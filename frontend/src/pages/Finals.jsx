import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Crown, Sparkles, PartyPopper } from "lucide-react";
import api from "@/lib/api";
import { IMAGES } from "@/lib/assets";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

const Slot = ({ seed, player, highlight }) => (
  <div data-testid={`bracket-slot-${seed ?? "tbd"}`}
    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 border transition-all ${highlight ? "bg-amber-500/15 border-amber-500/50" : "bg-ink-900 border-white/10"}`}>
    <span className={`font-head font-black text-sm w-6 text-center ${highlight ? "text-amber-400" : "text-gray-500"}`}>{seed ? seed : "–"}</span>
    <span className="font-head font-bold uppercase text-white text-sm truncate">{player ? player.name : "TBD"}</span>
    {player && <span className="ml-auto font-mono text-[11px] text-gray-400">{player.points}p</span>}
  </div>
);

const Match = ({ a, b }) => {
  // higher seed (lower rank index) is projected to advance
  const winner = a && b ? (a.rank <= b.rank ? a : b) : (a || b);
  return (
    <div className="space-y-1.5">
      <Slot seed={a?.rank} player={a} highlight={winner && a && winner.player_id === a.player_id} />
      <Slot seed={b?.rank} player={b} highlight={winner && b && winner.player_id === b.player_id} />
    </div>
  );
};

const Confetti = () => {
  const colors = ["#F59E0B", "#EF4444", "#10B981", "#FBBF24", "#ffffff"];
  const pieces = Array.from({ length: 60 });
  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {pieces.map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 0.6;
        const dur = 2.5 + Math.random() * 2;
        const size = 6 + Math.random() * 8;
        return (
          <motion.div key={`confetti-${i}`}
            initial={{ y: -40, opacity: 1, rotate: 0 }}
            animate={{ y: "110vh", rotate: 720, opacity: [1, 1, 0.8, 0] }}
            transition={{ duration: dur, delay, ease: "easeIn", repeat: Infinity }}
            style={{ position: "absolute", left: `${left}%`, width: size, height: size * 1.4, background: colors[i % colors.length], borderRadius: 2 }} />
        );
      })}
    </div>
  );
};

const championReveal = { initial: { scale: 0.7, opacity: 0 }, animate: { scale: 1, opacity: 1 }, transition: { type: "spring", stiffness: 200, damping: 15 } };
const trophyWobble = { animate: { rotate: [0, -8, 8, -8, 0] }, transition: { duration: 1.2, repeat: Infinity } };

export default function Finals() {
  const [seeds, setSeeds] = useState([]);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    api.get("/standings?month=all").then((r) => setSeeds(r.data.standings.slice(0, 8))).catch(() => {});
  }, []);

  const s = (i) => seeds[i] || null;
  const champion = s(0);

  return (
    <div className="min-h-screen bg-ink-900 relative">
      <Navbar />
      <AnimatePresence>{revealed && <Confetti />}</AnimatePresence>

      <section className="relative overflow-hidden border-b border-white/10">
        <img src={IMAGES.trophy} alt="trophy" className="absolute inset-0 w-full h-full object-cover opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/85 to-ink-900/60" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <span className="inline-flex items-center gap-2 bg-crimson/15 border border-crimson/40 text-crimson font-mono text-xs uppercase tracking-widest px-4 py-2 rounded-full"><PartyPopper size={14} /> December 27 · Finals & Party</span>
          <h1 className="font-head font-black uppercase text-5xl sm:text-7xl text-white mt-5">The Finals</h1>
          <p className="text-gray-300 max-w-2xl mx-auto mt-4">The top 8 of the season battle it out at Belly and the Beer. Seeds are set by overall league points.</p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Bracket */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-center" data-testid="finals-bracket">
          <div className="space-y-6">
            <div className="font-mono text-[11px] uppercase tracking-widest text-gray-400 mb-1">Quarterfinals</div>
            <Match a={s(0)} b={s(7)} />
            <Match a={s(3)} b={s(4)} />
            <Match a={s(2)} b={s(5)} />
            <Match a={s(1)} b={s(6)} />
          </div>
          <div className="space-y-16 lg:pt-10">
            <div className="font-mono text-[11px] uppercase tracking-widest text-gray-400 mb-1">Semifinals</div>
            <Match a={s(0)} b={s(3)} />
            <Match a={s(2)} b={s(1)} />
          </div>
          <div className="lg:pt-24">
            <div className="font-mono text-[11px] uppercase tracking-widest text-gray-400 mb-1">Final</div>
            <Match a={s(0)} b={s(1)} />
          </div>
          <div className="lg:pt-24 text-center">
            <div className="font-mono text-[11px] uppercase tracking-widest text-amber-500 mb-3">Projected Champion</div>
            <div className="bg-gradient-to-br from-amber-500/20 to-ink-800 border border-amber-500/40 rounded-2xl p-6">
              <Crown className="text-amber-400 mx-auto mb-2" size={32} />
              <div className="font-head font-black uppercase text-2xl text-white">{champion ? champion.name : "TBD"}</div>
              <div className="font-mono text-xs text-amber-500 mt-1">{champion ? `${champion.points} pts` : "—"}</div>
            </div>
          </div>
        </div>

        {/* Champion celebration */}
        <div className="mt-16 text-center">
          {!revealed ? (
            <button onClick={() => setRevealed(true)} data-testid="crown-champion-btn"
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-head font-bold uppercase tracking-wider px-8 py-4 rounded-xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all">
              <Sparkles size={18} /> Crown the Champion
            </button>
          ) : (
            <motion.div {...championReveal}
              data-testid="champion-celebration"
              className="relative max-w-xl mx-auto bg-gradient-to-br from-amber-500/25 to-ink-800 border border-amber-500/50 rounded-3xl p-10">
              <motion.div {...trophyWobble}>
                <Trophy className="text-amber-400 mx-auto mb-4" size={72} />
              </motion.div>
              <div className="font-mono text-xs uppercase tracking-widest text-amber-500">Belly Darts League Champion</div>
              <div className="font-head font-black uppercase text-5xl text-white mt-2">{champion ? champion.name : "TBD"}</div>
              {champion?.nickname && <div className="font-head text-xl text-amber-400 mt-1">"{champion.nickname}"</div>}
              <div className="font-head font-black text-3xl text-amber-400 mt-4">{champion ? `${champion.points} points` : ""}</div>
              <p className="text-gray-300 text-sm mt-5">Crowned at the December 27 finals & party. Drinks are on the house! 🍻</p>
              <button onClick={() => setRevealed(false)} data-testid="celebration-reset-btn" className="mt-6 bg-white/5 hover:bg-white/10 text-white font-head font-semibold uppercase text-sm border border-white/20 px-5 py-2.5 rounded-lg transition-all">Reset</button>
            </motion.div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
