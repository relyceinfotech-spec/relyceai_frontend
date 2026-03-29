import React, { useState, useEffect, useRef } from "react";

const FeatureShowcase = () => {
  const [active, setActive] = useState(0);
  const sectionRef = useRef(null);
  const [hoverIdx, setHoverIdx] = useState(-1);

  const capabilities = [
    {
      id: "analysis",
      title: "Deep Analysis",
      desc: "Agents that dissect complex problems, surface patterns in your data, and deliver structured insights you can act on immediately.",
    },
    {
      id: "content",
      title: "Content Generation",
      desc: "From technical documentation to marketing copy  agents draft, iterate, and refine content grounded in your source material and brand guidelines.",
    },
    {
      id: "code",
      title: "Code Intelligence",
      desc: "Debug, refactor, and generate code with agents that understand your codebase context. Not autocomplete  actual reasoning over your architecture.",
    },
    {
      id: "agents",
      title: "Custom Agent Personas",
      desc: "Build specialized agents tuned to your workflow. Configure expertise, tone, source preferences, and output format for consistent, high-quality results.",
    },
  ];

  // Auto-advance
  useEffect(() => {
    const t = setInterval(() => setActive((p) => (p + 1) % capabilities.length), 6000);
    return () => clearInterval(t);
  }, []);

  // Scroll reveal
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
      className="relative w-full py-32 lg:py-44 overflow-hidden"
      style={{ background: "#07060e" }}
    >
      {/* Ambient glow */}
      <div className="absolute bottom-0 left-1/3 w-[500px] h-[500px] rounded-full bg-emerald-600/[0.03] blur-[180px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-12">
        {/* Header */}
        <div className="ag-reveal mb-20 lg:mb-28">
          <p
            className="text-[11px] uppercase tracking-[0.4em] text-emerald-400/40 mb-5"
            style={{ fontFamily: "'Geist Mono', monospace" }}
          >
            The Ecosystem
          </p>
          <h2 className="text-4xl md:text-6xl lg:text-7xl font-light tracking-tight text-white/90 leading-[1.1] max-w-3xl">
            Specialized intelligence.
            <span className="text-white/20"> Purpose-built.</span>
          </h2>
        </div>

        {/* Split layout */}
        <div className="ag-reveal flex flex-col lg:flex-row gap-16 lg:gap-0">
          {/* Left: Tab list */}
          <div className="w-full lg:w-5/12 flex flex-col justify-center">
            {capabilities.map((cap, idx) => {
              const isActive = active === idx;
              const isHovered = hoverIdx === idx;
              return (
                <button
                  key={cap.id}
                  onClick={() => setActive(idx)}
                  onMouseEnter={() => setHoverIdx(idx)}
                  onMouseLeave={() => setHoverIdx(-1)}
                  className={`group relative w-full text-left py-6 border-b border-white/[0.03] transition-all duration-500 cursor-pointer min-h-[44px] ${
                    isActive ? "opacity-100" : "opacity-30 hover:opacity-60"
                  }`}
                >
                  {/* Active indicator — left bar with pulse on hover */}
                  <div
                    className={`absolute left-0 top-6 bottom-6 w-[2px] rounded-full transition-all duration-500 ${
                      isActive
                        ? "bg-gradient-to-b from-emerald-500 to-emerald-400 opacity-100"
                        : "bg-transparent opacity-0"
                    }`}
                    style={{
                      boxShadow: isActive && isHovered ? "0 0 12px rgba(16,185,129,0.5), 0 0 24px rgba(16,185,129,0.2)" : "none",
                      width: isActive && isHovered ? "3px" : "2px",
                      transition: "all 0.3s ease",
                    }}
                  />

                  {/* Hover background sweep */}
                  <div
                    className="absolute inset-0 rounded-lg transition-all duration-400 pointer-events-none"
                    style={{
                      background: isHovered ? "linear-gradient(90deg, rgba(16,185,129,0.04) 0%, transparent 100%)" : "transparent",
                      opacity: isHovered ? 1 : 0,
                    }}
                  />

                  <div className="relative z-10 pl-6">
                    <span
                      className={`text-[10px] tracking-[0.3em] uppercase block mb-2 transition-colors duration-500 ${
                        isActive ? "text-emerald-400/60" : "text-white/20"
                      }`}
                      style={{ fontFamily: "'Geist Mono', monospace" }}
                    >
                      0{idx + 1}
                    </span>
                    <h4
                      className={`text-xl md:text-2xl font-light tracking-tight transition-all duration-500 ${
                        isActive ? "text-white" : "text-white/50"
                      }`}
                      style={{
                        transform: isHovered ? "translateX(6px)" : "translateX(0)",
                        transition: "transform 0.4s cubic-bezier(0.16,1,0.3,1), color 0.5s",
                      }}
                    >
                      {cap.title}
                    </h4>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right: Content display area */}
          <div className="w-full lg:w-7/12 lg:pl-16 flex items-center">
            <div className="relative w-full min-h-[300px] flex items-center">
              {capabilities.map((cap, idx) => (
                <div
                  key={cap.id}
                  className={`absolute inset-0 flex flex-col justify-center transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                    active === idx
                      ? "opacity-100 translate-x-0 scale-100"
                      : "opacity-0 translate-x-8 scale-[0.97] pointer-events-none"
                  }`}
                >
                  {/* Large decorative number */}
                  <span className="text-[140px] md:text-[200px] font-extralight leading-none text-white/[0.02] tracking-tighter select-none pointer-events-none absolute -top-8 -left-4">
                    0{idx + 1}
                  </span>

                  <div className="relative z-10">
                    <h3 className="text-4xl md:text-5xl lg:text-6xl font-light tracking-tight text-white/90 leading-[1.1] mb-8">
                      {cap.title}
                    </h3>
                    <p className="text-lg md:text-xl text-white/30 font-light leading-relaxed max-w-lg">
                      {cap.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FeatureShowcase;
