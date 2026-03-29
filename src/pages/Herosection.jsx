import React, { useRef, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowDown } from "lucide-react";

// Subtle moving gradient text component
const AnimatedGradientText = ({ children, className }) => (
  <span className={`bg-clip-text text-transparent bg-gradient-to-r from-zinc-100 via-zinc-400 to-zinc-100 animate-[bg-pan_8s_linear_infinite] ${className}`} style={{ backgroundSize: '200% auto' }}>
    {children}
  </span>
);

const HeroSection = () => {
  const video1Ref = useRef(null);
  const video2Ref = useRef(null);
  const [activeVideo, setActiveVideo] = useState(1);
  const isTransitioning = useRef(false);

  // Preserve the exact, working video looping logic
  useEffect(() => {
    if (video1Ref.current) {
      video1Ref.current.play().catch(() => {});
    }

    const handleTimeUpdate = (e) => {
      const v = e.target;
      if (!isTransitioning.current && v.duration && v.currentTime >= v.duration - 0.5) {
        isTransitioning.current = true;
        
        if (activeVideo === 1 && video2Ref.current) {
          video2Ref.current.currentTime = 0;
          video2Ref.current.play().catch(() => {});
          setActiveVideo(2);
        } else if (activeVideo === 2 && video1Ref.current) {
          video1Ref.current.currentTime = 0;
          video1Ref.current.play().catch(() => {});
          setActiveVideo(1);
        }
      }
    };

    const handleEnded = () => {
      isTransitioning.current = false;
    };

    const v1 = video1Ref.current;
    const v2 = video2Ref.current;

    if (v1) {
      v1.addEventListener('timeupdate', handleTimeUpdate);
      v1.addEventListener('ended', handleEnded);
    }
    if (v2) {
      v2.addEventListener('timeupdate', handleTimeUpdate);
      v2.addEventListener('ended', handleEnded);
    }

    return () => {
      if (v1) {
        v1.removeEventListener('timeupdate', handleTimeUpdate);
        v1.removeEventListener('ended', handleEnded);
      }
      if (v2) {
        v2.removeEventListener('timeupdate', handleTimeUpdate);
        v2.removeEventListener('ended', handleEnded);
      }
    };
  }, [activeVideo]);

  return (
    <section className="relative h-screen min-h-[700px] w-full bg-[#030508] overflow-hidden selection:bg-emerald-500/30 selection:text-white flex flex-col justify-center items-center font-sans">
      
      {/* Seamless Looping Double Buffered Video Foreground */}
      <div className="absolute inset-0 z-0 overflow-hidden bg-[#030508]">
        <video
          ref={video1Ref}
          muted
          playsInline
          className={`transition-opacity duration-1000 ease-in-out absolute top-1/2 left-1/2 min-w-full min-h-full w-auto h-auto max-w-none max-h-none -translate-x-1/2 -translate-y-1/2 object-cover ${activeVideo === 1 ? 'opacity-[0.45]' : 'opacity-0'}`}
          src="/herosection.webm"
        />
        <video
          ref={video2Ref}
          muted
          playsInline
          className={`transition-opacity duration-1000 ease-in-out absolute top-1/2 left-1/2 min-w-full min-h-full w-auto h-auto max-w-none max-h-none -translate-x-1/2 -translate-y-1/2 object-cover ${activeVideo === 2 ? 'opacity-[0.45]' : 'opacity-0'}`}
          src="/herosection.webm"
        />
        
        {/* Deep, Premium Atmospheric Overlays */}
        {/* Base dark mask */}
        <div className="absolute inset-0 bg-black/20 pointer-events-none" />
        
        {/* Soft radial vignette focusing perfectly on the center */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(3,5,8,0.8)_100%)] pointer-events-none" />
        
        {/* Colored ambient glows to simulate "AI breathing" */}
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px] mix-blend-screen pointer-events-none animate-[pulse_6s_ease-in-out_infinite]" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] mix-blend-screen pointer-events-none animate-[pulse_8s_ease-in-out_infinite_reverse]" />

        {/* Bottom seamless blend into next sections */}
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#070a10] to-transparent pointer-events-none" />
      </div>

      {/* Main Content: Perfectly Centered Elegance */}
      <div className="relative z-20 w-full max-w-6xl mx-auto px-6 flex flex-col items-center justify-center text-center mt-[-8vh]">
        
        {/* Premium floating "status" above headline */}
        <div className="mb-8 inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/5 bg-white/[0.02] backdrop-blur-md shadow-[0_0_20px_rgba(255,255,255,0.02)]">
            <div className="flex space-x-1">
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-1.5 h-1.5 bg-emerald-400/70 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-1.5 h-1.5 bg-emerald-400/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            <span className="text-[11px] font-medium tracking-widest text-zinc-400 uppercase ml-2">
                Relyce Intelligence v2
            </span>
        </div>

        {/* The Core Headline */}
        <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-[90px] font-medium tracking-tight leading-[1.05] mb-8">
            <span className="text-white drop-shadow-sm">Intelligent AI</span><br className="hidden sm:block" />
            <AnimatedGradientText>Agents That Deliver.</AnimatedGradientText>
        </h1>

        <p className="text-lg md:text-xl text-zinc-400/90 font-light leading-relaxed max-w-2xl mx-auto mb-12 drop-shadow">
          Deploy AI agents that analyze documents, generate content, write code, and solve complex problems — all from a single, powerful interface.
        </p>

        {/* Ultra-Premium Glassmorphic CTA */}
        <div className="flex flex-col sm:flex-row gap-6 justify-center items-center w-full relative">
          <Link
            to="/chat"
            className="group relative inline-flex items-center justify-center gap-3 px-10 py-4 rounded-full bg-white/[0.03] backdrop-blur-lg border border-white/10 hover:bg-white/[0.06] transition-all duration-500 outline-none text-[13px] uppercase tracking-[0.15em] text-white font-medium overflow-hidden shadow-[0_4px_30px_rgba(0,0,0,0.1)]"
          >
            {/* Inner dynamic border glow effect common in high-end AI UIs */}
            <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
                 <div className="absolute inset-[-100%] bg-[conic-gradient(from_0deg,transparent_0_340deg,rgba(16,185,129,0.3)_360deg)] animate-[spin_3s_linear_infinite] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </div>
            {/* Inner fill to cover the conic gradient center */}
            <div className="absolute inset-[1px] rounded-full bg-[#0a0d14]/80 backdrop-blur-xl group-hover:bg-[#0a0d14]/60 transition-colors duration-500" />

            {/* CTA Content */}
            <div className="relative z-10 flex items-center gap-3">
                <span className="text-emerald-400 transform group-hover:scale-110 transition-transform duration-500">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                </span>
                <span>Get Started Free</span>
            </div>
          </Link>
          
          <Link
            to="/contact"
            className="text-[12px] uppercase tracking-[0.1em] text-zinc-500 hover:text-white transition-colors duration-300 border-b border-transparent hover:border-white/30 pb-0.5"
          >
            Capabilities
          </Link>
        </div>
      </div>

      {/* Elegant Bottom Footer */}
      <div className="absolute bottom-10 left-0 w-full px-8 lg:px-16 flex items-center justify-between z-20 pointer-events-none">
        {/* Scrolldown Indicator */}
        <div className="flex-1 flex justify-start pointer-events-auto">
            <div 
              className="group cursor-pointer flex flex-col items-center gap-2 hover:opacity-80 transition-opacity duration-300"
              onClick={() => window.scrollBy({ top: window.innerHeight, behavior: 'smooth' })}
            >
              <div className="w-[1px] h-12 bg-gradient-to-b from-white/20 to-transparent relative overflow-hidden">
                  <div className="absolute top-0 w-full h-1/2 bg-white/60 animate-[slideUp_2s_ease-in-out_infinite]" />
              </div>
              <span className="text-[9px] uppercase tracking-[0.3em] text-zinc-500 font-medium">DISCOVER</span>
            </div>
        </div>

        {/* Subtle Watermark */}
        <div className="flex-1 flex justify-center opacity-50">
            <div className="text-[10px] uppercase tracking-[0.4em] text-zinc-600 font-bold" style={{ letterSpacing: '8px' }}>
                RELYCE
            </div>
        </div>

        <div className="flex-1 flex justify-end"></div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes bg-pan {
            0% { background-position: 0% center; }
            100% { background-position: -200% center; }
        }
        @keyframes slideUp {
            0% { transform: translateY(-100%); opacity: 0; }
            50% { opacity: 1; }
            100% { transform: translateY(200%); opacity: 0; }
        }
      `}} />
    </section>
  );
};

export default HeroSection;