import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { LOGO_URL } from "@/lib/assets";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const hash = window.location.hash;
    const sessionId = new URLSearchParams(hash.replace("#", "")).get("session_id");

    const run = async () => {
      try {
        const res = await api.post("/auth/session", {}, { headers: { "X-Session-ID": sessionId } });
        setUser(res.data);
        window.history.replaceState(null, "", window.location.pathname);
        navigate("/admin", { replace: true, state: { user: res.data } });
      } catch {
        navigate("/login", { replace: true });
      }
    };
    if (sessionId) run();
    else navigate("/login", { replace: true });
  }, [navigate, setUser]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-ink-900">
      <img src={LOGO_URL} alt="loading" className="w-24 h-24 rounded-full spin-slow" />
      <p className="mt-6 font-head text-2xl uppercase tracking-widest text-amber-500">Checking your throw...</p>
    </div>
  );
}
