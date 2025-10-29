import { FormEvent, useEffect, useRef, useState } from "react";
import {
  apiConfig,
  GameStateModel,
  getSessionState,
  performAction,
  startSession
} from "../api/client";
import "./GameView.css";

interface LogEntry {
  id: string;
  author: "player" | "narrator" | "system";
  text: string;
}

const WELCOME_MESSAGE =
  "Welcome adventurer! Enter your name to start a new House Mystery session.";

const createEntry = (
  author: LogEntry["author"],
  text: string
): LogEntry => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  author,
  text: text.trim() || "(no message)"
});

const createWelcomeLog = (): LogEntry[] => [createEntry("system", WELCOME_MESSAGE)];

const GameView = () => {
  const [playerName, setPlayerName] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameStateModel | null>(null);
  const [log, setLog] = useState<LogEntry[]>(createWelcomeLog);
  const [action, setAction] = useState("");
  const [payload, setPayload] = useState("");
  const [startPending, setStartPending] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [syncPending, setSyncPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const hasSession = sessionId != null;
  const finished = Boolean(gameState?.finished);
  const scoreDisplay =
    gameState?.score == null ? "—" : gameState.score.toLocaleString();
  const turnCount = gameState?.turn_count ?? 0;
  const availableActions = gameState?.available_actions ?? [];
  const sessionsUrl = `${apiConfig.baseUrl}${apiConfig.sessionsPath}`;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  const resetToWelcome = (extraEntry?: LogEntry) => {
    setLog(extraEntry ? [...createWelcomeLog(), extraEntry] : createWelcomeLog());
    setGameState(null);
    setSessionId(null);
    setAction("");
    setPayload("");
  };

  const handleStartSession = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = playerName.trim();
    if (!trimmed || startPending) {
      return;
    }
    setStartPending(true);
    setError(null);

    try {
      const { session_id, state } = await startSession(trimmed);
      setSessionId(session_id);
      setGameState(state);
      setPlayerName(state.player_name);
      setLog((current) => [
        ...current,
        createEntry(
          "system",
          `Session ${session_id} started for ${state.player_name}.`
        ),
        createEntry("narrator", describeState(state))
      ]);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to start a new session. Ensure the API is reachable."
      );
      setLog((current) => [
        ...current,
        createEntry(
          "system",
          "Could not start a session. Confirm that the backend exposes POST /sessions."
        )
      ]);
    } finally {
      setStartPending(false);
    }
  };

  const handleCommandSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!sessionId || finished || actionPending || syncPending) {
      return;
    }

    const trimmedAction = action.trim();
    const trimmedPayload = payload.trim();
    if (!trimmedAction) {
      return;
    }

    setError(null);

    const playerEntry = createEntry(
      "player",
      trimmedPayload
        ? `${trimmedAction} — ${trimmedPayload}`
        : trimmedAction
    );
    setLog((current) => [...current, playerEntry]);
    setActionPending(true);

    try {
      const nextState = await performAction(
        sessionId,
        trimmedAction,
        trimmedPayload ? trimmedPayload : undefined
      );
      setGameState(nextState);
      setPlayerName(nextState.player_name);
      setAction("");
      setPayload("");

      setLog((current) => {
        const entries = [...current, createEntry("narrator", describeState(nextState))];
        if (nextState.finished) {
          entries.push(
            createEntry(
              "system",
              "The mystery is resolved! Start a new session when you are ready to explore again."
            )
          );
        }
        return entries;
      });
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "The action could not be completed. Try again or choose another action."
      );
      setLog((current) => [
        ...current,
        createEntry(
          "system",
          "The last command failed. Verify that the session is still active and the action is valid."
        )
      ]);
    } finally {
      setActionPending(false);
    }
  };

  const handleRefreshState = async () => {
    if (!sessionId || syncPending || actionPending) {
      return;
    }
    setSyncPending(true);
    setError(null);
    try {
      const state = await getSessionState(sessionId);
      setGameState(state);
      setPlayerName(state.player_name);
      setLog((current) => [
        ...current,
        createEntry("system", "Session state refreshed from the server.")
      ]);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to refresh the session state."
      );
    } finally {
      setSyncPending(false);
    }
  };

  const handleRestart = () => {
    resetToWelcome(
      createEntry(
        "system",
        "Session cleared. Enter a player name to begin a fresh run."
      )
    );
    setError(null);
  };

  const busy = actionPending || syncPending;

  return (
    <section className="game-view">
      <div className="game-panel">
        <div className="panel-header">
          <div>
            <h2>House Mystery Console</h2>
            <p className="panel-subtitle">
              Manage sessions and issue actions to explore the mansion.
            </p>
          </div>
          <div className="panel-meta">
            <div className="metric-badge">
              <span>Score</span>
              <strong>{scoreDisplay}</strong>
            </div>
            <div className="metric-badge">
              <span>Turn</span>
              <strong>{turnCount}</strong>
            </div>
          </div>
        </div>

        {hasSession ? (
          <div className="session-summary">
            <div className="session-summary-item">
              <span className="label">Session</span>
              <code>{sessionId}</code>
            </div>
            <div className="session-summary-item">
              <span className="label">Player</span>
              <strong>{gameState?.player_name ?? playerName}</strong>
            </div>
            <div className="session-buttons">
              <button
                type="button"
                className="ghost-button"
                onClick={handleRefreshState}
                disabled={busy}
              >
                {syncPending ? "Syncing…" : "Sync State"}
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={handleRestart}
                disabled={startPending || busy}
              >
                Restart
              </button>
            </div>
          </div>
        ) : (
          <form className="session-form" onSubmit={handleStartSession}>
            <div className="session-fields">
              <input
                type="text"
                name="player_name"
                autoComplete="off"
                placeholder="Who dares enter the house?"
                value={playerName}
                onChange={(event) => setPlayerName(event.target.value)}
                disabled={startPending}
                aria-label="Player name"
              />
              <button
                type="submit"
                disabled={startPending || !playerName.trim()}
              >
                {startPending ? "Summoning…" : "Start Session"}
              </button>
            </div>
            <p className="session-hint">
              Sessions are created via <code>POST {sessionsUrl}</code>. Provide a
              player name to receive a <code>session_id</code>.
            </p>
          </form>
        )}

        <div className="game-content">
          <div className="log-window">
            {log.map(({ id, author, text }) => (
              <article key={id} className={`log-entry ${author}`}>
                <header>
                  {author === "player"
                    ? "You"
                    : author === "system"
                    ? "System"
                    : "Narrator"}
                </header>
                <pre>{text}</pre>
              </article>
            ))}
            <div ref={bottomRef} />
          </div>

          <aside className="state-inspector">
            {gameState ? (
              <>
                <section className="inspector-section">
                  <h3>Location</h3>
                  <p className="inspector-room">{gameState.current_room}</p>
                  <p>{gameState.room_description}</p>
                </section>
                <section className="inspector-section">
                  <h3>Exits</h3>
                  {Object.keys(gameState.exits).length > 0 ? (
                    <ul className="inspector-list">
                      {Object.entries(gameState.exits).map(
                        ([direction, destination]) => (
                          <li key={direction}>
                            <span>{direction}</span>
                            <code>{destination}</code>
                          </li>
                        )
                      )}
                    </ul>
                  ) : (
                    <p className="inspector-empty">No open exits yet.</p>
                  )}
                  {gameState.locked_exits.length > 0 && (
                    <div className="inspector-subsection">
                      <h4>Locked</h4>
                      <ul className="inspector-list">
                        {gameState.locked_exits.map((exit) => (
                          <li key={`${exit.direction}-${exit.description}`}>
                            <span>{exit.direction}</span>
                            <code>{exit.description}</code>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
                <section className="inspector-section">
                  <h3>Items Nearby</h3>
                  {gameState.items_in_room.length > 0 ? (
                    <ul className="tag-list">
                      {gameState.items_in_room.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="inspector-empty">Nothing of note in this room.</p>
                  )}
                </section>
                <section className="inspector-section">
                  <h3>Inventory</h3>
                  {gameState.inventory.length > 0 ? (
                    <ul className="tag-list">
                      {gameState.inventory.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="inspector-empty">Your satchel is empty.</p>
                  )}
                </section>
                <section className="inspector-section">
                  <h3>Tasks</h3>
                  {gameState.tasks.length > 0 ? (
                    <ul className="task-list">
                      {gameState.tasks.map((task) => (
                        <li key={task.key} className={task.completed ? "done" : ""}>
                          <span>{task.description}</span>
                          <code>{task.completed ? "Complete" : "Pending"}</code>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="inspector-empty">
                      The family ledger has not assigned you any tasks yet.
                    </p>
                  )}
                </section>
                <section className="inspector-section">
                  <h3>Available Actions</h3>
                  {availableActions.length > 0 ? (
                    <div className="action-chip-grid">
                      {availableActions.map((value, index) => (
                        <button
                          type="button"
                          key={`${value}-${index}`}
                          className="action-chip"
                          onClick={() => {
                            setAction(value);
                            setPayload("");
                          }}
                          disabled={busy || finished}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="inspector-empty">
                      The caretaker has no suggestions right now.
                    </p>
                  )}
                </section>
              </>
            ) : (
              <div className="inspector-placeholder">
                <h3>No Active Session</h3>
                <p>
                  Start a new session to see room descriptions, inventory, and
                  tasks. The adventure service listens on{" "}
                  <code>{sessionsUrl}</code>.
                </p>
                <p>
                  After creating a session you will receive a{" "}
                  <code>session_id</code>. Use it to perform actions via{" "}
                  <code>
                    {sessionsUrl}/&#123;session_id&#125;
                    {apiConfig.actionsSegment}
                  </code>
                  .
                </p>
              </div>
            )}
          </aside>
        </div>

        <form className="command-form" onSubmit={handleCommandSubmit}>
          <div className="command-fields">
            <input
              type="text"
              name="action"
              autoComplete="off"
              placeholder={
                !hasSession
                  ? "Start a session to issue actions…"
                  : finished
                  ? "Session complete. Restart to continue."
                  : busy
                  ? "Working..."
                  : "Enter an action, e.g. look or go north"
              }
              value={action}
              onChange={(event) => setAction(event.target.value)}
              disabled={!hasSession || finished || busy}
              aria-label="Action"
            />
            <input
              type="text"
              name="payload"
              autoComplete="off"
              placeholder="Optional payload (direction, item, etc.)"
              value={payload}
              onChange={(event) => setPayload(event.target.value)}
              disabled={!hasSession || finished || busy}
              aria-label="Payload"
            />
          </div>
          <button
            type="submit"
            disabled={!hasSession || finished || busy || !action.trim()}
          >
            {actionPending ? "Sending…" : "Perform Action"}
          </button>
        </form>
        <p className="command-hint">
          Include a payload when needed, e.g. action <code>go</code> with payload{" "}
          <code>north</code>. Actions without a payload can be entered directly
          like <code>look</code> or <code>inventory</code>.
        </p>

        {error && <p className="error-banner">{error}</p>}

        <div className="hints">
          <strong>Integration Tips</strong>
          <p>
            Override endpoints with environment variables:{" "}
            <code>VITE_GAME_API_BASE_URL</code>, <code>VITE_GAME_SESSIONS_ENDPOINT</code>,{" "}
            <code>VITE_GAME_SCORES_ENDPOINT</code>, <code>VITE_GAME_ACTIONS_SEGMENT</code>.
          </p>
          <p>
            The server returns full state snapshots on every response, so the UI stays
            synchronized even if you refresh or reconnect.
          </p>
        </div>
      </div>
    </section>
  );
};

const describeState = (state: GameStateModel): string => {
  const segments: string[] = [];

  if (state.message?.trim()) {
    segments.push(state.message.trim());
  }

  if (state.current_room?.trim()) {
    segments.push(`You are in ${state.current_room}.`);
  }

  if (state.room_description?.trim()) {
    segments.push(state.room_description.trim());
  }

  if (state.items_in_room.length > 0) {
    segments.push(
      `Visible items: ${state.items_in_room.join(", ")}.`
    );
  }

  if (state.inventory.length > 0) {
    segments.push(`Inventory: ${state.inventory.join(", ")}.`);
  }

  if (state.locked_exits.length > 0) {
    const locks = state.locked_exits
      .map((exit) => `${exit.direction} (${exit.description})`)
      .join(", ");
    segments.push(`Locked exits: ${locks}.`);
  }

  if (state.available_actions.length > 0) {
    segments.push(
      `Available actions: ${state.available_actions.join(", ")}.`
    );
  }

  return segments.filter(Boolean).join("\n\n");
};

export default GameView;
