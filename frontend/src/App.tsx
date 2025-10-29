import { NavLink, Route, Routes } from "react-router-dom";
import GameView from "./pages/GameView";
import ScoresView from "./pages/ScoresView";
import "./App.css";

const App = () => {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Zork Adventure</h1>
        <nav>
          <NavLink to="/" end>
            Game
          </NavLink>
          <NavLink to="/scores">Scoreboard</NavLink>
        </nav>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<GameView />} />
          <Route path="/scores" element={<ScoresView />} />
        </Routes>
      </main>
    </div>
  );
};

export default App;
