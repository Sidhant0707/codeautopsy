import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0e0e0e] text-[#f1f5f9] p-8 md:p-24 font-satoshi">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/login"
          className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-white mb-12 transition-colors w-fit"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <h1 className="cabinet text-4xl font-bold text-white mb-8">
          Terms of Service
        </h1>

        <div className="glass-card p-8 rounded-3xl border border-white/5 space-y-8">
          <section>
            <h2 className="text-white font-bold mb-3 uppercase tracking-wide">
              1. Acceptance
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              By using CodeAutopsy, you agree to provide read-only access to
              your public or authorized private repositories for the purpose of
              architectural analysis.
            </p>
          </section>

          <section>
            <h2 className="text-white font-bold mb-3 uppercase tracking-wide">
              2. Usage Limits
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Rate limits apply based on your authentication status to ensure
              system stability when querying the analysis engine.
            </p>
          </section>

          <section>
            <h2 className="text-white font-bold mb-3 uppercase tracking-wide">
              3. Data Privacy
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Code analyzed is processed in real-time. We do not permanently
              store your codebase data unless explicitly cached for your active
              session.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
