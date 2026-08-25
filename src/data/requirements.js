// Declarative unlock conditions shared by every content table.
// Keeping these as data (not closures) means they serialise, diff cleanly, and
// can be exercised directly in tests.
//
// Supported keys, all optional and ANDed together:
//   clicks        lifetime clicks
//   lifetimeZen   lifetime zen earned this run
//   totalZen      zen earned across all runs
//   zps           current zen per second
//   building      { id, count } — own at least `count` of that generator
//   buildings     total generators owned across all lines
//   rebirth       rebirth count
//   essence       essence currently held
//   stage         highest stage reached
//   achievements  number of achievements unlocked
//   upgrade       id of another upgrade that must already be owned

/** Deepest TERRAIN stage reached, derived from the absolute depth. */
function bestStageReached(state) {
  return Math.floor((state.combat?.bestDepth ?? 0) / 10);
}

export function meetsRequirement(req, state) {
  if (!req) return true;

  if (req.clicks != null && state.lifetimeClicks < req.clicks) return false;
  if (req.lifetimeZen != null && state.lifetimeZen < req.lifetimeZen) return false;
  if (req.totalZen != null && state.totalZen < req.totalZen) return false;
  if (req.zps != null && (state.derived?.zps ?? 0) < req.zps) return false;
  if (req.rebirth != null && state.rebirthCount < req.rebirth) return false;
  if (req.essence != null && state.essence < req.essence) return false;
  if (req.stage != null && bestStageReached(state) < req.stage) return false;

  if (req.building) {
    if ((state.buildings[req.building.id] || 0) < req.building.count) return false;
  }

  if (req.buildings != null) {
    const total = Object.values(state.buildings).reduce((a, b) => a + b, 0);
    if (total < req.buildings) return false;
  }

  if (req.achievements != null) {
    if (Object.keys(state.achievements || {}).length < req.achievements) return false;
  }

  if (req.upgrade && !state.clickUpgrades[req.upgrade] && !state.tierUpgrades[req.upgrade]) {
    return false;
  }

  return true;
}

/** Human-readable "how do I unlock this" text for locked entries. */
export function describeRequirement(req, fmt) {
  if (!req) return '';
  const parts = [];
  if (req.clicks != null) parts.push(`${fmt(req.clicks)} lifetime taps`);
  if (req.lifetimeZen != null) parts.push(`${fmt(req.lifetimeZen)} zen earned`);
  if (req.totalZen != null) parts.push(`${fmt(req.totalZen)} all-time zen`);
  if (req.zps != null) parts.push(`${fmt(req.zps)} zen/sec`);
  if (req.building) parts.push(`${req.building.count}× that generator`);
  if (req.buildings != null) parts.push(`${req.buildings} generators owned`);
  if (req.rebirth != null) parts.push(`${req.rebirth} rebirth`);
  if (req.essence != null) parts.push(`${fmt(req.essence)} essence`);
  if (req.stage != null) parts.push(`stage ${req.stage}`);
  if (req.achievements != null) parts.push(`${req.achievements} achievements`);
  return parts.join(' · ');
}
