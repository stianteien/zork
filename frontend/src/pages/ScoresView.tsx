import { useCallback, useEffect, useRef, useState } from "react";
import { apiConfig, fetchScores, ScoreModel } from "../api/client";
import "./ScoresView.css";

const POLL_INTERVAL_MS = 3000;

const ScoresView = () => {
  const [scores, setScores] = useState<ScoreModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const loadScores = useCallback(
    async (options?: { silent?: boolean }) => {
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
      } catch (err) {
        console.error(err);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load scores. Confirm GET /scores is available."
        );
      } finally {
        inFlightRef.current = false;
        if (!silent) {
          setLoading(false);
        }
      }
    },
    []
  );

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

  return (
    <section className="scores-view">
      <div className="scores-panel">
        <header className="scores-header">
          <div>
            <h2>Scoreboard</h2>
            <p className="scores-subtitle">
              Top runs reported by the adventure service.
            </p>
          </div>
          <div className="scores-controls">
            <span className="scores-meta">
              {loading ? "Refreshing…" : `${scores.length} entr${scores.length === 1 ? "y" : "ies"}`}
            </span>
            <button
              type="button"
              onClick={() => {
                void loadScores();
              }}
              disabled={loading}
              className="ghost-button"
            >
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>
        </header>

        {error && <p className="error-banner">{error}</p>}

        <div className="scores-table-wrapper">
          <table className="scores-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={3} className="placeholder">
                    Fetching scores…
                  </td>
                </tr>
              )}
              {!loading && scores.length === 0 && !error && (
                <tr>
                  <td colSpan={3} className="placeholder">
                    No recorded scores yet. Finish a session to publish your run.
                  </td>
                </tr>
              )}
              {!loading &&
                scores.map((entry, index) => (
                  <tr key={`${entry.player_name}-${index}`}>
                    <td>{index + 1}</td>
                    <td>{entry.player_name}</td>
                    <td>{entry.score.toLocaleString()}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <p className="score-hint">
          Scores are served from <code>{scoreboardUrl}</code>. Override with{" "}
          <code>VITE_GAME_SCORES_ENDPOINT</code> if your backend differs.
        </p>
      </div>
    </section>
  );
};

export default ScoresView;
