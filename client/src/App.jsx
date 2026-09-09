import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Meeting from "./pages/Meeting.jsx";
import Summary from "./pages/Summary.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/meeting/:room" element={<Meeting />} />
      <Route path="/summary/:room" element={<Summary />} />
    </Routes>
  );
}
