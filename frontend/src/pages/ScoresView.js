import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiConfig, fetchScores } from "../api/client";
import "./ScoresView.css";
const POLL_INTERVAL_MS = 3000;
const ScoresView = () => {
    const [scores, setScores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const inFlightRef = useRef(false);
    const loadScores = useCallback(async (options) => {
        if (inFlightRef.current) {
            return;
        }
        const silent = Boolean(options?.silent);
        inFlightRef.current = true;
        if (!silent) {
            setLoading(true);
            setError(null);
        }
        try {
            const data = await fetchScores();
            setScores(data);
            setError(null);
        }
        catch (err) {
            console.error(err);
            setError(err instanceof Error
                ? err.message
                : "Failed to load scores. Confirm GET /scores is available.");
        }
        finally {
            inFlightRef.current = false;
            if (!silent) {
                setLoading(false);
            }
        }
    }, []);
    useEffect(() => {
        let cancelled = false;
        void loadScores().catch(() => {
            /* handled in loadScores */
        });
        const intervalId = window.setInterval(() => {
            if (cancelled || document.hidden) {
                return;
            }
            void loadScores({ silent: true });
        }, POLL_INTERVAL_MS);
        return () => {
            cancelled = true;
            window.clearInterval(intervalId);
        };
    }, [loadScores]);
    useEffect(() => {
        const handleVisibility = () => {
            if (!document.hidden) {
                void loadScores({ silent: true });
            }
        };
        document.addEventListener("visibilitychange", handleVisibility);
        return () => {
            document.removeEventListener("visibilitychange", handleVisibility);
        };
    }, [loadScores]);
    const scoreboardUrl = `${apiConfig.baseUrl}${apiConfig.scoresPath}`;
    return (_jsx("section", { className: "scores-view", children: _jsxs("div", { className: "scores-panel", children: [_jsxs("header", { className: "scores-header", children: [_jsxs("div", { children: [_jsx("h2", { children: "Scoreboard" }), _jsx("p", { className: "scores-subtitle", children: "Top runs reported by the adventure service." })] }), _jsxs("div", { className: "scores-controls", children: [_jsx("span", { className: "scores-meta", children: loading ? "Refreshing…" : `${scores.length} entr${scores.length === 1 ? "y" : "ies"}` }), _jsx("button", { type: "button", onClick: () => {
                                        void loadScores();
                                    }, disabled: loading, className: "ghost-button", children: loading ? "Loading…" : "Refresh" })] })] }), error && _jsx("p", { className: "error-banner", children: error }), _jsx("div", { className: "scores-table-wrapper", children: _jsxs("table", { className: "scores-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "#" }), _jsx("th", { children: "Player" }), _jsx("th", { children: "Score" })] }) }), _jsxs("tbody", { children: [loading && (_jsx("tr", { children: _jsx("td", { colSpan: 3, className: "placeholder", children: "Fetching scores\u2026" }) })), !loading && scores.length === 0 && !error && (_jsx("tr", { children: _jsx("td", { colSpan: 3, className: "placeholder", children: "No recorded scores yet. Finish a session to publish your run." }) })), !loading &&
                                        scores.map((entry, index) => (_jsxs("tr", { children: [_jsx("td", { children: index + 1 }), _jsx("td", { children: entry.player_name }), _jsx("td", { children: entry.score.toLocaleString() })] }, `${entry.player_name}-${index}`)))] })] }) }), _jsxs("p", { className: "score-hint", children: ["Scores are served from ", _jsx("code", { children: scoreboardUrl }), ". Override with", " ", _jsx("code", { children: "VITE_GAME_SCORES_ENDPOINT" }), " if your backend differs."] })] }) }));
};
export default ScoresView;
