import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import AuthCallback from "@/components/AuthCallback";
import Home from "@/pages/Home";
import Standings from "@/pages/Standings";
import Schedule from "@/pages/Schedule";
import Rules from "@/pages/Rules";
import Register from "@/pages/Register";
import Login from "@/pages/Login";
import Admin from "@/pages/Admin";
import Portal from "@/pages/Portal";
import Finals from "@/pages/Finals";

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/standings" element={<Standings />} />
      <Route path="/schedule" element={<Schedule />} />
      <Route path="/rules" element={<Rules />} />
      <Route path="/register" element={<Register />} />
      <Route path="/portal" element={<Portal />} />
      <Route path="/finals" element={<Finals />} />
      <Route path="/login" element={<Login />} />
      <Route path="/admin" element={<Admin />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
          <Toaster theme="dark" position="top-right" richColors />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
