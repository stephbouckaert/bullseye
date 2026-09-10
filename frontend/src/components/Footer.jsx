import { MapPin, Clock, Beer } from "lucide-react";
import { LOGO_URL } from "@/lib/assets";

export const Footer = () => (
  <footer className="border-t border-white/10 bg-ink-800 mt-20">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 md:grid-cols-3 gap-10">
      <div>
        <div className="flex items-center gap-3 mb-4">
          <img src={LOGO_URL} alt="logo" className="w-12 h-12 rounded-full ring-2 ring-amber-500/40" />
          <div className="font-head font-black text-2xl uppercase text-white">Belly Darts League</div>
        </div>
        <p className="text-gray-400 text-sm leading-relaxed">15 weeks of darts, beer and glory at Belly and the Beer. Sundays, September through December.</p>
      </div>
      <div>
        <h4 className="font-head uppercase tracking-widest text-amber-500 text-sm mb-4">The Venue</h4>
        <p className="flex items-center gap-2 text-gray-300 text-sm mb-2"><Beer size={16} className="text-amber-500" /> Belly and the Beer</p>
        <p className="flex items-center gap-2 text-gray-300 text-sm mb-2"><MapPin size={16} className="text-amber-500" /> 21 Elgin Street, Soho, Hong Kong</p>
        <p className="flex items-center gap-2 text-gray-300 text-sm"><Clock size={16} className="text-amber-500" /> Sundays · 3:00 PM – 6:00 PM</p>
      </div>
      <div>
        <h4 className="font-head uppercase tracking-widest text-amber-500 text-sm mb-4">Season</h4>
        <p className="text-gray-300 text-sm mb-2">Kick-off: September 20</p>
        <p className="text-gray-300 text-sm mb-2">Finals & Party: December 27</p>
        <p className="text-gray-300 text-sm">Early bird entry $100 · Standard $200</p>
      </div>
    </div>
    <div className="border-t border-white/10 py-5 text-center text-gray-500 text-xs font-mono">
      © {new Date().getFullYear()} Belly Darts League · 21 Elgin Street, Hong Kong
    </div>
  </footer>
);
