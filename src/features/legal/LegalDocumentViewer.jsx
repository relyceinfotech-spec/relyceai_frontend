import React from 'react';
import { ArrowLeft, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const LegalDocumentViewer = ({ title, lastUpdated, content, pdfUrl }) => {
  const navigate = useNavigate();

  // Simple parser to render text with structure
  const renderContent = (text) => {
    if (!text) return null;
    const lines = text.split('\n');
    const elements = [];
    let currentList = [];
    
    // Helper to flush list
    const flushList = () => {
      if (currentList.length > 0) {
        elements.push(
          <ul key={`list-${elements.length}`} className="list-disc pl-6 mb-4 space-y-2 text-zinc-300">
            {currentList.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        );
        currentList = [];
      }
    };

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Detect Headers
      // Level 1: "1. INTRODUCTION" or "TERMS OF USE" (if checking strictly)
      // We look for Number + Dot + Space + Uppercase Letters (mostly)
      const isHeader1 = /^\d+\.\s+[A-Z\s]+$/.test(trimmed); // "1. INTRODUCTION"
      const isHeader2 = /^\d+\.\d+\s/.test(trimmed); // "2.1 Age..."
      const isListItem = /^[•\-\*]\s/.test(trimmed); // "• You must..."

      if (isListItem) {
        currentList.push(trimmed.replace(/^[•\-\*]\s/, ''));
      } else {
        flushList();
        
        if (isHeader1) {
          elements.push(
            <h2 key={index} className="text-xl font-bold text-white mt-10 mb-4 border-b border-zinc-800/50 pb-2">
              {trimmed}
            </h2>
          );
        } else if (isHeader2) {
          elements.push(
            <h3 key={index} className="text-lg font-semibold text-emerald-400 mt-6 mb-3">
              {trimmed}
            </h3>
          );
        } else {
          // Check if it's a "Title" line purely uppercase and short?
          const isTitleLine = /^[A-Z\s]{5,}$/.test(trimmed) && trimmed.length < 50;
          if (isTitleLine && elements.length < 5) {
             // Skip main title if it's at the start, as we render it in header
             return; 
          }

          // Regular Paragraph
          elements.push(
            <p key={index} className="text-zinc-300 mb-3 leading-relaxed">
              {trimmed}
            </p>
          );
        }
      }
    });
    
    flushList();
    return elements;
  };

  return (
    <div className="min-h-screen bg-black text-slate-200 font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
            <button 
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
            >
                <ArrowLeft size={16} />
                Back
            </button>
            <div className="h-6 w-px bg-zinc-800 hidden sm:block"></div>
            <h1 className="text-sm font-semibold text-white hidden sm:block">{title}</h1>
        </div>
        
        {pdfUrl && (
            <a  
                href={pdfUrl} 
                download
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-xs font-medium text-zinc-400 hover:text-white transition-all"
            >
                <Download size={14} />
                <span className="hidden sm:inline">Download PDF</span>
            </a>
        )}
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-12 md:py-16 animate-fade-in">
        <div className="mb-12 text-center">
            <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-6 tracking-tight">{title}</h1>
            {lastUpdated && (
                <div className="flex flex-col items-center gap-2">
                    <p className="text-zinc-500 text-xs uppercase tracking-widest font-medium">
                        Last Updated: {lastUpdated}
                    </p>
                </div>
            )}
        </div>

        <div className="prose prose-invert prose-emerald max-w-none text-base">
            {renderContent(content)}
        </div>

        {/* Footer of Doc */}
        <div className="mt-16 pt-8 border-t border-zinc-800 text-center text-zinc-600 text-sm">
            <p>For any questions, please contact <a href="mailto:support@relyceai.com" className="text-emerald-500 hover:underline">support@relyceai.com</a></p>
        </div>
      </main>
    </div>
  );
};

export default LegalDocumentViewer;
