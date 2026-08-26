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
import {
  rollLoot, shardDrop, addToInventory, equip, scrap, forge, forgePrice,
  refine, fuse, canRefine, canFuse, fuseFodder, leafDrop, MAX_FORGE,
} from './systems/loot.js';
import { BattlePanel } from './ui/battlePanel.js';
import { GearPanel, itemDetailBody, slotPickerBody, skillPickerBody } from './ui/gearPanel.js';
import { SKILL_SLOTS } from './data/skills.js';
import { rarityFor, MAX_TIER, MAX_STARS } from './data/rarities.js';
import { openModal, el } from './ui/modal.js';
import { RebirthPanel } from './ui/rebirthPanel.js';
import { StorePanel, caseRevealBody } from './ui/storePanel.js';
import {
  GachaPanel, pullResultsBody, companionDetailBody, partyPickerBody,
  crewGearPickerBody, crewHatPickerBody,
} from './ui/gachaPanel.js';
import { summon, buyTicket, ticketPrice, ownedCompanions, partyMembers, TEN_PULL } from './systems/gacha.js';
import { rebirth, rebirthPreview, noteWall } from './systems/rebirth.js';
import { ascend, ascendPreview, buyConstellation } from './systems/ascension.js';
import { buyNode, respec, hasKeystone, takeKeystone, dropKeystone } from './systems/tree.js';
import { KEYSTONE_COST, KEYSTONE_GATE } from './data/keystones.js';
import { openCase } from './systems/cases.js';
import { buyBoost, buyLeafPack, claimDailyLeafs, dailyLeafsReady, SIMULATED_NOTICE } from './systems/store.js';
import { buyCosmetic, checkUnlocks, equipCosmetic, equipped, owns } from './systems/cosmetics.js';
import { boostById, cosmeticById, leafPackById } from './content/registry.js';
import { loadContent } from './content/load.js';
import { adminRequested, openAdminPanel } from './ui/adminPanel.js';
import { ticketsPerBoss } from './systems/meta.js';
import { COMPANIONS_BY_ID, PARTY_SIZE } from './data/companions.js';
import {
  addCrewItem, crewEquipped, crewHat, equipCrewItem, resolveCrewItem, rollCrewLoot,
  setCrewHat, unequipCrewItem,
} from './systems/crew.js';
import { DailyPanel } from './ui/dailyPanel.js';
import {
  rollQuests, claimQuest, questSummary, checkLogin, collectChests, chestsReady, redeemCode,
  activeQuests, chooseQuest, rerollQuests,
} from './systems/quests.js';
import { REROLL_COST } from './data/quests.js';
import { bracketStatus, claimBracket, enterBracket } from './systems/bracket.js';
import {
  checkRollover, claimPassLevel, unclaimedPassLevels, passTrack,
  passXpForClear, addPassXp, unlockPremium,
} from './systems/season.js';
import { SeasonPanel } from './ui/seasonPanel.js';
import { LeaderboardPanel, rivalBody } from './ui/leaderboardPanel.js';
import { Dialogue } from './ui/dialogue.js';
import { playCutscene, cutsceneOpen } from './ui/cutscene.js';
import { showCoachmark, closeCoachmark, coachmarkOpen } from './ui/coachmark.js';
import { ProfileCard, beatBody, renameBody, titlePickerBody, wardrobeBody } from './ui/profilePanel.js';
import { nextStep, markStep } from './systems/onboarding.js';
import { displayName, setName } from './systems/profile.js';
import { nextBeat, markSeen, beat as storyBeat } from './systems/story.js';
import { HOSTILE_CAPYBARAS } from './data/capybaras.js';
import { leaderboard, rivalsFor } from './systems/leaderboard.js';
import { activeEvent, syncEvent, addPetals, petalsForClear, exchange } from './systems/events.js';
import { PREMIUM_PRICE, PREMIUM_LEAFS } from './data/pass.js';
import { grantReward, describeGrant } from './systems/rewards.js';
import { LOGIN_REWARDS } from './data/quests.js';
import { Scene } from './render/scene.js';
import { Hud } from './ui/hud.js';
import { BuildingList, UpgradeGrid } from './ui/shop.js';
import { AchievementPanel, StatsPanel, openSettings as openSettingsModal } from './ui/panels.js';
import { Toaster } from './ui/toast.js';
import { Tabs } from './ui/tabs.js';
import { openNapReport, shouldShowNapReport } from './ui/napReport.js';
import { CachePanel } from './ui/cachePanel.js';
import { cacheInfo, collectCache, fillCache, MIN_CACHE_MS } from './systems/cache.js';
import { fmt, fmtInt } from './ui/numbers.js';
import { isModalOpen, closeModal } from './ui/modal.js';

/** Zen earned before the quest line opens up. */
/**
 * Lifetime zen before the way downstream opens.
 *
 * Was 5,000, which a simulated player reached at seven and a half minutes —
 * and the six minutes before it contained one upgrade and one generator. The
 * clicker is not the game, it is the doorway to the game, and a doorway that
 * takes seven minutes is a wall. At 1,000 it opens around three minutes, which
 * is roughly the second time a new player looks up.
 */
const QUEST_UNLOCK_ZEN = 1000;
/** The Rebirth tab appears once there is a run deep enough to be worth resetting. */
const REBIRTH_TEASE_DEPTH = 20;

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
    this.maybeOpen();
    this.handleReturn();
    this.golden.start(Date.now(), this.derived.goldenChanceMult);
    if (adminRequested()) this.openAdminWhenClear();

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
      essenceValue: $('essenceValue'),
      leafValue: $('leafValue'),
      lotusValue: $('lotusValue'),
      ticketValue: $('ticketValue'),
    };

    this.scene = new Scene($('scene'));
    // Over the scene, not over the game: a beat never stops anything.
    this.dialogue = new Dialogue(document.querySelector('.stage'), {
      onDone: (beat) => {
        markSeen(this.state, beat.id);
        this.save();
      },
    });
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
    this.cachePanel = new CachePanel($('cachePanel'), {
      onCollect: () => this.collectNap(),
    });
    this.profileCard = new ProfileCard($('profilePanel'), {
      onRename: () => this.renameProfile(),
      onWardrobe: () => this.openWardrobe(),
      onPickTitle: () => this.pickLook('title'),
      onReadBeat: (id) => this.readBeat(id),
    });

    this.questLocked = $('questLocked');
    this.kitLocked = $('kitLocked');
    this.battleRoot = $('battlePanel');
    this.gearRoot = $('gearPanel');

    this.battlePanel = new BattlePanel(this.battleRoot, {
      onToggleAuto: () => this.toggleAutoBattle(),
      onTravel: (dir) => this.travel(dir),
      onStance: (element) => this.setStance(element),
      onCast: (index) => this.castSkill(index),
      onToggleAutoCast: () => this.toggleAutoCast(),
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

    this.metaPanel = new RebirthPanel(this.metaRoot, {
      onRebirth: () => this.confirmRebirth(),
      onAscend: () => this.confirmAscend(),
      onBuyStar: (id) => this.purchaseConstellation(id),
      onBuyNode: (id) => this.purchaseNode(id),
      onRespec: () => this.doRespec(),
      onKeystone: (id) => this.toggleKeystone(id),
    });

    this.storePanel = new StorePanel($('storePanel'), {
      onClaimDaily: () => this.claimDailyLeafs(),
      onOpenCase: (id) => this.openCase(id),
      onBuyBoost: (id) => this.purchaseBoost(id),
      onBuyPack: (id) => this.purchaseLeafPack(id),
      onLook: (kind, id) => this.chooseLook(kind, id),
    });

    this.dailyPanel = new DailyPanel($('dailyPanel'), {
      onClaimQuest: (id) => this.claimQuest(id),
      onCollectChest: () => this.collectChest(),
      onChooseQuest: (id, kind) => this.pickQuest(id, kind),
      onReroll: (kind) => this.rerollOffer(kind),
      onClaimAll: () => this.claimAllQuests(),
    });

    this.leaderboardPanel = new LeaderboardPanel($('leaderboardPanel'), {
      onInspect: (id) => this.inspectRival(id),
      onExchange: (id) => this.exchangePetals(id),
      onBracket: () => this.doBracket(),
    });

    this.seasonPanel = new SeasonPanel($('seasonPanel'), {
      onClaim: (level, track) => this.claimPass(level, track),
      onClaimAll: () => this.claimAllPass(),
      onBuyPremiumPrice: () => this.confirmPremiumPrice(),
      onBuyPremiumLeafs: () => this.buyPremiumWithLeafs(),
    });

    this.tabs = new Tabs($('tabs'), {
      generators: $('panel-generators'),
      upgrades: $('panel-upgrades'),
      quest: $('panel-quest'),
      kit: $('panel-kit'),
      daily: $('panel-daily'),
      summon: $('panel-summon'),
      rebirth: $('panel-rebirth'),
      store: $('panel-store'),
      season: $('panel-season'),
      rivals: $('panel-rivals'),
      achievements: $('panel-achievements'),
      stats: $('panel-stats'),
    }, {
      subnav: $('subtabs'),
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
      if (isModalOpen()) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      // 1/2/3 cast the slotted skills. Only on the Quest tab, so the digits
      // stay free everywhere else.
      if (this.tabs.current === 'quest' && ['Digit1', 'Digit2', 'Digit3'].includes(e.code)) {
        e.preventDefault();
        this.castSkill(Number(e.code.slice(-1)) - 1);
        return;
      }

      if (e.code !== 'Space' && e.code !== 'Enter') return;
      if (tag === 'BUTTON') return;
      e.preventDefault();
      // Space is brace-or-tap: during a wind-up it reads the tell, otherwise it
      // is the tap it has always been. One key, whichever the moment wants.
      if (this.braceHit()) return;
      this.tapCapy();
    });

    // Persist on the way out — visibilitychange fires reliably on mobile where
    // beforeunload does not.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.hiddenAt = Date.now();
        this.save();
        audio.stopMusic();
      } else {
        this.handleWake();
      }
      this.updateMusic();
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
      else if (hit?.startsWith('companion:')) this.inspectCompanion(hit.slice('companion:'.length));
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
    this.applyCosmetics();
    const s = this.state.settings;
    audio.setEnabled(s.sound);
    audio.setVolume(s.volume);
    audio.setMusicEnabled(s.music);
    this.updateMusic();
    // Respect the OS preference unless the player has explicitly opted in.
    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.scene.setReducedMotion(s.reducedMotion || prefersReduced);
    document.documentElement.dataset.motion = s.reducedMotion || prefersReduced ? 'reduced' : 'full';
  }

  /**
   * Which of the three loops belongs to what is happening.
   *
   * Driven from state rather than fired at transitions, because a transition
   * can be missed — reloading mid-boss, or coming back to a tab — and then the
   * pond theme plays over a boss fight until the next one happens to fire.
   * playMusic() is idempotent, so calling it every tick costs nothing.
   */
  updateMusic() {
    if (!this.state.settings.music || document.visibilityState === 'hidden') {
      audio.stopMusic();
      return;
    }
    const fighting = this.state.combat.unlocked
      && this.state.combat.autoBattle
      && this.tabs.current === 'quest';
    const boss = fighting && !!this.combat.enemy?.boss;
    audio.playMusic(boss ? 'boss' : fighting ? 'descent' : 'pond');
  }

  // -------------------------------------------------------------- retention

  /** Roll quests, pay the login streak, roll the season. Boot and midnight. */
  handleRetention(now = Date.now()) {
    const rolled = rollQuests(this.state, now);
    const login = checkLogin(this.state, now);
    const rolledSeason = checkRollover(this.state, now);
    const expired = syncEvent(this.state, now);
    this.boardCache = null;

    if (expired) {
      this.toaster.show({
        title: `${expired.name} is over`,
        body: `${expired.petals} petals went with it. That is what petals do.`,
        kind: 'info',
        icon: '🌸',
      });
    }

    if (rolledSeason) {
      this.toaster.show({
        title: rolledSeason.to.name,
        body: `A new season. Last one you reached pass level ${rolledSeason.from.level}; every look it gave you is still yours.`,
        kind: 'achievement',
        icon: '🎋',
      });
    }

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
    if (!this.pendingLogin || isModalOpen() || cutsceneOpen()) return;
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

  /** Take one of the offered quests into a slot. */
  pickQuest(id, kind) {
    const out = chooseQuest(this.state, id, kind);
    if (!out.ok) {
      audio.denied();
      return;
    }
    audio.buy();
    if (out.remaining === 0) {
      this.toaster.show({
        title: kind === 'daily' ? 'Your day is set' : 'Your week is set',
        body: 'Those are the ones. They settle now.',
        kind: 'info',
        icon: '✅',
      });
    }
    this.save();
  }

  rerollOffer(kind) {
    const out = rerollQuests(this.state, kind);
    if (!out.ok) {
      audio.denied();
      if (out.reason === 'poor') {
        this.toaster.show({
          title: 'Not enough leafs',
          body: `A fresh offer costs ${REROLL_COST}.`,
          kind: 'warn',
          icon: '🍃',
        });
      }
      return;
    }
    audio.buy();
    this.save();
  }

  /** Everything finished, in one tap instead of a column of identical ones. */
  claimAllQuests() {
    const ready = activeQuests(this.state).filter((q) => q.done && !q.claimed);
    if (!ready.length) return;
    for (const quest of ready) this.claimQuest(quest.id, { quiet: true });

    audio.achievement();
    this.toaster.show({
      title: `${ready.length} quests done`,
      body: 'All collected.',
      kind: 'achievement',
      icon: '✅',
    });
  }

  claimQuest(id, { quiet = false } = {}) {
    const reward = claimQuest(this.state, id);
    if (!reward) {
      audio.denied();
      return;
    }
    const grant = grantReward(this.state, reward, this.derived);
    this.state.stats.questsDone = (this.state.stats.questsDone || 0) + 1;
    if (quiet) return;
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

  claimPass(level, track) {
    const result = claimPassLevel(this.state, level, track);
    if (!result.ok) {
      audio.denied();
      return;
    }
    const grant = grantReward(this.state, result.reward, this.derived);
    audio.buy();
    this.toaster.show({
      title: `${track === 'premium' ? 'Premium' : 'Free'} level ${level}`,
      body: result.reward.cosmetic ? result.reward.text : describeGrant(grant, fmt),
      kind: 'info',
      icon: '🎋',
    });
    this.afterRetentionChange(grant);
    this.seasonPanel.update(this.state);
  }

  /**
   * A hundred levels across two tracks is too many to claim one at a time, so
   * the panel offers to take the lot. Each one still goes through claimPass's
   * checks — this only saves the tapping.
   */
  claimAllPass() {
    let count = 0;
    for (const row of passTrack(this.state)) {
      for (const track of ['free', 'premium']) {
        if (!row[track].claimable) continue;
        const result = claimPassLevel(this.state, row.level, track);
        if (!result.ok) continue;
        grantReward(this.state, result.reward, this.derived);
        count++;
      }
    }
    if (!count) {
      audio.denied();
      return;
    }
    audio.levelUp();
    this.afterRetentionChange({});
    this.checkCosmeticUnlocks();
    this.seasonPanel.update(this.state);
    this.toaster.show({
      title: `${count} reward${count === 1 ? '' : 's'} claimed`,
      body: 'Everything on the track, collected.',
      kind: 'buff',
      icon: '🎋',
    });
  }

  /**
   * Simulated, exactly like the leaf packs. See systems/store.js — PAYMENTS is
   * false, nothing is charged, and the dialog says so before the button rather
   * than after it.
   */
  confirmPremiumPrice() {
    const body = el('div', 'confirm');
    body.appendChild(el('p', 'confirm__gain', 'Premium track'));
    body.appendChild(el('p', 'confirm__warn', SIMULATED_NOTICE));
    body.appendChild(
      el(
        'p',
        'confirm__lead',
        `The ${PREMIUM_PRICE} is a price tag, not a price. Nothing asks for a card and nothing is charged — this simply unlocks the track. If you would rather pay in something the game actually has, it is also ${fmtInt(PREMIUM_LEAFS)} leafs.`,
      ),
    );

    openModal({
      title: 'Unlock the premium track?',
      bodyNode: body,
      actions: [
        { label: 'Not now' },
        {
          label: 'Unlock it',
          variant: 'gold',
          onClick: () => this.grantPremium({ leafs: false }),
        },
      ],
    });
  }

  buyPremiumWithLeafs() {
    this.grantPremium({ leafs: true });
  }

  grantPremium({ leafs }) {
    const result = unlockPremium(this.state, { leafs });
    if (!result.ok) {
      audio.denied();
      return;
    }
    audio.golden();
    this.afterRetentionChange({});
    this.seasonPanel.update(this.state);
    this.toaster.show({
      title: 'Premium track unlocked',
      body: 'Everything you have already passed is waiting on it.',
      kind: 'achievement',
      icon: '🎋',
    });
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

  /**
   * The opening cutscene, once. A save that has played anything at all is not a
   * new player — someone importing a code onto a new device should land in their
   * pond, not in a story they have already had.
   */
  maybeOpen() {
    if (this.state.story.onboarded) return;

    if (this.state.lifetimeClicks > 0 || this.state.totalZen > 0) {
      this.state.story.onboarded = true;
      this.save();
      return;
    }

    playCutscene({
      onDone: () => {
        this.state.story.onboarded = true;
        this.save();
      },
    });
  }

  // ----------------------------------------------------------------- return

  handleReturn() {
    const now = Date.now();
    const elapsed = now - (this.state.lastSeen || now);
    this.state.lastSeen = now;
    if (elapsed <= 0) return;

    const capMs = this.derived.offlineCapMs;
    const { zen, creditedMs, lostMs } = fillCache(this.state, {
      zps: this.derived.zps,
      elapsedMs: elapsed,
      capMs,
      rate: this.derived.offlineRate,
    });

    // Below the threshold the cache still keeps what it took; it just is not
    // worth opening a modal over. Nothing is discarded either way.
    if (!shouldShowNapReport(elapsed, zen)) return;

    const bonusZen = this.state.cache.zen * 0.5;

    openNapReport({
      zen: this.state.cache.zen,
      elapsedMs: elapsed,
      creditedMs,
      cappedMs: lostMs,
      capMs,
      bonusZen,
      onCollect: () => this.collectNap(),
      onCollectBonus: () => this.collectNap(true),
      onLeave: () => this.save(),
    });
  }

  /**
   * Time spent with the tab backgrounded used to vanish outright: the frame
   * loop clamps a huge dt, and the return path only runs at boot. Now it goes
   * into the cache like any other time away, and the meter has it waiting.
   */
  handleWake() {
    const now = Date.now();
    const elapsed = now - (this.hiddenAt || now);
    this.hiddenAt = 0;
    if (elapsed < MIN_CACHE_MS) return;

    const { zen } = fillCache(this.state, {
      zps: this.derived.zps,
      elapsedMs: elapsed,
      capMs: this.derived.offlineCapMs,
      rate: this.derived.offlineRate,
    });
    if (zen <= 0) return;

    // A toast rather than the modal: you never left, and interrupting a tab
    // you just came back to would read as a nag.
    this.toaster.show({
      title: 'The cache filled',
      body: `+${fmt(zen)} zen waiting in the pond.`,
      kind: 'info',
      icon: '🪣',
    });
    this.save();
  }

  collectNap(bonus = false) {
    const info = cacheInfo(this.state, this.derived);
    if (info.zen <= 0) return;

    const { zen } = collectCache(this.state);
    const amount = bonus ? zen * 1.5 : zen;

    this.earn(amount);
    this.state.stats.naps++;
    this.state.stats.cacheZen += amount;
    this.state.stats.bestCache = Math.max(this.state.stats.bestCache, amount);
    this.state.lastSeen = Date.now();
    audio.nap();
    this.toaster.show({
      title: bonus ? 'Well stretched' : 'Welcome back',
      body: `+${fmt(amount)} zen from the nap.`,
      kind: 'info',
      icon: '🛁',
    });
    this.save();
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
    // Cheap once it has fired: noteWall() returns immediately on a state that
    // has already seen the wall, so this costs nothing for the rest of the run.
    if (!this.state.rebirthUnlocked) this.checkWall();
    this.checkStory();
    this.checkTutorial();
    this.updateMusic();

    // Only the visible panel needs refreshing.
    if (this.tabs.current === 'achievements') this.achievementPanel.update(this.state);
    if (this.tabs.current === 'stats') {
      this.profileCard.update(this.state);
      this.cachePanel.update(this.state, this.derived);
      this.statsPanel.update(this.state, this.derived, now);
    }
    if (this.tabs.current === 'quest' && this.state.combat.unlocked) {
      this.battlePanel.update(this.state, this.combat, this.cstats);
    }
    if (this.tabs.current === 'kit' && this.state.combat.unlocked) {
      this.gearPanel.update(this.state, this.cstats);
    }
    if (this.tabs.current === 'summon' && this.summonUnlocked()) {
      this.gachaPanel.update(this.state);
    }
    if (this.tabs.current === 'rebirth' && this.rebirthVisible()) {
      this.metaPanel.update(this.state, this.cstats);
    }
    if (this.tabs.current === 'daily') {
      this.dailyPanel.update(this.state, now);
    }
    if (this.tabs.current === 'store') {
      this.storePanel.update(this.state, now);
    }
    if (this.tabs.current === 'season') {
      this.seasonPanel.update(this.state, now);
    }
    if (this.tabs.current === 'rivals') {
      // Rebuilding sixty rivals every frame would be wasteful for a board that
      // moves once a day, so it is cached and refreshed when the day turns.
      this.leaderboardPanel.update(this.board(now), this.state, now);
    }

    this.tabs.badge('achievements', this.newAchievements);
    this.tabs.badge('kit', this.newGear);
    this.tabs.badge('summon', this.newTickets);
    // The Daily badge is derived, not counted — it always reflects what is
    // actually claimable right now rather than what happened since you looked.
    this.tabs.badge(
      'daily',
      questSummary(this.state).ready + chestsReady(this.state, now),
    );
    // Same rule for the Store: the badge is the free leafs waiting, not a count
    // of things the player has not looked at.
    this.tabs.badge('store', dailyLeafsReady(this.state, now) ? 1 : 0);
    this.tabs.badge('season', unclaimedPassLevels(this.state));
    this.tabs.badge('rivals', activeEvent(now) ? 1 : 0);
  }

  summonUnlocked() {
    const g = this.state.gacha;
    return g.tickets > 0 || g.pulls > 0 || Object.keys(g.companions).length > 0;
  }

  /** Whether the Rebirth tab has anything to show yet. */
  rebirthVisible() {
    return (
      this.state.rebirthUnlocked ||
      this.state.rebirthCount > 0 ||
      this.state.combat.bestDepth >= REBIRTH_TEASE_DEPTH
    );
  }

  updateMetaVisibility() {
    const summon = this.summonUnlocked();
    this.summonLocked.hidden = summon;
    this.gachaRoot.hidden = !summon;

    const rebirthReady = this.rebirthVisible();
    this.bathLocked.hidden = rebirthReady;
    this.metaRoot.hidden = !rebirthReady;
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
    const onQuest = this.tabs.current === 'quest';
    for (const ev of events) {
      if (ev.kind === 'hit' && ev.target === 'enemy' && onQuest) {
        this.battlePanel.showHit(ev);
      }
      if (ev.kind === 'cleared' && ev.enemy.boss) audio.levelUp();
      if (ev.kind === 'retreat') audio.denied();

      // Combat used to be silent. These play only on the Quest tab: a fight
      // ticking away in the background while you shop should not make noise.
      if (!onQuest) continue;
      switch (ev.kind) {
        case 'hit':
          if (ev.target === 'player') (ev.heavy ? audio.heavy() : audio.hurt());
          else audio.hit();
          break;
        case 'skill': audio.skill(ev.charge || 0); break;
        case 'windup': audio.windup(); break;
        case 'brace': audio.brace(); break;
        case 'ward': audio.ward(); break;
        case 'wardBroke': audio.wardBroke(); break;
        case 'engage': if (ev.pattern) audio.bossRoar(); break;
        case 'cleared': if (!ev.enemy.boss) audio.victory(); break;
        case 'defeat': audio.defeat(); break;
        default: break;
      }
    }
  }

  /**
   * The player read a wind-up. Routed from the capybara tap and the keyboard,
   * so bracing uses the verb the game already taught on minute one.
   *
   * Returns whether it landed, so a tap stays a tap when there is nothing to
   * brace — the input is never swallowed.
   */
  braceHit() {
    if (!this.state.combat.unlocked || !this.state.combat.autoBattle) return false;
    return this.combat.brace();
  }

  castSkill(index) {
    const id = this.state.combat.skills[index];
    if (!id) return;
    if (!this.combat.castById(id, this.cstats)) {
      audio.denied();
      return;
    }
    this.save();
  }

  toggleAutoCast() {
    const s = this.state.combat;
    s.autoCast = s.autoCast === false;
    this.toaster.show({
      title: s.autoCast ? 'Skills fire themselves' : 'Skills are yours',
      body: s.autoCast
        ? 'Back to automatic. Nothing is lost by leaving it here.'
        : 'Hold a skill until Focus is full for up to +60% on the cast.',
      kind: 'info',
      icon: '⚔',
    });
    this.save();
  }

  /** Pay out a cleared stage: zen, xp, shards and possibly a drop. */
  payoutStage({ stage, enemy }) {
    const s = this.state;

    const zen = enemy.reward * this.derived.globalMult;
    this.earn(zen);

    // The pass moves while you play, not only while you quest.
    addPassXp(this.state, passXpForClear(enemy.boss));
    addPetals(this.state, petalsForClear(enemy.boss));

    // Meeting a hostile capybara is a story beat as well as a fight — it is the
    // moment the cold stops being something happening to the water.
    if (HOSTILE_CAPYBARAS[enemy.id]) s.stats.metCapybara = 1;

    const gainedXp = xpForStage(stage, enemy.boss);
    const beforeLevel = this.cstats.level;
    s.combat.xp += gainedXp;

    s.combat.shards += shardDrop(stage, enemy.boss);

    // Bosses are the tap for summon tickets — one guaranteed, plus whatever
    // the tree and constellations have added on top.
    if (enemy.boss) {
      const leafs = leafDrop(stage, true);
      s.leafs += leafs;
      s.lifetimeLeafs += leafs;

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

    // Bosses also drop for the crew. A side channel, deliberately quieter than
    // player loot: the companions improve because you played, not because you
    // scheduled a second grind.
    if (enemy.boss) {
      const crewDrop = rollCrewLoot(stage, { luck: this.cstats.luck });
      if (crewDrop) this.awardCrewGear(crewDrop);
    }

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

  /** A crew piece. Auto-worn into an empty slot on whoever is in the party. */
  awardCrewGear(drop) {
    const s = this.state;
    const entry = addCrewItem(s, drop.id, { tier: drop.tier, stars: drop.stars });
    if (!entry) return;

    const item = resolveCrewItem(entry);
    s.stats.crewDrops = (s.stats.crewDrops || 0) + 1;

    // Fill an empty slot on the first party member who has one, for the same
    // reason player gear auto-equips: a reward you have to go and find in a
    // menu is a reward that does not land.
    for (const member of partyMembers(s)) {
      if (crewEquipped(s, member.id, item.slot)) continue;
      equipCrewItem(s, member.id, entry.uid);
      this.cstats = combatStats(s);
      break;
    }

    if (item.tier >= 9 || item.stars >= 3) {
      this.toaster.show({
        title: `${item.rarity.name} ${item.name}`,
        body: 'For the crew.',
        kind: 'buff',
        icon: '🎁',
      });
    }
  }

  /** `drop` is what rollLoot returned: a definition plus the rung and stars. */
  awardGear(drop) {
    const s = this.state;
    const { def, tier, stars } = drop;
    const entry = addToInventory(s, def.id, { tier, stars });
    if (!entry) return;

    const rarity = rarityFor(tier);
    s.stats.drops++;
    // Recorded by rung name so the trophies read as language rather than as an
    // index, and so a save survives the ladder being renumbered.
    if (!s.stats.raritiesFound.includes(rarity.name)) {
      s.stats.raritiesFound.push(rarity.name);
    }
    this.newGear++;

    // Auto-equip into an empty slot so the first hour never requires a trip to
    // the menu to feel the reward.
    if (!s.combat.equipped[def.slot]) {
      equip(s, entry.uid);
      this.cstats = combatStats(s);
    }

    // Only interrupt for something genuinely good — a toast per drop would be
    // constant noise, so it is the top rungs or a multi-star piece.
    if (tier >= 9 || stars >= 3) {
      audio.golden();
      this.toaster.show({
        title: stars > 1 ? `${def.name} ${'★'.repeat(stars)}` : def.name,
        body: `${rarity.name} — check your Kit.`,
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
    this.combat.travelTo(this.state.combat.depth + direction);
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
      itemDetailBody(resolveItem(entry), {
        equipped,
        shards: this.state.combat.shards,
        leafs: this.state.leafs,
        fodder: fuseFodder(this.state, uid).length,
      });

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

    if (canRefine(this.state, uid).ok) {
      actions.push({
        label: `Refine ${'★'.repeat(item.stars + 1)}`,
        variant: 'primary',
        onClick: () => {
          const result = refine(this.state, uid);
          if (!result.ok) {
            audio.denied();
            return true;
          }
          this.state.stats.refines++;
          this.afterGearChange();
          if (result.success) {
            this.state.stats.bestStars = Math.max(this.state.stats.bestStars || 1, result.stars);
            audio.golden();
            this.toaster.show({
              title: `${item.name} is now ${result.stars}★`,
              body: result.pitied ? 'The pity counter came through.' : 'It took.',
              kind: 'buff',
              icon: '★',
            });
          } else {
            audio.denied();
            this.toaster.show({
              title: 'It did not take',
              body: `${result.fails} failed. Guaranteed on the ${MAX_STARS}th attempt.`,
              kind: 'warn',
              icon: '★',
            });
          }
          this.openItemDetail(uid);
          return true;
        },
      });
    }

    if (canFuse(this.state, uid).ok) {
      actions.push({
        label: 'Fuse',
        variant: 'primary',
        onClick: () => {
          const before = resolveItem(entry).rarity.name;
          const result = fuse(this.state, uid);
          if (!result.ok) {
            audio.denied();
            return true;
          }
          this.state.stats.fuses++;
          const gained = rarityFor(result.tier).name;
          if (!this.state.stats.raritiesFound.includes(gained)) {
            this.state.stats.raritiesFound.push(gained);
          }
          audio.levelUp();
          this.afterGearChange();
          this.toaster.show({
            title: `${item.name}: ${before} → ${gained}`,
            body: `Three pieces went in. ${result.tier >= MAX_TIER ? 'Top of the ladder.' : ''}`.trim(),
            kind: 'achievement',
            icon: '🔥',
          });
          this.openItemDetail(uid);
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

  /** Anything meta — a pull, a tree node, a star — moves both stat blocks too. */
  afterMetaChange() {
    this.checkCosmeticUnlocks();
    this.applyParty();
    this.cstats = combatStats(this.state);
    this.derived = recomputeDerived(this.state, { comboPoints: this.combo.points });
    if (this.summonUnlocked()) this.gachaPanel.update(this.state);
    if (this.rebirthVisible()) this.metaPanel.update(this.state, this.cstats);
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

    openModal({
      title: def.name,
      bodyNode: companionDetailBody(companion, {
        inParty,
        state: this.state,
        onPickGear: (cid, slot) => this.openCrewGearPicker(cid, slot),
        onPickHat: (cid) => this.openCrewHatPicker(cid),
      }),
      actions,
    });
    return undefined;
  }

  /**
   * The two crew pickers.
   *
   * Both reopen the detail sheet when they close, so putting a charm on and
   * then a hat is two taps rather than a trip back through the roster.
   */
  openCrewGearPicker(companionId, slot) {
    const body = crewGearPickerBody(this.state, companionId, slot, (uid) => {
      if (uid === null) unequipCrewItem(this.state, companionId, slot);
      else equipCrewItem(this.state, companionId, uid);
      audio.buy();
      this.afterMetaChange();
      closeModal();
      this.inspectCompanion(companionId);
    });
    openModal({ title: 'Crew kit', bodyNode: body, actions: [{ label: 'Back' }] });
  }

  openCrewHatPicker(companionId) {
    const def = COMPANIONS_BY_ID[companionId];
    if (!def) return;
    const body = crewHatPickerBody(this.state, def, (hatId) => {
      setCrewHat(this.state, companionId, hatId);
      audio.buy();
      this.afterMetaChange();
      closeModal();
      this.inspectCompanion(companionId);
    });
    openModal({ title: `${def.name}'s hat`, wide: true, bodyNode: body, actions: [{ label: 'Back' }] });
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

  // ---------------------------------------------------------------- rebirth

  confirmRebirth() {
    const preview = rebirthPreview(this.state, this.cstats);
    if (!preview.canRebirth) {
      audio.denied();
      return;
    }

    const body = el('div', 'confirm');
    body.appendChild(el('p', 'confirm__gain', `+${fmtInt(preview.essence)} essence`));
    body.appendChild(el('p', 'confirm__lead', 'You lose:'));
    body.appendChild(
      list(['zen in hand', 'every generator', 'every tap and generator upgrade', 'your place downstream, back to stage 0']),
    );
    body.appendChild(el('p', 'confirm__lead', 'You keep:'));
    body.appendChild(
      list([
        'every rank in the tree, and the essence you are about to earn',
        'all your gear, forge levels, skills and shards',
        'every companion and trophy',
      ]),
    );

    openModal({
      title: 'Begin again?',
      bodyNode: body,
      actions: [
        { label: 'Not yet' },
        { label: 'Begin again', variant: 'gold', onClick: () => this.doRebirth() },
      ],
    });
  }

  doRebirth() {
    const result = rebirth(this.state);
    if (!result.ok) return;

    this.combo.reset();
    this.scene.particles.clear();
    this.scene.clearGolden();
    this.golden.start(Date.now(), 1);
    this.combat = new Combat(this.state);
    this.afterMetaChange();
    this.buildingList.update(this.state, this.derived);
    this.upgradeGrid.update(this.state);

    audio.levelUp();
    this.toaster.show({
      title: 'The water starts again',
      body: `+${fmtInt(result.gained)} essence, for stage ${result.stage}. Spend it on something permanent.`,
      kind: 'achievement',
      icon: '🌱',
    });
  }

  /**
   * Announce the wall the moment it arrives. Being stuck without being told is
   * the failure mode v1 had, and it reads as the game being broken rather than
   * as a system opening up.
   */
  checkWall() {
    if (!noteWall(this.state, this.cstats)) return;
    audio.achievement();
    this.toaster.show({
      title: 'You are stuck here',
      body: 'That boss will not fall inside thirty seconds. Rebirth is open.',
      kind: 'achievement',
      icon: '🌱',
    });
    this.save();
  }

  confirmAscend() {
    const preview = ascendPreview(this.state);
    if (!preview.canAscend) {
      audio.denied();
      return;
    }

    const body = el('div', 'confirm');
    body.appendChild(el('p', 'confirm__gain', `+${fmtInt(preview.lotus)} lotus`));
    body.appendChild(el('p', 'confirm__lead', 'Ascending takes more than a rebirth. You lose:'));
    body.appendChild(list(['everything rebirth takes', 'all your essence', 'every rank in the tree']));
    body.appendChild(el('p', 'confirm__lead', 'You keep:'));
    body.appendChild(list(['all constellations, and the lotus you are about to earn', 'every companion and trophy']));
    body.appendChild(
      el('p', 'confirm__warn', 'This layer is still being built. Constellations are strong enough to be worth it.'),
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

  // ------------------------------------------------------------------ store

  claimDailyLeafs() {
    const result = claimDailyLeafs(this.state);
    if (!result.ok) {
      audio.denied();
      return;
    }
    audio.buy();
    this.afterStoreChange();
    this.toaster.show({
      title: `+${result.leafs} leafs`,
      body: 'Not quite a Reed Case. Tomorrow it will be.',
      kind: 'buff',
      icon: '🍃',
    });
  }

  openCase(id) {
    const result = openCase(this.state, id);
    if (!result.ok) {
      audio.denied();
      this.toaster.show({
        title: 'Not enough leafs',
        body: 'Come back tomorrow for the free ones, or beat some bosses.',
        kind: 'warn',
        icon: '🍃',
      });
      return;
    }

    const item = resolveItem(result.entry);
    this.state.stats.drops++;
    if (!this.state.stats.raritiesFound.includes(result.rarity.name)) {
      this.state.stats.raritiesFound.push(result.rarity.name);
    }
    if (result.stars > (this.state.stats.bestStars || 1)) {
      this.state.stats.bestStars = result.stars;
    }
    this.newGear++;
    if (!this.state.combat.equipped[item.slot]) equip(this.state, result.entry.uid);

    audio.golden();
    this.afterStoreChange();
    openModal({ title: result.def.name, bodyNode: caseRevealBody(item, result), actions: [{ label: 'Nice' }] });
  }

  purchaseBoost(id) {
    const result = buyBoost(this.state, id);
    if (!result.ok) {
      audio.denied();
      return;
    }
    audio.levelUp();
    this.afterStoreChange();
    const def = boostById(id);
    this.toaster.show({
      title: result.extended ? `${def.name} extended` : def.name,
      body: def.blurb,
      kind: 'buff',
      icon: def.icon,
    });
  }

  /**
   * Simulated. See systems/store.js — PAYMENTS is false, nothing is charged and
   * no card is ever asked for. The confirmation says so before the button, not
   * after it.
   */
  purchaseLeafPack(id) {
    const pack = leafPackById(id);
    if (!pack) return;

    const body = el('div', 'confirm');
    body.appendChild(el('p', 'confirm__gain', `${fmtInt(pack.leafs)} 🍃`));
    body.appendChild(el('p', 'confirm__warn', SIMULATED_NOTICE));
    body.appendChild(
      el(
        'p',
        'confirm__lead',
        `The ${pack.price} is a price tag, not a price. This game has no payment processor and never asks for a card — pressing the button below simply adds the leafs.`,
      ),
    );

    openModal({
      title: pack.name,
      bodyNode: body,
      actions: [
        { label: 'Cancel' },
        {
          label: 'Add the leafs',
          variant: 'gold',
          onClick: () => {
            const result = buyLeafPack(this.state, id);
            if (!result.ok) {
              audio.denied();
              return;
            }
            audio.buy();
            this.afterStoreChange();
            this.toaster.show({
              title: `+${fmtInt(result.leafs)} leafs`,
              body: SIMULATED_NOTICE,
              kind: 'buff',
              icon: '🍃',
            });
          },
        },
      ],
    });
  }

  /** One tap on a cosmetic: buy it if it is for sale and unowned, else wear it. */
  chooseLook(kind, id) {
    const def = cosmeticById(kind, id);
    if (!def) return;

    if (!owns(this.state, kind, id)) {
      const result = buyCosmetic(this.state, kind, id);
      if (!result.ok) {
        audio.denied();
        return;
      }
      audio.golden();
    }

    equipCosmetic(this.state, kind, id);
    this.applyCosmetics();
    audio.buy();
    this.afterStoreChange();
  }

  /** Push what is worn into the renderer and the page. */
  applyCosmetics() {
    this.scene.setSkin(equipped(this.state, 'skin'));
    this.scene.setWorn({
      hat: equipped(this.state, 'hat'),
      outfit: equipped(this.state, 'outfit'),
      accessory: equipped(this.state, 'accessory'),
    });
    document.body.dataset.pond = equipped(this.state, 'pond');
    this.applyParty();
  }

  /**
   * Push the party into the scene.
   *
   * Called from applyCosmetics because a hat change and a party change both
   * have to reach the same place, and afterMetaChange already runs it.
   */
  applyParty() {
    this.scene.setParty(
      partyMembers(this.state).map((member) => ({ ...member, hat: crewHat(this.state, member.id) })),
    );
  }

  /**
   * Earned cosmetics open themselves. Cheap enough to check wherever the game
   * already recomputes, and it announces what opened so an unlock is never
   * something you only find by opening the Store.
   */
  checkCosmeticUnlocks() {
    for (const def of checkUnlocks(this.state)) {
      audio.achievement();
      this.toaster.show({
        title: `${def.name} unlocked`,
        body: 'A new look, in the Store.',
        kind: 'achievement',
        icon: '🎨',
      });
    }
  }

  afterStoreChange() {
    this.cstats = combatStats(this.state);
    this.derived = recomputeDerived(this.state, { comboPoints: this.combo.points });
    this.checkCosmeticUnlocks();
    this.storePanel.update(this.state);
    this.gearPanel.update(this.state, this.cstats);
    this.save();
  }

  // ------------------------------------------------------------------- story

  /**
   * Show whatever beat has come due. dueBeats() only reads, so a beat that
   * cannot be shown right now — a modal is up, one is already running — simply
   * comes round again next tick rather than being lost.
   */
  checkStory() {
    if (this.dialogue.open || isModalOpen() || cutsceneOpen()) return;
    const beat = nextBeat(this.state);
    if (beat) this.dialogue.show(beat);
  }

  /**
   * The next coach mark, if one is due and there is room for it. Marks are
   * mutually exclusive with the speech bar and with any modal — three things
   * competing for the same attention is how a tutorial gets hated.
   */
  checkTutorial() {
    // A mark shown a moment before a modal opened is now stranded behind it.
    // closeCoachmark() does not fire onDismiss, so the step is not marked seen
    // and simply comes round again once the screen is clear.
    if (isModalOpen() && coachmarkOpen()) closeCoachmark();
    if (coachmarkOpen() || this.dialogue.open || isModalOpen() || cutsceneOpen()) return;
    if (!this.state.story.onboarded) return;

    const step = nextStep(this.state);
    if (!step) return;

    const mark = showCoachmark({
      selector: step.selector,
      title: step.title,
      body: step.body,
      onDismiss: () => {
        markStep(this.state, step.id);
        this.save();
      },
    });
    // The element was not on screen; it will come round again next tick.
    if (!mark) return;
  }

  // ----------------------------------------------------------------- profile

  renameProfile() {
    const { body, input } = renameBody(displayName(this.state));
    openModal({
      title: 'What should we call you?',
      bodyNode: body,
      actions: [
        { label: 'Cancel' },
        {
          label: 'That one',
          variant: 'primary',
          onClick: () => {
            setName(this.state, input.value);
            this.profileCard.update(this.state);
            this.save();
          },
        },
      ],
    });
    setTimeout(() => input.focus(), 30);
  }

  /**
   * The wardrobe. Stays open while you try things on — a modal that closed on
   * every pick would make dressing a capybara take six trips.
   */
  openWardrobe() {
    const body = wardrobeBody(this.state, (kind, id) => {
      equipCosmetic(this.state, kind, id);
      this.applyCosmetics();
      this.profileCard.update(this.state);
      this.save();
    });
    openModal({ title: 'Wardrobe', wide: true, bodyNode: body, actions: [{ label: 'Done' }] });
  }

  pickLook(kind) {
    const body = titlePickerBody(this.state, (id) => {
      equipCosmetic(this.state, kind, id);
      this.applyCosmetics();
      this.profileCard.update(this.state);
      this.save();
      closeModal();
    });
    openModal({ title: 'Choose a title', bodyNode: body, actions: [{ label: 'Close' }] });
  }

  readBeat(id) {
    const beat = storyBeat(id);
    if (!beat) return;
    openModal({ title: beat.speaker.name, bodyNode: beatBody(beat), actions: [{ label: 'Close' }] });
  }

  // ------------------------------------------------------------------ rivals

  /**
   * The board. The rivals are cached against the day, because sixty loadouts is
   * a few hundred resolveItem() calls and they only move when the day turns; the
   * player's own row is rebuilt and re-ranked every time, because theirs moves
   * whenever they do.
   */
  board(now = Date.now()) {
    const day = Math.floor(now / 86400e3);
    if (!this.boardCache || this.boardCache.day !== day) {
      this.boardCache = { day, rivals: rivalsFor(now) };
    }
    const out = leaderboard(this.state, now, this.boardCache.rivals);
    // Hand the cached rivals along so the bracket does not rebuild all sixty
    // loadouts a second time on the same frame.
    out.cached = this.boardCache.rivals;
    return out;
  }

  /**
   * Enter this week's bracket, or collect the placement from one already run.
   *
   * One button for both, because from the player's side it is one thing: the
   * bracket is the thing on this screen you can act on, and what acting means
   * depends only on whether you have been yet.
   */
  doBracket() {
    const now = Date.now();
    const status = bracketStatus(this.state, now, this.boardCache?.rivals);

    if (!status.entered) {
      const out = enterBracket(this.state, now, this.boardCache?.rivals);
      if (!out.ok) {
        audio.denied();
        return;
      }
      audio.levelUp();
      const wins = out.wins;
      this.toaster.show({
        title: `${['Fourth', 'Third', 'Second', 'First'][wins]} place`,
        body: `${wins} of ${out.results.length} won. ${out.reward.text}.`,
        kind: 'achievement',
        icon: '🏅',
      });
      this.save();
      return;
    }

    const claim = claimBracket(this.state, now);
    if (!claim.ok) {
      audio.denied();
      return;
    }
    const grant = grantReward(this.state, claim.reward, this.derived);
    audio.achievement();
    this.toaster.show({
      title: 'Bracket collected',
      body: describeGrant(grant, fmt),
      kind: 'achievement',
      icon: '🏅',
    });
    this.save();
  }

  inspectRival(id) {
    const entry = this.board().rows.find((r) => r.id === id);
    if (!entry) return;
    openModal({
      title: entry.name,
      bodyNode: rivalBody(entry),
      actions: [{ label: 'Close' }],
    });
  }

  exchangePetals(id) {
    const result = exchange(this.state, id);
    if (!result.ok) {
      audio.denied();
      return;
    }

    const grant = grantReward(this.state, result.reward, this.derived);
    audio.golden();
    this.checkCosmeticUnlocks();
    this.afterStoreChange();
    this.leaderboardPanel.update(this.board(), this.state);
    this.toaster.show({
      title: result.row.text,
      body: `${result.spent} petals.`,
      kind: 'buff',
      icon: '🌸',
    });
  }

  // ------------------------------------------------------- tree and stars

  purchaseNode(id) {
    const result = buyNode(this.state, id);
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

  doRespec() {
    const body = el('div', 'confirm');
    body.appendChild(
      el('p', 'confirm__lead', 'Every point of essence comes back and the tree empties. Costs nothing.'),
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
              body: `${fmtInt(result.refunded)} essence back to spend.`,
              kind: 'info',
              icon: '🌱',
            });
          },
        },
      ],
    });
  }

  /**
   * Take a keystone, or drop one you already have.
   *
   * Both directions are one tap and dropping refunds in full, for the same
   * reason respec is free: a commitment you cannot walk back is not a build,
   * it is a mistake you have to live in.
   */
  toggleKeystone(id) {
    const state = this.state;
    if (hasKeystone(state, id)) {
      const out = dropKeystone(state, id);
      if (!out.ok) return;
      audio.buy();
      this.afterMetaChange();
      this.toaster.show({
        title: 'Keystone dropped',
        body: `${fmtInt(out.refunded)} essence back. Nothing is locked in.`,
        kind: 'info',
        icon: '🪨',
      });
      return;
    }

    const out = takeKeystone(state, id);
    if (!out.ok) {
      audio.denied();
      const why = {
        locked: `Needs ${KEYSTONE_GATE} ranks in that branch first.`,
        full: 'All three keystone slots are taken. Drop one to swap.',
        poor: `Costs ${fmtInt(KEYSTONE_COST)} essence.`,
      }[out.reason];
      if (why) this.toaster.show({ title: 'Not yet', body: why, kind: 'warn', icon: '🪨' });
      return;
    }

    audio.achievement();
    this.afterMetaChange();
    this.toaster.show({
      title: out.keystone.name,
      body: out.keystone.line,
      kind: 'buff',
      icon: '🪨',
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
    // On the Quest tab a tap during a wind-up is a brace, not a tap. This is
    // the whole reason the brace uses the capybara rather than a new button:
    // on a phone, the thing you already touch is the thing that saves you.
    if (this.tabs.current === 'quest' && this.braceHit()) return;

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

  /**
   * Open the content editor once the doorway is clear.
   *
   * The intro cutscene and the nap report both open during boot, and a dialog
   * opened underneath one of them is a dialog nobody can reach — on a fresh
   * profile ?admin=1 simply appeared to do nothing. Waiting costs nothing.
   */
  openAdminWhenClear() {
    const attempt = () => {
      if (cutsceneOpen() || isModalOpen()) {
        setTimeout(attempt, 400);
        return;
      }
      this.openAdmin();
    };
    attempt();
  }

  /**
   * The content editor. Reached with ?admin=1 — see ui/adminPanel.js for why
   * that is not pretending to be a permission.
   */
  openAdmin() {
    openAdminPanel({
      onApply: () => {
        // The store builds its shelves once and then only writes text into
        // them, so a catalogue change has to be pushed in rather than noticed.
        // Every other panel reads the catalogue on each update and picks the
        // change up on the next UI tick by itself.
        this.storePanel?.rebuild();
      },
    });
  }

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
//
// The content pack is fetched before the game is constructed, because the
// panels build their rows once from the catalogue and a shelf that is right
// only after the second repaint is a shelf that flickers. loadContent() never
// rejects — a missing or broken pack resolves to the built-in defaults — so
// there is nothing here that can stop the game starting.
loadContent().then(() => {
  window.capyquest = new Game();
});
