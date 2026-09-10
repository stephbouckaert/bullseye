import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { CheckCircle2, Beer, Calendar } from "lucide-react";
import api from "@/lib/api";
import { IMAGES } from "@/lib/assets";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export default function Register() {
  const [form, setForm] = useState({ name: "", nickname: "", email: "", phone: "" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);
  const [info, setInfo] = useState(null);

  useEffect(() => { api.get("/league/info").then((r) => setInfo(r.data)).catch(() => {}); }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email) { toast.error("Name and email are required"); return; }
    setSubmitting(true);
    try {
      const res = await api.post("/players/register", form);
      setDone(res.data);
      toast.success("You're in! Welcome to the league.");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-ink-900">
        <Navbar />
        <div className="max-w-lg mx-auto px-4 py-20 text-center">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <CheckCircle2 className="text-emerald mx-auto mb-6" size={64} />
            <h1 className="font-head font-black uppercase text-4xl text-white mb-3">You're Registered!</h1>
            <p className="text-gray-400 mb-6">Welcome to the Belly Darts League, {done.name}. Your spot is locked in.</p>
            <div className="bg-ink-800 border border-white/10 rounded-2xl p-6 text-left">
              <div className="flex justify-between py-2 border-b border-white/10"><span className="text-gray-400 font-mono text-sm">Entry Tier</span><span className="font-head font-bold uppercase text-white">{done.fee_tier === "early" ? "Early Bird" : "Standard"}</span></div>
              <div className="flex justify-between py-2 border-b border-white/10"><span className="text-gray-400 font-mono text-sm">Entry Fee</span><span className="font-head font-black text-2xl text-amber-400">${done.fee_amount}</span></div>
              <div className="flex justify-between py-2"><span className="text-gray-400 font-mono text-sm">Payment</span><span className="font-mono text-amber-500 text-sm">Pay at the venue</span></div>
            </div>
            <p className="text-gray-500 text-sm mt-6 font-mono">See you Sunday at Belly and the Beer, 21 Elgin Street.</p>
          </motion.div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-900">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
        <div>
          <span className="font-mono text-xs uppercase tracking-widest text-amber-500">Join the League</span>
          <h1 className="font-head font-black uppercase text-4xl sm:text-5xl text-white mt-1 mb-4">Register</h1>
          <p className="text-gray-400 mb-6">Lock in your spot for 15 weeks of Sunday darts. Your entry tier is set automatically based on today's date.</p>
          <div className="relative overflow-hidden rounded-2xl border border-white/10 mb-6">
            <img src={IMAGES.stout} alt="beer" className="w-full h-48 object-cover opacity-60" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink-900 to-transparent" />
          </div>
          {info && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm text-gray-300"><Beer size={18} className="text-emerald" /> Early bird ${info.fee_early} if you sign up by Sep 12 — otherwise ${info.fee_late}.</div>
              <div className="flex items-center gap-3 text-sm text-gray-300"><Calendar size={18} className="text-amber-500" /> Season runs Sep 20 → Dec 27, Sundays 3–6 PM.</div>
            </div>
          )}
        </div>

        <form onSubmit={submit} data-testid="register-form" className="bg-ink-800 border border-white/10 rounded-2xl p-8 space-y-5">
          {[
            { k: "name", label: "Full Name *", ph: "Marcus Chan", type: "text" },
            { k: "nickname", label: "Nickname / Darts Name", ph: "The Hammer", type: "text" },
            { k: "email", label: "Email *", ph: "you@example.com", type: "email" },
            { k: "phone", label: "Phone", ph: "+852 9123 4567", type: "tel" },
          ].map((f) => (
            <div key={f.k}>
              <label className="block font-mono text-[11px] uppercase tracking-widest text-gray-400 mb-2">{f.label}</label>
              <input
                data-testid={`register-input-${f.k}`}
                type={f.type} value={form[f.k]} onChange={set(f.k)} placeholder={f.ph}
                className="w-full bg-ink-900 border border-white/10 focus:border-amber-500 rounded-xl px-4 py-3 text-white placeholder-gray-600 outline-none transition-colors"
              />
            </div>
          ))}
          <button type="submit" disabled={submitting} data-testid="register-submit-btn"
            className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-head font-bold uppercase tracking-wider py-4 rounded-xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all">
            {submitting ? "Signing you up..." : "Complete Registration"}
          </button>
          <p className="text-gray-500 text-xs text-center font-mono">Entry fee is paid at the venue. No card required now.</p>
        </form>
      </div>
      <Footer />
    </div>
  );
}
