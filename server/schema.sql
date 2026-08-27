-- CapyQuest's D1 schema. Two tables, no relationships, no user accounts.
--
--   wrangler d1 execute capyquest --remote --file=server/schema.sql
--
-- Everything is IF NOT EXISTS so re-running it on a live database is safe.

-- One row per device that has turned cloud save on.
--
-- `code` is the same CAPY1 blob that Settings → Copy save code produces. The
-- server does not parse it, and deliberately so: the day the save format
-- changes, this table keeps working, because it never knew what was inside.
CREATE TABLE IF NOT EXISTS saves (
  id         TEXT PRIMARY KEY,
  -- The only credential. Generated on the device, never shown to anybody else,
  -- and the sole thing standing between an id and a write to it.
  secret     TEXT NOT NULL,
  code       TEXT NOT NULL,
  -- Server clock. Orders writes, because a device clock can be years out.
  updated_at INTEGER NOT NULL,
  -- What the device believed the time was. Kept for the client's own
  -- comparison and for working out afterwards why something looked stale.
  client_at  INTEGER NOT NULL,
  bytes      INTEGER NOT NULL
);

-- Housekeeping: find the saves nobody has touched in a long time.
CREATE INDEX IF NOT EXISTS saves_updated ON saves (updated_at);

-- One row per device per season.
--
-- Per season rather than lifetime, because CapyQuest's board already resets
-- with the season and the sixty simulated rivals are rebuilt from the season
-- index. A lifetime table would rank a returning player against a board they
-- are no longer playing on.
CREATE TABLE IF NOT EXISTS scores (
  id         TEXT NOT NULL,
  secret     TEXT NOT NULL,
  season     INTEGER NOT NULL,
  name       TEXT NOT NULL,
  depth      INTEGER NOT NULL DEFAULT 0,
  rebirths   INTEGER NOT NULL DEFAULT 0,
  pass_level INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (id, season)
);

-- The board query: one season, ordered by the same three fields the game ranks
-- on. Covering, so reading the top hundred never touches the table itself.
CREATE INDEX IF NOT EXISTS scores_board
  ON scores (season, depth DESC, rebirths DESC, pass_level DESC);
