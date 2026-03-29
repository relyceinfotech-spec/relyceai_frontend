import React, { useRef, useEffect, useState, useCallback } from "react";
import { Brain, FileSearch, Layers } from "lucide-react";

/* ─── Card 1: Mouse-tracking spotlight + glowing border ─── */
const SpotlightCard = ({ children, className = "", ...props }) => {
  const ref = useRef(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [hovering, setHovering] = useState(false);

  const handleMove = useCallback((e) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      className={`relative overflow-hidden ${className}`}
      {...props}
    >
      {/* Primary spotlight — strong emerald glow */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-300"
        style={{
          opacity: hovering ? 1 : 0,
          background: `radial-gradient(400px circle at ${pos.x}px ${pos.y}px, rgba(16,185,129,0.15), transparent 50%)`,
        }}
      />
      {/* Secondary warm halo ring */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-500"
        style={{
          opacity: hovering ? 1 : 0,
          background: `radial-gradient(200px circle at ${pos.x}px ${pos.y}px, rgba(52,211,153,0.08), transparent 60%)`,
        }}
      />
      {/* Border glow that follows cursor — top/bottom edges */}
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none transition-opacity duration-300"
        style={{
          opacity: hovering ? 1 : 0,
          boxShadow: `inset 0 0 80px rgba(16,185,129,0.04)`,
          border: "1px solid transparent",
          backgroundClip: "padding-box",
          WebkitMask: `radial-gradient(300px circle at ${pos.x}px ${pos.y}px, black 20%, transparent 70%)`,
          mask: `radial-gradient(300px circle at ${pos.x}px ${pos.y}px, black 20%, transparent 70%)`,
          borderColor: "rgba(16,185,129,0.25)",
        }}
      />
      {children}
    </div>
  );
};

/* ─── Card 2: Shimmer sweep on hover ─── */
const ShimmerCard = ({ children, className = "" }) => (
  <div className={`relative overflow-hidden ${className}`}>
    {/* Diagonal shimmer that sweeps across on hover */}
    <div
      className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
      style={{
        background: "linear-gradient(115deg, transparent 30%, rgba(16,185,129,0.04) 45%, rgba(16,185,129,0.08) 50%, rgba(16,185,129,0.04) 55%, transparent 70%)",
        backgroundSize: "250% 100%",
        backgroundPosition: "200% 0",
        animation: "none",
      }}
    />
    <style>{`
      .shimmer-card:hover .shimmer-sweep {
        animation: shimmer-sweep 1.8s ease-in-out forwards;
      }
      @keyframes shimmer-sweep {
        0%   { background-position: 200% 0; }
        100% { background-position: -50% 0; }
      }
    `}</style>
    <div
      className="shimmer-sweep absolute inset-0 pointer-events-none"
      style={{
        background: "linear-gradient(115deg, transparent 30%, rgba(16,185,129,0.04) 45%, rgba(16,185,129,0.08) 50%, rgba(16,185,129,0.04) 55%, transparent 70%)",
        backgroundSize: "250% 100%",
        backgroundPosition: "200% 0",
        opacity: 0,
      }}
    />
    {children}
  </div>
);

/* ─── Card 3: Animated corner accents ─── */
const CornerGlowCard = ({ children, className = "" }) => (
  <div className={`relative overflow-hidden ${className}`}>
    {/* Top-left corner accent */}
    <div className="absolute top-0 left-0 w-16 h-16 pointer-events-none">
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-emerald-500/40 to-transparent scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-700 ease-out" />
      <div className="absolute top-0 left-0 h-full w-px bg-gradient-to-b from-emerald-500/40 to-transparent scale-y-0 group-hover:scale-y-100 origin-top transition-transform duration-700 ease-out delay-100" />
    </div>
    {/* Bottom-right corner accent */}
    <div className="absolute bottom-0 right-0 w-16 h-16 pointer-events-none">
      <div className="absolute bottom-0 right-0 w-full h-px bg-gradient-to-l from-emerald-500/40 to-transparent scale-x-0 group-hover:scale-x-100 origin-right transition-transform duration-700 ease-out delay-200" />
      <div className="absolute bottom-0 right-0 h-full w-px bg-gradient-to-t from-emerald-500/40 to-transparent scale-y-0 group-hover:scale-y-100 origin-bottom transition-transform duration-700 ease-out delay-300" />
    </div>
    {children}
  </div>
);

const FeaturesSection = () => {
  const sectionRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("is-visible");
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -60px 0px" }
    );
    const els = sectionRef.current?.querySelectorAll(".ag-reveal");
    els?.forEach((el) => observer.observe(el));
    return () => els?.forEach((el) => observer.unobserve(el));
  }, []);

  const features = [
    {
      icon: Brain,
      label: "DEEP ANALYSIS",
      title: "Agents that think in layers",
      desc: "Not a chatbot. An intelligent engine that decomposes complex tasks into sub-steps, reasons through ambiguity, and delivers structured output across any domain  from market analysis to code generation.",
      span: "lg:col-span-2 lg:row-span-2",
      size: "large",
      Wrapper: SpotlightCard,
    },
    {
      icon: FileSearch,
      label: "DOCUMENT RAG",
      title: "Your files, instantly intelligent",
      desc: "Upload PDFs, reports, spreadsheets, and codebases. Agents build a knowledge layer on top and answer questions with pinpoint accuracy  grounded in your actual data.",
      span: "lg:col-span-1 lg:row-span-1",
      size: "small",
      Wrapper: ShimmerCard,
    },
    {
      icon: Layers,
      label: "MULTI-MODEL",
      title: "Orchestrate multiple AI models",
      desc: "Route tasks to the best-fit model automatically. Combine reasoning, retrieval, and generation across providers for output quality no single model can match.",
      span: "lg:col-span-1 lg:row-span-1",
      size: "small",
      Wrapper: CornerGlowCard,
    },
  ];

  return (
    <section
      ref={sectionRef}
      className="relative w-full py-32 lg:py-44 overflow-hidden"
      style={{ background: "#06080f" }}
    >
      {/* Large ambient orbs */}
      <div className="absolute top-[-200px] right-[-100px] w-[600px] h-[600px] rounded-full bg-emerald-600/[0.03] blur-[180px] pointer-events-none" />
      <div className="absolute bottom-[-200px] left-[-100px] w-[500px] h-[500px] rounded-full bg-emerald-500/[0.025] blur-[160px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-12">
        {/* Editorial section intro */}
        <div className="ag-reveal mb-20 lg:mb-28">
          <p
            className="text-[11px] uppercase tracking-[0.4em] text-emerald-400/50 mb-5"
            style={{ fontFamily: "'Geist Mono', monospace" }}
          >
            Core Capabilities
          </p>
          <h2 className="text-4xl md:text-6xl lg:text-7xl font-light tracking-tight text-white/90 leading-[1.1] max-w-4xl">
            Built to perform
            <span className="text-white/20"> — across every domain.</span>
          </h2>
        </div>

        {/* Bento grid — asymmetric */}
        <div className="grid grid-cols-1 lg:grid-cols-3 lg:grid-rows-2 gap-4 lg:gap-5">
          {features.map((f, idx) => (
            <f.Wrapper
              key={idx}
              className={`ag-reveal group ${f.span} rounded-2xl border border-white/[0.04] bg-white/[0.015] backdrop-blur-sm hover:border-emerald-500/15 transition-all duration-700 cursor-default ${idx === 1 ? "shimmer-card" : ""}`}
              style={{ transitionDelay: `${idx * 100}ms` }}
            >
              <div className={`relative z-10 flex flex-col justify-between h-full ${f.size === "large" ? "p-10 lg:p-14" : "p-8 lg:p-10"}`}>
                <div>
                  {/* Icon + Label row */}
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-9 h-9 rounded-lg bg-emerald-500/[0.08] border border-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/[0.15] group-hover:border-emerald-500/25 transition-all duration-500">
                      <f.icon className="w-4 h-4 text-emerald-400/70 group-hover:text-emerald-400 transition-colors duration-500" strokeWidth={1.5} />
                    </div>
                    <span
                      className="text-[10px] tracking-[0.3em] text-emerald-400/40 uppercase group-hover:text-emerald-400/70 transition-colors duration-500"
                      style={{ fontFamily: "'Geist Mono', monospace" }}
                    >
                      {f.label}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className={`font-light tracking-tight text-white/85 group-hover:text-white transition-colors duration-500 leading-[1.2] mb-5 ${f.size === "large" ? "text-3xl md:text-4xl lg:text-[42px]" : "text-xl md:text-2xl"}`}>
                    {f.title}
                  </h3>
                </div>

                {/* Description */}
                <p className={`text-white/30 font-light leading-relaxed group-hover:text-white/50 transition-colors duration-500 ${f.size === "large" ? "text-base max-w-lg" : "text-sm"}`}>
                  {f.desc}
                </p>
              </div>
            </f.Wrapper>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;