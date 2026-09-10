import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Users, Target, LogOut, Trash2, Plus, DollarSign, CheckCircle2, XCircle, ClipboardList, Shield,
} from "lucide-react";
import api from "@/lib/api";
import { LOGO_URL } from "@/lib/assets";
import { useAuth } from "@/context/AuthContext";

const SEASON_DATES = Array.from({ length: 15 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 8, 20) + i * 7 * 86400000);
  return d.toISOString().slice(0, 10);
});
const fmtDate = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

function ScoreEntry({ players, onSaved }) {
  const empty = {
    date: SEASON_DATES[0], official: true, player_a_id: "", player_b_id: "",
    medley_winner_id: "", medley_score: "2-0", countup_winner_id: "", halfit_winner_id: "",
  };
  const [f, setF] = useState(empty);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const a = players.find((p) => p.id === f.player_a_id);
  const b = players.find((p) => p.id === f.player_b_id);
  const bothSet = f.player_a_id && f.player_b_id && f.player_a_id !== f.player_b_id;

  const WinnerPick = ({ label, field, testid }) => (
    <div>
      <label className="block font-mono text-[10px] uppercase tracking-widest text-gray-400 mb-2">{label} winner</label>
      <div className="grid grid-cols-2 gap-2">
        {[a, b].map((p) => p && (
          <button key={p.id} type="button" data-testid={`${testid}-${p.id === f.player_a_id ? "a" : "b"}`}
            onClick={() => set(field, p.id)}
            className={`px-3 py-2.5 rounded-lg font-head font-bold uppercase text-sm truncate transition-all ${f[field] === p.id ? "bg-amber-500 text-black" : "bg-ink-900 border border-white/10 text-gray-300 hover:border-amber-500/40"}`}>
            {p.name}
          </button>
        ))}
      </div>
    </div>
  );

  const submit = async (e) => {
    e.preventDefault();
    if (!bothSet) { toast.error("Pick two different players"); return; }
    if (!f.medley_winner_id || !f.countup_winner_id || !f.halfit_winner_id) { toast.error("Select a winner for each game"); return; }
    setSaving(true);
    try {
      await api.post("/admin/matches", f);
      toast.success("Match recorded");
      setF({ ...empty, date: f.date });
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not save match");
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={submit} data-testid="score-entry-form" className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-widest text-gray-400 mb-2">Matchday</label>
          <select data-testid="score-date-select" value={f.date} onChange={(e) => set("date", e.target.value)}
            className="w-full bg-ink-900 border border-white/10 focus:border-amber-500 rounded-lg px-3 py-2.5 text-white outline-none">
            {SEASON_DATES.map((d, i) => <option key={d} value={d}>Week {i + 1} · {fmtDate(d)}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2 flex items-end">
          <label className="flex items-center gap-2 cursor-pointer bg-ink-900 border border-white/10 rounded-lg px-4 py-2.5 w-full" data-testid="score-official-toggle" onClick={() => set("official", !f.official)}>
            {f.official ? <CheckCircle2 className="text-emerald" size={18} /> : <XCircle className="text-gray-500" size={18} />}
            <span className="font-head font-semibold uppercase text-sm text-white">Official league match</span>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-widest text-gray-400 mb-2">Player A</label>
          <select data-testid="score-player-a" value={f.player_a_id} onChange={(e) => set("player_a_id", e.target.value)}
            className="w-full bg-ink-900 border border-white/10 focus:border-amber-500 rounded-lg px-3 py-2.5 text-white outline-none">
            <option value="">Select player…</option>
            {players.map((p) => <option key={p.id} value={p.id} disabled={p.id === f.player_b_id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-widest text-gray-400 mb-2">Player B</label>
          <select data-testid="score-player-b" value={f.player_b_id} onChange={(e) => set("player_b_id", e.target.value)}
            className="w-full bg-ink-900 border border-white/10 focus:border-amber-500 rounded-lg px-3 py-2.5 text-white outline-none">
            <option value="">Select player…</option>
            {players.map((p) => <option key={p.id} value={p.id} disabled={p.id === f.player_a_id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      {bothSet && (
        <div className="space-y-4 bg-ink-900/50 border border-white/10 rounded-xl p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            <WinnerPick label="Medley" field="medley_winner_id" testid="medley-winner" />
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-widest text-gray-400 mb-2">Medley score</label>
              <div className="grid grid-cols-2 gap-2">
                {["2-0", "2-1"].map((s) => (
                  <button key={s} type="button" data-testid={`medley-score-${s}`} onClick={() => set("medley_score", s)}
                    className={`px-3 py-2.5 rounded-lg font-head font-bold text-sm transition-all ${f.medley_score === s ? "bg-amber-500 text-black" : "bg-ink-900 border border-white/10 text-gray-300 hover:border-amber-500/40"}`}>
                    {s} <span className="font-mono text-xs">({s === "2-0" ? "3" : "2"}pts)</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <WinnerPick label="Count Up (+1)" field="countup_winner_id" testid="countup-winner" />
            <WinnerPick label="Half It (+1)" field="halfit_winner_id" testid="halfit-winner" />
          </div>
        </div>
      )}

      <button type="submit" disabled={saving} data-testid="score-submit-btn"
        className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-head font-bold uppercase tracking-wider py-3.5 rounded-xl active:scale-95 transition-all">
        {saving ? "Saving…" : "Record Match Result"}
      </button>
    </form>
  );
}

export default function Admin() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("scores");
  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [newPlayer, setNewPlayer] = useState({ name: "", nickname: "", email: "", phone: "" });

  const load = useCallback(() => {
    api.get("/admin/players").then((r) => setPlayers(r.data)).catch(() => {});
    api.get("/matches").then((r) => setMatches(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!loading && !user?.is_admin) navigate("/login", { replace: true });
    if (user?.is_admin) load();
  }, [user, loading, navigate, load]);

  if (loading || !user?.is_admin) {
    return <div className="min-h-screen bg-ink-900 flex items-center justify-center"><img src={LOGO_URL} className="w-16 h-16 rounded-full spin-slow" alt="loading" /></div>;
  }

  const togglePaid = async (p) => {
    try { await api.put(`/admin/players/${p.id}`, { paid: !p.paid }); load(); } catch { toast.error("Update failed"); }
  };
  const delPlayer = async (p) => {
    if (!window.confirm(`Remove ${p.name}?`)) return;
    try { await api.delete(`/admin/players/${p.id}`); toast.success("Player removed"); load(); } catch { toast.error("Delete failed"); }
  };
  const delMatch = async (m) => {
    try { await api.delete(`/admin/matches/${m.id}`); toast.success("Match deleted"); load(); } catch { toast.error("Delete failed"); }
  };
  const addPlayer = async (e) => {
    e.preventDefault();
    if (!newPlayer.name || !newPlayer.email) { toast.error("Name and email required"); return; }
    try {
      await api.post("/admin/players", newPlayer);
      toast.success("Player added");
      setNewPlayer({ name: "", nickname: "", email: "", phone: "" });
      load();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };

  const paidCount = players.filter((p) => p.paid).length;
  const revenue = players.filter((p) => p.paid).reduce((s, p) => s + p.fee_amount, 0);

  const tabs = [
    { id: "scores", label: "Score Entry", icon: Target },
    { id: "players", label: "Players", icon: Users },
    { id: "matches", label: "Match Log", icon: ClipboardList },
  ];

  return (
    <div className="min-h-screen bg-ink-900">
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-ink-900/80 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[72px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="logo" className="w-10 h-10 rounded-full ring-2 ring-amber-500/40" />
            <div>
              <div className="font-head font-black uppercase text-lg text-white leading-none flex items-center gap-2"><Shield size={15} className="text-amber-500" /> Admin Dashboard</div>
              <div className="font-mono text-[10px] text-gray-400">{user.email}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/")} data-testid="admin-view-site-btn" className="hidden sm:block bg-white/5 hover:bg-white/10 text-white font-head font-semibold uppercase text-sm border border-white/20 px-4 py-2 rounded-lg transition-all">View Site</button>
            <button onClick={async () => { await logout(); navigate("/"); }} data-testid="admin-logout-btn" className="flex items-center gap-2 bg-crimson/10 hover:bg-crimson/20 text-crimson font-head font-semibold uppercase text-sm border border-crimson/30 px-4 py-2 rounded-lg transition-all"><LogOut size={16} /> Logout</button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { v: players.length, l: "Players", i: Users },
            { v: matches.length, l: "Matches Logged", i: ClipboardList },
            { v: `${paidCount}/${players.length}`, l: "Fees Paid", i: CheckCircle2 },
            { v: `$${revenue}`, l: "Revenue Collected", i: DollarSign },
          ].map((s, i) => (
            <div key={i} className="bg-ink-800 border border-white/10 rounded-xl p-5">
              <s.i className="text-amber-500 mb-2" size={22} />
              <div className="font-head font-black text-3xl text-white">{s.v}</div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-gray-400 mt-1">{s.l}</div>
            </div>
          ))}
        </div>

        {/* tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} data-testid={`admin-tab-${t.id}`}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-head font-semibold uppercase text-sm tracking-wide transition-all ${tab === t.id ? "bg-amber-500 text-black" : "bg-white/5 text-gray-300 hover:bg-white/10"}`}>
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </div>

        {tab === "scores" && (
          <div className="bg-ink-800 border border-white/10 rounded-2xl p-6 sm:p-8 max-w-3xl">
            <h2 className="font-head font-black uppercase text-2xl text-white mb-1">Record a Match</h2>
            <p className="text-gray-400 text-sm mb-6">Enter the 3-game result. Points are calculated automatically.</p>
            <ScoreEntry players={players} onSaved={load} />
          </div>
        )}

        {tab === "players" && (
          <div className="space-y-6">
            <form onSubmit={addPlayer} data-testid="add-player-form" className="bg-ink-800 border border-white/10 rounded-2xl p-6 grid grid-cols-1 sm:grid-cols-4 gap-3">
              {[["name", "Full name *"], ["nickname", "Nickname"], ["email", "Email *"], ["phone", "Phone"]].map(([k, ph]) => (
                <input key={k} data-testid={`add-player-${k}`} placeholder={ph} value={newPlayer[k]}
                  onChange={(e) => setNewPlayer({ ...newPlayer, [k]: e.target.value })}
                  className="bg-ink-900 border border-white/10 focus:border-amber-500 rounded-lg px-3 py-2.5 text-white placeholder-gray-600 outline-none" />
              ))}
              <button type="submit" data-testid="add-player-btn" className="sm:col-span-4 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-head font-bold uppercase tracking-wider py-3 rounded-lg active:scale-95 transition-all"><Plus size={16} /> Add Player</button>
            </form>

            <div className="bg-ink-800 border border-white/10 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left" data-testid="players-table">
                  <thead><tr className="border-b border-white/10 font-mono text-[10px] uppercase tracking-widest text-gray-400">
                    <th className="px-4 py-3">Player</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Tier</th><th className="px-4 py-3">Fee</th><th className="px-4 py-3">Paid</th><th className="px-4 py-3"></th>
                  </tr></thead>
                  <tbody>
                    {players.map((p) => (
                      <tr key={p.id} data-testid={`player-row-${p.id}`} className="border-b border-white/5 hover:bg-white/5">
                        <td className="px-4 py-3"><div className="font-head font-bold uppercase text-white">{p.name}</div>{p.nickname && <div className="font-mono text-[10px] text-amber-500/80">"{p.nickname}"</div>}</td>
                        <td className="px-4 py-3 text-gray-400 text-sm font-mono">{p.email}</td>
                        <td className="px-4 py-3"><span className={`font-mono text-[10px] uppercase px-2 py-1 rounded ${p.fee_tier === "early" ? "bg-emerald/15 text-emerald" : "bg-white/5 text-gray-400"}`}>{p.fee_tier}</span></td>
                        <td className="px-4 py-3 font-head font-bold text-white">${p.fee_amount}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => togglePaid(p)} data-testid={`toggle-paid-${p.id}`} className={`flex items-center gap-1.5 font-mono text-xs px-2.5 py-1 rounded-full transition-all ${p.paid ? "bg-emerald/15 text-emerald" : "bg-crimson/10 text-crimson"}`}>
                            {p.paid ? <><CheckCircle2 size={13} /> Paid</> : <><XCircle size={13} /> Unpaid</>}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right"><button onClick={() => delPlayer(p)} data-testid={`delete-player-${p.id}`} className="text-gray-500 hover:text-crimson transition-colors"><Trash2 size={16} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === "matches" && (
          <div className="bg-ink-800 border border-white/10 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left" data-testid="matches-table">
                <thead><tr className="border-b border-white/10 font-mono text-[10px] uppercase tracking-widest text-gray-400">
                  <th className="px-4 py-3">Date</th><th className="px-4 py-3">Matchup</th><th className="px-4 py-3 text-center">Medley</th><th className="px-4 py-3 text-center">Points</th><th className="px-4 py-3 text-center">Official</th><th className="px-4 py-3"></th>
                </tr></thead>
                <tbody>
                  {matches.map((m) => (
                    <tr key={m.id} data-testid={`match-row-${m.id}`} className="border-b border-white/5 hover:bg-white/5">
                      <td className="px-4 py-3 font-mono text-xs text-gray-400">{fmtDate(m.date)}</td>
                      <td className="px-4 py-3">
                        <span className={`font-head font-bold uppercase ${m.medley_winner_id === m.player_a_id ? "text-amber-400" : "text-gray-300"}`}>{m.player_a_name}</span>
                        <span className="text-gray-600 mx-2 font-mono text-xs">vs</span>
                        <span className={`font-head font-bold uppercase ${m.medley_winner_id === m.player_b_id ? "text-amber-400" : "text-gray-300"}`}>{m.player_b_name}</span>
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-sm text-gray-300">{m.medley_score}</td>
                      <td className="px-4 py-3 text-center font-head font-bold text-amber-400">{m.points_a}–{m.points_b}</td>
                      <td className="px-4 py-3 text-center">{m.official ? <CheckCircle2 className="inline text-emerald" size={16} /> : <XCircle className="inline text-gray-600" size={16} />}</td>
                      <td className="px-4 py-3 text-right"><button onClick={() => delMatch(m)} data-testid={`delete-match-${m.id}`} className="text-gray-500 hover:text-crimson transition-colors"><Trash2 size={16} /></button></td>
                    </tr>
                  ))}
                  {matches.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-500 font-mono">No matches recorded yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
