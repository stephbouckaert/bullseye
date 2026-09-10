import { useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Search, Trophy, Target, Crosshair, TrendingUp, Scissors, Calendar, Send,
  CheckCircle2, XCircle, Clock, User,
} from "lucide-react";
import api from "@/lib/api";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

const SEASON_DATES = Array.from({ length: 15 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 8, 20) + i * 7 * 86400000);
  return d.toISOString().slice(0, 10);
});
const fmt = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

function SubmitMatch({ me, players, onDone }) {
  const opponents = players.filter((p) => p.id !== me.player.id);
  const empty = { opponent_id: "", date: SEASON_DATES[0], official: true, medley_winner: "me", medley_score: "2-0", countup_winner: "me", halfit_winner: "me" };
  const [f, setF] = useState(empty);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const opp = opponents.find((o) => o.id === f.opponent_id);

  const Picker = ({ label, field, testid }) => (
    <div>
      <label className="block font-mono text-[10px] uppercase tracking-widest text-gray-400 mb-2">{label}</label>
      <div className="grid grid-cols-2 gap-2">
        {[["me", me.player.name], ["opp", opp?.name || "Opponent"]].map(([val, name]) => (
          <button key={val} type="button" data-testid={`${testid}-${val}`} onClick={() => set(field, val)}
            className={`px-3 py-2.5 rounded-lg font-head font-bold uppercase text-sm truncate transition-all ${f[field] === val ? "bg-amber-500 text-black" : "bg-ink-900 border border-white/10 text-gray-300 hover:border-amber-500/40"}`}>
            {name}
          </button>
        ))}
      </div>
    </div>
  );

  const submit = async (e) => {
    e.preventDefault();
    if (!f.opponent_id) { toast.error("Pick your opponent"); return; }
    setSaving(true);
    try {
      await api.post("/players/submit-match", { submitter_email: me.player.email, ...f });
      toast.success("Result submitted — awaiting moderator confirmation");
      setF(empty);
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not submit");
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={submit} data-testid="submit-match-form" className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-widest text-gray-400 mb-2">Opponent</label>
          <select data-testid="submit-opponent" value={f.opponent_id} onChange={(e) => set("opponent_id", e.target.value)}
            className="w-full bg-ink-900 border border-white/10 focus:border-amber-500 rounded-lg px-3 py-2.5 text-white outline-none">
            <option value="">Select…</option>
            {opponents.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-widest text-gray-400 mb-2">Matchday</label>
          <select data-testid="submit-date" value={f.date} onChange={(e) => set("date", e.target.value)}
            className="w-full bg-ink-900 border border-white/10 focus:border-amber-500 rounded-lg px-3 py-2.5 text-white outline-none">
            {SEASON_DATES.map((d, i) => <option key={d} value={d}>Week {i + 1} · {fmt(d)}</option>)}
          </select>
        </div>
      </div>

      {f.opponent_id && (
        <div className="space-y-4 bg-ink-900/50 border border-white/10 rounded-xl p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Picker label="Medley winner" field="medley_winner" testid="submit-medley" />
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-widest text-gray-400 mb-2">Medley score</label>
              <div className="grid grid-cols-2 gap-2">
                {["2-0", "2-1"].map((s) => (
                  <button key={s} type="button" data-testid={`submit-medley-score-${s}`} onClick={() => set("medley_score", s)}
                    className={`px-3 py-2.5 rounded-lg font-head font-bold text-sm transition-all ${f.medley_score === s ? "bg-amber-500 text-black" : "bg-ink-900 border border-white/10 text-gray-300 hover:border-amber-500/40"}`}>{s}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Picker label="Count Up winner" field="countup_winner" testid="submit-countup" />
            <Picker label="Half It winner" field="halfit_winner" testid="submit-halfit" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer" data-testid="submit-official" onClick={() => set("official", !f.official)}>
            {f.official ? <CheckCircle2 className="text-emerald" size={18} /> : <XCircle className="text-gray-500" size={18} />}
            <span className="font-head font-semibold uppercase text-sm text-white">Both players agreed this is official</span>
          </label>
        </div>
      )}

      <button type="submit" disabled={saving} data-testid="submit-match-btn"
        className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-head font-bold uppercase tracking-wider py-3.5 rounded-xl active:scale-95 transition-all">
        <Send size={16} /> {saving ? "Submitting…" : "Submit Result for Review"}
      </button>
    </form>
  );
}

export default function Portal() {
  const [email, setEmail] = useState("");
  const [data, setData] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(false);

  const lookup = async (e) => {
    e?.preventDefault();
    if (!email) { toast.error("Enter your email"); return; }
    setLoading(true);
    try {
      const [me, pl] = await Promise.all([
        api.get(`/players/lookup?email=${encodeURIComponent(email)}`),
        api.get("/players"),
      ]);
      setData(me.data);
      setPlayers(pl.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Lookup failed");
      setData(null);
    } finally { setLoading(false); }
  };

  const refresh = () => {
    api.get(`/players/lookup?email=${encodeURIComponent(email)}`).then((r) => setData(r.data)).catch(() => {});
  };

  const s = data?.stats;

  return (
    <div className="min-h-screen bg-ink-900">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <span className="font-mono text-xs uppercase tracking-widest text-amber-500">Player Portal</span>
        <h1 className="font-head font-black uppercase text-4xl sm:text-5xl text-white mt-1 mb-6">My Stats</h1>

        <form onSubmit={lookup} data-testid="portal-lookup-form" className="flex flex-col sm:flex-row gap-3 mb-10 max-w-xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input data-testid="portal-email-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") lookup(e); }}
              placeholder="Enter your registered email"
              className="w-full bg-ink-800 border border-white/10 focus:border-amber-500 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-600 outline-none transition-colors" />
          </div>
          <button type="submit" disabled={loading} data-testid="portal-lookup-btn"
            className="bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-head font-bold uppercase tracking-wider px-7 py-3 rounded-xl active:scale-95 transition-all">
            {loading ? "Loading…" : "Find Me"}
          </button>
        </form>

        {data && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* header card */}
            <div className="bg-gradient-to-br from-amber-500/15 to-ink-800 border border-amber-500/30 rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center"><User className="text-amber-400" /></div>
                <div>
                  <div className="font-head font-black uppercase text-2xl text-white">{data.player.name}</div>
                  {data.player.nickname && <div className="font-mono text-xs text-amber-500">"{data.player.nickname}"</div>}
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center"><div className="font-head font-black text-4xl text-amber-400">{s?.rank ? `#${s.rank}` : "—"}</div><div className="font-mono text-[10px] uppercase tracking-widest text-gray-400">Rank</div></div>
                <div className="text-center"><div className="font-head font-black text-4xl text-white">{s?.points ?? 0}</div><div className="font-mono text-[10px] uppercase tracking-widest text-gray-400">Points</div></div>
                <div className="text-center">
                  <div className={`font-head font-bold text-sm px-2.5 py-1 rounded-full ${data.player.paid ? "bg-emerald/15 text-emerald" : "bg-crimson/10 text-crimson"}`}>{data.player.paid ? "Fee Paid" : "Fee Due"}</div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-gray-400 mt-1">${data.player.fee_amount}</div>
                </div>
              </div>
            </div>

            {/* stat grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { i: Target, l: "Matches", v: s?.matches_played ?? 0 },
                { i: Crosshair, l: "Medley Wins", v: s?.medley_wins ?? 0 },
                { i: TrendingUp, l: "Count Up Wins", v: s?.countup_wins ?? 0 },
                { i: Scissors, l: "Half It Wins", v: s?.halfit_wins ?? 0 },
              ].map((x) => (
                <div key={x.l} className="bg-ink-800 border border-white/10 rounded-xl p-5">
                  <x.i className="text-amber-500 mb-2" size={20} />
                  <div className="font-head font-black text-3xl text-white">{x.v}</div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-gray-400 mt-1">{x.l}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* submit */}
              <div className="bg-ink-800 border border-white/10 rounded-2xl p-6">
                <h2 className="font-head font-black uppercase text-xl text-white mb-1">Log a Match Result</h2>
                <p className="text-gray-400 text-sm mb-5">Enter your result — a moderator confirms it before it counts.</p>
                <SubmitMatch me={data} players={players} onDone={refresh} />
              </div>

              {/* upcoming */}
              <div className="bg-ink-800 border border-white/10 rounded-2xl p-6">
                <h2 className="font-head font-black uppercase text-xl text-white mb-4 flex items-center gap-2"><Calendar size={20} className="text-amber-500" /> Upcoming Matchdays</h2>
                <div className="space-y-2 max-h-[360px] overflow-y-auto">
                  {data.upcoming.length === 0 && <p className="text-gray-500 text-sm font-mono">Season complete.</p>}
                  {data.upcoming.map((d, i) => (
                    <div key={d} className="flex items-center justify-between bg-ink-900 border border-white/10 rounded-lg px-4 py-3">
                      <span className="font-head font-bold uppercase text-white">{fmt(d)}</span>
                      <span className="font-mono text-[11px] text-gray-500 flex items-center gap-1"><Clock size={12} /> 3–6 PM</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* history */}
            <div className="bg-ink-800 border border-white/10 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-white/10"><h2 className="font-head font-black uppercase text-xl text-white flex items-center gap-2"><Trophy size={18} className="text-amber-500" /> Match History</h2></div>
              <div className="overflow-x-auto">
                <table className="w-full text-left" data-testid="portal-history-table">
                  <thead><tr className="border-b border-white/10 font-mono text-[10px] uppercase tracking-widest text-gray-400">
                    <th className="px-4 py-3">Date</th><th className="px-4 py-3">Opponent</th><th className="px-4 py-3 text-center">Result</th><th className="px-4 py-3 text-center">Score</th><th className="px-4 py-3 text-center">Medley</th><th className="px-4 py-3 text-center">Status</th>
                  </tr></thead>
                  <tbody>
                    {data.history.map((m) => (
                      <tr key={m.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="px-4 py-3 font-mono text-xs text-gray-400">{fmt(m.date)}</td>
                        <td className="px-4 py-3 font-head font-bold uppercase text-white">{m.opponent}</td>
                        <td className="px-4 py-3 text-center"><span className={`font-head font-bold text-xs px-2 py-1 rounded ${m.won ? "bg-emerald/15 text-emerald" : "bg-crimson/10 text-crimson"}`}>{m.won ? "WON" : "LOST"}</span></td>
                        <td className="px-4 py-3 text-center font-head font-black text-amber-400">{m.points}–{m.opponent_points}</td>
                        <td className="px-4 py-3 text-center font-mono text-xs text-gray-300">{m.medley_score}</td>
                        <td className="px-4 py-3 text-center">{m.confirmed === false ? <span className="font-mono text-[10px] text-amber-500 flex items-center justify-center gap-1"><Clock size={12} /> Pending</span> : <CheckCircle2 className="inline text-emerald" size={15} />}</td>
                      </tr>
                    ))}
                    {data.history.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-500 font-mono">No matches yet — log your first result above.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </div>
      <Footer />
    </div>
  );
}
