import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../../utils/firebaseConfig';
import { collection, query, where, getDocs, doc, setDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { MessageSquare, Calendar, ExternalLink, ArrowRight, User, Copy, Play, Share2, Download, FileText } from 'lucide-react';
import MessageComponent from '../components/MessageComponent';
import { LoadingSpinner } from '../../../components/loading';
import { useAuth } from '../../../context/AuthContext';

export default function SharedChat() {
  const { shareId } = useParams();
  const navigate = useNavigate();
  const { currentUser: user } = useAuth();
  const [chatData, setChatData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [forking, setForking] = useState(false);

  useEffect(() => {
    const fetchSharedChat = async () => {
      try {
        const sharedChatsRef = collection(db, 'sharedChats');
        const q = query(sharedChatsRef, where('shareId', '==', shareId));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          setError('Chat not found or has been removed');
          return;
        }

        const doc = querySnapshot.docs[0];
        const data = doc.data();

        if (!data.isPublic) {
          setError('This chat is private');
          return;
        }

        setChatData(data);
      } catch (err) {
        console.error('Error fetching shared chat:', err);
        setError('Failed to load shared chat');
      } finally {
        setLoading(false);
      }
    };

    if (shareId) {
      fetchSharedChat();
    }
  }, [shareId]);

  const handleContinueChat = async () => {
    if (!user) {
        if (confirm("You need to sign in to continue this chat. Go to login?")) {
            navigate('/login');
        }
        return;
    }

    if (forking) return;
    setForking(true);

    try {
        const newSessionId = crypto.randomUUID();
        const sessionRef = doc(db, 'users', user.uid, 'chatSessions', newSessionId);

        // Use new Date() for immediate sorting (client-side timestamp)
        await setDoc(sessionRef, {
            name: chatData.title || 'Continued Chat',
            createdAt: new Date(),
            isForked: true,
            forkedFromShareId: shareId
        });

        const messagesRef = collection(db, 'users', user.uid, 'chatSessions', newSessionId, 'messages');
        
        const messagePromises = chatData.messages.map(async (msg, index) => {
            let ts = msg.timestamp;
            if (!ts) {
                const date = new Date();
                date.setSeconds(date.getSeconds() - (chatData.messages.length - index));
                ts = date;
            }

            return addDoc(messagesRef, {
                role: msg.role,
                content: msg.content,
                timestamp: ts,
                createdAt: new Date().toISOString()
            });
        });

        await Promise.all(messagePromises);
        navigate(`/chat/${newSessionId}`);

    } catch (err) {
        console.error("Failed to fork chat:", err);
        alert("Failed to continue chat. Please try again.");
    } finally {
        setForking(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f10] flex items-center justify-center">
        <LoadingSpinner size="default" message="Loading conversation..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0f0f10] flex flex-col items-center justify-center text-center p-4">
        <div className="bg-zinc-900 rounded-xl p-8 border border-zinc-800 max-w-md w-full shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-6 text-zinc-500">
                <MessageSquare size={32} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Unavailable</h2>
            <p className="text-zinc-400 mb-8">{error}</p>
            <button
            onClick={() => navigate('/')}
            className="w-full py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all hover:scale-[1.02]"
            >
            Go to Relyce AI
            </button>
        </div>
      </div>
    );
  }

  // Exact theme match from ChatWindow and ChatWindowHeader
  return (
    <div className="flex flex-col h-screen bg-[#0f0f10] text-gray-200 font-sans overflow-hidden relative selection:bg-emerald-500/30 selection:text-emerald-200">
      
      {/* CSS for scrollbar and animations */}
      <style>{`
          /* Custom scrollbar styles */
          .zeto-scrollbar::-webkit-scrollbar {
            width: 8px;
          }
          .zeto-scrollbar::-webkit-scrollbar-track {
            background: rgba(24, 24, 27, 0.5);
          }
          .zeto-scrollbar::-webkit-scrollbar-thumb {
            background: #27272a;
            border-radius: 4px;
            border: 2px solid rgba(24, 24, 27, 0.5);
          }
          .zeto-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #3f3f46;
          }
          .zeto-scrollbar {
            scrollbar-width: thin;
            scrollbar-color: #27272a rgba(24, 24, 27, 0.5);
          }
          @keyframes contentFadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-content {
            animation: contentFadeIn 0.3s ease-out forwards;
          }
      `}</style>

      {/* Header - Matching ChatWindowHeader styles EXACTLY */}
      {/* bg-zinc-900/80, border-emerald-500/20 */}
      <nav className="flex-shrink-0 sticky top-0 left-0 right-0 z-50 backdrop-blur-md bg-zinc-900/80 transition-colors duration-300 border-b border-emerald-500/20">
        <div className="flex items-center justify-between py-3 px-4 md:px-8">
            <div className="flex items-center gap-3">
            {/* Logo area */}
            <div className="group relative">
                <div className="relative w-8 h-8 rounded-full bg-black flex items-center justify-center text-white font-bold text-xs border border-zinc-800">
                    <img src="/logo.svg" alt="R" className="w-5 h-5 object-contain" onError={(e) => { e.target.style.display='none'; e.target.parentNode.textContent='R'; }} />
                </div>
            </div>
            <div className="flex flex-col">
                <h1 className="font-semibold text-white text-sm leading-tight tracking-tight flex items-center gap-2">
                    {chatData.title || 'Shared Chat'}
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-400 border border-zinc-700 font-normal uppercase tracking-wider">
                        Read Only
                    </span>
                </h1>
                <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-medium">
                    <span className="flex items-center gap-1">
                        <Calendar size={10} />
                        {chatData.sharedAt?.toDate?.()?.toLocaleDateString()}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                        <MessageSquare size={10} />
                        {chatData.messages.length} msgs
                    </span>
                </div>
            </div>
            </div>
            
            <div className="flex items-center gap-2">
                {!user && (
                    <button
                        onClick={() => navigate('/login')}
                        className="hidden sm:inline-flex px-3 py-1.5 rounded-lg text-zinc-400 hover:text-white text-sm font-medium transition-colors hover:bg-white/5"
                    >
                        Sign In
                    </button>
                )}
                <button
                onClick={() => navigator.clipboard.writeText(window.location.href).then(() => alert('Link copied!'))}
                className="flex items-center gap-2 px-3 py-2 rounded-lg transition text-sm hover:bg-white/10 text-white"
                title="Copy Link"
                >
                    <Share2 size={16} />
                    <span className="hidden sm:inline">Share</span>
                </button>
            </div>
        </div>
      </nav>

      {/* Main Chat Area */}
      {/* px-4 py-6 to match ChatWindow EXACTLY */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden relative zeto-scrollbar scroll-smooth">
        <div className="max-w-4xl mx-auto w-full px-4 py-6 md:px-8 pb-32 animate-content">
            
            {/* Messages */}
            <div className="space-y-6">
                {chatData.messages.map((msg, index) => (
                    <MessageComponent
                        key={index}
                        msg={msg}
                        index={index}
                        theme="dark"
                        chatMode="normal"
                        onCopyMessage={() => navigator.clipboard.writeText(msg.content)}
                        isLastMessage={index === chatData.messages.length - 1}
                    />
                ))}
            </div>

            {/* End of Chat Divider */}
            <div className="my-16 flex flex-col items-center justify-center gap-2 opacity-50">
                <div className="h-px bg-zinc-800 w-full max-w-sm"></div>
                <div className="text-xs text-zinc-600 font-medium uppercase tracking-widest">End of History</div>
            </div>

        </div>
      </main>
      
      {/* Search/Input Placeholder (Floating Footer) */}
      <div className="absolute bottom-6 left-0 right-0 px-4 md:px-8 z-20 pointer-events-none flex flex-col items-center gap-4">
         <div className="max-w-4xl mx-auto w-full flex justify-center pointer-events-auto">
            <div className="flex p-1.5 gap-2 bg-zinc-900/90 backdrop-blur-xl border border-emerald-500/20 rounded-xl shadow-2xl shadow-black/50 ring-1 ring-black/5">
                {/* Option 1: Start Fresh */}
                <button
                    onClick={() => navigate('/')}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white font-medium transition-all text-sm"
                >
                    <MessageSquare size={16} />
                    <span className="whitespace-nowrap">New Chat</span>
                </button>

                {/* Option 2: Continue This Chat (Fork) */}
                <button
                    onClick={handleContinueChat}
                    disabled={forking}
                    className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-lg shadow-emerald-900/20 hover:shadow-emerald-900/40 transition-all text-sm"
                >
                    {forking ? (
                        <>
                            <LoadingSpinner size="sm" /> Importing...
                        </>
                    ) : (
                        <>
                            <Play size={16} fill="currentColor" />
                            <span className="whitespace-nowrap">Continue Chat</span>
                        </>
                    )}
                </button>
            </div>
         </div>

         {/* Legal Links */}
         <div className="flex items-center gap-4 pointer-events-auto">
            <button onClick={() => navigate('/terms')} className="text-[10px] text-zinc-600 hover:text-emerald-500 transition-colors">
                Terms of Use
            </button>
            <span className="text-zinc-800">•</span>
            <button onClick={() => navigate('/privacy')} className="text-[10px] text-zinc-600 hover:text-emerald-500 transition-colors">
                Privacy Policy
            </button>
         </div>
      </div>

    </div>
  );
}