import React, { memo, useEffect, useRef } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { LogIn } from 'lucide-react';
import ChatInput from './ChatInput';
import useChat from '../../../hooks/useChat';
import ChatWindowHeader from './ChatWindowHeader';
import MessageComponent from './MessageComponent';
import TypingIndicator from './TypingIndicator';
import { LoadingSpinner } from '../../../components/loading';
import BotSkeletonLoader from './BotSkeletonLoader';
import logo from '../../../assets/logo.svg';

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
}) {
  // Enforce dark theme
  const theme = 'dark';
  const { currentUser: user, loading: authLoading } = useAuth();

  // Use the custom chat hook for all logic
  const {
    // State
    messages,
    loading,
    wsConnected,
    botTyping,
    isReconnecting,
    showScrollToBottom,
    chatMode,
    isTransitioning,

    // Refs
    messagesContainerRef,

    // Handlers
    setChatMode,
    handleSend,
    handleStop,
    handleReconnect,
    scrollToBottom,
    copyMessageToClipboard,
    handleFileUpload,
    handleFileUploadComplete,
    handleDownloadPDF,
    handleShare,
    handleCopyLink,
    handleDelete,
  } = useChat({
    currentSessionId,
    userId,
    chatSessions,
    onMessagesUpdate,
    chatMode: externalChatMode,
    onChatModeChange: externalOnChatModeChange,
  });

  // Refs for tracking messages and scroll behavior
  const prevMessagesLengthRef = useRef(messages.length);
  const isAutoScrollingRef = useRef(false);
  const lastUserMessageRef = useRef(null);
  const prevSessionIdRef = useRef(currentSessionId);
  const isSessionSwitchingRef = useRef(false);

  // Track session changes to prevent welcome screen flash
  useEffect(() => {
    if (prevSessionIdRef.current !== currentSessionId && prevSessionIdRef.current !== null) {
      isSessionSwitchingRef.current = true;
      // Reset after messages load (short delay)
      const timer = setTimeout(() => {
        isSessionSwitchingRef.current = false;
      }, 500);
      return () => clearTimeout(timer);
    }
    prevSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  // Helper function to scroll to a specific message element
  const scrollToMessage = (element) => {
    if (!messagesContainerRef.current || !element) return;

    const container = messagesContainerRef.current;
    const elementRect = element.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    // Calculate the scroll position to center the element
    const scrollTop = elementRect.top - containerRect.top + container.scrollTop;

    container.scrollTo({
      top: scrollTop,
      behavior: 'smooth'
    });
  };

  // Helper function to scroll a new user message to the top of visible area
  const scrollNewUserMessageToTop = () => {
    if (!messagesContainerRef.current || messages.length === 0) return;

    const container = messagesContainerRef.current;
    const lastMessage = messages[messages.length - 1];

    // Only for user messages
    if (lastMessage.role === 'user') {
      // Small delay to ensure the DOM has updated with the new message
      setTimeout(() => {
        if (container && lastUserMessageRef.current) {
          // Get the position of the last user message relative to the container
          const messageElement = lastUserMessageRef.current;
          const containerRect = container.getBoundingClientRect();
          const messageRect = messageElement.getBoundingClientRect();

          // Calculate the scroll position to show the message near the top
          const messageTop = messageRect.top - containerRect.top + container.scrollTop;
          const visibleHeight = container.clientHeight;

          // Scroll to position the message about 20% from the top of the visible area
          const targetScrollTop = Math.max(0, messageTop - (visibleHeight * 0.2));

          container.scrollTo({
            top: targetScrollTop,
            behavior: 'smooth'
          });

          // Set auto-scrolling flag to true so bot responses follow
          isAutoScrollingRef.current = true;
        } else {
          // Fallback: scroll to bottom
          setTimeout(() => {
            if (container) {
              container.scrollTo({
                top: container.scrollHeight,
                behavior: 'smooth'
              });
            }
          }, 50);
        }
      }, 100);
    }
  };

  // ============ ChatGPT-Style Scroll Behavior ============
  // Simple rule: Always scroll to bottom when new messages arrive or while bot is typing
  
  // Effect 1: Scroll to bottom when messages change
  useEffect(() => {
    if (!messagesContainerRef.current || messages.length === 0) return;
    
    const container = messagesContainerRef.current;
    const isNewMessage = messages.length > prevMessagesLengthRef.current;
    
    if (isNewMessage) {
      const lastMessage = messages[messages.length - 1];
      
      // For user messages - scroll IMMEDIATELY to bottom (instant, not smooth)
      if (lastMessage.role === 'user') {
        isAutoScrollingRef.current = true;
        // Use instant scroll so message appears at bottom immediately
        container.scrollTop = container.scrollHeight;
      }
      // For bot messages - keep auto-scrolling if we were auto-scrolling
      else if (lastMessage.role === 'bot' && isAutoScrollingRef.current) {
        requestAnimationFrame(() => {
          container.scrollTo({
            top: container.scrollHeight,
            behavior: 'smooth'
          });
        });
      }
    }
    
    prevMessagesLengthRef.current = messages.length;
  }, [messages]);

  // Effect 2: Keep scrolling while bot is typing (for streaming effect)
  useEffect(() => {
    if (!messagesContainerRef.current || !botTyping || !isAutoScrollingRef.current) return;

    const container = messagesContainerRef.current;
    
    // Scroll to bottom immediately when bot starts typing
    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth'
    });

    // Keep scrolling while typing (for long responses that grow)
    const scrollInterval = setInterval(() => {
      if (container && isAutoScrollingRef.current) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'auto' // Use 'auto' for continuous smooth updates
        });
      }
    }, 150);

    return () => clearInterval(scrollInterval);
  }, [botTyping]);

  // Effect 3: Reset auto-scroll flag when user manually scrolls up
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      if (!isNearBottom && !botTyping) {
        isAutoScrollingRef.current = false;
      } else if (isNearBottom) {
        isAutoScrollingRef.current = true;
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [botTyping]);

  // If still loading auth state, show a loading indicator
  if (authLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-900">
        <LoadingSpinner size="default" message="Loading..." />
      </div>
    );
  }

  // If user is not authenticated, show a sign in prompt
  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="mb-6">
            <LogIn size={48} className="mx-auto text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold mb-2 text-white">
            Sign in required
          </h2>
          <p className="mb-6 text-slate-400">
            Please sign in to access the chat
          </p>
          <button
            onClick={() => window.location.href = '/login'}
            className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg transition-colors"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  // Use the loading animation hook - simplified approach
  const showTypingAnimation = botTyping;

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full font-sans overflow-hidden relative transition-colors duration-300 bg-[#0f0f10]">
      <style>
        {`
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          .animate-fade-in {
            animation: fadeIn 0.2s ease-out forwards;
          }
          
          /* Smooth chat transition for session switching */
          .chat-messages-container {
            transition: opacity 0.15s ease-out;
          }
          .chat-messages-container.transitioning {
            opacity: 0.6;
          }
          
          /* Mobile input container styles */
          @media (max-width: 768px) {
            .mobile-input-container {
              padding: 0 !important;
              border-top: none !important;
            }
            /* Add extra padding at the bottom of messages container on mobile */
            .mobile-messages-container {
              padding-bottom: 100px !important;
            }
          }
          
          /* Ensure user messages have proper max width on desktop */
          @media (min-width: 769px) {
            .user-message-desktop {
              max-width: 60%;
            }
          }
          
          /* Custom scrollbar styles */
          .zeto-scrollbar::-webkit-scrollbar {
            width: 8px;
          }
          
          .zeto-scrollbar::-webkit-scrollbar-track {
            background: #18181b; /* dark theme scrollbar track */
            border-left: 3px solid #003925;
          }
          
          .zeto-scrollbar::-webkit-scrollbar-thumb {
            background: #005a3e;
            border-radius: 4px;
            border: none;
          }
          
          .zeto-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #007a55;
          }
          
          /* Firefox scrollbar */
          .zeto-scrollbar {
            scrollbar-width: thin;
            scrollbar-color: #005a3e #18181b; /* thumb color, track color */
          }
        `}
      </style>

      {/* Transparent Header */}
      {showHeader && (
        <ChatWindowHeader
          onToggleSidebar={onToggleSidebar}
          sidebarExpanded={sidebarExpanded}
          currentSessionId={currentSessionId}
          userId={userId}
          userUniqueId={null} // This would be fetched in the hook
          messages={messages}
          theme={theme}
          chatMode={chatMode}
          onChatModeChange={setChatMode}
          onDownloadPDF={handleDownloadPDF}
          onShare={handleShare}
          onCopyLink={handleCopyLink}
          onDelete={handleDelete}
        />
      )}

      <div
        ref={messagesContainerRef}
        className={`flex-1 overflow-y-auto overflow-x-hidden smooth-scroll relative pb-40 mobile-messages-container bg-zinc-900 chat-messages-container ${isTransitioning ? 'transitioning' : ''}`}
      >
        {/* Loading spinner removed - using only the auth loading spinner */}
        {/* Only show empty state when truly empty and not transitioning or switching sessions */}
        {!loading && !isTransitioning && !isSessionSwitchingRef.current && messages.length === 0 && (
          <div className="flex items-center justify-center h-full overflow-x-hidden">
            <div className="text-center max-w-md px-4">
              <div className="mb-4 flex justify-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center">
                  <img src={logo} alt="Relyce AI" className="w-[100%] h-[100%] rounded-[50%]" />
                </div>
              </div>
              <h1 className="text-2xl font-bold mb-1 text-white">
                Hello, <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                  {user?.displayName?.split(' ')[0] || 'there'}
                </span>
              </h1>
              <p className="text-lg font-medium text-gray-300 mb-6">
                Welcome to Relyce AI
              </p>
              <div className="flex flex-col gap-2">
                <div className="text-left bg-zinc-800 rounded-lg p-3">
                  <p className="text-sm font-medium text-gray-200">Try asking:</p>
                  <ul className="mt-1 text-sm text-gray-400 list-disc list-inside space-y-1">
                    <li>How can I improve my business strategy?</li>
                    <li>What are the latest market trends in my industry?</li>
                    <li>Can you analyze my business proposal?</li>
                    <li>Help me understand financial forecasting</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Always show messages if they exist - prevents flash during loading/transitions */}
        {messages.length > 0 && (
          <div className="max-w-4xl mx-auto w-full px-4 py-6 overflow-x-hidden">
            {messages.map((msg, index) => (
              <MessageComponent
                key={msg.id}
                ref={msg.role === 'user' ? (el) => { if (el) lastUserMessageRef.current = el; } : null}
                msg={msg}
                index={index}
                theme={theme}
                onCopyMessage={copyMessageToClipboard}
                isLastMessage={index === messages.length - 1}
              />
            ))}
            
            {/* Show skeleton loader when bot is thinking (accepted request but no message yet) */}
            {botTyping && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
              <div className="animate-fade-in">
                <BotSkeletonLoader />
              </div>
            )}
          </div>
        )}

        {/* NOTE: Old typing indicator removed - now using skeleton loader inside MessageComponent */}

        {/* 🔥 ChatGPT-style scroll spacer - ensures last message is never clipped by input */}
        <div className="h-[140px] w-full flex-shrink-0" aria-hidden="true" />

        {/* Scroll to bottom button - Side panel version for both mobile and desktop */}
        {showScrollToBottom && (
          <button
            onClick={scrollToBottom}
            className="fixed top-1/2 -translate-y-1/2 -right-2 p-2 rounded-l-lg shadow-lg z-10 transition-all duration-300 bg-emerald-600 text-white hover:bg-emerald-700"
            aria-label="Scroll to bottom"
            style={{ transform: 'translateY(-50%)' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </button>
        )}
      </div>

      {/* Improved chat input container with overlay positioning */}
      <div className="absolute bottom-0 left-0 right-0 p-1 backdrop-blur-sm z-20 mobile-input-container bg-zinc-900/90">
        <div className="max-w-5xl mx-auto">
          <ChatInput
            onSend={handleSend}
            onFileUpload={handleFileUpload}
            onFileUploadComplete={handleFileUploadComplete}
            wsConnected={wsConnected}
            botTyping={botTyping}
            isReconnecting={isReconnecting}
            onReconnect={handleReconnect}
            onStop={handleStop}
          />
        </div>
      </div>
    </div>
  );
});

export default ChatWindow;