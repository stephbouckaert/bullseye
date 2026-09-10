import { useEffect, useState } from "react";
import { Calendar, Trophy, CheckCircle2, Clock } from "lucide-react";
import api from "@/lib/api";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

const fmt = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

export default function Schedule() {
  const [weeks, setWeeks] = useState([]);
  const [openWeek, setOpenWeek] = useState(null);

  useEffect(() => {
    api.get("/schedule").then((r) => setWeeks(r.data.weeks)).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-ink-900">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <span className="font-mono text-xs uppercase tracking-widest text-amber-500">15 Weeks · Sundays 3–6 PM</span>
        <h1 className="font-head font-black uppercase text-4xl sm:text-5xl text-white mt-1 mb-8">Season Schedule</h1>

        <div className="space-y-3">
          {weeks.map((w) => (
            <div key={w.week} data-testid={`schedule-week-${w.week}`}
              className={`bg-ink-800 border rounded-2xl transition-all ${w.is_finals ? "border-crimson/40" : "border-white/10"} hover:border-amber-500/40`}>
              <button onClick={() => setOpenWeek(openWeek === w.week ? null : w.week)}
                data-testid={`schedule-week-toggle-${w.week}`}
                className="w-full flex items-center justify-between gap-4 p-5 text-left">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center shrink-0 ${w.is_finals ? "bg-crimson/15 border border-crimson/40" : "bg-white/5 border border-white/10"}`}>
                    <span className="font-mono text-[9px] uppercase text-gray-400">Week</span>
                    <span className="font-head font-black text-xl text-white leading-none">{w.week}</span>
                  </div>
                  <div>
                    <div className="font-head font-bold uppercase text-white text-lg flex items-center gap-2">
                      {fmt(w.date)}
                      {w.is_finals && <span className="flex items-center gap-1 text-crimson text-xs font-mono normal-case"><Trophy size={13} /> Finals & Party</span>}
                    </div>
                    <div className="font-mono text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                      <Clock size={12} /> 3:00 PM – 6:00 PM · {w.match_count} match{w.match_count !== 1 ? "es" : ""} logged
                    </div>
                  </div>
                </div>
                {w.is_past ? <CheckCircle2 className="text-emerald shrink-0" size={20} /> : <Calendar className="text-gray-500 shrink-0" size={20} />}
              </button>

              {openWeek === w.week && (
                <div className="border-t border-white/10 p-5">
                  {w.matches.length === 0 ? (
                    <p className="text-gray-500 text-sm font-mono">No matches recorded yet.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {w.matches.map((m) => (
                        <div key={m.id} className="bg-ink-900 border border-white/10 rounded-xl p-4">
                          <div className="flex items-center justify-between text-sm">
                            <span className={`font-head font-bold uppercase ${m.medley_winner_id === m.player_a_id ? "text-amber-400" : "text-gray-300"}`}>{m.player_a_name}</span>
                            <span className="font-mono text-xs text-gray-500">vs</span>
                            <span className={`font-head font-bold uppercase ${m.medley_winner_id === m.player_b_id ? "text-amber-400" : "text-gray-300"}`}>{m.player_b_name}</span>
                          </div>
                          <div className="flex items-center justify-center gap-2 mt-2 font-mono text-[11px] text-gray-500">
                            <span className="bg-white/5 px-2 py-0.5 rounded">Medley {m.medley_score}</span>
                            <span className="bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded">{m.points_a}–{m.points_b} pts</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
}
