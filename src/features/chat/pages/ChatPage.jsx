import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import ChatHistory from '../components/ChatHistory.jsx';
import ChatWindow from '../components/ChatWindow.jsx';
import ChatWindowHeader from '../components/ChatWindowHeader.jsx'; // Import the new header
import { useAuth } from '../../../context/AuthContext.jsx';
import { LoadingSpinner } from '../../../components/loading';
import { generateChatPDF } from '../../../utils/pdfGenerator.js';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { db } from '../../../utils/firebaseConfig.js';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import ChatService from '../../../services/chatService';

// Simple Loading Skeleton using LoadingSpinner
const ChatSkeleton = () => (
  <div className="flex h-full w-full bg-zinc-900 items-center justify-center">
    <LoadingSpinner size="default" message="Loading..." />
  </div>
);

function AppContent() {
  const { currentUser: user, userProfile } = useAuth();
  const theme = 'dark'; // Enforce dark theme
  // Removed setTheme since we're removing the toggle
  const { chatId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]); // Add messages state
  const [chatSessions, setChatSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [loadingChats, setLoadingChats] = useState(true);
  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  // Header state moved to ChatWindowHeader
  const [shareLoading, setShareLoading] = useState(false);

  // Chat mode state
  const [chatMode, setChatMode] = useState('normal');

  // Personality State
  const [personalities, setPersonalities] = useState([]);
  const [activePersonality, setActivePersonality] = useState(null);
  const location = useLocation(); // Track navigation for refetching

  // Use ref to prevent unnecessary navigation calls

  // Fetch Personalities
  useEffect(() => {
    if (user?.uid) {
        const uid = user.uid;
        ChatService.getPersonalities(uid).then(result => {
            if (result.success && result.personalities) {
                setPersonalities(result.personalities);
                
                // Update active personality if it exists, to reflect name changes
                if (activePersonality) {
                    const updated = result.personalities.find(p => p.id === activePersonality.id);
                    if (updated) setActivePersonality(updated);
                }
                
                // Set default active if none selected
                if (!activePersonality) {
                    const def = result.personalities.find(p => p.is_default && p.id === 'default_relyce') || result.personalities[0];
                    setActivePersonality(def);
                }
            } else {
                // Fallback to default personality if API fails
                console.warn('[ChatPage] Failed to fetch personalities, using default');
                const defaultPersonality = {
                    id: 'default_relyce',
                    name: 'Relyce AI',
                    description: 'Professional, helpful AI assistant',
                    is_default: true
                };
                setPersonalities([defaultPersonality]);
                if (!activePersonality) {
                    setActivePersonality(defaultPersonality);
                }
            }
        }).catch(err => {
            console.error('[ChatPage] Error fetching personalities:', err);
            // Fallback to default personality on error
            const defaultPersonality = {
                id: 'default_relyce',
                name: 'Relyce AI',
                description: 'Professional, helpful AI assistant',
                is_default: true
            };
            setPersonalities([defaultPersonality]);
            if (!activePersonality) {
                setActivePersonality(defaultPersonality);
            }
        });
    }
  }, [user?.uid, location.key]); // Refetch on navigation (location.key changes)




  // Download menu state

  // Set chat mode based on user's membership plan
  // Note: Mode defaults to 'normal' (Generic) - only switch to business if user explicitly wants it
  // Commenting out auto-mode change so users start with Generic by default
  // useEffect(() => {
  //   if (userProfile?.membership?.plan) {
  //     if (userProfile.membership.plan === 'business') {
  //       setChatMode('business');
  //     } else if (userProfile.membership.plan === 'plus') {
  //       setChatMode('business');
  //     } else {
  //       setChatMode('normal');
  //     }
  //   }
  // }, [userProfile?.membership?.plan]);

  // Download menu state
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const downloadButtonRef = useRef(null);
  const downloadMenuRef = useRef(null);
  const [downloadMenuCoords, setDownloadMenuCoords] = useState(null);

  // Use ref to prevent unnecessary navigation calls

  // Use ref to prevent unnecessary navigation calls
  const isNavigatingRef = useRef(false);
  const lastUrlSessionRef = useRef(chatId);




  // Memoize chatSessions to prevent unnecessary sidebar re-renders - MUST be before any early returns
  const memoizedChatSessions = useMemo(() => {
    return chatSessions || [];
  }, [chatSessions?.length]);

  // Track URL changes to update lastUrlSessionRef
  useEffect(() => {
    if (chatId) {
      lastUrlSessionRef.current = chatId;
    }
  }, [chatId]);
  // Listen for close sidebar events from mobile
  useEffect(() => {
    const handleCloseSidebar = () => setShowSidebar(false);
    window.addEventListener('closeSidebar', handleCloseSidebar);
    return () => window.removeEventListener('closeSidebar', handleCloseSidebar);
  }, []);







  // Add handleDownloadPDF function
  const handleDownloadPDF = async () => {
    if (!messages || messages.length === 0) {
      alert('No chat to download!');
      return;
    }

    try {
      const blob = await generateChatPDF(messages, {
        title: 'Chat Conversation',
        date: new Date(),
        participants: ['User', 'Relyce AI']
      });
      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relyce-chat-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  // Add handleDownloadText function for exporting chat as text file
  const handleDownloadText = () => {
    if (!messages || messages.length === 0) {
      alert('No chat to download!');
      return;
    }

    try {
      // Format messages as text
      const textContent = messages.map(msg => {
        return `[${msg.role.toUpperCase()}] (${new Date(msg.timestamp?.toDate ? msg.timestamp.toDate() : msg.createdAt).toLocaleString()})\n${msg.content}\n`;
      }).join('\n');

      // Create blob and download
      const blob = new Blob([textContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relyce-chat-${new Date().toISOString().slice(0, 10)}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating text file:', error);
      alert('Failed to generate text file. Please try again.');
    }
  };

  const handleSetCurrentSession = useCallback((id) => {
    // Same session? Just close sidebar
    if (currentSessionId === id) {
      setShowSidebar(false);
      return;
    }

    // ChatGPT-style: State-only update, NO navigation
    // This prevents component remounts and flashing
    setCurrentSessionId(id);
    setShowSidebar(false);

    // Silently update URL without triggering React Router re-render
    // This keeps URL in sync for sharing/bookmarking without causing flash
    window.history.replaceState(null, '', `/chat/${id}`);
  }, [currentSessionId]);

  // Share chat function - saves to sharedChats collection
  const handleShareChat = useCallback(async () => {
    if (!currentSessionId || !user || messages.length === 0) {
      alert('No messages to share!');
      return;
    }

    setShareLoading(true);
    try {
      // Generate unique share ID
      const shareId = crypto.randomUUID().slice(0, 8);
      
      // Get session name
      const currentSession = chatSessions.find(s => s.id === currentSessionId);
      const sessionName = currentSession?.name || 'Chat Conversation';
      
      // Save to sharedChats collection
      await addDoc(collection(db, 'sharedChats'), {
        shareId: shareId,
        originalSessionId: currentSessionId,
        ownerId: user.uid,
        title: sessionName,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp || msg.createdAt
        })),
        isPublic: true,
        sharedAt: serverTimestamp(),
        messageCount: messages.length
      });

      // Generate share URL
      const shareUrl = `${window.location.origin}/shared/${shareId}`;
      
      // Copy to clipboard
      await navigator.clipboard.writeText(shareUrl);
      
      // Try native share if available
      if (navigator.share) {
        try {
          await navigator.share({
            title: 'Relyce AI Chat',
            text: 'Check out this AI chat conversation',
            url: shareUrl,
          });
        } catch (e) {
          // User cancelled or share failed, URL already copied
        }
      }
      
      alert(`Share link copied!\n${shareUrl}`);
    } catch (error) {
      console.error('Error sharing chat:', error);
      alert('Failed to share chat. Please try again.');
    } finally {
      setShareLoading(false);
    }
  }, [currentSessionId, user, messages, chatSessions]);

  const handleToggleSidebarExpanded = useCallback((expanded) => {
    setSidebarExpanded(expanded);
  }, []);

  const createNewSession = useCallback(async () => {
    if (!user) return;

    const newSessionId = crypto.randomUUID();
    
    // Update UI immediately for instant response
    setCurrentSessionId(newSessionId);
    setMessages([]); // Clear messages for fresh chat
    setShowSidebar(false);
    navigate(`/chat/${newSessionId}`, { replace: true });

    // Write to Firebase in background (non-blocking)
    const newSessionRef = doc(
      db,
      'users',
      user.uid,
      'chatSessions',
      newSessionId
    );
    
    setDoc(newSessionRef, {
      name: 'New Chat',
      createdAt: serverTimestamp(),
    }).catch(e => console.error('Failed to create session:', e));
  }, [user, navigate]);

  useEffect(() => {
    if (user) {
      setLoadingChats(true);
      const chatRef = collection(db, 'users', user.uid, 'chatSessions');
      const q = query(chatRef, orderBy('createdAt', 'desc'));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const sessions = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setChatSessions(sessions);

          if (snapshot.metadata.hasPendingWrites) return;

          // Only handle URL-based navigation when URL actually changes
          if (chatId && chatId !== currentSessionId && !isNavigatingRef.current) {
            const sessionExists = sessions.find((s) => s.id === chatId);
            if (sessionExists) {
              setCurrentSessionId(chatId);
            } else if (sessions.length > 0) {
              const firstSession = sessions[0];
              setCurrentSessionId(firstSession.id);
              navigate(`/chat/${firstSession.id}`, { replace: true });
            }
          } else if (!chatId && sessions.length > 0 && !currentSessionId) {
            // Only set default if no session is selected
            const firstSession = sessions[0];
            setCurrentSessionId(firstSession.id);
            navigate(`/chat/${firstSession.id}`, { replace: true });
          } else if (!chatId && sessions.length === 0) {
            createNewSession();
          }

          setLoadingChats(false);
        },
        (error) => {
          console.error('Error fetching chat sessions: ', error);
          setLoadingChats(false);
        }
      );

      return () => unsubscribe();
    } else {
      setChatSessions([]);
      setCurrentSessionId(null);
      setLoadingChats(false);
    }
  }, [user, createNewSession, chatId, navigate]); // Removed currentSessionId - it causes subscription recreation

  // Pass messages to ChatWindow and update local state when messages change
  const handleMessagesUpdate = useCallback((newMessages) => {
    setMessages(newMessages);
  }, []);

  if (loadingChats) return <ChatSkeleton />;

  return (
    <div className="flex h-screen w-full font-sans overflow-hidden transition-colors duration-300 bg-zinc-900 text-gray-200">
      {/* Content with sidebar and chat area */}
      <div className="flex h-full w-full">
        {/* Sidebar */}
        <ChatHistory
          chatSessions={memoizedChatSessions}
          currentSessionId={currentSessionId}
          setCurrentSessionId={handleSetCurrentSession}
          createNewSession={createNewSession}
          onToggleSidebar={handleToggleSidebarExpanded}
          className={`z-40 flex-shrink-0
          ${showSidebar ? 'fixed inset-y-0 left-0 w-3/5 max-w-xs md:relative md:w-auto' : 'hidden md:block'}`}
        />

        {/* Chat Window with Header */}
        <main className="flex-1 flex flex-col overflow-hidden relative min-w-0 w-full">

          {/* Header - sticky to prevent hiding on mobile scroll */}
          {/* We use showHeader=true on ChatWindow mostly for standalone. Here we use distinct ChatWindowHeader */}
          <ChatWindowHeader 
             onToggleSidebar={() => {
                if (window.innerWidth < 768) {
                    setShowSidebar(true);
                } else {
                    setSidebarExpanded(!sidebarExpanded);
                }
             }}
             sidebarExpanded={sidebarExpanded}
             currentSessionId={currentSessionId}
             userId={user?.uid}
             userUniqueId={userProfile?.uniqueUserId}
             messages={messages}
             chatMode={chatMode}
             onChatModeChange={setChatMode}
             onDownloadPDF={handleDownloadPDF}
             onDownloadText={handleDownloadText}
             onShare={handleShareChat}
             onCopyLink={async () => {
                 if (!currentSessionId) return;
                 const shareUrl = `${window.location.origin}/chat/${currentSessionId}`;
                 await navigator.clipboard.writeText(shareUrl);
                 alert('Link copied to clipboard!');
             }}
             onDelete={() => {
                 // Implement delete logic if needed or pass handler
                 console.log("Delete clicked");
             }}
             personalities={personalities}
             activePersonality={activePersonality}
             setActivePersonality={setActivePersonality}
             setPersonalities={setPersonalities}
          />

          {!loadingChats && (
            <ChatWindow
              currentSessionId={currentSessionId}
              userId={user?.uid}
              chatSessions={memoizedChatSessions}
              sidebarExpanded={sidebarExpanded}
              onToggleSidebar={() => {
                if (window.innerWidth < 768) {
                  setShowSidebar(true);
                } else {
                  setSidebarExpanded(!sidebarExpanded);
                }
              }}
              onMessagesUpdate={handleMessagesUpdate}
              chatMode={chatMode}
              onChatModeChange={setChatMode}
              activePersonality={activePersonality}
              showHeader={false} 
            />
          )}
        </main>

        {/* Mobile overlay */}
        {showSidebar && (
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-30"
            onClick={() => setShowSidebar(false)}
          />
        )}
      </div>
    </div>
  );
};

export default AppContent;