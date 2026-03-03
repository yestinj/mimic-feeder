const ALLOWED_EVENTS = new Set([
  "intro_view",
  "game_start",
  "game_over",
  "retry_click",
]);

const MAX_ID_LENGTH = 128;
const MAX_PAYLOAD_LENGTH = 20000;
const MAX_USER_AGENT_LENGTH = 512;
const MAX_COUNTRY_LENGTH = 2;
const MAX_COLO_LENGTH = 16;

function getAllowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function parseOriginUrl(value) {
  if (!value) {
    return null;
  }
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function hasSubdomainSuffix(hostname, suffix) {
  const host = String(hostname || "").toLowerCase();
  const normalizedSuffix = String(suffix || "").toLowerCase();
  return host.length > normalizedSuffix.length && host.endsWith(`.${normalizedSuffix}`);
}

function matchesWildcardOrigin(rule, requestOriginUrl) {
  const withScheme = rule.match(/^([a-z]+):\/\/\*\.(.+)$/i);
  if (withScheme) {
    const ruleScheme = `${withScheme[1].toLowerCase()}:`;
    const ruleSuffix = withScheme[2].toLowerCase();
    return requestOriginUrl.protocol === ruleScheme &&
      hasSubdomainSuffix(requestOriginUrl.hostname, ruleSuffix);
  }

  const hostOnly = rule.match(/^\*\.(.+)$/i);
  if (hostOnly) {
    const ruleSuffix = hostOnly[1].toLowerCase();
    return hasSubdomainSuffix(requestOriginUrl.hostname, ruleSuffix);
  }

  return false;
}

function isOriginAllowed(origin, allowedOrigins) {
  if (allowedOrigins.length === 0) {
    return true;
  }
  const requestOriginUrl = parseOriginUrl(origin);
  if (!requestOriginUrl) {
    return false;
  }

  return allowedOrigins.some((rule) => {
    if (rule.includes("*")) {
      return matchesWildcardOrigin(rule, requestOriginUrl);
    }

    const ruleUrl = parseOriginUrl(rule);
    return Boolean(ruleUrl && ruleUrl.origin === requestOriginUrl.origin);
  });
}

function buildCorsHeaders(origin, allowedOrigins) {
  const headers = { Vary: "Origin" };
  if (origin && isOriginAllowed(origin, allowedOrigins)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type";
  }
  return headers;
}

function toNumberOrNull(value) {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function toWholeSecondsOrNull(value) {
  const numberValue = toNumberOrNull(value);
  if (numberValue === null) {
    return null;
  }
  return Math.max(0, Math.floor(numberValue));
}

function truncate(value, maxLength) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).slice(0, maxLength);
}

export function onRequestOptions(context) {
  const origin = context.request.headers.get("origin");
  const allowedOrigins = getAllowedOrigins(context.env);
  const corsHeaders = buildCorsHeaders(origin, allowedOrigins);

  if (!isOriginAllowed(origin, allowedOrigins)) {
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestPost(context) {
  const origin = context.request.headers.get("origin");
  const allowedOrigins = getAllowedOrigins(context.env);
  const corsHeaders = buildCorsHeaders(origin, allowedOrigins);

  if (!isOriginAllowed(origin, allowedOrigins)) {
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400, headers: corsHeaders });
  }

  const eventName = truncate(body?.event_name, MAX_ID_LENGTH);
  if (!ALLOWED_EVENTS.has(eventName)) {
    return new Response("Invalid event", { status: 400, headers: corsHeaders });
  }

  const sessionId = truncate(body?.session_id, MAX_ID_LENGTH);
  if (!sessionId) {
    return new Response("session_id required", { status: 400, headers: corsHeaders });
  }

  const runId = body?.run_id ? truncate(body.run_id, MAX_ID_LENGTH) : null;

  let payloadJson = null;
  if (body?.payload !== undefined) {
    try {
      payloadJson = JSON.stringify(body.payload).slice(0, MAX_PAYLOAD_LENGTH);
    } catch {
      return new Response("Invalid payload", { status: 400, headers: corsHeaders });
    }
  }

  const db = context.env.mimic_feeder_metrics;
  if (!db) {
    return new Response("DB binding not configured", { status: 500, headers: corsHeaders });
  }

  const cf = context.request.cf || {};

  await db
    .prepare(
      `INSERT INTO game_events (
        event_name, session_id, run_id, score, dungeon_floor, dungeon_zone,
        player_level, play_time_seconds, payload_json, user_agent, country, colo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      eventName,
      sessionId,
      runId,
      toNumberOrNull(body?.score),
      toNumberOrNull(body?.dungeon_floor),
      toNumberOrNull(body?.dungeon_zone),
      toNumberOrNull(body?.player_level),
      toWholeSecondsOrNull(body?.play_time_seconds),
      payloadJson,
      truncate(context.request.headers.get("user-agent"), MAX_USER_AGENT_LENGTH) || null,
      truncate(cf.country, MAX_COUNTRY_LENGTH) || null,
      truncate(cf.colo, MAX_COLO_LENGTH) || null
    )
    .run();

  return new Response(null, { status: 204, headers: corsHeaders });
}
