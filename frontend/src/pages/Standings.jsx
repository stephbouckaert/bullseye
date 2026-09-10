import { useEffect, useState } from "react";
import { Trophy, Medal, Target, Crosshair, Scissors, TrendingUp } from "lucide-react";
import api from "@/lib/api";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

const monthLabel = (m) => {
  if (m === "all") return "Overall";
  const [y, mo] = m.split("-");
  return new Date(y, mo - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
};

const rankStyle = (rank) => {
  if (rank === 1) return "text-amber-400 border-amber-400/50 bg-amber-400/10";
  if (rank === 2) return "text-gray-300 border-gray-300/40 bg-gray-300/10";
  if (rank === 3) return "text-orange-400 border-orange-400/40 bg-orange-400/10";
  return "text-gray-500 border-white/10 bg-transparent";
};

export default function Standings() {
  const [data, setData] = useState({ standings: [], months: [] });
  const [month, setMonth] = useState("all");

  useEffect(() => {
    api.get(`/standings?month=${month}`).then((r) => setData(r.data)).catch(() => {});
  }, [month]);

  const top3 = data.standings.slice(0, 3);
  const podiumOrder = [top3[1], top3[0], top3[2]];

  return (
    <div className="min-h-screen bg-ink-900">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <span className="font-mono text-xs uppercase tracking-widest text-amber-500">Leaderboard</span>
            <h1 className="font-head font-black uppercase text-4xl sm:text-5xl text-white mt-1">Standings</h1>
          </div>
          <div className="flex flex-wrap gap-2" data-testid="month-switcher">
            <button data-testid="standings-tab-all" onClick={() => setMonth("all")}
              className={`px-4 py-2 rounded-lg font-head font-semibold uppercase text-sm tracking-wide transition-all ${month === "all" ? "bg-amber-500 text-black" : "bg-white/5 text-gray-300 hover:bg-white/10"}`}>
              Overall
            </button>
            {data.months.map((m) => (
              <button key={m} data-testid={`standings-tab-${m}`} onClick={() => setMonth(m)}
                className={`px-4 py-2 rounded-lg font-head font-semibold uppercase text-sm tracking-wide transition-all ${month === m ? "bg-amber-500 text-black" : "bg-white/5 text-gray-300 hover:bg-white/10"}`}>
                {monthLabel(m)}
              </button>
            ))}
          </div>
        </div>

        {/* Podium */}
        {top3.length === 3 && (
          <div className="grid grid-cols-3 gap-3 sm:gap-6 mb-10">
            {podiumOrder.map((p, i) => {
              if (!p) return <div key={`podium-empty-${i}`} />;
              const heights = ["h-32", "h-44", "h-28"];
              const icons = [<Medal className="text-gray-300" />, <Trophy className="text-amber-400" size={30} />, <Medal className="text-orange-400" />];
              return (
                <div key={p.player_id} className="flex flex-col items-center justify-end">
                  <div className="mb-3 text-center">
                    <div className="flex justify-center mb-2">{icons[i]}</div>
                    <div className="font-head font-bold uppercase text-white text-sm sm:text-lg leading-tight">{p.name}</div>
                    <div className="font-mono text-amber-500 text-sm">{p.points} pts</div>
                  </div>
                  <div className={`w-full ${heights[i]} rounded-t-xl border-t border-x ${rankStyle(p.rank)} flex items-start justify-center pt-3`}>
                    <span className="font-head font-black text-4xl">{p.rank}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Table */}
        <div className="bg-ink-800 border border-white/10 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left" data-testid="standings-table">
              <thead>
                <tr className="border-b border-white/10 font-mono text-[11px] uppercase tracking-widest text-gray-400">
                  <th className="px-4 py-4">#</th>
                  <th className="px-4 py-4">Player</th>
                  <th className="px-3 py-4 text-center"><Target size={14} className="inline text-amber-500" /> Pts</th>
                  <th className="px-3 py-4 text-center">MP</th>
                  <th className="px-3 py-4 text-center"><Crosshair size={14} className="inline" /> Medley</th>
                  <th className="px-3 py-4 text-center"><TrendingUp size={14} className="inline" /> Count Up</th>
                  <th className="px-3 py-4 text-center"><Scissors size={14} className="inline" /> Half It</th>
                </tr>
              </thead>
              <tbody>
                {data.standings.map((r) => (
                  <tr key={r.player_id} data-testid={`standings-row-${r.rank}`}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border font-head font-black ${rankStyle(r.rank)}`}>{r.rank}</span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-head font-bold uppercase text-white">{r.name}</div>
                      {r.nickname && <div className="font-mono text-[11px] text-amber-500/80">"{r.nickname}"</div>}
                    </td>
                    <td className="px-3 py-4 text-center font-head font-black text-2xl text-amber-400">{r.points}</td>
                    <td className="px-3 py-4 text-center text-gray-300 font-mono">{r.matches_played}</td>
                    <td className="px-3 py-4 text-center text-gray-300 font-mono">{r.medley_wins}</td>
                    <td className="px-3 py-4 text-center text-gray-300 font-mono">{r.countup_wins}</td>
                    <td className="px-3 py-4 text-center text-gray-300 font-mono">{r.halfit_wins}</td>
                  </tr>
                ))}
                {data.standings.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500 font-mono">No results yet for {monthLabel(month)}.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
