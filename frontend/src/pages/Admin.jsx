import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Users, Target, LogOut, Trash2, Plus, DollarSign, CheckCircle2, XCircle, ClipboardList,
  Shield, Award, Pencil, Download, Clock, Check, X,
} from "lucide-react";
import api from "@/lib/api";
import { LOGO_URL } from "@/lib/assets";
import { useAuth } from "@/context/AuthContext";

const SEASON_DATES = Array.from({ length: 15 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 8, 20) + i * 7 * 86400000);
  return d.toISOString().slice(0, 10);
});
const fmtDate = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const isPending = (m) => m.confirmed === false;

function WinnerButtons({ a, b, value, onChange, testid }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {[a, b].map((p) => p && (
        <button key={p.id} type="button" data-testid={`${testid}-${p.id === a.id ? "a" : "b"}`}
          onClick={() => onChange(p.id)}
          className={`px-3 py-2.5 rounded-lg font-head font-bold uppercase text-sm truncate transition-all ${value === p.id ? "bg-amber-500 text-black" : "bg-ink-900 border border-white/10 text-gray-300 hover:border-amber-500/40"}`}>
          {p.name}
        </button>
      ))}
    </div>
  );
}

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
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-widest text-gray-400 mb-2">Medley winner</label>
              <WinnerButtons a={a} b={b} value={f.medley_winner_id} onChange={(v) => set("medley_winner_id", v)} testid="medley-winner" />
            </div>
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-widest text-gray-400 mb-2">Medley score</label>
              <div className="grid grid-cols-2 gap-2">
                {["2-0", "2-1"].map((sc) => (
                  <button key={sc} type="button" data-testid={`medley-score-${sc}`} onClick={() => set("medley_score", sc)}
                    className={`px-3 py-2.5 rounded-lg font-head font-bold text-sm transition-all ${f.medley_score === sc ? "bg-amber-500 text-black" : "bg-ink-900 border border-white/10 text-gray-300 hover:border-amber-500/40"}`}>
                    {sc} <span className="font-mono text-xs">({sc === "2-0" ? "3" : "2"}pts)</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block font-mono text-[10px] uppercase tracking-widest text-gray-400 mb-2">Count Up (+1)</label><WinnerButtons a={a} b={b} value={f.countup_winner_id} onChange={(v) => set("countup_winner_id", v)} testid="countup-winner" /></div>
            <div><label className="block font-mono text-[10px] uppercase tracking-widest text-gray-400 mb-2">Half It (+1)</label><WinnerButtons a={a} b={b} value={f.halfit_winner_id} onChange={(v) => set("halfit_winner_id", v)} testid="halfit-winner" /></div>
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

function EditMatchModal({ match, onClose, onSaved }) {
  const a = { id: match.player_a_id, name: match.player_a_name };
  const b = { id: match.player_b_id, name: match.player_b_name };
  const [f, setF] = useState({
    official: match.official,
    medley_winner_id: match.medley_winner_id,
    medley_score: match.medley_score,
    countup_winner_id: match.countup_winner_id,
    halfit_winner_id: match.halfit_winner_id,
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/admin/matches/${match.id}`, f);
      toast.success("Match updated");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Update failed");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" data-testid="edit-match-modal">
      <div className="bg-ink-800 border border-white/10 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-head font-black uppercase text-xl text-white">Edit Match</h3>
          <button onClick={onClose} data-testid="edit-close-btn" className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>
        <p className="font-head font-bold uppercase text-amber-400 mb-4">{a.name} <span className="text-gray-600 text-sm">vs</span> {b.name}</p>
        <div className="space-y-4">
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest text-gray-400 mb-2">Medley winner</label>
            <WinnerButtons a={a} b={b} value={f.medley_winner_id} onChange={(v) => set("medley_winner_id", v)} testid="edit-medley" />
          </div>
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest text-gray-400 mb-2">Medley score</label>
            <div className="grid grid-cols-2 gap-2">
              {["2-0", "2-1"].map((sc) => (
                <button key={sc} type="button" data-testid={`edit-medley-score-${sc}`} onClick={() => set("medley_score", sc)}
                  className={`px-3 py-2.5 rounded-lg font-head font-bold text-sm transition-all ${f.medley_score === sc ? "bg-amber-500 text-black" : "bg-ink-900 border border-white/10 text-gray-300 hover:border-amber-500/40"}`}>{sc}</button>
              ))}
            </div>
          </div>
          <div><label className="block font-mono text-[10px] uppercase tracking-widest text-gray-400 mb-2">Count Up winner</label><WinnerButtons a={a} b={b} value={f.countup_winner_id} onChange={(v) => set("countup_winner_id", v)} testid="edit-countup" /></div>
          <div><label className="block font-mono text-[10px] uppercase tracking-widest text-gray-400 mb-2">Half It winner</label><WinnerButtons a={a} b={b} value={f.halfit_winner_id} onChange={(v) => set("halfit_winner_id", v)} testid="edit-halfit" /></div>
          <label className="flex items-center gap-2 cursor-pointer" data-testid="edit-official-toggle" onClick={() => set("official", !f.official)}>
            {f.official ? <CheckCircle2 className="text-emerald" size={18} /> : <XCircle className="text-gray-500" size={18} />}
            <span className="font-head font-semibold uppercase text-sm text-white">Official league match</span>
          </label>
        </div>
        <button onClick={save} disabled={saving} data-testid="edit-save-btn"
          className="w-full mt-6 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-head font-bold uppercase tracking-wider py-3 rounded-xl active:scale-95 transition-all">
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

export default function Admin() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("scores");
  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [rewardDrafts, setRewardDrafts] = useState({});
  const [newPlayer, setNewPlayer] = useState({ name: "", nickname: "", email: "", phone: "" });
  const [editing, setEditing] = useState(null);

  const load = useCallback(() => {
    api.get("/admin/players").then((r) => setPlayers(r.data)).catch(() => {});
    api.get("/matches").then((r) => setMatches(r.data)).catch(() => {});
    api.get("/rewards").then((r) => {
      setRewards(r.data);
      setRewardDrafts(Object.fromEntries(r.data.map((x) => [x.month, x.reward])));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!loading && !user?.is_admin) navigate("/login", { replace: true });
    if (user?.is_admin) load();
  }, [user, loading, navigate, load]);

  if (loading || !user?.is_admin) {
    return <div className="min-h-screen bg-ink-900 flex items-center justify-center"><img src={LOGO_URL} className="w-16 h-16 rounded-full spin-slow" alt="loading" /></div>;
  }

  const togglePaid = async (p) => { try { await api.put(`/admin/players/${p.id}`, { paid: !p.paid }); load(); } catch { toast.error("Update failed"); } };
  const delPlayer = async (p) => { if (!window.confirm(`Remove ${p.name}?`)) return; try { await api.delete(`/admin/players/${p.id}`); toast.success("Player removed"); load(); } catch { toast.error("Delete failed"); } };
  const delMatch = async (m) => { try { await api.delete(`/admin/matches/${m.id}`); toast.success("Match deleted"); load(); } catch { toast.error("Delete failed"); } };
  const confirmMatch = async (m) => { try { await api.put(`/admin/matches/${m.id}/confirm`); toast.success("Match confirmed — now counts toward standings"); load(); } catch { toast.error("Confirm failed"); } };
  const addPlayer = async (e) => {
    e.preventDefault();
    if (!newPlayer.name || !newPlayer.email) { toast.error("Name and email required"); return; }
    try { await api.post("/admin/players", newPlayer); toast.success("Player added"); setNewPlayer({ name: "", nickname: "", email: "", phone: "" }); load(); }
    catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };
  const saveReward = async (month) => {
    try { await api.put(`/admin/rewards/${month}`, { reward: rewardDrafts[month] || "" }); toast.success("Reward saved"); load(); }
    catch { toast.error("Save failed"); }
  };
  const exportCsv = async () => {
    try {
      const res = await api.get("/admin/matches/export", { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url; a.download = "belly-darts-matches.csv"; a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV exported");
    } catch { toast.error("Export failed"); }
  };

  const paidCount = players.filter((p) => p.paid).length;
  const revenue = players.filter((p) => p.paid).reduce((s, p) => s + p.fee_amount, 0);
  const pendingCount = matches.filter(isPending).length;

  const tabs = [
    { id: "scores", label: "Score Entry", icon: Target },
    { id: "players", label: "Players", icon: Users },
    { id: "matches", label: "Match Log", icon: ClipboardList, badge: pendingCount },
    { id: "rewards", label: "Rewards", icon: Award },
  ];

  const nameOf = (m, pid) => (pid === m.player_a_id ? m.player_a_name : m.player_b_name);

  return (
    <div className="min-h-screen bg-ink-900">
      {editing && <EditMatchModal match={editing} onClose={() => setEditing(null)} onSaved={load} />}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-ink-900/80 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[72px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="logo" className="w-10 h-10 rounded-full ring-2 ring-amber-500/40" />
            <div>
              <div className="font-head font-black uppercase text-lg text-white leading-none flex items-center gap-2"><Shield size={15} className="text-amber-500" /> Moderator Dashboard</div>
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
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {[
            { v: players.length, l: "Players", i: Users },
            { v: matches.length, l: "Matches", i: ClipboardList },
            { v: pendingCount, l: "Pending Review", i: Clock },
            { v: `${paidCount}/${players.length}`, l: "Fees Paid", i: CheckCircle2 },
            { v: `$${revenue}`, l: "Revenue", i: DollarSign },
          ].map((st) => (
            <div key={st.l} className="bg-ink-800 border border-white/10 rounded-xl p-5">
              <st.i className={`mb-2 ${st.l === "Pending Review" && pendingCount > 0 ? "text-amber-400" : "text-amber-500"}`} size={22} />
              <div className="font-head font-black text-3xl text-white">{st.v}</div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-gray-400 mt-1">{st.l}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mb-6 flex-wrap">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} data-testid={`admin-tab-${t.id}`}
              className={`relative flex items-center gap-2 px-5 py-2.5 rounded-lg font-head font-semibold uppercase text-sm tracking-wide transition-all ${tab === t.id ? "bg-amber-500 text-black" : "bg-white/5 text-gray-300 hover:bg-white/10"}`}>
              <t.icon size={16} /> {t.label}
              {t.badge > 0 && <span className="ml-1 bg-crimson text-white text-[10px] font-mono px-1.5 py-0.5 rounded-full">{t.badge}</span>}
            </button>
          ))}
        </div>

        {tab === "scores" && (
          <div className="bg-ink-800 border border-white/10 rounded-2xl p-6 sm:p-8 max-w-3xl">
            <h2 className="font-head font-black uppercase text-2xl text-white mb-1">Record a Match</h2>
            <p className="text-gray-400 text-sm mb-6">Staff-entered matches are confirmed automatically. Points are calculated for you.</p>
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
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/10">
              <div className="font-head font-bold uppercase text-white">{pendingCount > 0 ? `${pendingCount} awaiting confirmation` : "All matches confirmed"}</div>
              <button onClick={exportCsv} data-testid="export-csv-btn" className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white font-head font-semibold uppercase text-sm border border-white/20 px-4 py-2 rounded-lg transition-all"><Download size={15} /> Export CSV</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left" data-testid="matches-table">
                <thead><tr className="border-b border-white/10 font-mono text-[10px] uppercase tracking-widest text-gray-400">
                  <th className="px-4 py-3">Date</th><th className="px-4 py-3">Matchup</th><th className="px-4 py-3 text-center">Medley</th><th className="px-4 py-3 text-center">Points</th><th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3 text-right">Actions</th>
                </tr></thead>
                <tbody>
                  {matches.map((m) => (
                    <tr key={m.id} data-testid={`match-row-${m.id}`} className={`border-b border-white/5 hover:bg-white/5 ${isPending(m) ? "bg-amber-500/5" : ""}`}>
                      <td className="px-4 py-3 font-mono text-xs text-gray-400">{fmtDate(m.date)}</td>
                      <td className="px-4 py-3">
                        <span className={`font-head font-bold uppercase ${m.medley_winner_id === m.player_a_id ? "text-amber-400" : "text-gray-300"}`}>{m.player_a_name}</span>
                        <span className="text-gray-600 mx-2 font-mono text-xs">vs</span>
                        <span className={`font-head font-bold uppercase ${m.medley_winner_id === m.player_b_id ? "text-amber-400" : "text-gray-300"}`}>{m.player_b_name}</span>
                        {m.submitted_by && <div className="font-mono text-[10px] text-gray-500 mt-0.5">submitted by player</div>}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-sm text-gray-300">{m.medley_score}</td>
                      <td className="px-4 py-3 text-center font-head font-bold text-amber-400">{m.points_a}–{m.points_b}</td>
                      <td className="px-4 py-3 text-center">
                        {isPending(m)
                          ? <span className="font-mono text-[10px] text-amber-500 flex items-center justify-center gap-1"><Clock size={12} /> Pending</span>
                          : (m.official ? <span className="font-mono text-[10px] text-emerald flex items-center justify-center gap-1"><CheckCircle2 size={13} /> Confirmed</span> : <span className="font-mono text-[10px] text-gray-500">Unofficial</span>)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {isPending(m) && <button onClick={() => confirmMatch(m)} data-testid={`confirm-match-${m.id}`} className="flex items-center gap-1 bg-emerald/15 hover:bg-emerald/25 text-emerald font-mono text-xs px-2.5 py-1.5 rounded-lg transition-all"><Check size={13} /> Confirm</button>}
                          <button onClick={() => setEditing(m)} data-testid={`edit-match-${m.id}`} className="text-gray-500 hover:text-amber-400 transition-colors"><Pencil size={16} /></button>
                          <button onClick={() => delMatch(m)} data-testid={`delete-match-${m.id}`} className="text-gray-500 hover:text-crimson transition-colors"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {matches.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-500 font-mono">No matches recorded yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "rewards" && (
          <div className="bg-ink-800 border border-white/10 rounded-2xl p-6 sm:p-8 max-w-2xl">
            <h2 className="font-head font-black uppercase text-2xl text-white mb-1 flex items-center gap-2"><Award className="text-amber-500" /> Monthly Rewards</h2>
            <p className="text-gray-400 text-sm mb-6">Set a different prize for each month's top points scorer. Shown publicly on the home page.</p>
            <div className="space-y-4" data-testid="rewards-editor">
              {rewards.map((r) => (
                <div key={r.month} className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="font-head font-bold uppercase text-white w-40 shrink-0">{r.label}</div>
                  <input data-testid={`reward-input-${r.month}`} value={rewardDrafts[r.month] ?? ""}
                    onChange={(e) => setRewardDrafts({ ...rewardDrafts, [r.month]: e.target.value })}
                    placeholder="e.g. HK$500 bar tab" className="flex-1 bg-ink-900 border border-white/10 focus:border-amber-500 rounded-lg px-3 py-2.5 text-white placeholder-gray-600 outline-none" />
                  <button onClick={() => saveReward(r.month)} data-testid={`reward-save-${r.month}`} className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-black font-head font-bold uppercase text-sm px-4 py-2.5 rounded-lg active:scale-95 transition-all"><Check size={15} /> Save</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
