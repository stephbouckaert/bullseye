import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { Menu, X, Target } from "lucide-react";
import { LOGO_URL } from "@/lib/assets";
import { useAuth } from "@/context/AuthContext";

const links = [
  { to: "/", label: "Home" },
  { to: "/standings", label: "Standings" },
  { to: "/schedule", label: "Schedule" },
  { to: "/finals", label: "Finals" },
  { to: "/rules", label: "Rules" },
  { to: "/register", label: "Register" },
  { to: "/portal", label: "My Stats" },
];

export const Navbar = () => {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-ink-900/80 border-b border-white/10">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[72px] flex items-center justify-between">
        <Link to="/" data-testid="nav-logo" className="flex items-center gap-3 group">
          <img src={LOGO_URL} alt="Belly Darts League" className="w-11 h-11 rounded-full ring-2 ring-amber-500/40 group-hover:ring-amber-500 transition-all" />
          <div className="leading-none hidden sm:block">
            <div className="font-head font-black text-xl uppercase tracking-wide text-white">Belly Darts</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-500">Hong Kong · League</div>
          </div>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              data-testid={`nav-${l.label.toLowerCase()}`}
              className={`px-4 py-2 rounded-lg font-head font-semibold uppercase tracking-wider text-sm transition-all ${
                pathname === l.to ? "text-amber-500 bg-white/5" : "text-gray-300 hover:text-white hover:bg-white/5"
              }`}
            >
              {l.label}
            </Link>
          ))}
          <Link
            to={user?.is_admin ? "/admin" : "/login"}
            data-testid="nav-admin"
            className="ml-2 flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-head font-bold uppercase tracking-wider px-5 py-2 rounded-lg transition-all active:scale-95"
          >
            <Target size={16} /> {user?.is_admin ? "Dashboard" : "Admin"}
          </Link>
        </div>

        <button data-testid="nav-mobile-toggle" className="md:hidden text-white" onClick={() => setOpen(!open)}>
          {open ? <X /> : <Menu />}
        </button>
      </nav>

      {open && (
        <div className="md:hidden border-t border-white/10 bg-ink-900 px-4 py-3 flex flex-col gap-1">
          {links.map((l) => (
            <Link key={l.to} to={l.to} onClick={() => setOpen(false)}
              data-testid={`nav-mobile-${l.label.toLowerCase()}`}
              className="px-4 py-3 rounded-lg font-head font-semibold uppercase tracking-wider text-sm text-gray-200 hover:bg-white/5">
              {l.label}
            </Link>
          ))}
          <Link to={user?.is_admin ? "/admin" : "/login"} onClick={() => setOpen(false)}
            className="px-4 py-3 rounded-lg font-head font-bold uppercase tracking-wider text-sm bg-amber-500 text-black text-center">
            {user?.is_admin ? "Dashboard" : "Admin Login"}
          </Link>
        </div>
      )}
    </header>
  );
};
