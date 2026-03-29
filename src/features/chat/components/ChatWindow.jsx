import React, { memo, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { LogIn } from 'lucide-react';
import ChatInput from './ChatInput';
import useChat from '../../../hooks/useChat';
import ChatWindowHeader from './ChatWindowHeader';
import MessageComponent from './MessageComponent';
import TypingIndicator from './TypingIndicator';
import { LoadingSpinner } from '../../../components/loading';
import BotSkeletonLoader from './BotSkeletonLoader';
import { normalizeChatMode, isAgentPremiumMode } from '../utils/chatMode.js';
// removed logo import

const AnimatedGradientText = ({ children, className }) => (
  <span className={`bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-teal-200 to-emerald-400 animate-[bg-pan_8s_linear_infinite] ${className}`} style={{ backgroundSize: '200% auto' }}>
    {children}
  </span>
);

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const inferContinueMeta = (content) => {
  if (!content) return null;
  if (/CONTINUE_AVAILABLE/i.test(content)) return null;
  if (!/```/.test(content)) return null;
  if (!/^##\s+[A-Za-z0-9_.-]+/m.test(content)) return null;

  const fileRegex = /^##\s+([A-Za-z0-9_.-]+)\s*$/gm;
  let lastFile = null;
  let lastIndex = -1;
  let match;
  while ((match = fileRegex.exec(content)) !== null) {
    lastFile = match[1];
    lastIndex = match.index + match[0].length;
  }
  if (!lastFile || lastIndex < 0) return null;

  const tail = content.slice(lastIndex);
  const saveRegex = new RegExp(`Save as:\\s*${escapeRegex(lastFile)}\\b`, "i");
  if (saveRegex.test(tail)) return null;

  const fenceCount = (tail.match(/```/g) || []).length;
  const unclosedFence = fenceCount % 2 === 1;
  const endsWithFence = /```\s*$/.test(content.trim());
  const looksIncomplete = unclosedFence || !endsWithFence;
  if (!looksIncomplete) return null;

  let mode = null;
  if (/\.(jsx|tsx)$/i.test(lastFile)) mode = "ui_react";
  else if (/\.(html|css|js)$/i.test(lastFile)) mode = "ui_demo_html";
  else return null;

  return { file: lastFile, mode };
};

const extractContinueMeta = (content) => {
  if (!content) return null;
  const match = content.match(/CONTINUE_AVAILABLE\s*(\{[\s\S]*?\})/i);
  if (!match) return inferContinueMeta(content);
  try {
    const meta = JSON.parse(match[1]);
    if (!meta || typeof meta.file !== "string" || typeof meta.mode !== "string") return null;
    const allowedModes = new Set(["ui_demo_html", "ui_react", "ui_implementation"]);
    if (!allowedModes.has(meta.mode)) return null;
    return {
      file: meta.file,
      mode: meta.mode,
      lines: Number.isFinite(meta.lines) ? meta.lines : undefined,
    };
  } catch {
    return null;
  }
};

const extractContinueContext = (content, meta) => {
  if (!content || !meta?.file) return content || "";
  const fenceRegex = /```[\s\S]*?```/g;
  let lastMatch = null;
  let match;
  while ((match = fenceRegex.exec(content)) !== null) {
    lastMatch = match;
  }
  if (!lastMatch) return content;

  const block = lastMatch[0];
  const headerMatch = block.match(/^```[^\n]*\n([\s\S]*)\n```$/);
  const inner = headerMatch ? headerMatch[1] : block;
  const lines = inner.split(/\r?\n/);
  const tailLines = meta.lines && Number.isFinite(meta.lines)
    ? lines.slice(-Math.max(1, Math.min(240, meta.lines)))
    : lines.slice(-120);

  return [
    `## ${meta.file}`,
    "```",
    tailLines.join("\n"),
    "```",
  ].join("\n");
};
const buildContinuePrompt = (meta, content) => {
  return [
    "Continue generating UI code.",
    `Mode: ${meta.mode}`,
    `File: ${meta.file}`,
    "Rules:",
    "- Continue from the exact last line of the previous output.",
    "- Do not repeat any previous content.",
    "- Continue the same file only.",
    "- Do not output any explanations or extra text.",
    "- If you must stop again, append a CONTINUE_AVAILABLE comment with updated metadata.",
    "",
    "<PREVIOUS_OUTPUT>",
    content || "",
    "</PREVIOUS_OUTPUT>",
  ].join("\n");
};
const ChatWindow = memo(function ChatWindow({
  currentSessionId,
  userId,
  chatSessions = [],
  showHeader = false,
  sidebarExpanded = true,
  onToggleSidebar,
  onMessagesUpdate,
  chatMode: externalChatMode,
  onChatModeChange: externalOnChatModeChange,
  personalities: externalPersonalities,
  activePersonality: externalActivePersonality,
  setActivePersonality: externalSetActivePersonality,
  initialMessage,
  onInitialMessageConsumed,
}) {
  const theme = 'dark';
  const { currentUser: user, userProfile, membership, loading: authLoading } = useAuth();

  const {
    messages, loading, wsConnected, botTyping, isReconnecting,
    showScrollToBottom, chatMode, isTransitioning, isDeepSearchActive,
    messagesContainerRef, setChatMode, handleSend, handleStop,
    handleReconnect, scrollToBottom, copyMessageToClipboard,
    handleFileUpload, handleFileUploadComplete, handleDownloadPDF,
    handleShare, handleCopyLink, handleDelete,
    personalities, activePersonality, setActivePersonality,
  } = useChat({
    currentSessionId, userId, chatSessions, onMessagesUpdate,
    chatMode: externalChatMode, onChatModeChange: externalOnChatModeChange,
    activePersonality: externalActivePersonality, setActivePersonality: externalSetActivePersonality,
    personalities: externalPersonalities,
  });
  const rawMembershipPlan = (
    membership?.plan ||
    membership?.planName ||
    userProfile?.membership?.plan ||
    userProfile?.membership?.planName ||
    userProfile?.membershipPlan ||
    'free'
  );
  const membershipPlan = String(rawMembershipPlan).trim().toLowerCase();
  const normalizedPlan = membershipPlan
    .replace(/\s+/g, '')
    .replace(/plan$/g, '')
    .replace('professional', 'pro')
    .replace('businessplan', 'business')
    .replace('proplan', 'pro')
    .replace('plusplan', 'plus');
  const canUseFullAgent = ['plus', 'pro', 'business'].includes(normalizedPlan);
  const effectiveMode = normalizeChatMode(chatMode);
  const isAgentTrial = isAgentPremiumMode(effectiveMode) && !canUseFullAgent;

  const handleContinue = useCallback((msg, meta) => {
    if (!msg || !meta) return;
    const context = extractContinueContext(msg.content, meta);
    const prompt = buildContinuePrompt(meta, context);
    handleSend({ text: prompt });
  }, [handleSend]);

  const handleFollowupClick = useCallback((question) => {
    const q = typeof question === 'string' ? question.trim() : '';
    if (!q) return;
    handleSend({ text: q });
  }, [handleSend]);

  const prevMessagesLengthRef = useRef(messages.length);
  const isAutoScrollingRef = useRef(false);
  const prevBotTypingRef = useRef(false);
  const lastUserMessageRef = useRef(null);
  const lastBotMessageRef = useRef(null);
  const prevSessionIdRef = useRef(currentSessionId);
  const isSessionSwitchingRef = useRef(false);

  useEffect(() => {
    if (prevSessionIdRef.current !== currentSessionId && prevSessionIdRef.current !== null) {
      isSessionSwitchingRef.current = true;
      const timer = setTimeout(() => { isSessionSwitchingRef.current = false; }, 500);
      return () => clearTimeout(timer);
    }
    prevSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  // Auto-send initialMessage from Memory Manager ("See what Relyce learned")
  useEffect(() => {
    if (!initialMessage || !currentSessionId || loading) return;
    const timer = setTimeout(() => {
      handleSend({ text: initialMessage });
      if (onInitialMessageConsumed) onInitialMessageConsumed();
    }, 800);
    return () => clearTimeout(timer);
  }, [initialMessage, currentSessionId]);

  const scrollToMessage = (element) => {
    if (!messagesContainerRef.current || !element) return;
    const container = messagesContainerRef.current;
    const elementRect = element.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const scrollTop = elementRect.top - containerRect.top + container.scrollTop;
    container.scrollTo({ top: scrollTop, behavior: 'smooth' });
  };

  const scrollNewUserMessageToTop = () => {
    if (!messagesContainerRef.current || messages.length === 0) return;
    const container = messagesContainerRef.current;
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role === 'user') {
      setTimeout(() => {
        if (container && lastUserMessageRef.current) {
          const messageElement = lastUserMessageRef.current;
          const containerRect = container.getBoundingClientRect();
          const messageRect = messageElement.getBoundingClientRect();
          const messageTop = messageRect.top - containerRect.top + container.scrollTop;
          const visibleHeight = container.clientHeight;
          const targetScrollTop = Math.max(0, messageTop - (visibleHeight * 0.2));
          container.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
          isAutoScrollingRef.current = true;
        } else {
          setTimeout(() => {
            if (container) container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
          }, 50);
        }
      }, 100);
    }
  };

  // Scroll to bottom when new messages are added
  useEffect(() => {
    if (!messagesContainerRef.current || messages.length === 0) return;
    const container = messagesContainerRef.current;
    const isNewMessage = messages.length > prevMessagesLengthRef.current;
    if (isNewMessage) {
      isAutoScrollingRef.current = true;
      requestAnimationFrame(() => { container.scrollTop = container.scrollHeight; });
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages]);

  // RAF-based auto-scroll during streaming - only follows if user hasn't scrolled away
  useEffect(() => {
    if (!botTyping) return;
    const container = messagesContainerRef.current;
    if (!container) return;

    let rafId = null;
    const scrollTick = () => {
      if (!isAutoScrollingRef.current || !container) {
        // User scrolled away - stop the loop entirely
        return;
      }
      container.scrollTop = container.scrollHeight;
      rafId = requestAnimationFrame(scrollTick);
    };
    // Only start if we're near the bottom
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
    if (isNearBottom) {
      isAutoScrollingRef.current = true;
      rafId = requestAnimationFrame(scrollTick);
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [botTyping]);

  // Keep viewport pinned once when streaming stops to avoid post-stream bounce.
  useEffect(() => {
    const wasTyping = prevBotTypingRef.current;
    prevBotTypingRef.current = botTyping;
    if (botTyping || !wasTyping) return;

    const container = messagesContainerRef.current;
    if (!container) return;

    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 260;
    if (!isNearBottom) return;

    let raf1 = null;
    let raf2 = null;
    let settleTimer = null;

    raf1 = requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
      raf2 = requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    });

    // One delayed settle pass for markdown finalization/layout changes.
    settleTimer = setTimeout(() => {
      if (!messagesContainerRef.current) return;
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }, 180);

    return () => {
      if (raf1) cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
      if (settleTimer) clearTimeout(settleTimer);
    };
  }, [botTyping]);
  // Track user scroll - user can always opt out during streaming by scrolling up
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
      if (!isNearBottom) {
        isAutoScrollingRef.current = false;
      } else {
        isAutoScrollingRef.current = true;
      }
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  if (authLoading) {
    return <div className="flex-1 flex items-center justify-center bg-transparent"><LoadingSpinner size="default" message="Loading..." /></div>;
  }

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center bg-transparent p-4 text-center">
        <div className="max-w-md">
          <LogIn size={48} className="mx-auto text-white/50 mb-6 opacity-80" />
          <h2 className="text-2xl font-light tracking-tight mb-2 text-white">Sign in required</h2>
          <p className="mb-6 text-white/50 text-sm">Authentication is required to initialize communication sequence.</p>
          <button onClick={() => window.location.href = '/login'} className="px-6 py-3 bg-white text-black hover:bg-white/90 font-medium rounded-md transition-colors text-sm tracking-wide">
            AUTHENTICATE
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full font-sans overflow-hidden relative transition-colors duration-300 bg-transparent">
      <style>{`
          .animate-fade-in { animation: fadeIn 0.2s ease-out forwards; }
          .chat-messages-container { transition: none; }
          .chat-messages-container.transitioning { opacity: 1; }
          @media (max-width: 768px) {
            .mobile-input-container { padding: 0 !important; border-top: none !important; }
            .mobile-messages-container { padding-bottom: 100px !important; }
          }
          @media (min-width: 769px) { .user-message-desktop { max-width: 70%; } }
          
          .custom-chat-scrollbar::-webkit-scrollbar { width: 6px; }
          .custom-chat-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-chat-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
          .custom-chat-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}</style>

      {showHeader && (
        <ChatWindowHeader
          onToggleSidebar={onToggleSidebar} sidebarExpanded={sidebarExpanded} currentSessionId={currentSessionId} userId={userId} userUniqueId={userProfile?.uniqueUserId}
          messages={messages} theme={theme} chatMode={chatMode} onChatModeChange={setChatMode} onDownloadPDF={handleDownloadPDF} onShare={handleShare}
          canUseFullAgent={canUseFullAgent} membershipPlan={membershipPlan}
          onCopyLink={handleCopyLink} onDelete={handleDelete} personalities={personalities} activePersonality={activePersonality} setActivePersonality={setActivePersonality}
        />
      )}

      <div ref={messagesContainerRef} className={`flex-1 overflow-y-auto overflow-x-hidden relative mobile-messages-container ${showHeader ? 'pt-[60px] md:pt-0' : 'pt-0'} custom-chat-scrollbar chat-messages-container ${isTransitioning ? 'transitioning' : ''}`}>
        {!loading && !isTransitioning && !isSessionSwitchingRef.current && messages.length === 0 && (
          <div className="min-h-[calc(100vh-200px)] w-full"></div>
        )}
        {messages.length > 0 && (
          <div className="max-w-5xl mx-auto w-full px-4 md:px-6 pt-8 pb-32 md:pt-10 md:pb-40 overflow-x-hidden">
            {messages.map((msg, index) => {
              const continueMetaRaw = extractContinueMeta(msg.content);
              const continueMeta = isAgentTrial ? null : continueMetaRaw;
              const thinkingVisibility = userProfile?.settings?.personalization?.thinkingVisibility || 'auto';
              return (
              <MessageComponent
                key={msg.id}
                ref={(el) => { if (el) { if (msg.role === 'user') lastUserMessageRef.current = el; if (index === messages.length - 1 && msg.role === 'bot') lastBotMessageRef.current = el; } }}
                msg={msg} index={index} theme={theme} chatMode={chatMode} onCopyMessage={copyMessageToClipboard}
                onContinue={handleContinue} onFollowupClick={handleFollowupClick} continueMeta={continueMeta} isLastMessage={index === messages.length - 1} thinkingVisibility={thinkingVisibility}
              />
              );
            })}
          </div>
        )}

        <div className="h-[140px] w-full flex-shrink-0" aria-hidden="true" />

        {showScrollToBottom && (
          <button onClick={scrollToBottom} className="fixed bottom-32 right-8 z-40 flex items-center gap-2 px-4 py-2 rounded-full bg-[#0a0d14]/90 backdrop-blur-xl border border-white/10 text-zinc-300 hover:text-emerald-400 hover:border-emerald-500/30 hover:shadow-[0_0_20px_rgba(16,185,129,0.1)] transition-all duration-300 hover:-translate-y-0.5 text-xs font-medium tracking-wide shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
            <span>Latest</span>
          </button>
        )}
      </div>

      <div className={`absolute left-0 right-0 z-20 pointer-events-none transition-all duration-300 ease-in-out ${
         (!loading && !isTransitioning && !isSessionSwitchingRef.current && messages.length === 0)
           ? 'top-[45%] -translate-y-1/2 flex flex-col items-center justify-center p-4' 
           : 'bottom-0 px-4 pb-4 md:px-6 md:pb-7 mobile-input-container mobile-input-fixed'
      }`}>
        {(!loading && !isTransitioning && !isSessionSwitchingRef.current && messages.length === 0) && (
          <div className="text-center animate-fade-in pointer-events-auto mb-8 flex flex-col items-center gap-3">
            <span className="text-white/60 text-lg md:text-xl font-light tracking-wide">Welcome{user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}</span>
            <h1 className="text-3xl md:text-4xl font-medium tracking-wide text-white">What can I help with?</h1>
          </div>
        )}
        <div className={`max-w-3xl lg:max-w-4xl mx-auto w-full pointer-events-auto transition-transform duration-500 ${!loading && !isTransitioning && !isSessionSwitchingRef.current && messages.length === 0 ? 'scale-105' : 'scale-100'}`}>
          <ChatInput
            onSend={handleSend} onFileUpload={handleFileUpload} onFileUploadComplete={handleFileUploadComplete} wsConnected={wsConnected} botTyping={botTyping}
            isReconnecting={isReconnecting} onReconnect={handleReconnect} onStop={handleStop} sessionId={currentSessionId} chatMode={chatMode}
            canUseFullAgent={canUseFullAgent} membershipPlan={membershipPlan}
          />
        </div>
      </div>
      
      <style>{`
        @keyframes bg-pan {
            0% { background-position: 0% center; }
            100% { background-position: -200% center; }
        }
      `}</style>
    </div>
  );
});

export default ChatWindow;
