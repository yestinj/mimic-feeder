const ANALYTICS_ENDPOINT = '/api/track';
const SESSION_STORAGE_KEY = 'mf_session_id';
const SESSION_ID_MAX_LENGTH = 128;

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

function trackEvent(eventName, fields) {
    try {
        const payloadFields = fields && typeof fields === 'object' ? fields : {};
        const payload = {
            event_name: String(eventName || ''),
            session_id: getSessionId(),
            run_id: analyticsCurrentRunId,
            score: payloadFields.score,
            dungeon_floor: payloadFields.dungeon_floor,
            dungeon_zone: payloadFields.dungeon_zone,
            player_level: payloadFields.player_level,
            play_time_seconds: payloadFields.play_time_seconds,
            payload: payloadFields.payload,
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
