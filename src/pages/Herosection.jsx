import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bot, BrainCircuit, Users, Shield, Send, Sparkles, Zap, ChevronRight, Globe, Lock, Cpu } from "lucide-react";
import bgImage from "../assets/hero5.png"; // You can change to hero2.png, hero3.png, or hero5.png

const HeroSection = () => {
  const [placeholderText, setPlaceholderText] = useState("");
  const [isTyping, setIsTyping] = useState(true);

  // Easter Egg States
  const [clickSparks, setClickSparks] = useState([]);
  const [titleClicks, setTitleClicks] = useState(0);
  const [showSecret, setShowSecret] = useState(false);
  const [currentRoast, setCurrentRoast] = useState("");
  const [countdown, setCountdown] = useState(8);
  const [featureEasterEggs, setFeatureEasterEggs] = useState({});

  const easterEggColors = ['text-pink-400', 'text-purple-400', 'text-cyan-400', 'text-yellow-400', 'text-orange-400'];

  // Roasting messages
  const roastMessages = [
    "Still clicking? You must be really bored 💀",
    "Go touch some grass... after using Relyce AI 🌱",
    "You clicked 3 times. That's 3x more effort than your last project 😏",
    "Congrats! You found me. Now go do something productive 🔥",
    "AI can't fix your procrastination... but we can help with everything else 😎",
  ];

  // Click spark effect
  const handlePageClick = (e) => {
    if (Math.random() > 0.6) { // 40% chance
      const id = Date.now();
      setClickSparks(prev => [...prev, { id, x: e.clientX, y: e.clientY }]);
      setTimeout(() => setClickSparks(prev => prev.filter(s => s.id !== id)), 800);
    }
  };

  // Secret message on title click
  const handleTitleClick = () => {
    setTitleClicks(prev => prev + 1);
    if (titleClicks >= 2) {
      const randomMessage = roastMessages[Math.floor(Math.random() * roastMessages.length)];
      setCurrentRoast(randomMessage);
      setShowSecret(true);
      setCountdown(8);

      let count = 8;
      const timer = setInterval(() => {
        count--;
        setCountdown(count);
        if (count <= 0) {
          clearInterval(timer);
          setShowSecret(false);
        }
      }, 1000);
      setTitleClicks(0);
    }
  };

  // Feature hover
  const handleFeatureHover = (index) => {
    const randomColor = easterEggColors[Math.floor(Math.random() * easterEggColors.length)];
    setFeatureEasterEggs(prev => ({ ...prev, [index]: randomColor }));
  };

  const resetFeatureHover = (index) => {
    setFeatureEasterEggs(prev => ({ ...prev, [index]: null }));
  };

  // Typewriter effect
  const questions = [
    "What can you help me with?",
    "Explain quantum computing...",
    "Write a poem about AI...",
  ];

  useEffect(() => {
    let questionIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let timeout;

    const type = () => {
      const currentQuestion = questions[questionIndex];
      if (!isDeleting) {
        setPlaceholderText(currentQuestion.substring(0, charIndex + 1));
        charIndex++;
        if (charIndex === currentQuestion.length) {
          isDeleting = true;
          timeout = setTimeout(type, 2000);
          return;
        }
        timeout = setTimeout(type, 80); // Type speed
      } else {
        setPlaceholderText(currentQuestion.substring(0, charIndex - 1));
        charIndex--;
        if (charIndex === 0) {
          isDeleting = false;
          questionIndex = (questionIndex + 1) % questions.length;
          timeout = setTimeout(type, 500);
          return;
        }
        timeout = setTimeout(type, 40); // Delete speed
      }
    };
    type();
    return () => clearTimeout(timeout);
  }, []);

  const features = [
    { icon: BrainCircuit, title: "Advanced", subtitle: "Reasoning" },
    { icon: Users, title: "Real-time", subtitle: "Collaboration" },
    { icon: Shield, title: "Secure &", subtitle: "Private" },
  ];

  return (
    <section className="relative h-screen w-full overflow-hidden flex items-center" onClick={handlePageClick}>
      
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src={bgImage} 
          alt="AI Background" 
          className="w-full h-full object-cover"
        />
        {/* Dark overlay gradient for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/70 to-black/90" />
        {/* Emerald tint overlay for brand consistency */}
        <div className="absolute inset-0 bg-gradient-to-tr from-emerald-900/20 via-transparent to-teal-900/20 mix-blend-overlay" />
      </div>

      {/* Animated particles overlay */}
      <div className="absolute inset-0 z-[1]">
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-emerald-400 rounded-full animate-pulse" style={{ animationDuration: '3s' }} />
        <div className="absolute top-1/3 right-1/3 w-1 h-1 bg-teal-400 rounded-full animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-1/4 left-1/3 w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" style={{ animationDuration: '5s' }} />
      </div>
      
      {/* Click Spark Effects */}
      {clickSparks.map(spark => (
        <div key={spark.id} className="fixed pointer-events-none z-50" style={{ left: spark.x - 20, top: spark.y - 20 }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="absolute w-2 h-2 bg-emerald-400 rounded-full animate-spark" style={{ transform: `rotate(${i * 60}deg)`, animationDelay: `${i * 0.05}s` }} />
          ))}
        </div>
      ))}

      {/* Roast Popup */}
      {showSecret && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md" onClick={() => setShowSecret(false)}>
          <div className="bg-gradient-to-br from-[#0f1a0f] to-[#05060a] text-white px-8 py-8 rounded-3xl border border-emerald-500/30 max-w-sm mx-4 text-center relative shadow-2xl shadow-emerald-500/20">
             <div className="text-4xl mb-4">🔥</div>
             <p className="text-emerald-400 font-bold mb-2">Relyce AI says:</p>
             <p className="text-gray-300">{currentRoast}</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">

          {/* Left Side: Text */}
          <div className="text-center lg:text-left order-1">
             
             {/* Premium Pill with Glass Effect */}
             <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 backdrop-blur-xl animate-fade-in-up mb-6 lg:mx-0 mx-auto shadow-lg shadow-emerald-500/10">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-emerald-400 font-mono text-xs uppercase tracking-widest font-semibold">Next Gen AI Platform</span>
             </div>

            <h1
              className={`text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight leading-tight text-white mb-5 transition-transform duration-300 drop-shadow-2xl ${showSecret ? 'scale-105' : ''}`}
              onClick={handleTitleClick}
            >
              Experience the Future of{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 animate-gradient-x">
                AI Conversation.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-zinc-300 leading-relaxed max-w-xl mx-auto lg:mx-0 mb-8 drop-shadow-lg">
              Instant, intelligent, and seamless. Your personal assistant, evolved.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-12">
              <Link
                to="/chat"
                className="group inline-flex items-center justify-center gap-2 px-8 py-3.5 font-semibold rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-black hover:from-emerald-400 hover:to-teal-400 transition-all hover:scale-105 shadow-[0_0_30px_rgba(16,185,129,0.4)] hover:shadow-[0_0_40px_rgba(16,185,129,0.6)]"
              >
                <span>Get Started Now</span>
                <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              
               <a 
                  href="#features"
                  className="inline-flex items-center justify-center gap-2 px-8 py-3.5 font-medium rounded-full border border-emerald-500/30 bg-black/30 backdrop-blur-sm text-white hover:bg-emerald-500/10 hover:border-emerald-500/50 transition-all cursor-pointer"
               >
                  <Sparkles size={18} className="text-emerald-400" />
                  <span>Explore Features</span>
               </a>
            </div>

            {/* Enhanced Feature Cards with Glass Effect */}
            <div className="grid grid-cols-3 gap-3 lg:gap-6">
               {features.map((feature, index) => (
                  <div key={index} 
                    onMouseEnter={() => handleFeatureHover(index)}
                    onMouseLeave={() => resetFeatureHover(index)}
                    className="group cursor-pointer"
                  >
                     <div className={`mb-2 inline-flex items-center justify-center w-10 h-10 rounded-xl bg-black/40 backdrop-blur-md border border-emerald-500/20 text-emerald-400 group-hover:bg-emerald-500/20 group-hover:border-emerald-500/50 group-hover:scale-110 transition-all duration-300 shadow-lg ${featureEasterEggs[index] ? 'text-pink-400 border-pink-400 animate-bounce' : ''}`}>
                        <feature.icon size={20} />
                     </div>
                     <div className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors drop-shadow-lg">{feature.title}</div>
                     <div className="text-[10px] text-zinc-400 group-hover:text-zinc-300 transition-colors">{feature.subtitle}</div>
                  </div>
               ))}
            </div>

             {/* Developed with 💚 by Relyce Infotech */}
             <div className="mt-8 flex justify-center lg:justify-start">
               <span className="text-[16px] text-gray-400 cursor-default select-none transition-all duration-500 hover:text-transparent hover:bg-clip-text hover:bg-gradient-to-r hover:from-emerald-400 hover:via-teal-300 hover:to-emerald-500 hover:scale-105 inline-block">
                 Developed with 💚 by Relyce Infotech
               </span>
             </div>

          </div>

          {/* Right Side - Enhanced Chat Interface */}
          <div className="hidden lg:flex order-2 justify-end relative perspective-1000">
             
             {/* Enhanced decorative elements */}
             <div className="absolute right-10 top-10 w-72 h-72 bg-emerald-500/20 rounded-full blur-3xl -z-10 animate-pulse" style={{ animationDuration: '4s' }} />
             <div className="absolute left-0 bottom-10 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl -z-10 animate-pulse" style={{ animationDuration: '6s' }} />

             <div className="relative w-full max-w-md transform hover:scale-[1.02] transition-transform duration-700 ease-out">
                {/* Chat Window Frame with Glass Effect */}
                <div className="rounded-2xl bg-black/40 backdrop-blur-xl border border-white/20 shadow-2xl overflow-hidden relative">
                   {/* Header */}
                   <div className="h-12 border-b border-white/10 flex items-center px-4 gap-3 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 backdrop-blur-sm">
                      <div className="flex gap-2">
                         <div className="w-3 h-3 rounded-full bg-red-500 border border-red-600 shadow-lg shadow-red-500/50" />
                         <div className="w-3 h-3 rounded-full bg-yellow-500 border border-yellow-600 shadow-lg shadow-yellow-500/50" />
                         <div className="w-3 h-3 rounded-full bg-green-500 border border-green-600 shadow-lg shadow-green-500/50" />
                      </div>
                      <div className="flex-1 text-center text-[11px] font-mono text-emerald-400 font-semibold">relyce-ai-v2.0 • LIVE</div>
                   </div>

                   {/* Body */}
                   <div className="p-5 space-y-4 bg-gradient-to-br from-black/60 to-emerald-950/40 min-h-[350px] backdrop-blur-sm">
                      
                      {/* AI Msg */}
                      <div className="flex gap-3 animate-fade-in">
                         <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/30 to-teal-500/30 border border-emerald-400/30 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/30">
                            <Bot size={16} className="text-emerald-300" />
                         </div>
                         <div className="space-y-2 max-w-[85%]">
                            <div className="p-3 rounded-2xl rounded-tl-none bg-white/10 backdrop-blur-md border border-white/20 text-xs text-white shadow-xl">
                               👋 Hey there! Ready to unlock AI superpowers?
                            </div>
                         </div>
                      </div>

                      {/* User Msg */}
                      <div className="flex gap-3 flex-row-reverse animate-fade-in" style={{ animationDelay: '0.3s' }}>
                         <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center shrink-0 border border-white/10 shadow-lg">
                            <div className="w-4 h-4 bg-gradient-to-br from-zinc-500 to-zinc-600 rounded-full" />
                         </div>
                         <div className="space-y-2 max-w-[85%]">
                            <div className="p-3 rounded-2xl rounded-tr-none bg-gradient-to-r from-emerald-500 to-teal-500 text-xs text-black font-medium shadow-xl shadow-emerald-500/30">
                               Show me real-time market insights 📊
                            </div>
                         </div>
                      </div>

                      {/* AI Researching Msg */}
                      <div className="flex gap-3 animate-fade-in" style={{ animationDelay: '0.6s' }}>
                         <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/30 to-teal-500/30 border border-emerald-400/30 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/30">
                            <Bot size={16} className="text-emerald-300" />
                         </div>
                         <div className="space-y-2 w-full">
                            <div className="flex items-center gap-2 text-[10px] text-emerald-400 font-mono mb-1">
                               <Sparkles size={10} className="animate-pulse" />
                               <span>Analyzing data streams...</span>
                            </div>
                            <div className="p-3 rounded-2xl rounded-tl-none bg-white/10 backdrop-blur-md border border-white/20 text-xs text-white shadow-xl">
                               <div className="flex gap-2 mb-2">
                                  <div className="h-1.5 w-24 bg-emerald-400/30 rounded animate-pulse" />
                                  <div className="h-1.5 w-12 bg-white/20 rounded animate-pulse" style={{ animationDelay: '0.2s' }} />
                               </div>
                               <div className="h-24 w-full bg-black/40 rounded-lg border border-emerald-500/20 relative overflow-hidden backdrop-blur-sm">
                                  {/* Enhanced Chart */}
                                  <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between px-2 pb-2 h-full gap-1">
                                     {[40, 70, 50, 90, 60, 80].map((h, i) => (
                                        <div 
                                          key={i} 
                                          className="w-full bg-gradient-to-t from-emerald-500/40 to-emerald-400/60 rounded-t-sm hover:from-emerald-400/60 hover:to-emerald-300/80 transition-all duration-300 shadow-lg shadow-emerald-500/20" 
                                          style={{ height: `${h}%`, animationDelay: `${i * 0.1}s` }} 
                                        />
                                     ))}
                                  </div>
                               </div>
                            </div>
                         </div>
                      </div>

                   </div>

                   {/* Enhanced Input Area */}
                   <div className="p-3 border-t border-white/10 bg-gradient-to-r from-black/50 to-emerald-950/30 backdrop-blur-sm">
                      <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md border border-emerald-500/30 rounded-xl px-3 py-2.5 shadow-lg">
                         <div className="flex-1 text-zinc-400 text-xs font-mono truncate">
                            {placeholderText}<span className="animate-pulse text-emerald-400 font-bold">|</span>
                         </div>
                         <div className="w-7 h-7 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center cursor-pointer hover:scale-110 transition-transform shadow-lg shadow-emerald-500/50">
                            <Send size={14} className="text-black" />
                         </div>
                      </div>
                   </div>
                </div>
             </div>
          </div>

        </div>
      </div>

       {/* Enhanced Scroll Down Indicator */}
      <div 
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 cursor-pointer animate-bounce hover:text-emerald-400 text-white/60 transition-colors drop-shadow-lg"
        onClick={() => window.scrollBy({ top: window.innerHeight, behavior: 'smooth' })}
      >
         <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-mono uppercase tracking-wider">Scroll</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
               <path d="M7 13l5 5 5-5M7 6l5 5 5-5"/>
            </svg>
         </div>
      </div>

      <style>{`
        @keyframes spark {
          0% { transform: rotate(var(--rotation, 0deg)) translateY(0) scale(1); opacity: 1; }
          100% { transform: rotate(var(--rotation, 0deg)) translateY(-30px) scale(0); opacity: 0; }
        }
        .animate-spark { animation: spark 0.6s ease-out forwards; }
        .perspective-1000 { perspective: 1000px; }
        
        @keyframes gradient-x {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient-x {
          background-size: 200% auto;
          animation: gradient-x 3s ease infinite;
        }
        
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.6s ease-out forwards;
        }
        
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.8s ease-out forwards;
        }
      `}</style>
    </section>
  );
};

export default HeroSection;