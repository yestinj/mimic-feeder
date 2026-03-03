-- Mimic Feeder D1 Analytics Queries
-- =================================
-- Run from your local machine:
--
-- 1) Execute all queries against LOCAL D1:
--    npx wrangler d1 execute mimic-feeder-metrics --local --file queries/d1_metrics_queries.sql
--
-- 2) Execute all queries against PRODUCTION D1 (remote):
--    npx wrangler d1 execute mimic-feeder-metrics --remote --file queries/d1_metrics_queries.sql
--
-- 3) Execute one query ad hoc against LOCAL:
--    npx wrangler d1 execute mimic-feeder-metrics --local --command "<SQL>"
--
-- 4) Execute one query ad hoc against PRODUCTION (from local machine):
--    npx wrangler d1 execute mimic-feeder-metrics --remote --command "<SQL>"
--
-- Notes:
-- - "against prod from local" means running Wrangler locally with --remote.
-- - Queries assume schema from migrations/0001_game_events.sql.
--
-- WebStorm / IntelliJ SQLite datasource (local D1):
-- 1) Add Data Source -> SQLite
-- 2) Database file: <repo>/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite
--    (select the .sqlite file; ignore .sqlite-shm and .sqlite-wal)
-- 3) Test connection and save.
-- 4) If local DB identity changes, re-check the folder and reselect the .sqlite file.


-- Q1) Daily unique players (game starts; recommended DAU)
SELECT date(created_at) AS day, COUNT(DISTINCT session_id) AS players
FROM game_events
WHERE event_name = 'game_start'
GROUP BY day
ORDER BY day DESC;


-- Q1b) Daily unique intro views (new-player exposure)
SELECT date(created_at) AS day, COUNT(DISTINCT session_id) AS players
FROM game_events
WHERE event_name = 'intro_view'
GROUP BY day
ORDER BY day DESC;


-- Q2) Funnel totals (intro -> start -> game over)
WITH intro AS (
  SELECT COUNT(DISTINCT session_id) AS c FROM game_events WHERE event_name = 'intro_view'
),
start AS (
  SELECT COUNT(DISTINCT session_id) AS c FROM game_events WHERE event_name = 'game_start'
),
dead AS (
  SELECT COUNT(DISTINCT session_id) AS c FROM game_events WHERE event_name = 'game_over'
)
SELECT intro.c AS intro_players, start.c AS started_players, dead.c AS game_over_players
FROM intro, start, dead;


-- Q3) Funnel conversion percentages
WITH intro AS (
  SELECT COUNT(DISTINCT session_id) AS c FROM game_events WHERE event_name = 'intro_view'
),
start AS (
  SELECT COUNT(DISTINCT session_id) AS c FROM game_events WHERE event_name = 'game_start'
),
dead AS (
  SELECT COUNT(DISTINCT session_id) AS c FROM game_events WHERE event_name = 'game_over'
)
SELECT
  intro.c AS intro_players,
  start.c AS started_players,
  dead.c AS game_over_players,
  CASE WHEN intro.c > 0 THEN ROUND((start.c * 100.0) / intro.c, 2) ELSE NULL END AS intro_to_start_pct,
  CASE WHEN start.c > 0 THEN ROUND((dead.c * 100.0) / start.c, 2) ELSE NULL END AS start_to_game_over_pct
FROM intro, start, dead;


-- Q4) Progress depth (game overs by floor)
SELECT dungeon_floor, COUNT(*) AS game_overs
FROM game_events
WHERE event_name = 'game_over'
GROUP BY dungeon_floor
ORDER BY dungeon_floor DESC;


-- Q5) Starts by input source (keyboard/mouse/retry/auto)
SELECT
  COALESCE(json_extract(payload_json, '$.input'), 'unknown') AS input_source,
  COUNT(*) AS starts
FROM game_events
WHERE event_name = 'game_start'
GROUP BY input_source
ORDER BY starts DESC;


-- Q6) Game-over performance summary by day
SELECT
  date(created_at) AS day,
  COUNT(*) AS game_overs,
  ROUND(AVG(score), 1) AS avg_score,
  MAX(score) AS best_score,
  ROUND(AVG(play_time_seconds), 1) AS avg_play_time_seconds,
  MAX(play_time_seconds) AS max_play_time_seconds
FROM game_events
WHERE event_name = 'game_over'
GROUP BY day
ORDER BY day DESC;


-- Q7) Retry behavior summary
WITH dead AS (
  SELECT COUNT(*) AS c FROM game_events WHERE event_name = 'game_over'
),
retry AS (
  SELECT COUNT(*) AS c FROM game_events WHERE event_name = 'retry_click'
)
SELECT
  dead.c AS game_overs,
  retry.c AS retries,
  CASE WHEN dead.c > 0 THEN ROUND((retry.c * 100.0) / dead.c, 2) ELSE NULL END AS retries_per_game_over_pct
FROM dead, retry;


-- Q8) Top sessions by activity
SELECT
  session_id,
  COUNT(*) AS events,
  COUNT(DISTINCT run_id) AS runs,
  MAX(created_at) AS last_seen
FROM game_events
GROUP BY session_id
ORDER BY events DESC
LIMIT 20;


-- Q9) Event volume by day and event type
SELECT
  date(created_at) AS day,
  event_name,
  COUNT(*) AS events
FROM game_events
GROUP BY day, event_name
ORDER BY day DESC, events DESC;


-- Q10) Geo breakdown (country, colo)
SELECT
  COALESCE(country, 'unknown') AS country,
  COALESCE(colo, 'unknown') AS colo,
  COUNT(*) AS events
FROM game_events
GROUP BY country, colo
ORDER BY events DESC
LIMIT 50;


-- Q11) Last 50 events for quick inspection
SELECT
  id,
  created_at,
  event_name,
  session_id,
  run_id,
  score,
  dungeon_floor,
  dungeon_zone,
  player_level,
  play_time_seconds,
  payload_json
FROM game_events
ORDER BY id DESC
LIMIT 50;


-- Q12) Data quality: unexpected event names
SELECT event_name, COUNT(*) AS c
FROM game_events
WHERE event_name NOT IN ('intro_view', 'game_start', 'game_over', 'retry_click')
GROUP BY event_name
ORDER BY c DESC;


-- Q13) Data quality: run_id should exist for run-scoped events
SELECT event_name, COUNT(*) AS missing_run_id
FROM game_events
WHERE event_name IN ('game_start', 'game_over', 'retry_click')
  AND run_id IS NULL
GROUP BY event_name
ORDER BY missing_run_id DESC;


-- Q14) Data quality: payload field presence checks
SELECT
  event_name,
  SUM(CASE WHEN event_name = 'intro_view' AND json_extract(payload_json, '$.version') IS NULL THEN 1 ELSE 0 END) AS intro_view_missing_version,
  SUM(CASE WHEN event_name = 'game_start' AND json_extract(payload_json, '$.version') IS NULL THEN 1 ELSE 0 END) AS game_start_missing_version,
  SUM(CASE WHEN event_name = 'game_start' AND json_extract(payload_json, '$.input') IS NULL THEN 1 ELSE 0 END) AS game_start_missing_input,
  SUM(CASE WHEN event_name = 'retry_click' AND json_extract(payload_json, '$.version') IS NULL THEN 1 ELSE 0 END) AS retry_click_missing_version,
  SUM(CASE WHEN event_name = 'retry_click' AND json_extract(payload_json, '$.from') IS NULL THEN 1 ELSE 0 END) AS retry_click_missing_from,
  SUM(CASE WHEN event_name = 'game_over' AND json_extract(payload_json, '$.version') IS NULL THEN 1 ELSE 0 END) AS game_over_missing_version,
  SUM(CASE WHEN event_name = 'game_over' AND json_extract(payload_json, '$.cause') IS NULL THEN 1 ELSE 0 END) AS game_over_missing_cause,
  SUM(CASE WHEN event_name = 'game_over' AND json_extract(payload_json, '$.objects_eaten') IS NULL THEN 1 ELSE 0 END) AS game_over_missing_objects_eaten
FROM game_events;
