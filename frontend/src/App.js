import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { NavLink, Route, Routes } from "react-router-dom";
import GameView from "./pages/GameView";
import ScoresView from "./pages/ScoresView";
import "./App.css";
const App = () => {
    return (_jsxs("div", { className: "app-shell", children: [_jsxs("header", { className: "app-header", children: [_jsx("h1", { children: "Zork Adventure" }), _jsxs("nav", { children: [_jsx(NavLink, { to: "/", end: true, children: "Game" }), _jsx(NavLink, { to: "/scores", children: "Scoreboard" })] })] }), _jsx("main", { className: "app-main", children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(GameView, {}) }), _jsx(Route, { path: "/scores", element: _jsx(ScoresView, {}) })] }) })] }));
};
export default App;
