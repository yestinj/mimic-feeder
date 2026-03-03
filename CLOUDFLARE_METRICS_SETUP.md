# Cloudflare Metrics Setup for Mimic Feeder

This guide sets up lightweight game analytics on Cloudflare Free using:
- Cloudflare Pages (already hosting your game)
- Cloudflare Pages Functions (`/api/track` endpoint)
- Cloudflare D1 (event storage)

No VPS is required for this version.

Wrangler config format note:
- Use `wrangler.toml` in this repo.
- Keep all config/binding examples in TOML format.

## 1) What you will track

Track a small set of events first:
- `intro_view`
- `game_start`
- `game_over`
- `retry_click`

Each event should include:
- `session_id` (browser-level ID from `localStorage`)
- `run_id` (new ID each run)
- core stats (`score`, `dungeon_floor`, `dungeon_zone`, `player_level`, `play_time_seconds`)
- optional `payload` JSON for event-specific fields

## 2) One-time Cloudflare setup

Progress status for this repo:
- [x] `2.1 Install Wrangler and log in` (Complete)
- [x] `2.2 Pull your Pages project config into this repo` (Complete)
- [x] `2.3 Create a D1 database` (Complete)
- [x] `2.4 Add D1 binding to your Wrangler config` (Complete)
- [x] `2.5 Create and apply schema migrations` (Complete)
- [x] `2.6 Add a Pages Function endpoint` (Complete)
- [x] `2.7 Set an origin allowlist` (Complete)
- [ ] `2.8 Deploy with Wrangler-managed bindings` (Next)
- [x] `2.9 Ensure only /api/* invokes Functions` (Complete)
- [x] `2.10 Add a basic rate limit rule` (Complete)
- [x] `2.11 Enforce origin allowlist at edge` (Complete)

## 2.1 Install Wrangler and log in

```bash
npm i -D wrangler
npx wrangler login
```

## 2.2 Pull your Pages project config into this repo

```bash
npx wrangler pages download config <YOUR_PAGES_PROJECT_NAME>
```

This creates/updates your Wrangler config file (`wrangler.toml`).

## 2.3 Create a D1 database

```bash
npx wrangler d1 create mimic-feeder-metrics
```

Copy the returned `database_id`.

Note:
- `--location` is optional. If omitted, Cloudflare selects placement automatically.

## 2.4 Add D1 binding to your Wrangler config

Use a binding name like `mimic_feeder_metrics`.

`wrangler.toml` example:

```toml
name = "mimic-feeder"
pages_build_output_dir = "./dist"

[[d1_databases]]
binding = "mimic_feeder_metrics"
database_name = "mimic-feeder-metrics"
database_id = "<PASTE_DATABASE_ID>"
```

Notes:
- Keep your existing config values if already present.
- If you manage bindings only in dashboard, still keep `pages_build_output_dir` for local `wrangler pages dev`.

## 2.5 Create and apply schema migrations

Create `migrations/0001_game_events.sql`:

```sql
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
```

Apply locally:

```bash
npx wrangler d1 migrations apply mimic-feeder-metrics --local
```

Apply to production D1:

```bash
npx wrangler d1 migrations apply mimic-feeder-metrics --remote
```

## 2.6 Add a Pages Function endpoint

Create `functions/api/track.js`:

```js
const ALLOWED_EVENTS = new Set([
  'intro_view',
  'game_start',
  'game_over',
  'retry_click'
]);

function parseOriginUrl(value) {
  try {
    return value ? new URL(value) : null;
  } catch {
    return null;
  }
}

function hasSubdomainSuffix(hostname, suffix) {
  const host = String(hostname || '').toLowerCase();
  const normalizedSuffix = String(suffix || '').toLowerCase();
  return host.length > normalizedSuffix.length && host.endsWith(`.${normalizedSuffix}`);
}

function matchesWildcardOrigin(rule, requestOriginUrl) {
  const withScheme = rule.match(/^([a-z]+):\/\/\*\.(.+)$/i);
  if (withScheme) {
    return (
      requestOriginUrl.protocol === `${withScheme[1].toLowerCase()}:` &&
      hasSubdomainSuffix(requestOriginUrl.hostname, withScheme[2])
    );
  }

  const hostOnly = rule.match(/^\*\.(.+)$/i);
  if (hostOnly) {
    return hasSubdomainSuffix(requestOriginUrl.hostname, hostOnly[1]);
  }

  return false;
}

function isOriginAllowed(origin, allowedOrigins) {
  if (allowedOrigins.length === 0) return true;
  const requestOriginUrl = parseOriginUrl(origin);
  if (!requestOriginUrl) return false;

  return allowedOrigins.some((rule) => {
    if (rule.includes('*')) {
      return matchesWildcardOrigin(rule, requestOriginUrl);
    }

    const ruleUrl = parseOriginUrl(rule);
    return Boolean(ruleUrl && ruleUrl.origin === requestOriginUrl.origin);
  });
}

export async function onRequestPost(context) {
  const origin = context.request.headers.get('origin');
  const allowedOrigins = String(context.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (!isOriginAllowed(origin, allowedOrigins)) {
    return new Response('Forbidden', { status: 403 });
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const eventName = String(body?.event_name || '');
  if (!ALLOWED_EVENTS.has(eventName)) {
    return new Response('Invalid event', { status: 400 });
  }

  const sessionId = String(body?.session_id || '').slice(0, 128);
  const runId = body?.run_id ? String(body.run_id).slice(0, 128) : null;
  if (!sessionId) {
    return new Response('session_id required', { status: 400 });
  }

  const payloadJson = body?.payload ? JSON.stringify(body.payload).slice(0, 20000) : null;
  const cf = context.request.cf || {};

  await context.env.mimic_feeder_metrics
    .prepare(`
      INSERT INTO game_events (
        event_name, session_id, run_id, score, dungeon_floor, dungeon_zone,
        player_level, play_time_seconds, payload_json, user_agent, country, colo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      eventName,
      sessionId,
      runId,
      Number.isFinite(body?.score) ? body.score : null,
      Number.isFinite(body?.dungeon_floor) ? body.dungeon_floor : null,
      Number.isFinite(body?.dungeon_zone) ? body.dungeon_zone : null,
      Number.isFinite(body?.player_level) ? body.player_level : null,
      Number.isFinite(body?.play_time_seconds) ? body.play_time_seconds : null,
      payloadJson,
      context.request.headers.get('user-agent') || null,
      cf.country || null,
      cf.colo || null
    )
    .run();

  return new Response(null, { status: 204 });
}
```

Note:
- This snippet is a starter outline. The repo implementation in `functions/api/track.js` is stricter (CORS/`OPTIONS`, truncation helpers, and whole-second normalization for `play_time_seconds`).

## 2.7 Set an origin allowlist (recommended)

- Set `ALLOWED_ORIGINS` in `wrangler.toml`:
  - `https://mimicfeeder.yest.dev,https://mimic-feeder.pages.dev,https://*.mimic-feeder.pages.dev`
- For local Wrangler dev, set `ALLOWED_ORIGINS` in `.dev.vars`:
  - `http://localhost:8080,http://localhost:8788`
- Wildcard support is implemented for entries like `https://*.mimic-feeder.pages.dev`.
- The endpoint rejects requests whose `Origin` is not in the allowlist.
- Note: origin checks are effective for browser-originated abuse reduction, but they are not a complete auth mechanism against server-to-server spoofed traffic.
- Runtime caveat: `npm start` is static-only and does not run `/api/track`. Use `wrangler pages dev dist` for local API + D1 testing.

## 2.8 Deploy with Wrangler-managed bindings

If your project is Git-connected Pages and you are using `wrangler.toml` as config:
- Commit/push the new files.
- Trigger a new deployment.
- Verify in dashboard that `mimic_feeder_metrics` appears under Bindings.

Important:
- When you use a Wrangler config with `pages_build_output_dir`, treat it as source-of-truth.
- Do not edit the same bindings in dashboard and Wrangler at the same time, or config can drift.
- If you prefer dashboard-managed bindings, remove that binding from Wrangler and manage it only in dashboard.

## 2.9 Ensure only `/api/*` invokes Functions

To preserve unlimited static requests on Pages, keep Functions scoped to API routes.

Create `src/_routes.json` with:

```json
{
  "version": 1,
  "include": ["/api/*"],
  "exclude": []
}
```

Then make sure your build copies it into `dist/_routes.json` (same way `src/_headers` is copied today).

Note:
- Pages can auto-generate invocation routes, but setting `_routes.json` explicitly prevents surprises.
- Keep this file in the build output directory (`dist/` for this repo).

## 2.10 Add a basic rate limit rule (recommended)

Cloudflare dashboard path:
- `Security` -> `Security rules` -> `Rate limiting rules` -> `Create rule`

Configured values used:
- Rule name: `api-track-rate-limit`
- Expression (paste in Expression Editor):

```txt
(http.host eq "mimicfeeder.yest.dev" and
 http.request.uri.path eq "/api/track" and
 http.request.method eq "POST")
```

- Characteristics: IP-based counting (dashboard default)
- Threshold: `5` requests per `10 seconds`
- Action: `Block`
- Block duration: `10 seconds`

Notes:
- Free plan includes `1` rate limiting rule per zone, so this uses that slot.
- Dashboard options can vary by plan/UI; `10s` windows and `Block` action are valid.

## 2.11 Enforce origin allowlist at edge (defense in depth)

Cloudflare dashboard path:
- `Security` -> `Security rules` -> `Custom rules` -> `Create rule`

Use these starter values:
- Rule name: `api-track-origin-allowlist`
- Action: `Block`
- Expression (paste in Expression Editor):

```txt
(http.host eq "mimicfeeder.yest.dev" and
 http.request.uri.path eq "/api/track" and
 http.request.method in {"POST" "OPTIONS"} and
 not (
   any(http.request.headers["origin"][*] eq "https://mimicfeeder.yest.dev") or
   any(http.request.headers["origin"][*] eq "https://mimic-feeder.pages.dev") or
   any(lower(http.request.headers["origin"][*])[*] wildcard "https://*.mimic-feeder.pages.dev")
 ))
```

Notes:
- Keep this rule aligned with `ALLOWED_ORIGINS` in app config.
- This is a custom rule slot (separate from the rate limiting slot).
- This gives protection even before your Function executes.

## 3) High-level code update plan for this repo

Implement this in small commits.

Security requirement:
- Require domain allowlisting for analytics ingestion (`ALLOWED_ORIGINS` + matching Security Custom Rule).

Progress status for this repo:
- [x] `3.1 Add a client analytics helper` (Complete)
- [x] `3.2 Wire analytics helper into build order` (Complete)
- [x] `3.3 Add event hooks in current game flow` (Complete)
- [x] `3.4 Event payload contract` (Complete)
- [x] `3.5 Validate locally` (Complete)

## 3.1 Add a client analytics helper

Create `src/js/analytics.js` with:
- `getSessionId()` stored in `localStorage` (key like `mf_session_id`), with in-memory fallback if storage is unavailable
- `startRun()` to set a new `run_id`
- `trackEvent(eventName, fields)`
  - use `navigator.sendBeacon('/api/track', blob)` when available
  - fallback to `fetch('/api/track', { method: 'POST', keepalive: true, ... })`
  - respect browser privacy opt-out signals (`Global Privacy Control` / `Do Not Track`) by skipping sends
  - allowlist payload keys by event on the client before sending
  - fail-open behavior: never throw, and never block gameplay if `/api/track` is unreachable

## 3.2 Wire analytics helper into build order

Update `build.js` `jsFileOrder` to include `analytics.js` before files that call it.

## 3.3 Add event hooks in current game flow

Suggested hooks in your existing files:
- `src/js/sketch.js`
  - In `setup()`: when intro is shown, send `intro_view` once.
  - In `setup()`: if intro is skipped for returning players, call `startRun()` + send `game_start` once with `input: 'auto'`.
  - In `restartGame()`: call `startRun()` + send `game_start` once with `input: 'retry'`.
  - In `keyPressed()` game-over Enter handler: send `retry_click` before restart.
  - In `triggerGameOver()`: send `game_over` with run stats.
- `src/js/introScreen.js`
  - In `handleIntroScreenKeyPressed()` and `handleIntroScreenMousePressed()`: call `startRun()` + send `game_start` once.
- `src/js/gameOverScreen.js`
  - In retry click handler: send `retry_click` before restart.

## 3.4 Event payload contract

Keep payloads stable and small:
- `intro_view`: `{ version }`
- `game_start`: `{ version, input: 'keyboard'|'mouse'|'retry'|'auto' }`
- `game_over`: `{ cause?, score, dungeon_floor, dungeon_zone, player_level, play_time_seconds, objects_eaten }`
  - current cause values: `'bomb_hit'|'fireball_hit'|'boss_fireball_hit'|'humanoid_missed'`
- `retry_click`: `{ version, from: 'game_over', input: 'mouse'|'keyboard' }`

## 3.5 Validate locally

```bash
npm run build
npx wrangler pages dev dist
```

Then hit your game and confirm writes:

```bash
npx wrangler d1 execute mimic-feeder-metrics --local --command "SELECT event_name, COUNT(*) c FROM game_events GROUP BY event_name ORDER BY c DESC;"
```

## 4) Useful starter queries

Dedicated query pack:
- `queries/d1_metrics_queries.sql` (includes run commands for local and production from your local machine)

Progress status for this repo:
- [x] `4. Query pack and starter analytics queries` (Complete)

## 4.1 Daily unique players (game starts, recommended DAU)

```sql
SELECT date(created_at) AS day, COUNT(DISTINCT session_id) AS players
FROM game_events
WHERE event_name = 'game_start'
GROUP BY day
ORDER BY day DESC;
```

## 4.1b Daily unique intro views (new-player exposure)

```sql
SELECT date(created_at) AS day, COUNT(DISTINCT session_id) AS players
FROM game_events
WHERE event_name = 'intro_view'
GROUP BY day
ORDER BY day DESC;
```

## 4.2 Funnel (intro -> start -> game over)

```sql
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
```

## 4.3 Progress depth

```sql
SELECT dungeon_floor, COUNT(*) AS game_overs
FROM game_events
WHERE event_name = 'game_over'
GROUP BY dungeon_floor
ORDER BY dungeon_floor DESC;
```

## 5) Free-tier guardrails (important)

As of February 17, 2026:
- Workers Free request quota (shared with Pages Functions): `100,000/day`
- D1 Free: `5,000,000 rows read/day`, `100,000 rows written/day`, `5 GB` total storage, `500 MB` max per database, and `10` databases/account

Implications:
- Keep event volume low (start with 3-6 events per run).
- Do not log per-frame or high-frequency movement events.
- Keep payload JSON small.

## 6) Privacy and abuse basics

- Do not store player-entered names or other personal data in analytics events.
- Use anonymous random IDs (`session_id`, `run_id`).
- Accept only an allowlist of event names.
- Allowlist event payload keys before sending from the client (defense in depth against accidental extra fields).
- Respect browser privacy preferences (`navigator.globalPrivacyControl`, `Do Not Track`) and skip analytics when enabled.
- Truncate long strings and payloads.
- Treat `user_agent` as potentially identifying; remove it or store only coarse metadata if you want stricter privacy posture.
- `colo` is the Cloudflare edge data center code (for example `SJC`, `LAX`) and is coarse routing metadata.

## 7) Official docs used

- Pages Functions bindings: https://developers.cloudflare.com/pages/functions/bindings/
- Pages Wrangler config: https://developers.cloudflare.com/pages/functions/wrangler-configuration/
- Pages local dev: https://developers.cloudflare.com/pages/functions/local-development/
- Pages routing: https://developers.cloudflare.com/pages/functions/routing/
- D1 getting started: https://developers.cloudflare.com/d1/get-started/
- D1 Wrangler commands: https://developers.cloudflare.com/d1/wrangler-commands/
- D1 pricing: https://developers.cloudflare.com/d1/platform/pricing/
- D1 limits: https://developers.cloudflare.com/d1/platform/limits/
- Workers pricing/limits: https://developers.cloudflare.com/workers/platform/pricing/ and https://developers.cloudflare.com/workers/platform/limits/
