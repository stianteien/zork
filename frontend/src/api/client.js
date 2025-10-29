const BASE_URL = import.meta.env.VITE_GAME_API_BASE_URL?.replace(/\/$/, "") ??
    "http://127.0.0.1:8005";
const SESSIONS_ENDPOINT = normalizePath(import.meta.env.VITE_GAME_SESSIONS_ENDPOINT ?? "/sessions");
const SCORES_ENDPOINT = normalizePath(import.meta.env.VITE_GAME_SCORES_ENDPOINT ?? "/scores");
const ACTIONS_SEGMENT = normalizePath(import.meta.env.VITE_GAME_ACTIONS_SEGMENT ?? "/actions");
export const apiConfig = {
    baseUrl: BASE_URL,
    sessionsPath: SESSIONS_ENDPOINT,
    actionsSegment: ACTIONS_SEGMENT,
    scoresPath: SCORES_ENDPOINT
};
class ApiError extends Error {
    constructor(message, status) {
        super(message);
        Object.defineProperty(this, "status", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: status
        });
        this.name = "ApiError";
    }
}
const buildUrl = (path) => `${BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
async function fetchJson(path, options) {
    const url = buildUrl(path);
    const response = await fetch(url, {
        ...options,
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...options?.headers
        }
    });
    if (!response.ok) {
        const text = await response.text();
        throw new ApiError(`Request to ${url} failed with ${response.status}: ${text || response.statusText}`, response.status);
    }
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
        return (await response.json());
    }
    throw new ApiError(`Expected JSON response from ${url} but received ${contentType ?? "unknown content type"}`);
}
export const startSession = async (playerName) => {
    const payload = await fetchJson(SESSIONS_ENDPOINT, {
        method: "POST",
        body: JSON.stringify({ player_name: playerName })
    });
    return payload;
};
export const getSessionState = async (sessionId) => {
    return fetchJson(`${SESSIONS_ENDPOINT}/${encodeURIComponent(sessionId)}`);
};
export const listAvailableActions = async (sessionId) => {
    return fetchJson(`${SESSIONS_ENDPOINT}/${encodeURIComponent(sessionId)}${ACTIONS_SEGMENT}`);
};
export const performAction = async (sessionId, action, payload) => {
    const body = { action };
    if (payload) {
        body.payload = payload;
    }
    return fetchJson(`${SESSIONS_ENDPOINT}/${encodeURIComponent(sessionId)}${ACTIONS_SEGMENT}`, {
        method: "POST",
        body: JSON.stringify(body)
    });
};
export const fetchScores = async (limit) => {
    const query = typeof limit === "number" && Number.isFinite(limit)
        ? `?limit=${encodeURIComponent(Math.max(1, Math.trunc(limit)))}`
        : "";
    const payload = await fetchJson(`${SCORES_ENDPOINT}${query}`, {
        method: "GET",
        cache: "no-store"
    });
    return payload.scores;
};
function normalizePath(value) {
    if (!value) {
        return "/";
    }
    return value.startsWith("/") ? value : `/${value}`;
}
