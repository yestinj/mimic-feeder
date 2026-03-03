CREATE TABLE IF NOT EXISTS game_events (
  id INTEGER PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  event_name TEXT NOT NULL,
  session_id TEXT NOT NULL,
  run_id TEXT,
  score INTEGER,
  dungeon_floor INTEGER,
  dungeon_zone INTEGER,
  player_level INTEGER,
  play_time_seconds REAL,
  payload_json TEXT,
  user_agent TEXT,
  country TEXT,
  colo TEXT
);

CREATE INDEX IF NOT EXISTS idx_game_events_created_at
  ON game_events(created_at);

CREATE INDEX IF NOT EXISTS idx_game_events_event_created_at
  ON game_events(event_name, created_at);

CREATE INDEX IF NOT EXISTS idx_game_events_event_dungeon_floor
  ON game_events(event_name, dungeon_floor);

CREATE INDEX IF NOT EXISTS idx_game_events_session_created_at
  ON game_events(session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_game_events_run_created_at
  ON game_events(run_id, created_at)
  WHERE run_id IS NOT NULL;
