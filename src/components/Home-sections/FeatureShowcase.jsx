import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, Building2, MessageSquare, UserCircle2, BookOpen, BarChart3, Database, Bot } from 'lucide-react';

// Import images
import aiPersonaImg from '../../assets/ai_persona.png';
import businessImg from '../../assets/business.webp';
import dataVizImg from '../../assets/data visuvilation.webp';
import genericImg from '../../assets/genric.webp';
import libraryImg from '../../assets/library.webp';

const FeatureShowcase = () => {
    const [currentSlide, setCurrentSlide] = useState(0);

    const slides = [
        {
            id: 'personalization',
            title: "Web AI Personalization",
            subtitle: "Custom AI Personas",
            description: "Tailor your AI experience with specific personalities. From coding experts to creative writers, choose the persona that fits your needs.",
            icon: UserCircle2,
            image: aiPersonaImg,
            tags: ["Development", "Personalization"],
            customContent: (
                <div className="w-full h-full bg-[#0a0f0a] relative overflow-hidden flex flex-col">
                    {/* Abstract Background */}
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:24px_24px]" />
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl" />
                    
                    {/* Header */}
                    <div className="relative z-10 px-6 py-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/30 backdrop-blur-sm">
                        <div className="text-sm font-semibold text-zinc-300">Select Persona</div>
                        <div className="flex gap-1">
                            <div className="w-2 h-2 rounded-full bg-red-500/50" />
                            <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
                            <div className="w-2 h-2 rounded-full bg-green-500/50" />
                        </div>
                    </div>

                    {/* Content - Persona List */}
                    <div className="relative z-10 p-5 space-y-3">
                        
                        {/* Active Persona Option */}
                        <div className="relative group p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/40 transition-all duration-300 shadow-lg shadow-emerald-500/10 translate-x-2">
                             {/* Selection Indicator */}
                             <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                             
                             <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                                    <UserCircle2 size={20} className="text-emerald-400" />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                        <div className="text-white text-sm font-bold">Software Engineer</div>
                                        <div className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500 text-black font-bold">ACTIVE</div>
                                    </div>
                                    <div className="text-xs text-zinc-400 mt-0.5">Concise, Technical, Code-focused</div>
                                </div>
                             </div>
                        </div>

                        {/* Inactive Option 1 */}
                        <div className="p-3 rounded-xl bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700 transition-all opacity-60 hover:opacity-100 cursor-pointer">
                             <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center border border-zinc-700">
                                    <MessageSquare size={18} className="text-zinc-400" />
                                </div>
                                <div>
                                    <div className="text-zinc-300 text-sm font-medium">Creative Writer</div>
                                    <div className="text-xs text-zinc-500 mt-0.5">Imaginative, Verbose, Storyteller</div>
                                </div>
                             </div>
                        </div>

                         {/* Inactive Option 2 */}
                         <div className="p-3 rounded-xl bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700 transition-all opacity-60 hover:opacity-100 cursor-pointer">
                             <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center border border-zinc-700">
                                    <Building2 size={18} className="text-zinc-400" />
                                </div>
                                <div>
                                    <div className="text-zinc-300 text-sm font-medium">Business Analyst</div>
                                    <div className="text-xs text-zinc-500 mt-0.5">Formal, Data-driven, Strategic</div>
                                </div>
                             </div>
                        </div>

                    </div>
                </div>
            )
        },
        {
            id: 'business',
            title: "Business Chat",
            subtitle: "Enterprise Intelligence",
            description: "Secure, context-aware chat designed for business operations. Streamline workflows and access company knowledge instantly.",
            icon: Building2,
            image: businessImg,
            tags: ["Enterprise", "Secure Ops"]
        },
        {
            id: 'visualization',
            title: "Data Visualization",
            subtitle: "Excel & CSV Analysis",
            description: "Upload your data files and unlock deep insights. Generate interactive charts and visual reports in seconds.",
            icon: BarChart3,
            image: dataVizImg,
            tags: ["Analytics", "Visual Reports"]
        },
        {
            id: 'generic',
            title: "Generic Normal Chat",
            subtitle: "Everyday Assistant",
            description: "Your go-to AI for general queries, writing assistance, and problem-solving. Capable, fast, and always ready to help.",
            icon: MessageSquare,
            image: genericImg,
            tags: ["General Purpose", "Fast Assist"]
        },
        {
            id: 'library',
            title: "Digital Library",
            subtitle: "Document Bucket",
            description: "A centralized bucket for all your files. Upload PDFs, organize your knowledge base, and chat with your documents effortlessly.",
            icon: Database,
            image: libraryImg,
            tags: ["PDF Bucket", "Knowledge Base"]
        }
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % slides.length);
        }, 8000);
        return () => clearInterval(interval);
    }, []);

    const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % slides.length);
    const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);

    const currentData = slides[currentSlide];

    
    return (
        <section className="relative w-full py-32 bg-[#05060a] overflow-hidden">
            
            <div className="max-w-7xl mx-auto px-6 relative z-10">
                {/* Section Header */}
                <div className="mb-20 text-center">
                    <span className="text-emerald-500 font-mono text-xs uppercase tracking-widest px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/5">
                        Capabilities
                    </span>
                    <h2 className="text-4xl md:text-5xl font-bold text-white mt-6 mb-4">
                        Everything you need <br />
                        <span className="text-zinc-500">in one powerful platform.</span>
                    </h2>
                </div>

                <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
                    
                    {/* Content Side */}
                    <div className="order-2 lg:order-1 space-y-10">
                        
                        {/* Title & Desc */}
                        <div className="space-y-6 relative">
                            {/* Animated line decor */}
                            <div className="w-12 h-1 bg-emerald-500 rounded-full" />
                            
                            <h3 className="text-3xl md:text-4xl font-bold text-white leading-tight">
                                {currentData.title}
                            </h3>
                            <p className="text-lg text-zinc-400 leading-relaxed">
                                {currentData.description}
                            </p>

                             {/* Tags */}
                            <div className="flex flex-wrap gap-3 pt-2">
                                {currentData.tags.map((tag, idx) => (
                                    <div key={idx} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900/50 border border-zinc-800 text-zinc-300 text-sm hover:border-emerald-500/30 transition-colors">
                                        {idx === 0 && <currentData.icon size={14} className="text-emerald-500" />}
                                        <span>{tag}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Controls & Progress */}
                        <div className="flex flex-col gap-6 pt-6">
                            {/* Progress Bar */}
                            <div className="flex items-center gap-4">
                                <span className="text-xs font-mono text-zinc-500">0{currentSlide + 1}</span>
                                <div className="h-1 bg-zinc-900 rounded-full flex-1 overflow-hidden">
                                    <div 
                                        className="h-full bg-emerald-500 transition-all duration-300 ease-out"
                                        style={{ width: `${((currentSlide + 1) / slides.length) * 100}%` }}
                                    />
                                </div>
                                <span className="text-xs font-mono text-zinc-500">0{slides.length}</span>
                            </div>

                            <div className="flex gap-4">
                                <button 
                                    onClick={prevSlide}
                                    className="p-4 rounded-full border border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all hover:scale-105 active:scale-95"
                                >
                                    <ChevronLeft size={20} />
                                </button>
                                <button 
                                    onClick={nextSlide}
                                    className="p-4 rounded-full bg-emerald-500 text-black hover:bg-emerald-400 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-emerald-500/20"
                                >
                                    <ChevronRight size={20} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Visual Image Side */}
                    <div className="order-1 lg:order-2">
                        <div className="relative group">
                            {/* Frame */}
                            <div className="relative z-10 rounded-2xl bg-[#0a0f0a] border border-zinc-800 p-2 shadow-2xl transition-transform duration-500 group-hover:-translate-y-2">
                                <div className="relative rounded-xl overflow-hidden aspect-[16/10] bg-zinc-900">
                                    {currentData.customContent ? (
                                        currentData.customContent
                                    ) : (
                                        <>
                                            <img 
                                                src={currentData.image} 
                                                alt={currentData.title}
                                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                            />
                                            {/* Inner shadow/vignette */}
                                            <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-xl" />
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Decorative Elements behind */}
                            <div className="absolute -right-4 -bottom-4 w-full h-full border border-zinc-800 rounded-2xl -z-10" />
                            <div className="absolute -right-8 -bottom-8 w-full h-full border border-zinc-800/50 rounded-2xl -z-20" />
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default FeatureShowcase;
