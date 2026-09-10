import { Target, Crosshair, Scissors, TrendingUp, Users, HandMetal, ClipboardCheck, Award } from "lucide-react";
import { GAME_IMAGES } from "@/lib/assets";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

const Rule = ({ icon: Icon, title, children, accent = "text-amber-500", images }) => (
  <div className="bg-ink-800 border border-white/10 rounded-2xl p-6 hover:border-amber-500/40 transition-all">
    {images && (
      <div className={`grid ${images.length > 1 ? "grid-cols-2" : "grid-cols-1"} gap-2 mb-4`}>
        {images.map((src) => (
          <img key={src} src={src} alt={title} className="h-24 w-full object-cover rounded-lg border border-white/10" />
        ))}
      </div>
    )}
    <Icon className={`${accent} mb-3`} size={26} />
    <h3 className="font-head font-bold uppercase text-xl text-white mb-2">{title}</h3>
    <div className="text-gray-400 text-sm leading-relaxed space-y-1">{children}</div>
  </div>
);

export default function Rules() {
  return (
    <div className="min-h-screen bg-ink-900">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <span className="font-mono text-xs uppercase tracking-widest text-amber-500">The Rulebook</span>
        <h1 className="font-head font-black uppercase text-4xl sm:text-5xl text-white mt-1 mb-3">How It Works</h1>
        <p className="text-gray-400 max-w-2xl mb-10">Everything you need to know about match days, scoring and points at the Belly Darts League.</p>

        {/* Points breakdown highlight */}
        <div className="bg-gradient-to-br from-amber-500/15 to-ink-800 border border-amber-500/30 rounded-2xl p-8 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <Target className="text-amber-500" size={28} />
            <h2 className="font-head font-black uppercase text-3xl text-white">Scoring · Max 15 pts / day</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-ink-900/60 border border-white/10 rounded-xl p-5">
              <div className="font-head font-bold uppercase text-white text-lg mb-2">Medley</div>
              <div className="flex justify-between text-sm mb-1"><span className="text-gray-400">Win 2 – 0</span><span className="font-mono text-amber-400 font-bold">3 pts</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-400">Win 2 – 1</span><span className="font-mono text-amber-400 font-bold">2 pts</span></div>
            </div>
            <div className="bg-ink-900/60 border border-white/10 rounded-xl p-5">
              <div className="font-head font-bold uppercase text-white text-lg mb-2">Count Up</div>
              <div className="flex justify-between text-sm"><span className="text-gray-400">Game winner</span><span className="font-mono text-amber-400 font-bold">+1 pt</span></div>
            </div>
            <div className="bg-ink-900/60 border border-white/10 rounded-xl p-5">
              <div className="font-head font-bold uppercase text-white text-lg mb-2">Half It</div>
              <div className="flex justify-between text-sm"><span className="text-gray-400">Game winner</span><span className="font-mono text-amber-400 font-bold">+1 pt</span></div>
            </div>
          </div>
          <p className="text-gray-400 text-sm mt-5 font-mono">5 points max per match × up to 3 matches = 15 points per matchday.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <Rule icon={Users} title="Match Days">
            <p>Play up to <strong className="text-white">3 matches</strong> per day.</p>
            <p>Each match must be against a <strong className="text-white">different opponent</strong>.</p>
          </Rule>
          <Rule icon={ClipboardCheck} title="Official Matches">
            <p>Before playing, both players must agree whether the match counts as an <strong className="text-white">official</strong> league match.</p>
          </Rule>
          <Rule icon={HandMetal} title="Who Throws First">
            <p>Throw a dart at the bullseye. <strong className="text-white">Closest to the center</strong> throws first.</p>
          </Rule>
          <Rule icon={Crosshair} title="Medley Game" images={[GAME_IMAGES.medley701, GAME_IMAGES.cricket]}>
            <p><strong className="text-white">Game 1:</strong> 701 — straight start, <span className="text-amber-500/90">Master Out</span> finish (double or bull to close).</p>
            <p><strong className="text-white">Game 2:</strong> Standard Cricket — 20, 19, 18, 17, 16, 15 &amp; Bull.</p>
            <p><strong className="text-white">Game 3:</strong> Player's choice of 701 or Cricket — the decider.</p>
          </Rule>
          <Rule icon={TrendingUp} title="Count Up Game" images={[GAME_IMAGES.countup]}>
            <p>Throw 3 darts a round over 8 rounds and stack the highest total — every hit counts, bulls and trebles included.</p>
            <p className="text-amber-500/90">Highest total wins the game (+1 league point).</p>
          </Rule>
          <Rule icon={Scissors} title="Half It Game" images={[GAME_IMAGES.halfit]}>
            <p>Hit the called target each round — 15, 16, Double, 17, 18, 20, Bull. Land it and you score; <strong className="text-crimson">miss it and your score is HALVED.</strong></p>
            <p className="text-amber-500/90">Highest score after all rounds wins (+1 league point).</p>
          </Rule>
          <Rule icon={ClipboardCheck} title="Score Tracking" accent="text-emerald">
            <p>Venue staff record all scores in the league system after each match.</p>
          </Rule>
          <Rule icon={Award} title="Monthly Prize" accent="text-crimson">
            <p>The top points scorer each month wins the monthly reward.</p>
          </Rule>
          <Rule icon={Award} title="Season Awards" accent="text-crimson">
            <p>Top 3 players earn trophies at the December 27 finals & party.</p>
          </Rule>
        </div>
      </div>
      <Footer />
    </div>
  );
}
