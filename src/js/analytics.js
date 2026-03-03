const ANALYTICS_ENDPOINT = '/api/track';
const SESSION_STORAGE_KEY = 'mf_session_id';
const SESSION_ID_MAX_LENGTH = 128;
const RESPECT_BROWSER_PRIVACY_SIGNALS = false;
const TRACKING_ALLOWED_FIELDS_BY_EVENT = {
    intro_view: new Set(['version']),
    game_start: new Set(['version', 'input']),
    game_over: new Set(['version', 'objects_eaten', 'cause']),
    retry_click: new Set(['version', 'from', 'input']),
};

let analyticsFallbackSessionId = null;
let analyticsCurrentRunId = null;

function generateAnalyticsId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function readSessionIdFromStorage() {
    try {
        return localStorage.getItem(SESSION_STORAGE_KEY);
    } catch (error) {
        return null;
    }
}

function writeSessionIdToStorage(sessionId) {
    try {
        localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
        return true;
    } catch (error) {
        return false;
    }
}

function normalizeSessionId(value) {
    return String(value || '').slice(0, SESSION_ID_MAX_LENGTH);
}

function getSessionId() {
    const storedSessionId = normalizeSessionId(readSessionIdFromStorage());
    if (storedSessionId) {
        analyticsFallbackSessionId = storedSessionId;
        return storedSessionId;
    }

    if (analyticsFallbackSessionId) {
        return analyticsFallbackSessionId;
    }

    const generatedSessionId = normalizeSessionId(generateAnalyticsId());
    analyticsFallbackSessionId = generatedSessionId;
    writeSessionIdToStorage(generatedSessionId);
    return generatedSessionId;
}

function getRunId() {
    return analyticsCurrentRunId;
}

function startRun() {
    if (isPrivacyOptOutEnabled()) {
        analyticsCurrentRunId = null;
        return null;
    }
    analyticsCurrentRunId = generateAnalyticsId();
    return analyticsCurrentRunId;
}

function sendWithFetch(payloadText) {
    return fetch(ANALYTICS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payloadText,
        keepalive: true,
        credentials: 'same-origin',
    });
}

function isPrivacyOptOutEnabled() {
    if (!RESPECT_BROWSER_PRIVACY_SIGNALS) {
        return false;
    }

    if (typeof navigator !== 'undefined') {
        if (navigator.globalPrivacyControl === true) {
            return true;
        }
        const dnt = String(
            navigator.doNotTrack ??
            (typeof window !== 'undefined' ? window.doNotTrack : '')
        ).toLowerCase();
        if (dnt === '1' || dnt === 'yes') {
            return true;
        }
    }
    return false;
}

function sanitizePayloadForEvent(eventName, payload) {
    if (!payload || typeof payload !== 'object') {
        return undefined;
    }

    const allowlist = TRACKING_ALLOWED_FIELDS_BY_EVENT[eventName];
    if (!allowlist) {
        return undefined;
    }

    const sanitized = {};
    for (const key of allowlist) {
        if (Object.prototype.hasOwnProperty.call(payload, key)) {
            sanitized[key] = payload[key];
        }
    }

    return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function trackEvent(eventName, fields) {
    try {
        if (isPrivacyOptOutEnabled()) {
            return;
        }

        const normalizedEventName = String(eventName || '');
        const payloadFields = fields && typeof fields === 'object' ? fields : {};
        const payload = {
            event_name: normalizedEventName,
            session_id: getSessionId(),
            run_id: analyticsCurrentRunId,
            score: payloadFields.score,
            dungeon_floor: payloadFields.dungeon_floor,
            dungeon_zone: payloadFields.dungeon_zone,
            player_level: payloadFields.player_level,
            play_time_seconds: payloadFields.play_time_seconds,
            payload: sanitizePayloadForEvent(normalizedEventName, payloadFields.payload),
        };
        const payloadText = JSON.stringify(payload);

        if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
            try {
                const body = new Blob([payloadText], { type: 'application/json' });
                const queued = navigator.sendBeacon(ANALYTICS_ENDPOINT, body);
                if (queued) {
                    return;
                }
            } catch (error) {
                // Fall back to fetch below.
            }
        }

        const requestPromise = sendWithFetch(payloadText);
        if (requestPromise && typeof requestPromise.catch === 'function') {
            requestPromise.catch(() => {});
        }
    } catch (error) {
        // Fail-open analytics: never block gameplay.
    }
}
