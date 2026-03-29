import React, { useEffect, useRef, useState, useCallback } from "react";

/* ─── Step card with mouse-aware tilt + inner glow ─── */
const TiltStep = ({ children, className = "", idx }) => {
  const ref = useRef(null);
  const [transform, setTransform] = useState("");
  const [glowPos, setGlowPos] = useState({ x: 50, y: 50 });
  const [hovering, setHovering] = useState(false);

  const handleMove = useCallback((e) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const rotateX = (y - 0.5) * -6;
    const rotateY = (x - 0.5) * 6;
    setTransform(`perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02,1.02,1.02)`);
    setGlowPos({ x: x * 100, y: y * 100 });
  }, []);

  const handleLeave = () => {
    setTransform("");
    setHovering(false);
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={handleLeave}
      className={`relative ${className}`}
      style={{
        transform,
        transition: hovering ? "transform 0.15s ease-out" : "transform 0.5s ease-out",
        willChange: "transform",
      }}
    >
      {/* Inner glow following cursor */}
      <div
        className="absolute inset-0 pointer-events-none rounded-sm transition-opacity duration-300"
        style={{
          opacity: hovering ? 1 : 0,
          background: `radial-gradient(300px circle at ${glowPos.x}% ${glowPos.y}%, rgba(16,185,129,0.07), transparent 60%)`,
        }}
      />
      {children}
    </div>
  );
};

export default function HowItWorksSection() {
  const sectionRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("is-visible");
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
    );
    const els = sectionRef.current?.querySelectorAll(".ag-reveal");
    els?.forEach((el) => observer.observe(el));
    return () => els?.forEach((el) => observer.unobserve(el));
  }, []);

  const steps = [
    {
      number: "01",
      title: "Define",
      subtitle: "Set your objective",
      desc: "Provide your goal  analyze a market, generate a report, debug code, or draft content. The agent structures its approach to your exact needs.",
    },
    {
      number: "02",
      title: "Execute",
      subtitle: "Agents work autonomously",
      desc: "Agents break your task into sub steps, pull from your documents, reason through ambiguity, and iterate  without needing you to hold their hand.",
    },
    {
      number: "03",
      title: "Synthesize",
      subtitle: "Get actionable output",
      desc: "Receive polished reports, clean datasets, working code, or strategic recommendations. Export, share with your team, or feed into your next workflow.",
    },
  ];

  return (
    <section
      ref={sectionRef}
      className="relative w-full py-32 lg:py-44 overflow-hidden"
      style={{ background: "#08060f" }}
    >
      {/* Ambient */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-emerald-600/[0.025] blur-[200px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-12">
        {/* Header */}
        <div className="ag-reveal mb-24 lg:mb-32">
          <p
            className="text-[11px] uppercase tracking-[0.4em] text-emerald-400/40 mb-5"
            style={{ fontFamily: "'Geist Mono', monospace" }}
          >
            How It Works
          </p>
          <h2 className="text-4xl md:text-6xl lg:text-7xl font-light tracking-tight text-white/90 leading-[1.1] max-w-3xl">
            Three phases.
            <span className="text-white/20"> Zero hand-holding.</span>
          </h2>
        </div>

        {/* Horizontal steps with tilt effect */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
          {steps.map((step, idx) => (
            <TiltStep
              key={idx}
              idx={idx}
              className="ag-reveal group cursor-default"
              style={{ transitionDelay: `${idx * 150}ms` }}
            >
              {/* Top border with animated fill on hover */}
              <div className="h-px w-full bg-white/[0.04] relative overflow-hidden mb-10">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/60 via-emerald-400/40 to-transparent scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-1000 ease-out" />
              </div>

              <div className="pr-8 lg:pr-12 pb-8">
                {/* Number */}
                <span
                  className="text-[11px] text-emerald-400/30 tracking-[0.3em] block mb-4 group-hover:text-emerald-400/60 transition-colors duration-700"
                  style={{ fontFamily: "'Geist Mono', monospace" }}
                >
                  {step.number}
                </span>

                {/* Title — scales up slightly on hover */}
                <h3 className="text-3xl md:text-4xl lg:text-5xl font-light tracking-tight text-white/80 mb-3 group-hover:text-white transition-all duration-500 origin-left">
                  {step.title}
                </h3>

                {/* Subtitle */}
                <p className="text-sm text-emerald-400/40 mb-6 group-hover:text-emerald-400/70 transition-colors duration-500">
                  {step.subtitle}
                </p>

                {/* Description */}
                <p className="text-[15px] text-white/25 font-light leading-relaxed group-hover:text-white/45 transition-colors duration-500 max-w-sm">
                  {step.desc}
                </p>
              </div>
            </TiltStep>
          ))}
        </div>
      </div>
    </section>
  );
}