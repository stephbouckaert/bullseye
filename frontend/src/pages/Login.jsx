import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, LogIn } from "lucide-react";
import { LOGO_URL, IMAGES } from "@/lib/assets";
import { useAuth } from "@/context/AuthContext";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function Login() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user?.is_admin) navigate("/admin", { replace: true });
  }, [user, loading, navigate]);

  const handleLogin = () => {
    const redirectUrl = window.location.origin + "/admin";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen bg-ink-900 flex items-center justify-center relative overflow-hidden px-4">
      <img src={IMAGES.pub} alt="pub" className="absolute inset-0 w-full h-full object-cover opacity-15" />
      <div className="absolute inset-0 bg-ink-900/70 grain" />
      <div className="relative bg-ink-800 border border-white/10 rounded-3xl p-10 max-w-md w-full text-center">
        <img src={LOGO_URL} alt="logo" className="w-20 h-20 rounded-full mx-auto ring-2 ring-amber-500/40" />
        <div className="flex items-center justify-center gap-2 mt-6 text-amber-500 font-mono text-xs uppercase tracking-widest"><Shield size={14} /> Admin Access</div>
        <h1 className="font-head font-black uppercase text-4xl text-white mt-2 mb-3">Staff Login</h1>
        <p className="text-gray-400 text-sm mb-8">Sign in with Google to manage players, enter match scores and run the league.</p>
        <button onClick={handleLogin} data-testid="google-login-btn"
          className="w-full flex items-center justify-center gap-3 bg-amber-500 hover:bg-amber-400 text-black font-head font-bold uppercase tracking-wider py-4 rounded-xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all">
          <LogIn size={18} /> Continue with Google
        </button>
        <p className="text-gray-600 text-xs mt-6 font-mono">Only authorised venue staff can access the dashboard.</p>
      </div>
    </div>
  );
}
