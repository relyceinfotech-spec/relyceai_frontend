import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../../utils/firebaseConfig';
import { collection, query, where, getDocs } from 'firebase/firestore';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ArrowLeft, Share, ExternalLink } from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext.jsx';

const Avatar = ({ role, theme }) => {
  const isUser = role === 'user';
  const initial = isUser ? 'U' : 'R';
  const bgColor = isUser
    ? (theme === 'dark' ? 'bg-emerald-500' : 'bg-emerald-500')
    : (theme === 'dark' ? 'bg-zinc-600' : 'bg-slate-400');
  return (
    <div
      className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-sm ${bgColor}`}
    >
      {initial}
    </div>
  );
};

const MarkdownComponents = {
  code({ _node, inline, className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || '');
    return !inline && match ? (
      <SyntaxHighlighter style={atomDark} language={match[1]} PreTag="div" {...props}>
        {String(children).replace(/\n$/, '')}
      </SyntaxHighlighter>
    ) : (
      <code className="bg-zinc-700/50 text-emerald-300 px-1.5 py-0.5 rounded-md text-sm" {...props}>
        {children}
      </code>
    );
  },
  h1: ({ _node, ...props }) => <h1 className="text-2xl font-bold mt-4 mb-2" {...props} />,
  h3: ({ _node, ...props }) => <h3 className="text-lg font-bold mt-3 mb-1" {...props} />,
  ul: ({ _node, ...props }) => <ul className="list-disc list-inside space-y-1 my-2" {...props} />,
  ol: ({ _node, ...props }) => <ol className="list-decimal list-inside space-y-1 my-2" {...props} />,
  hr: ({ _node, ...props }) => <hr className="my-4 border-zinc-700" {...props} />,
  p: ({ _node, ...props }) => <p className="leading-relaxed" {...props} />,
};

export default function SharedChat() {
  const { theme } = useTheme();
  const { shareId } = useParams();
  const navigate = useNavigate();
  const [chatData, setChatData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSharedChat = async () => {
      try {
        const sharedChatsRef = collection(db, 'sharedChats');
        const q = query(sharedChatsRef, where('shareId', '==', shareId));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          setError('Shared chat not found or may have been removed.');
          return;
        }

        const doc = querySnapshot.docs[0];
        const data = doc.data();

        if (!data.isPublic) {
          setError('This chat is no longer publicly accessible.');
          return;
        }

        setChatData(data);
      } catch (err) {
        console.error('Error fetching shared chat:', err);
        setError('Failed to load shared chat. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    if (shareId) {
      fetchSharedChat();
    }
  }, [shareId]);

  const handleShare = async () => {
    const shareUrl = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Relyce AI Shared Chat',
          text: 'Check out this AI chat conversation',
          url: shareUrl,
        });
      } catch (err) {
        // User cancelled sharing
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      alert('Link copied to clipboard!');
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors duration-300 ${theme === 'dark' ? 'bg-zinc-900' : 'bg-slate-100'
        }`}>
        <div className={`text-lg ${theme === 'dark' ? 'text-white' : 'text-slate-900'
          }`}>Loading shared chat...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors duration-300 ${theme === 'dark' ? 'bg-zinc-900' : 'bg-slate-100'
        }`}>
        <div className="text-center max-w-md">
          <div className={`text-lg mb-4 ${theme === 'dark' ? 'text-red-400' : 'text-red-600'
            }`}>{error}</div>
          <button
            onClick={() => navigate('/')}
            className={`px-6 py-2 rounded-lg transition font-semibold ${theme === 'dark'
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-emerald-500 hover:bg-emerald-600 text-white'
              }`}
          >
            Go to Relyce AI
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen flex flex-col transition-colors duration-300 ${theme === 'dark' ? 'bg-zinc-900 text-white' : 'bg-slate-100 text-slate-900'
      }`}>
      {/* Header */}
      <div className={`backdrop-blur-sm border-b px-4 py-3 transition-colors duration-300 ${theme === 'dark'
          ? 'bg-black/10 border-white/10'
          : 'bg-white/10 border-black/10'
        }`}>
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className={`p-2 rounded-lg transition ${theme === 'dark'
                  ? 'hover:bg-white/10'
                  : 'hover:bg-black/10'
                }`}
              title="Back to Relyce AI"
            >
              <ArrowLeft size={20} className={
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              } />
            </button>
            <img src="/logo.svg" alt="Relyce AI" className="w-10 h-10 object-contain" />
            <span className={`font-semibold text-lg ${theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}>Relyce AI - Shared Chat</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition text-sm ${theme === 'dark'
                  ? 'hover:bg-white/10'
                  : 'hover:bg-black/10'
                } ${theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}
            >
              <Share size={16} />
              Share
            </button>
            <button
              onClick={() => navigate('/')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition text-sm font-semibold ${theme === 'dark'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                }`}
            >
              <ExternalLink size={16} />
              Try Relyce AI
            </button>
          </div>
        </div>
      </div>

      {/* Chat Content - Scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6">
        <div className={`rounded-2xl p-6 space-y-6 transition-colors duration-300 ${theme === 'dark'
            ? 'bg-zinc-800/50'
            : 'bg-white border border-slate-200'
          }`}>
          <div className={`text-center pb-4 transition-colors duration-300 ${theme === 'dark' ? 'border-b border-zinc-700' : 'border-b border-slate-300'
            }`}>
            <h1 className="text-2xl font-bold mb-2">Shared Conversation</h1>
            <p className={`text-sm ${theme === 'dark' ? 'text-zinc-400' : 'text-slate-500'
              }`}>
              Shared on {chatData.sharedAt?.toDate?.()?.toLocaleDateString() || 'Recently'}
            </p>
          </div>

          {/* Messages */}
          <div className="space-y-6">
            {chatData.messages.map((msg, index) => (
              <div
                key={index}
                className={`flex items-start gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
              >
                {msg.role === 'bot' && <Avatar role="bot" theme={theme} />}
                <div
                  className={`max-w-3xl px-5 py-3 rounded-2xl shadow-md leading-relaxed ${msg.role === 'user'
                      ? (theme === 'dark'
                        ? 'bg-emerald-600 text-white rounded-br-none'
                        : 'bg-emerald-500 text-white rounded-br-none')
                      : (theme === 'dark'
                        ? 'bg-zinc-700 text-gray-200 rounded-bl-none'
                        : 'bg-slate-100 text-slate-800 rounded-bl-none')
                    }`}
                >
                  {msg.content && (
                    <ReactMarkdown components={MarkdownComponents} remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  )}
                </div>
                {msg.role === 'user' && <Avatar role="user" theme={theme} />}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className={`text-center pt-6 transition-colors duration-300 ${theme === 'dark' ? 'border-t border-zinc-700' : 'border-t border-slate-300'
            }`}>
            <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-zinc-400' : 'text-slate-500'
              }`}>
              Want to try Relyce AI yourself?
            </p>
            <button
              onClick={() => navigate('/')}
              className={`px-6 py-3 rounded-lg transition font-semibold ${theme === 'dark'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                }`}
            >
              Start Chatting with Relyce AI
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}