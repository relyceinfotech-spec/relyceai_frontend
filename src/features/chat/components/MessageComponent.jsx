import React, { useState, useEffect, useRef, useMemo, memo, forwardRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Download, Image, FileText, Globe, ExternalLink, Search, Sparkles, BrainCircuit, ChevronDown, ChevronUp } from 'lucide-react';
import { getFileIcon, formatFileSize } from '../../../utils/chatHelpers';
import IntelligenceBar from './IntelligenceBar';
import AgentMetaBlock from './AgentMetaBlock';
import PDFService from '../../../services/pdfService';
import { buildResponse } from '../response_pipeline/response_builder';
import StructuredResponseRenderer from '../response_pipeline/StructuredResponseRenderer';
import { normalizeChatMode } from '../utils/chatMode.js';
import './MessageComponent.css';

const THINKING_START = "[THINKING]";
const THINKING_END = "[/THINKING]";
const REMARK_PLUGINS = [remarkGfm];

let _syntaxHighlighter = null;
let _syntaxTheme = null;
let _syntaxLoadPromise = null;

const ensureSyntaxHighlighterLoaded = async () => {
  if (_syntaxHighlighter && _syntaxTheme) {
    return { SyntaxHighlighter: _syntaxHighlighter, syntaxTheme: _syntaxTheme };
  }

  if (!_syntaxLoadPromise) {
    _syntaxLoadPromise = Promise.all([
      import('react-syntax-highlighter'),
      import('react-syntax-highlighter/dist/esm/styles/prism'),
    ])
      .then(([highlighterModule, styleModule]) => {
        _syntaxHighlighter = highlighterModule.Prism;
        _syntaxTheme = styleModule.atomDark;
        return { SyntaxHighlighter: _syntaxHighlighter, syntaxTheme: _syntaxTheme };
      })
      .catch((err) => {
        _syntaxLoadPromise = null;
        throw err;
      });
  }

  return _syntaxLoadPromise;
};

const parseThinkingContent = (content) => {
  if (!content) return { thinkingContent: "", displayContent: "" };

  const thinkingParts = [];
  const displayParts = [];
  let cursor = 0;

  while (cursor < content.length) {
    const start = content.indexOf(THINKING_START, cursor);
    if (start === -1) {
      displayParts.push(content.slice(cursor));
      break;
    }

    displayParts.push(content.slice(cursor, start));
    const end = content.indexOf(THINKING_END, start + THINKING_START.length);
    if (end === -1) {
      thinkingParts.push(content.slice(start + THINKING_START.length));
      cursor = content.length;
      break;
    }

    thinkingParts.push(content.slice(start + THINKING_START.length, end));
    cursor = end + THINKING_END.length;
  }

  return {
    thinkingContent: thinkingParts.join("\n").trim(),
    displayContent: displayParts.join("").trim()
  };
};

const normalizeThinkingContent = (text) => {
  if (!text) return "";
  let cleaned = text.replace(/\r\n/g, "\n");
  cleaned = cleaned.replace(/\[\/?THINKING\]/gi, "");
  cleaned = cleaned.replace(/^(Thinking Process:|Thinking:|Reasoning:)\s*/i, "");

  cleaned = cleaned.replace(/\b(\w+):\s*\1:/gi, "$1:");
  cleaned = cleaned.replace(/\b([A-Z][a-z]+)\s+\1\b/g, "$1");
  cleaned = cleaned.replace(/^(\w+)\s+\1:/gim, "$1:");
  cleaned = cleaned.replace(/(\w+\s+\w+):\s*\1:/gi, "$1:");
  cleaned = cleaned.replace(/\b([a-zA-Z]{3,})([a-z]{3,})\2\b/g, "$1$2");
  cleaned = cleaned.replace(/\b([A-Za-z]{2,})\1\b/g, "$1");
  cleaned = cleaned.replace(/\b([A-Za-z]{2,})\b([,:;!?])\s*\1\b/gi, "$1$2");
  cleaned = cleaned.replace(/\b([A-Za-z]{2,})\b(?:\s+\1\b)+/gi, "$1");
  cleaned = cleaned.replace(/\b([A-Za-z]+(?:'s|'re|'ve|'d|n't))\b(?:\s+\1\b)+/gi, "$1");
  cleaned = cleaned.replace(/'s\s*'s\b/gi, "'s");

  cleaned = cleaned.replace(/::+/g, ":");
  cleaned = cleaned.replace(/\.{2,}/g, ".");
  cleaned = cleaned.replace(/--+/g, "-");
  cleaned = cleaned.replace(/\s{2,}/g, " ");
  cleaned = cleaned.replace(/\b([A-Za-z]{2,}\s+[A-Za-z]{2,})\s+\1\b/gi, "$1");
  cleaned = cleaned.replace(/\*\*\s*\*\*/g, "");
  cleaned = cleaned.replace(/(\n|^)\s*\*\s*Option\s+(\d+)\s*(.*?):/gi, "$1- **Option $2$3:**");
  cleaned = cleaned.replace(/\*\*\s*:\s*\*\*/g, ":");

  const lines = cleaned.split("\n");
  const deduped = [];
  let lastLine = "";
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed === lastLine) continue;
    deduped.push(line);
    lastLine = trimmed;
  }

  return deduped.join("\n").trim();
};

const formatThinkingForDisplay = (text) => {
  if (!text) return text;
  let cleaned = text
    .replace(/\r\n/g, "\n")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/[\u2022\u00B7]/g, "*")
    .replace(/\s*\*\s*\*\s*/g, "\n")
    .replace(/([^\n])\s*(\d+(?:\.\d+)*)(?:\.){1,}\s+/g, "$1\n$2. ")
    .replace(/\n{3,}/g, "\n\n");

  const normalizeSectionNumber = (value) => {
    const first = value.split(".")[0];
    if (/^(\d)\1+$/.test(first)) {
      return first[0];
    }
    return first;
  };

  const cleanTitle = (value) =>
    value
      .replace(/\*+/g, "")
      .replace(/[:\-]\s*$/, "")
      .replace(/\s{2,}/g, " ")
      .trim();

  const splitIntoItems = (value) => {
    if (!value) return [];
    let working = value;
    working = working.replace(
      /\s+(?=(?:Input|Context|Persona|Preferences|Intent|Tone|Constraints|Option|Safety|Final|Response|Strategy|Plan|Drafting|Refining)\b\s*:)/gi,
      "\n"
    );
    working = working.replace(/\s+(?=Option\s+\d+\b)/gi, "\n");
    working = working.replace(/\s+(?=Final Output Generation\b)/gi, "\n");
    working = working.replace(/\s+(?=Final Polish\b)/gi, "\n");
    working = working.replace(/\s+(?=Safety Check\b)/gi, "\n");
    working = working.replace(/\s+(?=Response Strategy\b)/gi, "\n");
    working = working.replace(/\s*\*\s*\*\s*/g, "\n");

    const chunks = working.split("\n");
    const items = [];
    for (const chunk of chunks) {
      if (!chunk) continue;
      let trimmed = chunk.trim();
      if (!trimmed) continue;
      trimmed = trimmed.replace(/^\s*[\-*\u2022\u00B7]\s*/, "");
      trimmed = trimmed.replace(/\s{2,}/g, " ");
      const subparts = trimmed
        .split(/\s+\*\s+/)
        .map((part) => part.trim())
        .filter(Boolean);
      if (subparts.length > 1) {
        items.push(...subparts);
      } else {
        items.push(trimmed);
      }
    }
    return items;
  };

  const lines = cleaned.split("\n");
  const output = [];
  let currentSection = null;
  let buffer = [];

  const flushSection = () => {
    if (!currentSection && buffer.length === 0) return;
    if (currentSection) {
      output.push(`### ${currentSection}`);
    }
    if (buffer.length > 0) {
      buffer.forEach((item) => output.push(`- ${item}`));
    }
    buffer = [];
  };

  const pushLine = (value) => {
    splitIntoItems(value).forEach((item) => {
      if (item) buffer.push(item);
    });
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const sectionMatch = line.match(/^\s*(\d+(?:\.\d+)*)(?:\.)+\s*(.+)$/);
    if (sectionMatch) {
      flushSection();
      const number = normalizeSectionNumber(sectionMatch[1]);
      const remainder = sectionMatch[2].trim();
      const parts = splitIntoItems(remainder);
      const titleRaw = parts.shift() || remainder;
      const title = cleanTitle(titleRaw);
      currentSection = title ? `${number}. ${title}` : `${number}.`;
      parts.forEach((item) => buffer.push(item));
      continue;
    }

    pushLine(line);
  }

  flushSection();
  return output.join("\n");
};

const cleanHeading = (value) => {
  if (!value) return "";
  return value
    .replace(/^[#*\s]+/, "")
    .replace(/\s+[*#:]+$/, "")
    .trim();
};

const extractCurrentHeading = (text) => {
  if (!text) return "";
  const isNoiseHeading = (value) =>
    /final output generation|safety check/i.test(value);
  const lines = text.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (/^#{1,6}\s+.+$/.test(line) || /^\d+\.\s+.+$/.test(line)) {
      const cleaned = cleanHeading(line.replace(/^\d+\.\s*/, ""));
      if (cleaned && cleaned.length < 60 && !isNoiseHeading(cleaned)) {
         return cleaned;
      }
    }
  }
  return "";
};

const ThinkingLoader = () => (
  <div className="flex items-center gap-4 py-3 min-h-[44px]">
    <div className="relative flex h-3 w-3 mt-1.5">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-20"></span>
      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.3)]"></span>
    </div>
    <span className="text-[13px] font-sans tracking-wide text-zinc-400 font-light animate-pulse mt-1">Analyzing request...</span>
  </div>
);

const ProcessingIndicator = ({ query, showSearch, holdFinalStep }) => (
  <div className="py-6 min-h-[120px] flex items-center">
    {showSearch ? (
      <div className="flex items-center gap-4 py-3 min-h-[44px]">
        <div className="relative flex h-3 w-3 mt-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zinc-400 opacity-20"></span>
            <Search size={14} className="text-zinc-400 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
        <span className="text-[13px] font-sans tracking-wide text-zinc-400 font-light animate-pulse mt-1">Searching the web</span>
      </div>
    ) : (
      <ThinkingLoader />
    )}
  </div>
);

const GeneratingIndicator = ({ query, holdFinalStep }) => (
  <ThinkingLoader />
);

const SourcesDisplay = ({ sources }) => (
  <div className="mb-4 pb-4 border-b border-white/5">
    <div className="flex items-center gap-2 text-[10px] uppercase font-mono tracking-widest text-white/40 mb-3">
      <Globe size={10} />
      <span>REFERENCES ({sources.length})</span>
    </div>
    <div className="flex flex-wrap gap-2">
      {sources.slice(0, 5).map((source, idx) => {
        const href = typeof source === "string"
          ? source
          : (source?.url || source?.link || "");
        const label = typeof source === "string"
          ? source
          : (source?.name || source?.title || href || `source-${idx}`);
        let domain = 'source';
        try {
          domain = new URL(href).hostname.replace('www.', '');
        } catch {}
        const sourceKey = href || label || `source-${idx}`;
        
        return (
          <a
            key={sourceKey}
            href={href || undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-1.5 border border-white/10 text-[10px] uppercase tracking-wider font-mono text-white/60 hover:text-white hover:bg-white/5 transition-colors"
            title={label}
          >
            <span className="truncate max-w-[120px]">{domain}</span>
            <ExternalLink size={10} className="opacity-50" />
          </a>
        );
      })}
    </div>
  </div>
);

// Legacy StateBadge, ExecutionLogAccordion, AgentStateHeader removed to favor external AgentMetaBlock

const ThinkingDropdown = ({ formattedContent, currentHeading, isStreaming, hasAnswer }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasUserToggled, setHasUserToggled] = useState(false);

  useEffect(() => {
    if (hasAnswer && isOpen && !hasUserToggled) {
      setIsOpen(false);
    }
  }, [hasAnswer, isOpen, hasUserToggled]);

  if (!formattedContent) return null;

  const showLiveHeading = Boolean(isStreaming && currentHeading);
  const showStaticHeading = Boolean(!isStreaming && currentHeading);

  return (
    <div className="thinking-dropdown-container">
      <button
        onClick={() => {
          setHasUserToggled(true);
          setIsOpen(!isOpen);
        }}
        className="flex items-center gap-2 py-2 text-[10px] font-mono tracking-widest text-white/40 hover:text-white w-full uppercase border-b border-transparent hover:border-white/20 transition-all text-left group"
      >
        {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        <Sparkles size={12} className={isOpen ? "text-white" : "opacity-40"} />
        <span>{isStreaming ? "PROCESSING" : "SHOW LOGS"}</span>
        
        {showLiveHeading && (
          <span className="text-white border-l border-white/20 pl-2 ml-2 tracking-normal truncate">
            {currentHeading}
          </span>
        )}
        {!showLiveHeading && showStaticHeading && (
          <span className="opacity-50 border-l border-white/10 pl-2 ml-2 tracking-normal truncate">
            {currentHeading}
          </span>
        )}
      </button>
      
      {isOpen && (
        <div className="border border-white/5 bg-[#0a0d14]/50 backdrop-blur-md rounded-2xl p-5 mt-3 shadow-inner">
          <div className="prose prose-sm prose-invert max-w-none text-zinc-400 prose-p:leading-relaxed text-[13px] font-light">
            <ReactMarkdown components={MarkdownComponents} remarkPlugins={REMARK_PLUGINS}>
              {formattedContent}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
};

const isSafeUrl = (url) => {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
};

// --- Hoisted to module scope to prevent React from re-mounting markdown DOM on every streaming tick ---

const LANGUAGE_FILE_EXTENSIONS = {
  javascript: "js",
  js: "js",
  typescript: "ts",
  ts: "ts",
  jsx: "jsx",
  tsx: "tsx",
  python: "py",
  py: "py",
  java: "java",
  c: "c",
  cpp: "cpp",
  csharp: "cs",
  cs: "cs",
  go: "go",
  rust: "rs",
  ruby: "rb",
  php: "php",
  swift: "swift",
  kotlin: "kt",
  sql: "sql",
  html: "html",
  css: "css",
  scss: "scss",
  sass: "sass",
  json: "json",
  yaml: "yml",
  yml: "yml",
  xml: "xml",
  bash: "sh",
  sh: "sh",
  shell: "sh",
  powershell: "ps1",
  ps1: "ps1",
  markdown: "md",
  md: "md",
  text: "txt",
};

const getCodeFileExtension = (language) => {
  const key = String(language || "text").toLowerCase();
  return LANGUAGE_FILE_EXTENSIONS[key] || "txt";
};

const CodeBlockWithCopy = ({ code, language, ...props }) => {
  const [copied, setCopied] = useState(false);
  const [syntaxReady, setSyntaxReady] = useState(Boolean(_syntaxHighlighter && _syntaxTheme));
  const normalizedCode = String(code).replace(/\n$/, "");

  useEffect(() => {
    let active = true;
    if (syntaxReady) return () => { active = false; };

    ensureSyntaxHighlighterLoaded()
      .then(() => {
        if (active) setSyntaxReady(true);
      })
      .catch(() => {
        if (active) setSyntaxReady(false);
      });

    return () => {
      active = false;
    };
  }, [syntaxReady]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(normalizedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code: ', err);
    }
  };

  const handleDownload = () => {
    try {
      const extension = getCodeFileExtension(language);
      const blob = new Blob([normalizedCode], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `snippet-${Date.now()}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download code snippet:", err);
    }
  };

  return (
    <div className="overflow-hidden my-6 border border-white/[0.05] bg-[#0a0d14] rounded-2xl shadow-xl group/code">
      <div className="flex items-center justify-between px-5 py-3 bg-[#030508]/80 backdrop-blur-sm border-b border-white/[0.02]">
        <span className="text-[11px] text-zinc-500 font-medium tracking-wider">
          {language || 'code'}
        </span>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDownload}
            className="text-[11px] font-medium tracking-wide text-zinc-500 hover:text-white transition-colors flex items-center gap-1.5 opacity-100 sm:opacity-0 sm:group-hover/code:opacity-100"
            aria-label="Download code"
            type="button"
          >
            <Download size={12} />
            <span>Download</span>
          </button>
          <button
            onClick={handleCopy}
            className="text-[11px] font-medium tracking-wide text-zinc-500 hover:text-white transition-colors flex items-center gap-1.5 opacity-100 sm:opacity-0 sm:group-hover/code:opacity-100"
            aria-label="Copy code"
            type="button"
          >
            <Copy size={12} />
            {copied ? <span className="text-emerald-400">Copied</span> : <span>Copy code</span>}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto relative" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255, 255, 255, 0.1) transparent' }}>
        {syntaxReady && _syntaxHighlighter && _syntaxTheme ? (
          <_syntaxHighlighter
            style={_syntaxTheme}
            language={language === 'text' ? 'text' : language}
            PreTag="div"
            customStyle={{
              margin: 0,
              background: 'transparent',
              padding: '1.25rem 1.5rem',
              fontSize: '13px',
              lineHeight: '1.7',
              fontFamily: '"JetBrains Mono", source-code-pro, Menlo, Monaco, Consolas, "Courier New", monospace'
            }}
            {...props}
          >
            {normalizedCode}
          </_syntaxHighlighter>
        ) : (
          <pre className="m-0 p-5 text-[13px] leading-relaxed font-mono whitespace-pre overflow-x-auto text-zinc-100">
            {normalizedCode}
          </pre>
        )}
      </div>
    </div>
  );
};
const MarkdownComponents = {
  code({ _node, inline, className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || "");
    const language = match ? match[1] : "text";

    const isBlock = !inline || String(children).includes('\n');
    return isBlock ? (
      <CodeBlockWithCopy code={children} language={language} {...props} />
    ) : (
      <code className="bg-white/5 text-white/90 px-1.5 py-0.5 border border-white/10 text-sm font-mono" {...props}>
        {children}
      </code>
    );
  },
  h1: ({ _node, ...props }) => <h1 className="text-2xl sm:text-3xl font-normal tracking-tight mt-10 mb-6 text-white" {...props} />,
  h2: ({ _node, ...props }) => <h2 className="text-xl sm:text-2xl font-light tracking-wide mt-10 mb-6 border-b border-white/5 pb-3 text-zinc-100" {...props} />,
  h3: ({ _node, ...props }) => <h3 className="text-lg font-medium tracking-wide mt-8 mb-4 text-zinc-200" {...props} />,
  h4: ({ _node, ...props }) => <h4 className="text-base font-medium mt-6 mb-3 text-zinc-300" {...props} />,
  h5: ({ _node, ...props }) => <h5 className="text-sm tracking-wide mt-5 mb-2 text-zinc-400" {...props} />,
  h6: ({ _node, ...props }) => <h6 className="text-[12px] font-medium mt-4 mb-2 uppercase tracking-wider text-zinc-500" {...props} />,
  ul: ({ _node, ...props }) => <ul className="list-disc list-outside space-y-3 mb-6 ml-6 marker:text-zinc-500 text-zinc-300" {...props} />,
  ol: ({ _node, ...props }) => <ol className="list-decimal list-outside space-y-3 mb-6 ml-6 marker:text-zinc-500 text-zinc-300" {...props} />,
  li: ({ _node, ...props }) => <li className="my-1.5 leading-relaxed pl-1" {...props} />,
  hr: ({ _node, ...props }) => <hr className="my-10 border-white/5" {...props} />,
  p: ({ _node, ...props }) => <div className="leading-relaxed mb-6 last:mb-0 text-zinc-300 font-light" {...props} />,
  blockquote: ({ _node, ...props }) => <blockquote className="border-l-2 border-emerald-500/30 bg-emerald-500/5 rounded-r-2xl px-5 py-4 mb-6 italic text-zinc-400" {...props} />,
  a: ({ _node, href, children, ...props }) => {
    const safeHref = isSafeUrl(href) ? href : '#';
    return (
      <a className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 border-b border-emerald-500/30 hover:border-emerald-400 transition-colors" target="_blank" rel="noopener noreferrer" href={safeHref} {...props}>
        {children}
        <ExternalLink size={12} className="opacity-70" />
      </a>
    );
  },
  table: ({ _node, ...props }) => (
    <div className="my-8 w-full overflow-x-auto border border-white/5 bg-[#0a0d14] rounded-2xl shadow-lg">
      <table className="w-full border-collapse text-sm text-left" {...props} />
    </div>
  ),
  thead: ({ _node, ...props }) => <thead className="bg-[#030508]/80 backdrop-blur-sm border-b border-white/5 text-[11px] uppercase tracking-wider font-medium text-zinc-500" {...props} />,
  th: ({ _node, ...props }) => <th className="px-6 py-4 font-medium" {...props} />,
  td: ({ _node, ...props }) => <td className="border-t border-white/[0.02] px-6 py-4 text-zinc-300 font-light" {...props} />,
  tr: ({ _node, ...props }) => <tr className="hover:bg-white/[0.02] transition-colors" {...props} />,
  img: ({ _node, ...props }) => <img className="my-8 max-w-full h-auto border border-white/5 rounded-2xl shadow-xl" {...props} />,
  strong: ({ _node, ...props }) => <strong className="font-medium text-white" {...props} />,
  em: ({ _node, ...props }) => <em className="italic text-zinc-400" {...props} />,
};

// --- End hoisted components ---
const parseToolResults = (content) => {
  if (!content || !content.includes("TOOL_RESULT:")) return { cleanContent: content, toolResults: [] };
  const pattern = /TOOL_RESULT:\s*([A-Za-z0-9_]+)[\s\S]*?(?=TOOL_RESULT:|$)/g;
  const toolResults = [];
  let match;
  while ((match = pattern.exec(content)) !== null) {
    const block = match[0];
    const tool = match[1];
    const status = (block.match(/STATUS:\s*([^\n]+)/i) || [])[1] || "unknown";
    const source = (block.match(/SOURCE:\s*([^\n]+)/i) || [])[1] || "";
    const confidence = (block.match(/CONFIDENCE:\s*([^\n]+)/i) || [])[1] || "";
    const reason = (block.match(/REASON:\s*([^\n]+)/i) || [])[1] || "";
    let data = null;
    let rawData = "";
    const dataMatch = block.match(/DATA:\s*\n([\s\S]*)/i);
    if (dataMatch && dataMatch[1]) {
      rawData = dataMatch[1].trim();
      try {
        data = JSON.parse(rawData);
      } catch {
        data = null;
      }
    }
    toolResults.push({ tool, status, source, confidence, reason, data, rawData });
  }
  const cleanContent = content.replace(pattern, "").trim();
  return { cleanContent, toolResults };
};

const ToolResultCard = ({ result }) => {
  const { tool, status, confidence, reason, data, rawData } = result;
  const statusColor = status === "success" ? "text-emerald-300" : "text-rose-300";
  const badgeColor = status === "success" ? "bg-emerald-500/10 border-emerald-500/20" : "bg-rose-500/10 border-rose-500/20";

  const renderData = () => {
    if (tool === "validate_code" && data?.summary) {
      const { total, high, medium, low } = data.summary;
      return (
        <div className="flex gap-4 text-xs text-zinc-400">
          <span>Total: <span className="text-zinc-200">{total}</span></span>
          <span>High: <span className="text-rose-300">{high}</span></span>
          <span>Med: <span className="text-amber-300">{medium}</span></span>
          <span>Low: <span className="text-emerald-300">{low}</span></span>
        </div>
      );
    }
    if (tool === "extract_entities" && data?.counts) {
      return (
        <div className="flex flex-wrap gap-2 text-xs text-zinc-300">
          {Object.entries(data.counts).map(([k, v]) => (
            <span key={k} className="px-2 py-1 rounded border border-white/10 bg-white/[0.02]">{k}: {v}</span>
          ))}
        </div>
      );
    }
    if (tool === "document_compare" && data?.diff) {
      const lines = String(data.diff).split("\n");
      return (
        <pre className="text-[11px] leading-relaxed whitespace-pre-wrap font-mono bg-black/30 border border-white/10 rounded-lg p-3 max-h-64 overflow-auto">
          {lines.map((line, idx) => {
            let cls = "text-zinc-300";
            if (line.startsWith("+") && !line.startsWith("+++")) cls = "text-emerald-300";
            if (line.startsWith("-") && !line.startsWith("---")) cls = "text-rose-300";
            return <div key={idx} className={cls}>{line}</div>;
          })}
        </pre>
      );
    }
    if (tool === "extract_tables" && (data?.tables || data?.csv_preview)) {
      return (
        <div className="space-y-2">
          <div className="text-xs text-zinc-400">Tables: <span className="text-zinc-200">{data?.tables?.length || 0}</span></div>
          {data?.csv_preview ? (
            <pre className="text-[11px] leading-relaxed whitespace-pre-wrap font-mono bg-black/30 border border-white/10 rounded-lg p-3 max-h-40 overflow-auto">
              {data.csv_preview}
            </pre>
          ) : null}
        </div>
      );
    }
    if (tool === "unit_cost_calc" && data?.items) {
      return (
        <div className="text-xs text-zinc-300">
          <div className="mb-2">Total: <span className="text-emerald-300">{data.total}</span> {data.currency || ""}</div>
          <div className="grid grid-cols-3 gap-2">
            {data.items.map((item, idx) => (
              <div key={idx} className="px-2 py-1 rounded border border-white/10 bg-white/[0.02]">
                <div className="text-zinc-200">{item.name}</div>
                <div className="text-zinc-500">qty {item.quantity} @ {item.unit_cost}</div>
                <div className="text-emerald-300">= {item.total}</div>
              </div>
            ))}
          </div>
        </div>
      );
    }
    if (tool === "pdf_maker") {
      const textContent = String(data?.content || rawData || "").trim();
      const title = String(data?.title || "Document Export");
      const filename = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'document-export'}-${new Date().toISOString().slice(0, 10)}.pdf`;
      return (
        <div className="space-y-2">
          <div className="text-xs text-zinc-400">{data?.message || 'PDF content prepared'}</div>
          <button
            type="button"
            onClick={async () => {
              try {
                await PDFService.generateAndDownloadTextPDF(textContent, { title }, filename);
              } catch (error) {
                console.error('PDF maker download failed:', error);
              }
            }}
            className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
          >
            <Download size={14} />
            Download PDF
          </button>
        </div>
      );
    }
    const printable = data ? JSON.stringify(data, null, 2) : rawData || "";
    return printable ? (
      <pre className="text-[11px] leading-relaxed whitespace-pre-wrap font-mono bg-black/30 border border-white/10 rounded-lg p-3 max-h-64 overflow-auto">
        {printable}
      </pre>
    ) : null;
  };

  return (
    <div className="mt-3 mb-4 border border-white/10 rounded-2xl bg-white/[0.02] p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs uppercase tracking-widest text-zinc-500 font-mono">Tool Result</div>
        <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded ${badgeColor} border ${statusColor}`}>{status}</span>
      </div>
      <div className="text-sm text-zinc-200 mb-2">{tool.replace(/_/g, " ")}</div>
      <div className="text-[11px] text-zinc-500 mb-3">Confidence: {confidence || "n/a"}</div>
      {reason ? <div className="text-xs text-rose-300 mb-2">{reason}</div> : null}
      {renderData()}
    </div>
  );
};

const normalizeConfidenceBand = (confidence, level) => {
  const rawLevel = String(level || "").trim().toUpperCase();
  if (rawLevel === "HIGH") return "HIGH";
  if (rawLevel === "MEDIUM" || rawLevel === "MODERATE") return "MEDIUM";
  if (rawLevel === "LOW") return "LOW";
  if (typeof confidence === "number") {
    if (confidence >= 0.75) return "HIGH";
    if (confidence >= 0.45) return "MEDIUM";
    return "LOW";
  }
  return "";
};

const ResponseConfidenceBadge = ({ confidence, confidenceLevel }) => {
  const band = normalizeConfidenceBand(confidence, confidenceLevel);
  if (!band) return null;
  if (band === "HIGH") {
    return (
      <div className="mb-4 inline-flex items-center gap-2 text-[11px] text-emerald-300 border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 rounded-full">
        <span>🟢</span>
        <span>High confidence</span>
      </div>
    );
  }
  if (band === "MEDIUM") {
    return (
      <div className="mb-4 inline-flex items-center gap-2 text-[11px] text-amber-300 border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 rounded-full">
        <span>🟡</span>
        <span>Medium confidence</span>
      </div>
    );
  }
  return (
    <div className="mb-4 inline-flex items-center gap-2 text-[11px] text-red-300 border border-red-500/30 bg-red-500/10 px-3 py-1.5 rounded-full">
      <span>🔴</span>
      <span>Low confidence — verify this</span>
    </div>
  );
};

const MessageComponentInner = forwardRef(({ msg, index, theme, onCopyMessage, onContinue, onFollowupClick, continueMeta, isLastMessage, chatMode, thinkingVisibility = 'auto' }, ref) => {
  const [showCopyButton, setShowCopyButton] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showIndicator, setShowIndicator] = useState(false);
  const [holdFinalStep, setHoldFinalStep] = useState(false);
  const [indicatorFade, setIndicatorFade] = useState(false);
  const [ghostSpace, setGhostSpace] = useState(false);
  const [renderMarkdown, setRenderMarkdown] = useState(false);
  const markdownTimerRef = useRef(null);
  const indicatorStartRef = useRef(0);
  const indicatorTimeoutRef = useRef(null);
  const holdTimeoutRef = useRef(null);
  const fadeTimeoutRef = useRef(null);
  const ghostTimeoutRef = useRef(null);

  const isGeneric = normalizeChatMode(chatMode) === 'smart';
  const isStreaming = msg.isStreaming;


  const stripContinueMarkers = (content) => {
    if (!content) return content;
    return content.replace(/^[^\n]*CONTINUE_AVAILABLE[^\n]*\n?/gmi, "");
  };

  const stripSystemMarkers = (content) => {
    if (!content) return content;
    let cleaned = stripContinueMarkers(content);
    cleaned = cleaned.replace(/\[THINKING\][\s\S]*?\[\/THINKING\]/g, "");
    cleaned = cleaned.replace(/\[THINKING\][\s\S]*$/g, "");
    return cleaned;
  };


  const stripInternalLeakage = (content) => {
    if (!content) return content;
    let cleaned = String(content);

    const blockedLinePatterns = [
      /^\s*_?CALL\s*:\s*.*$/gim,
      /^\s*TOOL_CALL\s*:\s*.*$/gim,
      /^\s*Assistant:\s*First,.*$/gim,
      /^\s*First,\s*the user.*$/gim,
      /^\s*AGENT OPERATIONAL LOGIC\s*:?.*$/gim,
      /^\s*RUNTIME CONTEXT\s*:?.*$/gim,
      /^\s*CRITICAL SYSTEM OVERRIDE\s*:?.*$/gim,
      /^\s*Rules for FINAL ANSWER\s*:?.*$/gim,
      /^\s*Classify\s*&\s*Plan\s*:?.*$/gim,
      /^\s*Do NOT describe steps or reasoning\.?\s*$/gim,
      /^\s*Do NOT narrate what you did\.?\s*$/gim,
      /^\s*Only include sources if asked\.?\s*$/gim,
      /^\s*Deliver one clean final response\.?\s*$/gim,
      /^\s*You have completed all required execution steps\.?.*$/gim,
      /^\s*(Thoughts|Progress)\s*$/gim,
      /^\s*(Searching|Searched)\s+\"?.*\"?\s*$/gim,
      /^\s*Step completed\s*$/gim,
      /^\s*Sources collected\..*$/gim,
      /^\s*Looking for relevant and recent sources.*$/gim,
    ];

    blockedLinePatterns.forEach((pattern) => {
      cleaned = cleaned.replace(pattern, "");
    });

    // If prompt/tool leakage appears, keep only the final human-facing section.
    const leakageHints = [
      /AGENT OPERATIONAL LOGIC/i,
      /CRITICAL SYSTEM OVERRIDE/i,
      /RUNTIME CONTEXT/i,
      /Rules for FINAL ANSWER/i,
      /^\s*_?CALL\s*:/im,
      /^\s*TOOL_CALL\s*:/im,
    ];

    if (leakageHints.some((rx) => rx.test(content))) {
      const headingMatch = cleaned.match(/(?:^|\n)#{1,6}\s+.+/m);
      if (headingMatch && typeof headingMatch.index === "number") {
        const start = headingMatch.index + (headingMatch[0].startsWith("\n") ? 1 : 0);
        cleaned = cleaned.slice(start);
      }

      cleaned = cleaned.replace(/^\s*Assistant\s*:[\s\S]*?(?=(?:\n#{1,6}\s+|$))/im, "");
    }

    cleaned = cleaned
      .replace(/\n{3,}/g, "\n\n")
      .replace(/^[\s\n]+|[\s\n]+$/g, "");
    return cleaned;
  };
  const handleCopy = () => {
    onCopyMessage(stripSystemMarkers(msg.content));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const preprocessContent = (content) => {
    if (!content) return content;
    let processed = stripInternalLeakage(stripContinueMarkers(content));

    const codePatterns = [
      /^(mkdir|cd|npm|npm run|npm install|git|sudo|apt-get|docker|pip|pip install|python|node|ls|cat|chmod|chown)\s+.+$/i,
      /^[a-z0-9_]+\s*=\s*['"][^'"]*['"]$/i,
      /^\s*\{\s*".+":\s*.+\}\s*$/s,
    ];

    const isRawCode = codePatterns.some(pattern => pattern.test(processed.trim())) && !processed.includes('```') && !processed.includes('`');

    if (isRawCode) {
      const isTerminal = /^(mkdir|cd|npm|git|sudo|apt-get|docker|pip|python|node|ls|cat|chmod|chown)/i.test(processed.trim());
      processed = `\`\`\`${isTerminal ? 'bash' : 'code'}\n${processed.trim()}\n\`\`\``;
    }

    const looksLikeHtmlDoc = /<!doctype\s+html|<html[\s>]/i.test(processed);
    if (looksLikeHtmlDoc && !processed.includes("```")) {
      processed = `\`\`\`html
${processed.trim()}
\`\`\``;
    }

    processed = processed.replace(
      /Source:\s*(https?:\/\/[^\s]+)/gi,
      (match, url) => {
        try {
          const domain = new URL(url).hostname.replace('www.', '');
          return `[Source: ${domain}](${url})`;
        } catch {
          return `[Source](${url})`;
        }
      }
    );

    processed = processed.replace(
      /(?<!\[.*?\]\()(?<!\()(?<!")(?<!')\b(https?:\/\/[^\s\)"'\]<>]+)/g,
      (url) => {
        try {
          const domain = new URL(url).hostname.replace('www.', '');
          return `[Source: ${domain}](${url})`;
        } catch {
          return `[Link](${url})`;
        }
      }
    );
    return processed;
  };

  const formatStreamingForDisplay = (value) => {
    if (!value) return value;
    return stripInternalLeakage(value)
      .replace(/\r\n/g, "\n")
      // Hide raw markdown tokens while streaming; final render still uses full markdown.
      .replace(/(^|\n)\s*#{1,6}\s*/g, "$1")
      .replace(/```[\w-]*\n?/g, "")
      .replace(/```/g, "")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\*\*/g, "")
      .replace(/__/g, "")
      .replace(/\s+-\s+/g, "\n- ")
      .replace(/\s*\*\s+/g, "\n* ")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/^\n+/, "");
  };
  const [thinkingDurationMs, setThinkingDurationMs] = useState(0);
  const extractStreamingCodeBlock = (value) => {
    if (!value || !value.includes("```")) return null;
    const openFence = value.indexOf("```");
    if (openFence < 0) return null;
    const fenceHead = value.slice(openFence + 3).split("\n")[0] || "";
    const language = fenceHead.trim().toLowerCase() || "code";
    let codeBody = value.slice(openFence + 3 + fenceHead.length);
    if (codeBody.startsWith("\n")) codeBody = codeBody.slice(1);
    const closeFence = codeBody.lastIndexOf("```");
    if (closeFence >= 0) {
      codeBody = codeBody.slice(0, closeFence);
    }
    return { language, code: codeBody };
  };
  const thinkingStartTimeRef = useRef(null);
  
  const isSearching = msg.isSearching;
  const isGenerating = msg.isGenerating;
  const sources = msg.sources || [];
  const followups = Array.isArray(msg.followups) ? msg.followups : [];
  const actionChips = Array.isArray(msg.actionChips) ? msg.actionChips : [];
  const parsedToolResults = useMemo(() => parseToolResults(msg.content || ""), [msg.content]);
  const trustMeta = msg?.metadata || {};
  const highStakesMeta = trustMeta?.high_stakes || null;
  const parsedContent = useMemo(() => parseThinkingContent(parsedToolResults.cleanContent || ""), [parsedToolResults.cleanContent]);
  const displayContent = useMemo(() => {
    let cleaned = stripContinueMarkers(parsedContent.displayContent || "");
    cleaned = cleaned.replace(/\[\/?THINKING\]/gi, "").trim();
    cleaned = stripInternalLeakage(cleaned);
    return cleaned;
  }, [parsedContent.displayContent]);
  const thinkingContent = parsedContent.thinkingContent || "";
  const normalizedThinking = useMemo(() => normalizeThinkingContent(thinkingContent), [thinkingContent]);
  const formattedThinking = useMemo(() => formatThinkingForDisplay(normalizedThinking), [normalizedThinking]);
  const preprocessedDisplay = useMemo(() => {
    if (!displayContent) return "";
    if (isStreaming) return displayContent;
    return preprocessContent(displayContent);
  }, [displayContent, isStreaming]);
  const structuredResponse = useMemo(() => {
    const isNormalMode = normalizeChatMode(chatMode) === "smart";
    if (isNormalMode) return null;
    if (isStreaming) return null;

    const backendStructured = msg?.structured_response;
    if (backendStructured && typeof backendStructured === "object") {
      const normalizedSources = Array.isArray(backendStructured.sources)
        ? backendStructured.sources
            .map((s) => {
              if (!s) return null;
              if (typeof s === "string") return s;
              return {
                name: s.name || s.title || "",
                url: s.url || s.link || "",
                trust: s.trust ?? null,
              };
            })
            .filter((s) => (typeof s === "string" ? Boolean(s) : Boolean(s?.name || s?.url)))
        : [];

      const normalizedBlocks = Array.isArray(backendStructured.blocks) ? backendStructured.blocks : [];
      const tableBlock = normalizedBlocks.find((b) => b?.type === "table");

      return {
        type: backendStructured.answer_type || "summary",
        answer: backendStructured.answer || "",
        keyPoints: Array.isArray(backendStructured.key_points) ? backendStructured.key_points : [],
        sources: normalizedSources,
        confidence: typeof backendStructured.confidence === "number" ? backendStructured.confidence : null,
        confidence_level: backendStructured.confidence_level || null,
        metadata: backendStructured.metadata || {},
        blocks: normalizedBlocks,
        tableMarkdown: tableBlock?.markdown || "",
        timeline: [],
        relatedQuestions: followups,
        hasStructure: Boolean(
          backendStructured.answer ||
          (Array.isArray(backendStructured.key_points) && backendStructured.key_points.length) ||
          normalizedBlocks.length
        ),
      };
    }

    if (!displayContent) return null;
    return buildResponse(displayContent, {
      sources,
      relatedQuestions: followups,
      meta: { confidence: msg?.intelligence?.confidence },
    });
  }, [displayContent, isStreaming, sources, followups, msg?.intelligence?.confidence, msg?.structured_response]);
  const hasStructuredBlocks = Boolean(Array.isArray(structuredResponse?.blocks) && structuredResponse.blocks.length > 0);
  const responseConfidence = typeof structuredResponse?.confidence === "number"
    ? structuredResponse.confidence
    : (typeof msg?.confidence === "number" ? msg.confidence : null);
  const responseConfidenceLevel = structuredResponse?.confidence_level || msg?.confidence_level || null;
  // UX choice: render chat replies as natural text, not forced Answer/Key-Points cards.
  // Keep structured payload for metadata/followups, but do not switch to structured renderer.
  const shouldUseStructuredRenderer = false;

  const hasVisibleContent = Boolean(displayContent && displayContent.trim().length > 0);
  const indicatorActive = Boolean((isSearching || isGenerating) && !hasVisibleContent && !formattedThinking);

  useEffect(() => {
    const minDurationMs = 1200;
    const holdAfterMs = 2000;

    if (indicatorTimeoutRef.current) clearTimeout(indicatorTimeoutRef.current);
    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
    if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
    if (ghostTimeoutRef.current) clearTimeout(ghostTimeoutRef.current);

    if (indicatorActive) {
      indicatorStartRef.current = Date.now();
      setShowIndicator(true);
      setHoldFinalStep(false);
      setIndicatorFade(false);
      setGhostSpace(false);
      holdTimeoutRef.current = setTimeout(() => {
        setHoldFinalStep(true);
        holdTimeoutRef.current = null;
      }, holdAfterMs);
      return;
    }

    const elapsed = indicatorStartRef.current ? Date.now() - indicatorStartRef.current : minDurationMs;
    const remaining = Math.max(0, minDurationMs - elapsed);

    // Track thinking duration
    if (formattedThinking && !thinkingStartTimeRef.current) {
      thinkingStartTimeRef.current = Date.now();
    } else if (!isStreaming && thinkingStartTimeRef.current && !thinkingDurationMs) {
      setThinkingDurationMs(Date.now() - thinkingStartTimeRef.current);
    }

    indicatorTimeoutRef.current = setTimeout(() => {
      setIndicatorFade(true);
      fadeTimeoutRef.current = setTimeout(() => {
        setShowIndicator(false);
        setIndicatorFade(false);
        setGhostSpace(true);
        indicatorStartRef.current = 0;
        setHoldFinalStep(false);
        fadeTimeoutRef.current = null;
      }, 220);
      ghostTimeoutRef.current = setTimeout(() => {
        setGhostSpace(false);
        ghostTimeoutRef.current = null;
      }, 520);
      indicatorTimeoutRef.current = null;
    }, remaining);

    return () => {
      if (indicatorTimeoutRef.current) clearTimeout(indicatorTimeoutRef.current);
      if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
      if (ghostTimeoutRef.current) clearTimeout(ghostTimeoutRef.current);
      setIndicatorFade(false);
      setShowIndicator(false);
      setGhostSpace(false);
      setHoldFinalStep(false);
      indicatorStartRef.current = 0;
    };
  }, [indicatorActive]);

  useEffect(() => {
    if (markdownTimerRef.current) {
      clearTimeout(markdownTimerRef.current);
      markdownTimerRef.current = null;
    }
    if (isStreaming) {
      setRenderMarkdown(false);
      return;
    }
    if (displayContent) {
      markdownTimerRef.current = setTimeout(() => {
        setRenderMarkdown(true);
        markdownTimerRef.current = null;
      }, 90);
      return () => {
        if (markdownTimerRef.current) {
          clearTimeout(markdownTimerRef.current);
          markdownTimerRef.current = null;
        }
      };
    }
    setRenderMarkdown(false);
    return () => {
      if (markdownTimerRef.current) {
        clearTimeout(markdownTimerRef.current);
        markdownTimerRef.current = null;
      }
    };
  }, [isStreaming, displayContent]);

  if (msg.role === "user") {
    return (
      <div ref={ref} className={`flex justify-end mb-10 group w-full px-4 md:px-0`} >
        <div className="max-w-[90%] md:max-w-[75%] lg:max-w-[65%] flex flex-col items-end">
          {msg.files && msg.files.length > 0 && (
            <div className="mb-3 space-y-2 inline-flex flex-col items-end w-full">
              {msg.files.map((file, idx) => {
                const fileKey = file.id || `${file.name || 'file'}:${file.size || 0}:${file.lastModified || idx}`;
                return (
                  <div key={fileKey} className="flex items-center gap-3 px-4 py-3 border border-white/10 bg-[#030508] shadow-sm w-auto max-w-full">
                  <div className="text-zinc-500">
                    {(() => {
                      const icon = getFileIcon(file.type);
                      switch (icon.type) {
                        case 'image': return <Image size={18} />;
                        case 'pdf': return <FileText size={18} />;
                        default: return <FileText size={18} />;
                      }
                    })()}
                  </div>
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="text-sm truncate text-zinc-300 font-medium">{file.name}</div>
                    <div className="text-[11px] text-zinc-500 font-mono tracking-wide">{formatFileSize(file.size)}</div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
          
          <div className="inline-block px-6 py-4 bg-white/[0.02] border border-white/10 rounded-[2px] shadow-sm text-white/90 text-sm leading-relaxed font-light text-left min-w-[60px] max-w-full break-words">
            {msg.content}
          </div>
          
          <div className="mt-2 flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={handleCopy} className="text-[11px] font-medium tracking-wide text-zinc-500 hover:text-white transition-all flex items-center gap-1.5" title={copied ? "Copied!" : "Copy request"}>
              {copied ? <><Sparkles size={12} className="text-emerald-400" /> <span className="text-emerald-400">Copied</span></> : <><Copy size={12} /> Copy</>}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // System/Bot Message Body
  return (
    <div
      ref={ref}
      className={`flex items-start gap-6 mb-12 group w-full ${isLastMessage ? 'pb-8' : 'border-b border-white/5 pb-10'}`}
      onMouseEnter={() => setShowCopyButton(true)}
      onMouseLeave={() => setShowCopyButton(false)}
    >
      <div className="flex-1 min-w-0 px-2 lg:px-8 max-w-4xl mx-auto w-full">

        <div className="text-white/80 leading-loose text-[15px] font-light font-['Inter',sans-serif]">
          {isLastMessage && (!displayContent && !formattedThinking) && (isSearching || isGenerating) && !msg.agentMeta?.agent_state && (
            <ProcessingIndicator query={msg.searchQuery} showSearch={isSearching} holdFinalStep={holdFinalStep} />
          )}

          {isLastMessage && Array.isArray(msg.executionLog) && msg.executionLog.length > 0 && (
            <AgentMetaBlock
              meta={msg.agentMeta}
              logs={msg.executionLog}
              thinkingContent={formattedThinking}
              thinkingDurationMs={thinkingDurationMs}
              isStreaming={isStreaming}
            />
          )}
          {parsedToolResults.toolResults.map((result, idx) => (
            <ToolResultCard key={`${result.tool}-${idx}`} result={result} />
          ))}
          {sources.length > 0 && !showIndicator && !indicatorFade && !ghostSpace && !shouldUseStructuredRenderer && (
            <SourcesDisplay sources={sources} />
          )}


          {msg.intelligence && (
            <IntelligenceBar intelligence={msg.intelligence} isStreaming={isStreaming} />
          )}
          {!isStreaming && (
            <ResponseConfidenceBadge confidence={responseConfidence} confidenceLevel={responseConfidenceLevel} />
          )}

          {highStakesMeta?.enabled && !isStreaming && (
            <div className="mb-4 rounded-lg border border-amber-400/25 bg-amber-400/5 p-3 text-xs text-amber-200">
              <div className="font-medium mb-1">High-Stakes Domain: {String(trustMeta?.domain || "general").replace(/_/g, " ")}</div>
              <div>{highStakesMeta?.disclaimer || "Verify this response with qualified professionals or official sources."}</div>
            </div>
          )}

          {(displayContent || shouldUseStructuredRenderer) && (() => {
            const liveCode = isStreaming ? extractStreamingCodeBlock(displayContent) : null;
            return (
              <div className="relative" data-streaming={isStreaming ? 'true' : undefined}>
                {(isStreaming || !renderMarkdown) ? (
                  liveCode ? (
                    <div className="overflow-hidden my-4 border border-white/[0.08] bg-[#0a0d14] rounded-2xl">
                      <div className="px-4 py-2 text-[11px] tracking-wider uppercase text-zinc-500 border-b border-white/[0.06]">
                        {liveCode.language}
                      </div>
                      <pre className="m-0 p-4 text-[13px] leading-relaxed font-mono whitespace-pre overflow-x-auto text-zinc-100">
                        {liveCode.code}
                      </pre>
                    </div>
                  ) : (
                    <div className="streaming-plain">{formatStreamingForDisplay(displayContent)}</div>
                  )
                ) : shouldUseStructuredRenderer ? (
                  <StructuredResponseRenderer response={structuredResponse} onFollowupClick={onFollowupClick} />
                ) : (
                  <div className="prose prose-invert max-w-none prose-pre:bg-transparent prose-pre:p-0 prose-pre:m-0 mt-4">
                    <ReactMarkdown components={MarkdownComponents} remarkPlugins={REMARK_PLUGINS}>
                      {preprocessedDisplay}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
          {(!isStreaming && !isSearching && !isGenerating && (followups.length > 0 || actionChips.length > 0)) && (
            <div className="mt-6 flex flex-wrap gap-2">
              {followups.map((q, i) => (
                <button
                  key={'followup-' + i + '-' + q}
                  onClick={() => onFollowupClick && onFollowupClick(q)}
                  className="text-[12px] px-3 py-1.5 rounded-full border border-white/15 bg-white/[0.03] text-zinc-200 hover:text-white hover:border-emerald-400/40 transition-colors"
                  title="Ask follow-up"
                >
                  {q}
                </button>
              ))}
              {actionChips.map((chip, i) => (
                <button
                  key={'action-' + i + '-' + chip}
                  onClick={() => onFollowupClick && onFollowupClick(chip)}
                  className="text-[12px] px-3 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:text-emerald-200 hover:border-emerald-400/50 transition-colors"
                  title="Run quick action"
                >
                  {chip}
                </button>
              ))}
            </div>
          )}

        
        {displayContent && !isSearching && !isGenerating && !isStreaming && (
          <div className="mt-8 pt-4 border-t border-white/5 flex gap-4 items-center opacity-30 group-hover:opacity-100 transition-opacity">
            <button onClick={handleCopy} className="text-[11px] font-medium tracking-wide text-zinc-500 hover:text-white transition-colors flex items-center gap-1.5" title={copied ? "Copied!" : "Copy text"}>
              <Copy size={12} className={copied ? "text-emerald-400" : ""} /> {copied ? <span className="text-emerald-400">Copied</span> : 'Copy text'}
            </button>
            {continueMeta && (
              <span className="text-[11px] font-medium tracking-wide text-zinc-500 border border-white/5 bg-white/[0.02] px-3 py-1.5 rounded-full flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Continuation Available
              </span>
            )}
            {continueMeta && onContinue && (
              <button onClick={() => onContinue(msg, continueMeta)} className="text-[11px] font-medium tracking-wide text-zinc-300 hover:text-white transition-colors bg-white/5 px-4 py-1.5 rounded-full flex items-center gap-2 border border-white/10 hover:border-white/20">
                <Sparkles size={12} className="text-emerald-400" /> Proceed
              </button>
            )}
            <button
              onClick={() => {
                const blob = new Blob([stripSystemMarkers(msg.content)], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `relyce-log-${Date.now()}.txt`;
                document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
              }}
              className="text-[11px] font-medium tracking-wide text-zinc-500 hover:text-white transition-colors flex items-center gap-1.5"
              title="Download text file"
            >
              <Download size={12} /> Export
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

const areMessagePropsEqual = (prevProps, nextProps) => {
  if (prevProps.index !== nextProps.index) return false;
  if (prevProps.theme !== nextProps.theme) return false;
  if (prevProps.chatMode !== nextProps.chatMode) return false;
  if (prevProps.isLastMessage !== nextProps.isLastMessage) return false;
  if (prevProps.thinkingVisibility !== nextProps.thinkingVisibility) return false;

  const prevContinue = prevProps.continueMeta;
  const nextContinue = nextProps.continueMeta;
  if (!!prevContinue !== !!nextContinue) return false;
  if (prevContinue && nextContinue) {
    if (prevContinue.file !== nextContinue.file) return false;
    if (prevContinue.mode !== nextContinue.mode) return false;
    if ((prevContinue.lines || 0) !== (nextContinue.lines || 0)) return false;
  }

  const p = prevProps.msg || {};
  const n = nextProps.msg || {};
  if (p === n) return true;
  return (
    p.id === n.id &&
    p.role === n.role &&
    p.content === n.content &&
    p.isStreaming === n.isStreaming &&
    p.isSearching === n.isSearching &&
    p.isGenerating === n.isGenerating &&
    p.searchQuery === n.searchQuery &&
    p.answer === n.answer &&
    p.schema_version === n.schema_version &&
    p.answer_type === n.answer_type &&
    p.intelligence === n.intelligence &&
    p.agentMeta === n.agentMeta &&
    p.executionLog === n.executionLog &&
    p.sources === n.sources &&
    p.followups === n.followups &&
    p.actionChips === n.actionChips &&
    p.metadata === n.metadata &&
    p.structured_response === n.structured_response &&
    p.files === n.files
  );
};

const MessageComponent = memo(MessageComponentInner, areMessagePropsEqual);

export default MessageComponent;
