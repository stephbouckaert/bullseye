import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Target, Beer, Trophy, Calendar, Clock, MapPin, ArrowRight, Zap, Users } from "lucide-react";
import api from "@/lib/api";
import { IMAGES, GAME_IMAGES } from "@/lib/assets";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

const Stat = ({ value, label, icon: Icon }) => (
  <div className="bg-ink-800 border border-white/10 rounded-xl p-6 hover:border-amber-500/40 transition-all">
    <Icon className="text-amber-500 mb-3" size={26} />
    <div className="font-head font-black text-3xl sm:text-4xl text-white">{value}</div>
    <div className="font-mono text-[11px] uppercase tracking-widest text-gray-400 mt-1">{label}</div>
  </div>
);

export default function Home() {
  const [info, setInfo] = useState(null);
  const [playerCount, setPlayerCount] = useState(0);
  const [rewards, setRewards] = useState([]);

  useEffect(() => {
    api.get("/league/info").then((r) => setInfo(r.data)).catch(() => {});
    api.get("/players").then((r) => setPlayerCount(r.data.length)).catch(() => {});
    api.get("/rewards").then((r) => setRewards(r.data)).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-ink-900">
      <Navbar />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={IMAGES.hero} alt="dartboard" className="w-full h-full object-cover opacity-25" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/85 to-ink-900/60" />
          <div className="absolute inset-0 grain" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <span className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-xs uppercase tracking-widest px-4 py-2 rounded-full">
              <Beer size={14} /> Belly and the Beer · 21 Elgin St, Hong Kong
            </span>
            <h1 className="font-head font-black uppercase tracking-tight text-white text-5xl sm:text-7xl lg:text-8xl mt-6 leading-[0.9]">
              Belly Darts<br /><span className="text-amber-500">League</span>
            </h1>
            <p className="text-gray-300 text-lg sm:text-xl max-w-2xl mt-6 leading-relaxed">
              15 weeks of raw precision, cold pints and Sunday showdowns. Throw for the bullseye, stack your points, and battle for the trophy at the December 27 finals.
            </p>
            <div className="flex flex-wrap gap-4 mt-9">
              <Link to="/register" data-testid="hero-register-btn"
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-head font-bold uppercase tracking-wider px-7 py-3.5 rounded-xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all">
                Sign Up Now <ArrowRight size={18} />
              </Link>
              <Link to="/standings" data-testid="hero-standings-btn"
                className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white font-head font-semibold uppercase tracking-wider border border-white/20 px-7 py-3.5 rounded-xl transition-all">
                <Trophy size={18} /> Live Standings
              </Link>
            </div>
          </motion.div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-16">
            <Stat value="15" label="Weeks of Darts" icon={Calendar} />
            <Stat value={playerCount || "—"} label="Registered Players" icon={Users} />
            <Stat value="15" label="Max Points / Day" icon={Zap} />
            <Stat value="Top 3" label="Season Trophies" icon={Trophy} />
          </div>
        </div>
      </section>

      {/* TIMELINE + FEES */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-ink-800 border border-white/10 rounded-2xl p-8">
            <h2 className="font-head font-black uppercase text-3xl text-white mb-6">Season Timeline</h2>
            <div className="space-y-5">
              {[
                { icon: Beer, t: "Early Bird Deadline", d: "October 31 — lock in the $100 rate", c: "text-emerald" },
                { icon: Target, t: "Season Kick-off", d: "September 20 — first darts fly", c: "text-amber-500" },
                { icon: Clock, t: "Every Sunday", d: "3:00 PM – 6:00 PM match window", c: "text-amber-500" },
                { icon: Trophy, t: "Finals & Party", d: "December 27 — champions crowned", c: "text-crimson" },
              ].map((x) => (
                <div key={x.t} className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                    <x.icon className={x.c} size={20} />
                  </div>
                  <div>
                    <div className="font-head font-bold uppercase tracking-wide text-white text-lg">{x.t}</div>
                    <div className="text-gray-400 text-sm">{x.d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 grid grid-cols-1 gap-6">
            <div className="relative overflow-hidden bg-gradient-to-br from-emerald/20 to-ink-800 border border-emerald/30 rounded-2xl p-7">
              <div className="font-mono text-xs uppercase tracking-widest text-emerald mb-2">Early Bird · by Oct 31</div>
              <div className="font-head font-black text-6xl text-white">$100</div>
              <p className="text-gray-300 text-sm mt-3">Register before October 31 and save big on your season entry.</p>
            </div>
            <div className="bg-ink-800 border border-white/10 rounded-2xl p-7">
              <div className="font-mono text-xs uppercase tracking-widest text-gray-400 mb-2">Standard · after Oct 31</div>
              <div className="font-head font-black text-6xl text-white">$200</div>
              <p className="text-gray-400 text-sm mt-3">Late entries welcome all season long at the standard rate.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FORMAT */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="font-head font-black uppercase text-3xl text-white mb-2">Match Format</h2>
        <p className="text-gray-400 mb-8">Each 1v1 match is a three-game battle. Play up to 3 opponents a matchday.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { t: "Medley", d: "Game 1: 701 (Master Out) · Game 2: Standard Cricket (20–15 + Bull) · Game 3: choice of the two. Win 2-0 for 3 pts, 2-1 for 2 pts.", pts: "3 pts", img: GAME_IMAGES.medley701 },
            { t: "Count Up", d: "Add up your 3-dart scores over 8 rounds — highest total wins. Winner takes +1 point.", pts: "+1 pt", img: GAME_IMAGES.countup },
            { t: "Half It", d: "Hit each called target (15, 16, DBL, 17…). Miss and your score is halved. Winner takes +1 point.", pts: "+1 pt", img: GAME_IMAGES.halfit },
          ].map((g) => (
            <div key={g.t} className="group relative overflow-hidden bg-ink-800 border border-white/10 rounded-2xl hover:border-amber-500/40 transition-all">
              <div className="h-40 overflow-hidden">
                <img src={g.img} alt={g.t} className="w-full h-full object-cover opacity-60 group-hover:opacity-80 group-hover:scale-105 transition-all duration-500" />
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-head font-bold uppercase text-2xl text-white">{g.t}</h3>
                  <span className="font-mono text-xs bg-amber-500 text-black px-2.5 py-1 rounded-full font-bold">{g.pts}</span>
                </div>
                <p className="text-gray-400 text-sm">{g.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PRIZES */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="relative overflow-hidden rounded-3xl border border-white/10">
          <img src={IMAGES.trophy} alt="trophies" className="absolute inset-0 w-full h-full object-cover opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-r from-ink-900 to-ink-900/70" />
          <div className="relative p-10 lg:p-14">
            <Trophy className="text-amber-500 mb-4" size={40} />
            <h2 className="font-head font-black uppercase text-4xl text-white mb-4">Prizes & Glory</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 max-w-3xl">
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <div className="font-head font-bold uppercase text-amber-500 text-lg">Monthly Prizes</div>
                <p className="text-gray-300 text-sm mt-2 mb-3">A different reward every month for the top points scorer.</p>
                <div className="space-y-2" data-testid="home-monthly-rewards">
                  {rewards.map((r) => (
                    <div key={r.month} className="flex items-center justify-between gap-3 bg-ink-900/50 border border-white/10 rounded-lg px-3 py-2">
                      <span className="font-mono text-[11px] uppercase tracking-wider text-gray-400 shrink-0">{r.label.replace(" 2026", "")}</span>
                      <span className="font-head font-semibold text-white text-sm text-right">{r.reward || "To be announced"}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <div className="font-head font-bold uppercase text-amber-500 text-lg">Season Top 3</div>
                <p className="text-gray-300 text-sm mt-2">Trophies for the top three players, awarded at the Dec 27 finals.</p>
              </div>
            </div>
            <Link to="/register" data-testid="prizes-register-btn"
              className="inline-flex items-center gap-2 mt-8 bg-amber-500 hover:bg-amber-400 text-black font-head font-bold uppercase tracking-wider px-7 py-3.5 rounded-xl active:scale-95 transition-all">
              Claim Your Spot <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
