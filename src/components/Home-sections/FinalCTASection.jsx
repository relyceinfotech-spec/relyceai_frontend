import React, { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";

export default function FinalCTASection() {
  const sectionRef = useRef(null);
  const btnRef = useRef(null);
  const [btnGlow, setBtnGlow] = useState({ x: 50, y: 50 });
  const [btnHover, setBtnHover] = useState(false);

  const handleBtnMove = useCallback((e) => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    setBtnGlow({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("is-visible"); });
      },
      { threshold: 0.15 }
    );
    const els = sectionRef.current?.querySelectorAll(".ag-reveal");
    els?.forEach((el) => observer.observe(el));
    return () => els?.forEach((el) => observer.unobserve(el));
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative w-full overflow-hidden"
      style={{ background: "#06050d" }}
    >
      {/* Ambient orbs */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full bg-emerald-600/[0.03] blur-[200px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-emerald-500/[0.04] blur-[150px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-12 py-32 lg:py-48">
        {/* Top divider */}
        <div className="ag-reveal w-full h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent mb-24 lg:mb-32" />

        {/* Cinematic CTA */}
        <div className="ag-reveal flex flex-col items-center text-center">
          <p
            className="text-[11px] uppercase tracking-[0.4em] text-emerald-400/40 mb-8"
            style={{ fontFamily: "'Geist Mono', monospace" }}
          >
            Ready to deploy
          </p>

          <h2 className="text-5xl md:text-7xl lg:text-8xl xl:text-[110px] font-light tracking-tight text-white/90 leading-[1.05] mb-8 max-w-5xl">
            Deploy your
            <br />
            <span className="text-white/20">first agent.</span>
          </h2>

          <p className="text-lg text-white/25 font-light leading-relaxed max-w-xl mb-14">
            From deep analysis to content generation to code intelligence  deploy
            agents that handle the heavy lifting while you focus on what matters.
          </p>

          {/* CTA button — magnetic glow + ripple */}
          <Link
            ref={btnRef}
            to="/chat"
            onMouseMove={handleBtnMove}
            onMouseEnter={() => setBtnHover(true)}
            onMouseLeave={() => setBtnHover(false)}
            className="group relative inline-flex items-center gap-3 px-10 py-4 rounded-full border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm transition-all duration-500 cursor-pointer min-h-[48px] overflow-hidden"
            style={{
              borderColor: btnHover ? "rgba(16,185,129,0.25)" : "rgba(255,255,255,0.08)",
              boxShadow: btnHover
                ? "0 0 30px rgba(16,185,129,0.1), 0 0 60px rgba(16,185,129,0.05)"
                : "none",
            }}
          >
            {/* Mouse-following inner glow */}
            <div
              className="absolute inset-0 rounded-full pointer-events-none transition-opacity duration-300"
              style={{
                opacity: btnHover ? 1 : 0,
                background: `radial-gradient(120px circle at ${btnGlow.x}% ${btnGlow.y}%, rgba(16,185,129,0.15), transparent 60%)`,
              }}
            />

            <span className="relative z-10 text-[13px] uppercase tracking-[0.15em] text-white/70 font-medium group-hover:text-white transition-colors duration-500">
              Deploy Agent
            </span>
            <ArrowUpRight
              className="relative z-10 w-4 h-4 text-white/40 group-hover:text-emerald-400 transition-all duration-500"
              style={{
                transform: btnHover ? "translate(2px, -2px) rotate(-5deg)" : "none",
                transition: "transform 0.4s cubic-bezier(0.16,1,0.3,1), color 0.5s",
              }}
            />
          </Link>

          {/* Secondary link */}
          <Link
            to="/pricing"
            className="mt-6 text-[12px] uppercase tracking-[0.15em] text-white/15 hover:text-white/40 transition-colors duration-300 border-b border-transparent hover:border-white/10 pb-0.5 cursor-pointer"
          >
            View Pricing
          </Link>
        </div>

        {/* Bottom spacer */}
        <div className="mt-24 lg:mt-32 w-full h-px bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
      </div>
    </section>
  );
}