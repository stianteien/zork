const runtimeBaseUrl =
  typeof window === "undefined"
    ? undefined
    : window.__ENV__?.VITE_GAME_API_BASE_URL;

const BASE_URL =
  normalizeBaseUrl(runtimeBaseUrl) ??
  normalizeBaseUrl(import.meta.env.VITE_GAME_API_BASE_URL) ??
  "http://127.0.0.1:8005";

const SESSIONS_ENDPOINT = normalizePath(
  import.meta.env.VITE_GAME_SESSIONS_ENDPOINT ?? "/sessions"
);

const SCORES_ENDPOINT = normalizePath(
  import.meta.env.VITE_GAME_SCORES_ENDPOINT ?? "/scores"
);

const ACTIONS_SEGMENT = normalizePath(
  import.meta.env.VITE_GAME_ACTIONS_SEGMENT ?? "/actions"
);

export const apiConfig = {
  baseUrl: BASE_URL,
  sessionsPath: SESSIONS_ENDPOINT,
  actionsSegment: ACTIONS_SEGMENT,
  scoresPath: SCORES_ENDPOINT
} as const;

export interface LockedExitModel {
  direction: string;
  description: string;
}

export interface TaskStatusModel {
  key: string;
  description: string;
  completed: boolean;
}

export interface GameStateModel {
  message: string;
  player_name: string;
  current_room: string;
  room_description: string;
  exits: Record<string, string>;
  locked_exits: LockedExitModel[];
  items_in_room: string[];
  inventory: string[];
  turn_count: number;
  tasks: TaskStatusModel[];
  finished: boolean;
  score: number | null;
  available_actions: string[];
}

export interface SessionCreateResponse {
  session_id: string;
  state: GameStateModel;
}

export interface AvailableActionsResponse {
  session_id: string;
  available_actions: string[];
}

export interface ScoreModel {
  player_name: string;
  score: number;
}

export interface ScoreboardResponse {
  scores: ScoreModel[];
}

export interface ActionRequest {
  action: string;
  payload?: string | null;
}

class ApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "ApiError";
  }
}

const buildUrl = (path: string) =>
  `${BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;

async function fetchJson<TResponse>(
  path: string,
  options?: RequestInit
): Promise<TResponse> {
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
    throw new ApiError(
      `Request to ${url} failed with ${response.status}: ${text || response.statusText}`,
      response.status
    );
  }

  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return (await response.json()) as TResponse;
  }

  throw new ApiError(
    `Expected JSON response from ${url} but received ${contentType ?? "unknown content type"}`
  );
}

export const startSession = async (
  playerName: string
): Promise<SessionCreateResponse> => {
  const payload: SessionCreateResponse = await fetchJson(SESSIONS_ENDPOINT, {
    method: "POST",
    body: JSON.stringify({ player_name: playerName })
  });
  return payload;
};

export const getSessionState = async (
  sessionId: string
): Promise<GameStateModel> => {
  return fetchJson<GameStateModel>(`${SESSIONS_ENDPOINT}/${encodeURIComponent(sessionId)}`);
};

export const listAvailableActions = async (
  sessionId: string
): Promise<AvailableActionsResponse> => {
  return fetchJson<AvailableActionsResponse>(
    `${SESSIONS_ENDPOINT}/${encodeURIComponent(sessionId)}${ACTIONS_SEGMENT}`
  );
};

export const performAction = async (
  sessionId: string,
  action: string,
  payload?: string | null
): Promise<GameStateModel> => {
  const body: ActionRequest = { action };
  if (payload) {
    body.payload = payload;
  }

  return fetchJson<GameStateModel>(
    `${SESSIONS_ENDPOINT}/${encodeURIComponent(sessionId)}${ACTIONS_SEGMENT}`,
    {
      method: "POST",
      body: JSON.stringify(body)
    }
  );
};

export const fetchScores = async (limit?: number): Promise<ScoreModel[]> => {
  const query =
    typeof limit === "number" && Number.isFinite(limit)
      ? `?limit=${encodeURIComponent(Math.max(1, Math.trunc(limit)))}`
      : "";

  const payload = await fetchJson<ScoreboardResponse>(
    `${SCORES_ENDPOINT}${query}`,
    {
      method: "GET",
      cache: "no-store"
    }
  );

  return payload.scores;
};

function normalizePath(value: string): string {
  if (!value) {
    return "/";
  }

  return value.startsWith("/") ? value : `/${value}`;
}

function normalizeBaseUrl(value?: string): string | undefined {
  if (!value || value === "$VITE_GAME_API_BASE_URL") {
    return undefined;
  }

  return value.replace(/\/$/, "");
}
