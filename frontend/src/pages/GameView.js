import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { apiConfig, getSessionState, performAction, startSession } from "../api/client";
import "./GameView.css";
const WELCOME_MESSAGE = "Welcome adventurer! Enter your name to start a new House Mystery session.";
const createEntry = (author, text) => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    author,
    text: text.trim() || "(no message)"
});
const createWelcomeLog = () => [createEntry("system", WELCOME_MESSAGE)];
const GameView = () => {
    const [playerName, setPlayerName] = useState("");
    const [sessionId, setSessionId] = useState(null);
    const [gameState, setGameState] = useState(null);
    const [log, setLog] = useState(createWelcomeLog);
    const [action, setAction] = useState("");
    const [payload, setPayload] = useState("");
    const [startPending, setStartPending] = useState(false);
    const [actionPending, setActionPending] = useState(false);
    const [syncPending, setSyncPending] = useState(false);
    const [error, setError] = useState(null);
    const bottomRef = useRef(null);
    const hasSession = sessionId != null;
    const finished = Boolean(gameState?.finished);
    const scoreDisplay = gameState?.score == null ? "—" : gameState.score.toLocaleString();
    const turnCount = gameState?.turn_count ?? 0;
    const availableActions = gameState?.available_actions ?? [];
    const sessionsUrl = `${apiConfig.baseUrl}${apiConfig.sessionsPath}`;
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [log]);
    const resetToWelcome = (extraEntry) => {
        setLog(extraEntry ? [...createWelcomeLog(), extraEntry] : createWelcomeLog());
        setGameState(null);
        setSessionId(null);
        setAction("");
        setPayload("");
    };
    const handleStartSession = async (event) => {
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
                createEntry("system", `Session ${session_id} started for ${state.player_name}.`),
                createEntry("narrator", describeState(state))
            ]);
        }
        catch (err) {
            console.error(err);
            setError(err instanceof Error
                ? err.message
                : "Failed to start a new session. Ensure the API is reachable.");
            setLog((current) => [
                ...current,
                createEntry("system", "Could not start a session. Confirm that the backend exposes POST /sessions.")
            ]);
        }
        finally {
            setStartPending(false);
        }
    };
    const handleCommandSubmit = async (event) => {
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
        const playerEntry = createEntry("player", trimmedPayload
            ? `${trimmedAction} — ${trimmedPayload}`
            : trimmedAction);
        setLog((current) => [...current, playerEntry]);
        setActionPending(true);
        try {
            const nextState = await performAction(sessionId, trimmedAction, trimmedPayload ? trimmedPayload : undefined);
            setGameState(nextState);
            setPlayerName(nextState.player_name);
            setAction("");
            setPayload("");
            setLog((current) => {
                const entries = [...current, createEntry("narrator", describeState(nextState))];
                if (nextState.finished) {
                    entries.push(createEntry("system", "The mystery is resolved! Start a new session when you are ready to explore again."));
                }
                return entries;
            });
        }
        catch (err) {
            console.error(err);
            setError(err instanceof Error
                ? err.message
                : "The action could not be completed. Try again or choose another action.");
            setLog((current) => [
                ...current,
                createEntry("system", "The last command failed. Verify that the session is still active and the action is valid.")
            ]);
        }
        finally {
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
        }
        catch (err) {
            console.error(err);
            setError(err instanceof Error
                ? err.message
                : "Unable to refresh the session state.");
        }
        finally {
            setSyncPending(false);
        }
    };
    const handleRestart = () => {
        resetToWelcome(createEntry("system", "Session cleared. Enter a player name to begin a fresh run."));
        setError(null);
    };
    const busy = actionPending || syncPending;
    return (_jsx("section", { className: "game-view", children: _jsxs("div", { className: "game-panel", children: [_jsxs("div", { className: "panel-header", children: [_jsxs("div", { children: [_jsx("h2", { children: "House Mystery Console" }), _jsx("p", { className: "panel-subtitle", children: "Manage sessions and issue actions to explore the mansion." })] }), _jsxs("div", { className: "panel-meta", children: [_jsxs("div", { className: "metric-badge", children: [_jsx("span", { children: "Score" }), _jsx("strong", { children: scoreDisplay })] }), _jsxs("div", { className: "metric-badge", children: [_jsx("span", { children: "Turn" }), _jsx("strong", { children: turnCount })] })] })] }), hasSession ? (_jsxs("div", { className: "session-summary", children: [_jsxs("div", { className: "session-summary-item", children: [_jsx("span", { className: "label", children: "Session" }), _jsx("code", { children: sessionId })] }), _jsxs("div", { className: "session-summary-item", children: [_jsx("span", { className: "label", children: "Player" }), _jsx("strong", { children: gameState?.player_name ?? playerName })] }), _jsxs("div", { className: "session-buttons", children: [_jsx("button", { type: "button", className: "ghost-button", onClick: handleRefreshState, disabled: busy, children: syncPending ? "Syncing…" : "Sync State" }), _jsx("button", { type: "button", className: "ghost-button", onClick: handleRestart, disabled: startPending || busy, children: "Restart" })] })] })) : (_jsxs("form", { className: "session-form", onSubmit: handleStartSession, children: [_jsxs("div", { className: "session-fields", children: [_jsx("input", { type: "text", name: "player_name", autoComplete: "off", placeholder: "Who dares enter the house?", value: playerName, onChange: (event) => setPlayerName(event.target.value), disabled: startPending, "aria-label": "Player name" }), _jsx("button", { type: "submit", disabled: startPending || !playerName.trim(), children: startPending ? "Summoning…" : "Start Session" })] }), _jsxs("p", { className: "session-hint", children: ["Sessions are created via ", _jsxs("code", { children: ["POST ", sessionsUrl] }), ". Provide a player name to receive a ", _jsx("code", { children: "session_id" }), "."] })] })), _jsxs("div", { className: "game-content", children: [_jsxs("div", { className: "log-window", children: [log.map(({ id, author, text }) => (_jsxs("article", { className: `log-entry ${author}`, children: [_jsx("header", { children: author === "player"
                                                ? "You"
                                                : author === "system"
                                                    ? "System"
                                                    : "Narrator" }), _jsx("pre", { children: text })] }, id))), _jsx("div", { ref: bottomRef })] }), _jsx("aside", { className: "state-inspector", children: gameState ? (_jsxs(_Fragment, { children: [_jsxs("section", { className: "inspector-section", children: [_jsx("h3", { children: "Location" }), _jsx("p", { className: "inspector-room", children: gameState.current_room }), _jsx("p", { children: gameState.room_description })] }), _jsxs("section", { className: "inspector-section", children: [_jsx("h3", { children: "Exits" }), Object.keys(gameState.exits).length > 0 ? (_jsx("ul", { className: "inspector-list", children: Object.entries(gameState.exits).map(([direction, destination]) => (_jsxs("li", { children: [_jsx("span", { children: direction }), _jsx("code", { children: destination })] }, direction))) })) : (_jsx("p", { className: "inspector-empty", children: "No open exits yet." })), gameState.locked_exits.length > 0 && (_jsxs("div", { className: "inspector-subsection", children: [_jsx("h4", { children: "Locked" }), _jsx("ul", { className: "inspector-list", children: gameState.locked_exits.map((exit) => (_jsxs("li", { children: [_jsx("span", { children: exit.direction }), _jsx("code", { children: exit.description })] }, `${exit.direction}-${exit.description}`))) })] }))] }), _jsxs("section", { className: "inspector-section", children: [_jsx("h3", { children: "Items Nearby" }), gameState.items_in_room.length > 0 ? (_jsx("ul", { className: "tag-list", children: gameState.items_in_room.map((item) => (_jsx("li", { children: item }, item))) })) : (_jsx("p", { className: "inspector-empty", children: "Nothing of note in this room." }))] }), _jsxs("section", { className: "inspector-section", children: [_jsx("h3", { children: "Inventory" }), gameState.inventory.length > 0 ? (_jsx("ul", { className: "tag-list", children: gameState.inventory.map((item) => (_jsx("li", { children: item }, item))) })) : (_jsx("p", { className: "inspector-empty", children: "Your satchel is empty." }))] }), _jsxs("section", { className: "inspector-section", children: [_jsx("h3", { children: "Tasks" }), gameState.tasks.length > 0 ? (_jsx("ul", { className: "task-list", children: gameState.tasks.map((task) => (_jsxs("li", { className: task.completed ? "done" : "", children: [_jsx("span", { children: task.description }), _jsx("code", { children: task.completed ? "Complete" : "Pending" })] }, task.key))) })) : (_jsx("p", { className: "inspector-empty", children: "The family ledger has not assigned you any tasks yet." }))] }), _jsxs("section", { className: "inspector-section", children: [_jsx("h3", { children: "Available Actions" }), availableActions.length > 0 ? (_jsx("div", { className: "action-chip-grid", children: availableActions.map((value, index) => (_jsx("button", { type: "button", className: "action-chip", onClick: () => {
                                                        setAction(value);
                                                        setPayload("");
                                                    }, disabled: busy || finished, children: value }, `${value}-${index}`))) })) : (_jsx("p", { className: "inspector-empty", children: "The caretaker has no suggestions right now." }))] })] })) : (_jsxs("div", { className: "inspector-placeholder", children: [_jsx("h3", { children: "No Active Session" }), _jsxs("p", { children: ["Start a new session to see room descriptions, inventory, and tasks. The adventure service listens on", " ", _jsx("code", { children: sessionsUrl }), "."] }), _jsxs("p", { children: ["After creating a session you will receive a", " ", _jsx("code", { children: "session_id" }), ". Use it to perform actions via", " ", _jsxs("code", { children: [sessionsUrl, "/{session_id}", apiConfig.actionsSegment] }), "."] })] })) })] }), _jsxs("form", { className: "command-form", onSubmit: handleCommandSubmit, children: [_jsxs("div", { className: "command-fields", children: [_jsx("input", { type: "text", name: "action", autoComplete: "off", placeholder: !hasSession
                                        ? "Start a session to issue actions…"
                                        : finished
                                            ? "Session complete. Restart to continue."
                                            : busy
                                                ? "Working..."
                                                : "Enter an action, e.g. look or go north", value: action, onChange: (event) => setAction(event.target.value), disabled: !hasSession || finished || busy, "aria-label": "Action" }), _jsx("input", { type: "text", name: "payload", autoComplete: "off", placeholder: "Optional payload (direction, item, etc.)", value: payload, onChange: (event) => setPayload(event.target.value), disabled: !hasSession || finished || busy, "aria-label": "Payload" })] }), _jsx("button", { type: "submit", disabled: !hasSession || finished || busy || !action.trim(), children: actionPending ? "Sending…" : "Perform Action" })] }), _jsxs("p", { className: "command-hint", children: ["Include a payload when needed, e.g. action ", _jsx("code", { children: "go" }), " with payload", " ", _jsx("code", { children: "north" }), ". Actions without a payload can be entered directly like ", _jsx("code", { children: "look" }), " or ", _jsx("code", { children: "inventory" }), "."] }), error && _jsx("p", { className: "error-banner", children: error }), _jsxs("div", { className: "hints", children: [_jsx("strong", { children: "Integration Tips" }), _jsxs("p", { children: ["Override endpoints with environment variables:", " ", _jsx("code", { children: "VITE_GAME_API_BASE_URL" }), ", ", _jsx("code", { children: "VITE_GAME_SESSIONS_ENDPOINT" }), ",", " ", _jsx("code", { children: "VITE_GAME_SCORES_ENDPOINT" }), ", ", _jsx("code", { children: "VITE_GAME_ACTIONS_SEGMENT" }), "."] }), _jsx("p", { children: "The server returns full state snapshots on every response, so the UI stays synchronized even if you refresh or reconnect." })] })] }) }));
};
const describeState = (state) => {
    const segments = [];
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
        segments.push(`Visible items: ${state.items_in_room.join(", ")}.`);
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
        segments.push(`Available actions: ${state.available_actions.join(", ")}.`);
    }
    return segments.filter(Boolean).join("\n\n");
};
export default GameView;
