// CapyQuest — bootstrap and game loop.
//
// Loop shape: a fixed-step simulation for income (so a stutter never loses or
// duplicates zen) and a free-running render pass. UI updates are throttled to
// ~15Hz because nobody can read a number that changes sixty times a second.

import { createState } from './state.js';
import { loadState, saveState, clearSave, freshState } from './save.js';
import { recomputeDerived } from './systems/stats.js';
import { ComboTracker, resolveClick } from './systems/clicker.js';
import { GoldenSpawner, windfallAmount } from './systems/golden.js';
import { checkAchievements, describeReward } from './systems/achievements.js';
import { buyBuilding, buyUpgrade } from './systems/shop.js';
import { audio } from './systems/audio.js';
import { offlineEarnings } from './balance.js';
import { Combat } from './systems/combat.js';
import { combatStats, xpForStage, resolveItem } from './systems/combatStats.js';
import { rollLoot, shardDrop, addToInventory, equip, scrap, forge, forgePrice, MAX_FORGE } from './systems/loot.js';
import { BattlePanel } from './ui/battlePanel.js';
import { GearPanel, itemDetailBody, slotPickerBody, skillPickerBody } from './ui/gearPanel.js';
import { SKILL_SLOTS } from './data/skills.js';
import { RARITY } from './render/palettes.js';
import { openModal, el } from './ui/modal.js';
import { MetaPanel } from './ui/metaPanel.js';
import { GachaPanel, pullResultsBody, companionDetailBody, partyPickerBody } from './ui/gachaPanel.js';
import { summon, buyTicket, ticketPrice, ownedCompanions, TEN_PULL } from './systems/gacha.js';
import { prestige, ascend, prestigePreview, ascendPreview, buyRelic, buyConstellation, PRESTIGE_MIN_ZEN } from './systems/prestige.js';
import { buyTalent, respec, availablePoints } from './systems/talents.js';
import { ticketsPerBoss } from './systems/meta.js';
import { COMPANIONS_BY_ID, PARTY_SIZE } from './data/companions.js';
import { DailyPanel } from './ui/dailyPanel.js';
import {
  rollQuests, claimQuest, questSummary, checkLogin, collectChests, chestsReady,
  claimPassLevel, unclaimedPassLevels, redeemCode,
} from './systems/quests.js';
import { grantReward, describeGrant } from './systems/rewards.js';
import { LOGIN_REWARDS } from './data/quests.js';
import { Scene } from './render/scene.js';
import { Hud } from './ui/hud.js';
import { BuildingList, UpgradeGrid } from './ui/shop.js';
import { AchievementPanel, StatsPanel, openSettings as openSettingsModal } from './ui/panels.js';
import { Toaster } from './ui/toast.js';
import { Tabs } from './ui/tabs.js';
import { openNapReport, shouldShowNapReport } from './ui/napReport.js';
import { fmt, fmtInt } from './ui/numbers.js';
import { isModalOpen, closeModal } from './ui/modal.js';

/** Zen earned before the quest line opens up. */
const QUEST_UNLOCK_ZEN = 5000;
/** The Bath tab appears a little before it is usable, so the goal is visible. */
const BATH_TEASE_ZEN = PRESTIGE_MIN_ZEN * 0.1;

const SIM_STEP_MS = 100; // ten income ticks a second is plenty
const UI_INTERVAL_MS = 66;
const SAVE_INTERVAL_MS = 10e3;
const ACHIEVEMENT_INTERVAL_MS = 500;
const MAX_CATCHUP_MS = 2000; // never simulate more than this in one frame

class Game {
  constructor() {
    this.state = loadState() || createState();
    // "One sitting" means this sitting — the counter is persisted only so a
    // reload mid-session does not lose the last few minutes of it.
    this.state.stats.sessionMs = 0;
    this.combo = new ComboTracker();
    this.golden = new GoldenSpawner();
    this.combat = new Combat(this.state);
    this.derived = recomputeDerived(this.state, { comboPoints: 0 });
    this.cstats = combatStats(this.state);

    this.accumulator = 0;
    this.lastFrame = performance.now();
    this.uiTimer = 0;
    this.saveTimer = 0;
    this.achTimer = 0;
    this.lastClickAt = performance.now();
    this.idleAccum = 0;
    this.newAchievements = 0;

    this.bindDom();
    this.applySettings();
    this.handleRetention();
    this.handleReturn();
    this.golden.start(Date.now(), this.derived.goldenChanceMult);

    requestAnimationFrame((t) => this.frame(t));
  }

  // ------------------------------------------------------------------ setup

  bindDom() {
    const $ = (id) => document.getElementById(id);

    this.refs = {
      zenValue: $('zenValue'),
      zpsValue: $('zpsValue'),
      clickValue: $('clickValue'),
      comboWrap: $('comboWrap'),
      comboFill: $('comboFill'),
      comboLabel: $('comboLabel'),
      buffList: $('buffList'),
      yuzuValue: $('yuzuValue'),
      lotusValue: $('lotusValue'),
      ticketValue: $('ticketValue'),
    };

    this.scene = new Scene($('scene'));
    this.hud = new Hud(this.refs);
    this.toaster = new Toaster($('toasts'));

    this.buildingList = new BuildingList($('buildingList'), {
      onBuy: (id) => this.onBuyBuilding(id),
    });
    this.upgradeGrid = new UpgradeGrid($('upgradeGrid'), {
      onBuy: (id) => this.onBuyUpgrade(id),
    });
    this.achievementPanel = new AchievementPanel($('achievementPanel'));
    this.statsPanel = new StatsPanel($('statsPanel'));

    this.questLocked = $('questLocked');
    this.kitLocked = $('kitLocked');
    this.battleRoot = $('battlePanel');
    this.gearRoot = $('gearPanel');

    this.battlePanel = new BattlePanel(this.battleRoot, {
      onToggleAuto: () => this.toggleAutoBattle(),
      onTravel: (dir) => this.travel(dir),
      onStance: (element) => this.setStance(element),
    });

    this.gearPanel = new GearPanel(this.gearRoot, {
      onEquip: (uid, slot, opts) => this.onGearInteract(uid, slot, opts),
      onUnequip: (slot) => this.unequipSlot(slot),
      onForge: (uid) => this.forgeItem(uid),
      onScrap: (uid) => this.scrapItem(uid),
      onSlotSkill: (index) => this.openSkillPicker(index),
    });

    this.summonLocked = $('summonLocked');
    this.bathLocked = $('bathLocked');
    this.gachaRoot = $('gachaPanel');
    this.metaRoot = $('metaPanel');

    this.gachaPanel = new GachaPanel(this.gachaRoot, {
      onPull: (n) => this.pull(n),
      onBuyTicket: () => this.buySummonTicket(),
      onInspect: (id, slot) => this.inspectCompanion(id, slot),
    });

    this.metaPanel = new MetaPanel(this.metaRoot, {
      onPrestige: () => this.confirmPrestige(),
      onAscend: () => this.confirmAscend(),
      onBuyRelic: (id) => this.purchaseRelic(id),
      onBuyStar: (id) => this.purchaseConstellation(id),
      onBuyTalent: (id) => this.purchaseTalent(id),
      onRespec: () => this.doRespec(),
    });

    this.dailyPanel = new DailyPanel($('dailyPanel'), {
      onClaimQuest: (id) => this.claimQuest(id),
      onCollectChest: () => this.collectChest(),
      onClaimPass: (level) => this.claimPass(level),
    });

    this.tabs = new Tabs($('tabs'), {
      generators: $('panel-generators'),
      upgrades: $('panel-upgrades'),
      quest: $('panel-quest'),
      kit: $('panel-kit'),
      daily: $('panel-daily'),
      summon: $('panel-summon'),
      bath: $('panel-bath'),
      achievements: $('panel-achievements'),
      stats: $('panel-stats'),
    }, {
      onChange: (tab) => {
        if (tab === 'achievements') this.newAchievements = 0;
        if (tab === 'kit') this.newGear = 0;
        if (tab === 'summon') this.newTickets = 0;
      },
    });
    this.newGear = 0;
    this.newTickets = 0;

    this.bindStage($('scene'));
    this.bindBuyAmount($('buyAmount'));

    $('settingsBtn').addEventListener('click', () => this.openSettings());

    // Space and Enter tap the capybara for keyboard players, but only when a
    // dialog is not holding focus.
    document.addEventListener('keydown', (e) => {
      if (e.code !== 'Space' && e.code !== 'Enter') return;
      if (isModalOpen()) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON') return;
      e.preventDefault();
      this.tapCapy();
    });

    // Persist on the way out — visibilitychange fires reliably on mobile where
    // beforeunload does not.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.save();
    });
    window.addEventListener('pagehide', () => this.save());
  }

  bindStage(canvas) {
    const handle = (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const hit = this.scene.hitTest(x, y);
      if (hit === 'golden') this.catchGolden(x, y);
      else if (hit === 'capy') this.tapCapy();
    };

    // Pointer events cover mouse, touch and pen in one path, and preventing the
    // default stops mobile double-tap-to-zoom from eating fast tapping.
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      handle(e.clientX, e.clientY);
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  bindBuyAmount(root) {
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-amount]');
      if (!btn) return;
      const raw = btn.dataset.amount;
      this.state.settings.buyAmount = raw === 'max' ? 'max' : Number(raw);
      this.refreshBuyAmount(root);
    });
    this.refreshBuyAmount(root);
  }

  refreshBuyAmount(root) {
    const current = String(this.state.settings.buyAmount);
    for (const btn of root.querySelectorAll('[data-amount]')) {
      const active = btn.dataset.amount === current;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
  }

  applySettings() {
    const s = this.state.settings;
    audio.setEnabled(s.sound);
    audio.setVolume(s.volume);
    // Respect the OS preference unless the player has explicitly opted in.
    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.scene.setReducedMotion(s.reducedMotion || prefersReduced);
    document.documentElement.dataset.motion = s.reducedMotion || prefersReduced ? 'reduced' : 'full';
  }

  // -------------------------------------------------------------- retention

  /** Roll quests and pay the login streak. Runs at boot and at midnight. */
  handleRetention(now = Date.now()) {
    const rolled = rollQuests(this.state, now);
    const login = checkLogin(this.state, now);

    if (login) {
      // Queued rather than shown immediately — the Nap Report opens on top of
      // this at boot, and two stacked modals is one too many.
      this.pendingLogin = login;
    }

    if (rolled.daily && this.state.stats.playMs > 0 && !login) {
      this.toaster.show({
        title: 'New day',
        body: 'Fresh quests are up.',
        kind: 'info',
        icon: '☀️',
      });
    }
    return rolled;
  }

  /** Show the login reward once nothing else is holding the screen. */
  flushPendingLogin() {
    if (!this.pendingLogin || isModalOpen()) return;
    const login = this.pendingLogin;
    this.pendingLogin = null;

    const grant = grantReward(this.state, login, this.derived);
    this.state.login.pendingDay = 0;
    audio.achievement();

    const body = el('div', 'login-reward');
    body.appendChild(
      el('p', 'login-reward__streak', `Day ${login.streak} · ${login.text}`),
    );
    body.appendChild(el('p', 'login-reward__grant', describeGrant(grant, fmt)));
    if (login.streak > 1) {
      body.appendChild(
        el('p', 'login-reward__note', `Come back tomorrow for day ${((login.streak) % LOGIN_REWARDS.length) + 1}.`),
      );
    }

    openModal({
      title: 'Welcome back',
      bodyNode: body,
      actions: [{ label: 'Thanks', variant: 'primary' }],
    });
    this.afterMetaChange();
  }

  claimQuest(id) {
    const reward = claimQuest(this.state, id);
    if (!reward) {
      audio.denied();
      return;
    }
    const grant = grantReward(this.state, reward, this.derived);
    this.state.stats.questsDone = (this.state.stats.questsDone || 0) + 1;
    audio.buy();
    this.toaster.show({
      title: 'Quest done',
      body: describeGrant(grant, fmt),
      kind: 'achievement',
      icon: '✅',
    });
    this.afterRetentionChange(grant);
  }

  collectChest() {
    const now = Date.now();
    const result = collectChests(this.state, now);
    if (!result) {
      audio.denied();
      return;
    }

    // Each chest pays a scaled bundle; several at once simply stack.
    let total = { zen: 0, tickets: 0, shards: 0, pass: 0, passLevels: null };
    for (let i = 0; i < result.count; i++) {
      const roll = { zenMult: 240, shards: 60, pass: 8, tickets: i === result.count - 1 && result.count >= 3 ? 1 : 0 };
      const grant = grantReward(this.state, roll, this.derived);
      total = {
        zen: total.zen + grant.zen,
        tickets: total.tickets + grant.tickets,
        shards: total.shards + grant.shards,
        pass: total.pass + grant.pass,
        passLevels: grant.passLevels || total.passLevels,
      };
    }

    this.state.stats.chestsOpened = (this.state.stats.chestsOpened || 0) + result.count;
    audio.golden();
    this.hud.pop();
    this.toaster.show({
      title: `${result.count} chest${result.count === 1 ? '' : 's'}`,
      body: describeGrant(total, fmt),
      kind: 'buff',
      icon: '🎁',
    });
    this.afterRetentionChange(total);
  }

  claimPass(level) {
    const reward = claimPassLevel(this.state, level);
    if (!reward) {
      audio.denied();
      return;
    }
    const grant = grantReward(this.state, reward, this.derived);
    audio.buy();
    this.toaster.show({
      title: `Pass level ${level}`,
      body: describeGrant(grant, fmt),
      kind: 'info',
      icon: '🎋',
    });
    this.afterRetentionChange(grant);
  }

  /** Repaint after a payout, and celebrate a pass level-up if one landed. */
  afterRetentionChange(grant) {
    if (grant?.passLevels) {
      this.toaster.show({
        title: `Zen Pass level ${grant.passLevels.to}`,
        body: 'New rewards to claim.',
        kind: 'achievement',
        icon: '🎋',
      });
      audio.levelUp();
    }
    this.derived = recomputeDerived(this.state, { comboPoints: this.combo.points });
    this.dailyPanel.update(this.state);
    this.save();
  }

  redeemSecretCode(input) {
    const result = redeemCode(this.state, input);
    if (!result.ok) {
      audio.denied();
      this.toaster.show({
        title: result.reason === 'used' ? 'Already redeemed' : 'No such code',
        body: result.reason === 'used' ? 'That one only works once.' : 'Nothing happened. Try another.',
        kind: 'warn',
      });
      return false;
    }
    const grant = grantReward(this.state, result.reward, this.derived);
    audio.golden();
    this.toaster.show({
      title: result.reward.text,
      body: describeGrant(grant, fmt),
      kind: 'buff',
      icon: '🔑',
    });
    this.afterRetentionChange(grant);
    return true;
  }

  // ----------------------------------------------------------------- return

  handleReturn() {
    const now = Date.now();
    const elapsed = now - (this.state.lastSeen || now);
    if (elapsed <= 0) return;

    const { zen, creditedMs, cappedMs } = offlineEarnings(this.derived.zps, elapsed, {
      capMs: this.derived.offlineCapMs,
      rate: this.derived.offlineRate,
    });

    if (!shouldShowNapReport(elapsed, zen)) {
      this.state.lastSeen = now;
      return;
    }

    // The bonus is a free choice, not a paywall or an ad — it just rewards
    // reading the report instead of dismissing it.
    const bonusZen = zen * 0.5;

    openNapReport({
      zen,
      elapsedMs: elapsed,
      creditedMs,
      cappedMs,
      bonusZen,
      onCollect: (amount) => this.collectNap(amount),
      onCollectBonus: (amount) => this.collectNap(amount, true),
    });
  }

  collectNap(amount, bonus = false) {
    this.earn(amount);
    this.state.stats.naps++;
    this.state.lastSeen = Date.now();
    audio.nap();
    this.toaster.show({
      title: bonus ? 'Well stretched' : 'Welcome back',
      body: `+${fmt(amount)} zen from the nap.`,
      kind: 'info',
      icon: '🛁',
    });
  }

  // ------------------------------------------------------------------- loop

  frame(timestamp) {
    // Clamping protects against a huge dt after the tab was backgrounded —
    // offline income is handled by the Nap Report, not by the loop.
    const dt = Math.min(timestamp - this.lastFrame, MAX_CATCHUP_MS);
    this.lastFrame = timestamp;

    this.simulate(dt);
    this.render(dt / 1000);

    requestAnimationFrame((t) => this.frame(t));
  }

  simulate(dtMs) {
    const now = Date.now();
    this.accumulator += dtMs;

    let steps = 0;
    while (this.accumulator >= SIM_STEP_MS && steps < 40) {
      this.tick(SIM_STEP_MS / 1000, now);
      this.accumulator -= SIM_STEP_MS;
      steps++;
    }
    if (steps >= 40) this.accumulator = 0; // give up on a huge backlog

    this.combo.tick(now);
    this.derived = recomputeDerived(this.state, { comboPoints: this.combo.points, now });
    this.cstats = combatStats(this.state);

    this.expireBuffs(now);
    this.maybeSpawnGolden(now);
    this.tickCombat(dtMs / 1000);

    this.uiTimer += dtMs;
    if (this.uiTimer >= UI_INTERVAL_MS) {
      this.updateUi(now);
      this.uiTimer = 0;
    }

    this.achTimer += dtMs;
    if (this.achTimer >= ACHIEVEMENT_INTERVAL_MS) {
      this.checkAchievements(now);
      // Catches midnight in a session left open overnight.
      this.handleRetention(now);
      this.flushPendingLogin();
      this.achTimer = 0;
    }

    this.saveTimer += dtMs;
    if (this.saveTimer >= SAVE_INTERVAL_MS) {
      this.save();
      this.saveTimer = 0;
    }
  }

  tick(dtSec, now) {
    const gained = this.derived.zps * dtSec;
    if (gained > 0) this.earn(gained);

    const dtMs = dtSec * 1000;
    this.state.stats.playMs += dtMs;
    this.state.stats.sessionMs += dtMs;
    this.state.stats.bestZps = Math.max(this.state.stats.bestZps, this.derived.zps);

    // Track the longest hands-off stretch for the Idle Hands achievement.
    this.idleAccum = now - this.lastClickAt;
    this.state.stats.bestIdleMs = Math.max(this.state.stats.bestIdleMs, this.idleAccum);
  }

  render(dtSec) {
    this.scene.update(dtSec);
    const frenzy = this.state.buffs.some((b) => b.id === 'frenzy' && b.until > Date.now());
    this.scene.draw({ frenzy });
  }

  updateUi(now) {
    this.hud.update(this.state, this.derived, this.combo, now);
    this.buildingList.update(this.state, this.derived);
    this.upgradeGrid.update(this.state);
    this.updateQuestVisibility();
    this.updateMetaVisibility();

    // Only the visible panel needs refreshing.
    if (this.tabs.current === 'achievements') this.achievementPanel.update(this.state);
    if (this.tabs.current === 'stats') this.statsPanel.update(this.state, this.derived, now);
    if (this.tabs.current === 'quest' && this.state.combat.unlocked) {
      this.battlePanel.update(this.state, this.combat, this.cstats);
    }
    if (this.tabs.current === 'kit' && this.state.combat.unlocked) {
      this.gearPanel.update(this.state, this.cstats);
    }
    if (this.tabs.current === 'summon' && this.summonUnlocked()) {
      this.gachaPanel.update(this.state);
    }
    if (this.tabs.current === 'bath' && this.bathUnlocked()) {
      this.metaPanel.update(this.state, this.cstats.level);
    }
    if (this.tabs.current === 'daily') {
      this.dailyPanel.update(this.state, now);
    }

    this.tabs.badge('achievements', this.newAchievements);
    this.tabs.badge('kit', this.newGear);
    this.tabs.badge('summon', this.newTickets);
    // The Daily badge is derived, not counted — it always reflects what is
    // actually claimable right now rather than what happened since you looked.
    this.tabs.badge(
      'daily',
      questSummary(this.state).ready + chestsReady(this.state, now) + unclaimedPassLevels(this.state),
    );
  }

  summonUnlocked() {
    const g = this.state.gacha;
    return g.tickets > 0 || g.pulls > 0 || Object.keys(g.companions).length > 0;
  }

  bathUnlocked() {
    return this.state.lifetimeZen >= BATH_TEASE_ZEN || this.state.prestigeCount > 0;
  }

  updateMetaVisibility() {
    const summon = this.summonUnlocked();
    this.summonLocked.hidden = summon;
    this.gachaRoot.hidden = !summon;

    const bath = this.bathUnlocked();
    this.bathLocked.hidden = bath;
    this.metaRoot.hidden = !bath;
  }

  updateQuestVisibility() {
    if (!this.state.combat.unlocked && this.state.totalZen >= QUEST_UNLOCK_ZEN) {
      this.state.combat.unlocked = true;
      this.toaster.show({
        title: 'The way downstream',
        body: 'Something is moving in the reeds. Open the Quest tab.',
        kind: 'achievement',
        icon: '🗺',
      });
      audio.achievement();
    }

    const on = this.state.combat.unlocked;
    this.questLocked.hidden = on;
    this.battleRoot.hidden = !on;
    this.kitLocked.hidden = on;
    this.gearRoot.hidden = !on;
  }

  // ----------------------------------------------------------------- combat

  tickCombat(dtSec) {
    if (!this.state.combat.unlocked || !this.state.combat.autoBattle) return;

    this.combat.update(dtSec, this.cstats, (result) => this.payoutStage(result));

    const events = this.combat.drainEvents();
    if (!events.length) return;

    this.battlePanel.consume(events);
    for (const ev of events) {
      if (ev.kind === 'hit' && ev.target === 'enemy' && this.tabs.current === 'quest') {
        this.battlePanel.showHit(ev);
      }
      if (ev.kind === 'cleared' && ev.enemy.boss) audio.levelUp();
      if (ev.kind === 'retreat') audio.denied();
    }
  }

  /** Pay out a cleared stage: zen, xp, shards and possibly a drop. */
  payoutStage({ stage, enemy }) {
    const s = this.state;

    const zen = enemy.reward * this.derived.globalMult;
    this.earn(zen);

    const gainedXp = xpForStage(stage, enemy.boss);
    const beforeLevel = this.cstats.level;
    s.combat.xp += gainedXp;

    s.combat.shards += shardDrop(stage, enemy.boss);

    // Bosses are the tap for summon tickets — one guaranteed, plus whatever
    // relics and constellations have added on top.
    if (enemy.boss) {
      const tickets = 1 + ticketsPerBoss(s);
      s.gacha.tickets += tickets;
      this.newTickets += tickets;
      this.toaster.show({
        title: `+${tickets} summon ticket${tickets === 1 ? '' : 's'}`,
        body: 'Somebody out there wants to meet you.',
        kind: 'buff',
        icon: '🎟',
      });
    }

    const drop = rollLoot(stage, { isBoss: enemy.boss, luck: this.cstats.luck });
    if (drop) this.awardGear(drop);

    // Recompute before reading the new level so the toast is not one behind.
    this.cstats = combatStats(s);
    if (this.cstats.level > beforeLevel) {
      s.stats.bestLevel = Math.max(s.stats.bestLevel, this.cstats.level);
      audio.levelUp();
      this.toaster.show({
        title: `Level ${this.cstats.level}`,
        body: 'Bigger. Rounder. Harder to argue with.',
        kind: 'achievement',
        icon: '⭐',
      });
    }
  }

  awardGear(itemDef) {
    const s = this.state;
    const entry = addToInventory(s, itemDef.id);
    if (!entry) return;

    s.stats.drops++;
    if (!s.stats.raritiesFound.includes(itemDef.rarity)) {
      s.stats.raritiesFound.push(itemDef.rarity);
    }
    this.newGear++;

    // Auto-equip into an empty slot so the first hour never requires a trip to
    // the menu to feel the reward.
    if (!s.combat.equipped[itemDef.slot]) {
      equip(s, entry.uid);
      this.cstats = combatStats(s);
    }

    // Only interrupt for something genuinely good — a toast per common drop
    // would be constant noise.
    if (['legendary', 'mythic', 'capybaric'].includes(itemDef.rarity)) {
      audio.golden();
      this.toaster.show({
        title: itemDef.name,
        body: `${RARITY[itemDef.rarity].name} — check your Kit.`,
        kind: 'buff',
        icon: '✨',
      });
    }
  }

  toggleAutoBattle() {
    const s = this.state.combat;
    s.autoBattle = !s.autoBattle;
    if (s.autoBattle) {
      this.combat.engage(this.cstats);
      this.battlePanel.logLine('Heading downstream.', 'skill');
    } else {
      this.battlePanel.logLine('Holding here.', '');
    }
    audio.buy();
  }

  travel(direction) {
    this.combat.travelTo(this.state.combat.stage + direction);
    if (this.state.combat.autoBattle) this.combat.engage(this.cstats);
    audio.buy();
  }

  setStance(element) {
    this.state.combat.element = element;
    if (!this.state.stats.stancesUsed.includes(element)) {
      this.state.stats.stancesUsed.push(element);
    }
    this.cstats = combatStats(this.state);
    audio.click(0.5);
  }

  // ------------------------------------------------------------------- gear

  onGearInteract(uid, slot, opts = {}) {
    if (opts.pick) return this.openSlotPicker(slot);
    if (opts.inspect) return this.openItemDetail(uid);
    return undefined;
  }

  openSlotPicker(slotId) {
    const body = slotPickerBody(this.state, slotId, (uid) => {
      equip(this.state, uid);
      this.afterGearChange();
      closeAndRefresh(this);
    });

    const equipped = this.state.combat.equipped[slotId];
    const actions = [{ label: 'Close' }];
    if (equipped) {
      actions.unshift({
        label: 'Take it off',
        onClick: () => {
          delete this.state.combat.equipped[slotId];
          this.afterGearChange();
        },
      });
    }
    openModal({ title: 'Choose a piece', bodyNode: body, actions });
  }

  openItemDetail(uid) {
    const entry = this.state.combat.inventory.find((i) => i.uid === uid);
    if (!entry) return;
    const item = resolveItem(entry);
    const equipped = Object.values(this.state.combat.equipped).includes(uid);

    const render = () =>
      itemDetailBody(resolveItem(entry), { equipped, shards: this.state.combat.shards });

    const actions = [];

    if ((entry.forge || 0) < MAX_FORGE) {
      actions.push({
        label: `Enhance (${forgePrice(entry)})`,
        variant: 'gold',
        onClick: () => {
          const result = forge(this.state, uid);
          if (!result.ok) {
            audio.denied();
            this.toaster.show({
              title: 'Not enough shards',
              body: 'Scrap something you are not using.',
              kind: 'warn',
            });
            return true; // keep the dialog open
          }
          this.state.stats.forges++;
          if (result.level >= MAX_FORGE) this.state.stats.maxForges++;
          audio.levelUp();
          this.afterGearChange();
          this.openItemDetail(uid); // reopen with the new numbers
          return true;
        },
      });
    }

    if (!equipped) {
      actions.push({
        label: 'Equip',
        variant: 'primary',
        onClick: () => {
          equip(this.state, uid);
          this.afterGearChange();
        },
      });
      actions.push({
        label: 'Scrap',
        variant: 'danger',
        onClick: () => {
          const result = scrap(this.state, uid);
          if (result.ok) {
            audio.buy();
            this.toaster.show({ title: 'Scrapped', body: `+${result.shards} shards.`, kind: 'info', icon: '🔧' });
          }
          this.afterGearChange();
        },
      });
    }

    actions.push({ label: 'Close' });
    openModal({ title: item.name, bodyNode: render(), actions });
  }

  openSkillPicker(index) {
    const body = skillPickerBody(this.state, (skillId) => {
      const skills = this.state.combat.skills;
      if (skillId === null) {
        skills.splice(index, 1);
      } else {
        // A skill can only occupy one slot; moving it clears the old one.
        const existing = skills.indexOf(skillId);
        if (existing >= 0) skills.splice(existing, 1);
        skills[index] = skillId;
      }
      this.state.combat.skills = skills.filter(Boolean).slice(0, SKILL_SLOTS);
      this.afterGearChange();
      closeAndRefresh(this);
    });
    openModal({ title: 'Slot a skill', bodyNode: body, actions: [{ label: 'Close' }] });
  }

  unequipSlot(slot) {
    delete this.state.combat.equipped[slot];
    this.afterGearChange();
  }

  forgeItem(uid) {
    forge(this.state, uid);
    this.afterGearChange();
  }

  scrapItem(uid) {
    scrap(this.state, uid);
    this.afterGearChange();
  }

  /** Gear changes move both stat blocks, so recompute and repaint both. */
  afterGearChange() {
    this.cstats = combatStats(this.state);
    this.derived = recomputeDerived(this.state, { comboPoints: this.combo.points });
    this.gearPanel.update(this.state, this.cstats);
    this.save();
  }

  /** Anything meta — a pull, a relic, a talent — moves both stat blocks too. */
  afterMetaChange() {
    this.cstats = combatStats(this.state);
    this.derived = recomputeDerived(this.state, { comboPoints: this.combo.points });
    if (this.summonUnlocked()) this.gachaPanel.update(this.state);
    if (this.bathUnlocked()) this.metaPanel.update(this.state, this.cstats.level);
    this.save();
  }

  // ------------------------------------------------------------------ gacha

  pull(count) {
    const results = summon(this.state, count);
    if (!results.length) {
      audio.denied();
      return;
    }

    const best = Math.max(...results.map((r) => r.star));
    if (best === 5) audio.golden();
    else if (best === 4) audio.levelUp();
    else audio.buy();

    // Auto-fill the party from what you own, so a first-time summoner gets the
    // benefit without having to find the party UI first.
    this.autoFillParty();
    this.afterMetaChange();

    openModal({
      title: results.length > 1 ? `${results.length} summons` : 'Summon',
      bodyNode: pullResultsBody(results),
      actions: [{ label: 'Nice', variant: 'primary' }],
      wide: results.length > 1,
    });

    for (const r of results.filter((x) => x.star === 5 && x.isNew)) {
      this.toaster.show({
        title: COMPANIONS_BY_ID[r.id].name,
        body: 'Five stars. Genuinely rare.',
        kind: 'achievement',
        icon: '⭐',
      });
    }
  }

  autoFillParty() {
    const g = this.state.gacha;
    if (g.party.length >= PARTY_SIZE) return;
    for (const companion of ownedCompanions(this.state)) {
      if (g.party.length >= PARTY_SIZE) break;
      if (!g.party.includes(companion.id)) g.party.push(companion.id);
    }
  }

  buySummonTicket() {
    const result = buyTicket(this.state);
    if (!result.ok) {
      audio.denied();
      this.toaster.show({
        title: 'Not enough zen',
        body: `A ticket costs ${fmt(ticketPrice(this.state))}.`,
        kind: 'warn',
      });
      return;
    }
    audio.buy();
    this.afterMetaChange();
  }

  /** Tapping a roster card inspects it; tapping a party slot opens the picker. */
  inspectCompanion(id, slot) {
    if (id === null) return this.openPartyPicker(slot);

    const def = COMPANIONS_BY_ID[id];
    const owned = this.state.gacha.companions[id];
    if (!def || !owned) return undefined;

    const companion = { ...def, level: owned.level, shards: owned.shards };
    const inParty = this.state.gacha.party.includes(id);

    const actions = [];
    if (inParty) {
      actions.push({
        label: 'Remove from party',
        onClick: () => {
          this.state.gacha.party = this.state.gacha.party.filter((x) => x !== id);
          this.afterMetaChange();
        },
      });
    } else if (this.state.gacha.party.length < PARTY_SIZE) {
      actions.push({
        label: 'Add to party',
        variant: 'primary',
        onClick: () => {
          this.state.gacha.party.push(id);
          this.afterMetaChange();
        },
      });
    }
    actions.push({ label: 'Close' });

    openModal({ title: def.name, bodyNode: companionDetailBody(companion, { inParty }), actions });
    return undefined;
  }

  openPartyPicker(slot) {
    const body = partyPickerBody(this.state, (id) => {
      const party = this.state.gacha.party.slice();
      if (id === null) {
        party.splice(slot, 1);
      } else {
        const existing = party.indexOf(id);
        if (existing >= 0) party.splice(existing, 1);
        party[slot] = id;
      }
      this.state.gacha.party = party.filter(Boolean).slice(0, PARTY_SIZE);
      closeModal();
      this.afterMetaChange();
    });
    openModal({ title: 'Choose a capybara', bodyNode: body, actions: [{ label: 'Close' }] });
  }

  // --------------------------------------------------------------- prestige

  confirmPrestige() {
    const preview = prestigePreview(this.state);
    if (!preview.canPrestige) {
      audio.denied();
      return;
    }

    const body = el('div', 'confirm');
    body.appendChild(el('p', 'confirm__gain', `+${fmtInt(preview.yuzu)} yuzu`));
    body.appendChild(el('p', 'confirm__lead', 'You lose:'));
    body.appendChild(list(['zen in hand', 'every generator', 'every tap and generator upgrade']));
    body.appendChild(el('p', 'confirm__lead', 'You keep:'));
    body.appendChild(
      list([
        'all relics, and the yuzu you are about to earn',
        'your whole quest run — stage, level, gear and skills',
        'every companion, trophy and talent point',
      ]),
    );

    openModal({
      title: 'Take the Yuzu Bath?',
      bodyNode: body,
      actions: [
        { label: 'Not yet' },
        { label: `Take the bath`, variant: 'gold', onClick: () => this.doPrestige() },
      ],
    });
  }

  doPrestige() {
    const result = prestige(this.state);
    if (!result.ok) return;

    this.combo.reset();
    this.scene.particles.clear();
    this.scene.clearGolden();
    this.golden.start(Date.now(), 1);
    this.afterMetaChange();
    this.buildingList.update(this.state, this.derived);
    this.upgradeGrid.update(this.state);

    audio.levelUp();
    this.toaster.show({
      title: 'A very long soak',
      body: `+${fmtInt(result.gained)} yuzu. The pond is quiet again.`,
      kind: 'achievement',
      icon: '🍋',
    });
  }

  confirmAscend() {
    const preview = ascendPreview(this.state);
    if (!preview.canAscend) {
      audio.denied();
      return;
    }

    const body = el('div', 'confirm');
    body.appendChild(el('p', 'confirm__gain', `+${fmtInt(preview.lotus)} lotus`));
    body.appendChild(el('p', 'confirm__lead', 'Ascending takes more than a bath. You lose:'));
    body.appendChild(list(['everything prestige takes', 'all your yuzu', 'every relic you bought']));
    body.appendChild(el('p', 'confirm__lead', 'You keep:'));
    body.appendChild(list(['all constellations, and the lotus you are about to earn', 'every companion and trophy']));
    body.appendChild(
      el('p', 'confirm__warn', 'This is not reversible. Constellations are strong enough to be worth it.'),
    );

    openModal({
      title: 'Reach the Still Point?',
      bodyNode: body,
      actions: [
        { label: 'Stay here' },
        { label: 'Ascend', variant: 'danger', onClick: () => this.doAscend() },
      ],
    });
  }

  doAscend() {
    const result = ascend(this.state);
    if (!result.ok) return;

    this.combo.reset();
    this.scene.particles.clear();
    this.scene.clearGolden();
    this.golden.start(Date.now(), 1);
    this.combat = new Combat(this.state);
    this.afterMetaChange();
    this.buildingList.update(this.state, this.derived);
    this.upgradeGrid.update(this.state);

    audio.achievement();
    this.toaster.show({
      title: 'The Still Point',
      body: `+${fmtInt(result.gained)} lotus. Everything begins again, larger.`,
      kind: 'achievement',
      icon: '🪷',
    });
  }

  // ----------------------------------------------------- relics and talents

  purchaseRelic(id) {
    const result = buyRelic(this.state, id);
    if (!result.ok) {
      audio.denied();
      return;
    }
    audio.buy();
    this.afterMetaChange();
  }

  purchaseConstellation(id) {
    const result = buyConstellation(this.state, id);
    if (!result.ok) {
      audio.denied();
      return;
    }
    audio.levelUp();
    this.afterMetaChange();
  }

  purchaseTalent(id) {
    const result = buyTalent(this.state, id, this.cstats.level);
    if (!result.ok) {
      audio.denied();
      return;
    }
    audio.buy();
    this.afterMetaChange();
  }

  doRespec() {
    const points = availablePoints(this.state, this.cstats.level);
    const body = el('div', 'confirm');
    body.appendChild(
      el('p', 'confirm__lead', 'Every talent point comes back and the tree resets. Costs nothing.'),
    );
    openModal({
      title: 'Respec the tree?',
      bodyNode: body,
      actions: [
        { label: 'Leave it' },
        {
          label: 'Reset it',
          variant: 'primary',
          onClick: () => {
            const result = respec(this.state);
            audio.buy();
            this.afterMetaChange();
            this.toaster.show({
              title: 'Tree reset',
              body: `${result.refunded + points} points to spend.`,
              kind: 'info',
              icon: '🌱',
            });
          },
        },
      ],
    });
  }

  // --------------------------------------------------------------- gameplay

  earn(amount) {
    if (!(amount > 0)) return;
    this.state.zen += amount;
    this.state.lifetimeZen += amount;
    this.state.totalZen += amount;
  }

  tapCapy() {
    const now = Date.now();
    this.combo.hit(now, this.derived.comboCap);
    this.lastClickAt = now;

    // Recompute immediately so this tap is paid at the combo it just created.
    this.derived = recomputeDerived(this.state, { comboPoints: this.combo.points, now });

    const { amount, crit } = resolveClick(this.derived);
    this.earn(amount);
    this.state.lifetimeClicks++;
    this.state.stats.handmadeZen += amount;
    this.state.stats.bestCombo = Math.max(this.state.stats.bestCombo, this.combo.points);
    if (crit) this.state.stats.crits++;

    const frenzy = this.derived.buffMult > 1;
    this.scene.tap({ crit, frenzy });

    // Numbers rise from above the capybara's head, not from the cursor. Every
    // tap lands in the same place, so spawning at the hit point would stack the
    // whole streak over its face and hide the thing you are here to look at.
    const box = this.scene.capyBox;
    this.scene.particles.float(box.x, box.y - box.r * 0.95, `+${fmt(amount)}`, {
      color: crit ? '#ffe08a' : '#fdf6e8',
      size: crit ? 24 : 16,
      life: crit ? 1.2 : 0.85,
    });

    if (crit) audio.crit();
    else audio.click(this.combo.points / Math.max(1, this.derived.comboCap));

    if (crit) this.hud.pop();
  }

  catchGolden(x, y) {
    const buff = this.golden.rollBuff();
    this.scene.clearGolden();
    this.golden.schedule(Date.now(), this.derived.goldenChanceMult);
    this.state.stats.goldens++;
    audio.golden();

    this.scene.particles.burst(x, y, {
      count: 30,
      colors: ['#f7c948', '#fff7d6', '#ffe08a'],
      speed: 300,
      life: 0.9,
      size: 4,
    });
    this.scene.particles.addShake(11);

    if (buff.instant) {
      const amount = windfallAmount(this.derived.zps, this.derived.clickValue);
      this.earn(amount);
      this.scene.particles.float(x, y - 20, `+${fmt(amount)}`, { color: '#ffe08a', size: 26, life: 1.5 });
      this.hud.pop();
      this.toaster.show({ title: buff.name, body: `+${fmt(amount)} zen, out of nowhere.`, kind: 'buff', icon: '✨' });
      return;
    }

    const now = Date.now();
    const duration = buff.durationMs * this.derived.goldenDurationMult;
    // Re-catching the same buff extends it rather than stacking a duplicate.
    const existing = this.state.buffs.find((b) => b.id === buff.id && b.until > now);
    if (existing) existing.until += duration;
    else this.state.buffs.push({ id: buff.id, name: buff.name, until: now + duration, effects: buff.effects });

    this.toaster.show({ title: buff.name, body: buff.blurb, kind: 'buff', icon: '✨' });
  }

  maybeSpawnGolden(now) {
    if (!this.golden.shouldSpawn(now)) return;
    const rect = this.scene.canvas.getBoundingClientRect();
    if (rect.width < 20 || rect.height < 20) return; // canvas not laid out yet
    this.golden.markSpawned();
    this.scene.spawnGolden(this.golden.visibleMs(this.derived.goldenDurationMult) / 1000, rect.width, rect.height);

    // If it wanders off uncaught, quietly queue the next one.
    setTimeout(() => {
      if (this.scene.golden) return;
      if (!this.golden.scheduled) this.golden.schedule(Date.now(), this.derived.goldenChanceMult);
    }, this.golden.visibleMs(this.derived.goldenDurationMult) + 200);
  }

  expireBuffs(now) {
    const before = this.state.buffs.length;
    this.state.buffs = this.state.buffs.filter((b) => b.until > now);
    if (this.state.buffs.length !== before) {
      this.derived = recomputeDerived(this.state, { comboPoints: this.combo.points, now });
    }
  }

  checkAchievements(now) {
    const unlocked = checkAchievements(this.state, now);
    if (!unlocked.length) return;

    this.newAchievements += unlocked.length;
    audio.achievement();
    for (const ach of unlocked) {
      this.toaster.show({
        title: ach.name,
        body: describeReward(ach.reward) || ach.blurb,
        kind: 'achievement',
        icon: '🏆',
      });
    }
    this.derived = recomputeDerived(this.state, { comboPoints: this.combo.points, now });
  }

  // ----------------------------------------------------------------- buying

  onBuyBuilding(id) {
    const result = buyBuilding(this.state, id, this.state.settings.buyAmount, this.derived.costDiscount);
    if (!result.ok) {
      audio.denied();
      return;
    }
    audio.buy();
    this.state.stats.buildingsBought = (this.state.stats.buildingsBought || 0) + result.count;
    this.derived = recomputeDerived(this.state, { comboPoints: this.combo.points });
    this.buildingList.update(this.state, this.derived);
    this.upgradeGrid.update(this.state);
  }

  onBuyUpgrade(id) {
    const result = buyUpgrade(this.state, id);
    if (!result.ok) {
      audio.denied();
      return;
    }
    audio.levelUp();
    this.state.stats.upgradesBought = (this.state.stats.upgradesBought || 0) + 1;
    this.toaster.show({ title: result.upgrade.name, body: result.upgrade.blurb, kind: 'info', icon: '⬆' });
    this.derived = recomputeDerived(this.state, { comboPoints: this.combo.points });
    this.upgradeGrid.update(this.state);
    this.buildingList.update(this.state, this.derived);
  }

  // --------------------------------------------------------------- settings

  openSettings() {
    openSettingsModal(this.state, {
      toaster: this.toaster,
      onCode: (input) => this.redeemSecretCode(input),
      onChange: (loaded) => {
        if (loaded) {
          this.state = loaded;
          this.combo.reset();
          this.scene.particles.clear();
        }
        this.applySettings();
        this.derived = recomputeDerived(this.state, { comboPoints: this.combo.points });
        this.save();
      },
      onReset: () => {
        clearSave();
        this.state = freshState();
        this.combo.reset();
        this.scene.particles.clear();
        this.scene.clearGolden();
        this.golden.start(Date.now());
        this.derived = recomputeDerived(this.state, { comboPoints: 0 });
        this.applySettings();
        this.save();
        this.toaster.show({ title: 'A fresh pond', body: 'Everything is quiet again.', kind: 'info', icon: '🌱' });
      },
    });
  }

  save() {
    saveState(this.state);
  }
}

/** Close the open dialog and repaint the kit — used by the picker callbacks. */
function closeAndRefresh(game) {
  closeModal();
  game.gearPanel.update(game.state, game.cstats);
}

/** Bulleted list for the confirmation dialogs. */
function list(items) {
  const ul = document.createElement('ul');
  ul.className = 'confirm__list';
  for (const text of items) {
    const li = document.createElement('li');
    li.textContent = text;
    ul.appendChild(li);
  }
  return ul;
}

// The module is deferred, so the DOM is parsed by the time this runs.
window.capyquest = new Game();
