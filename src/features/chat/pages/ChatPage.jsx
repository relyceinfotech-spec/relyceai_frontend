import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import ChatHistory from '../components/ChatHistory.jsx';
import ChatWindow from '../components/ChatWindow.jsx';
import ChatWindowHeader from '../components/ChatWindowHeader.jsx';
import { useAuth } from '../../../context/AuthContext.jsx';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../../utils/firebaseConfig.js';
import { collection, query, orderBy, onSnapshot, doc, setDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import ChatService from '../../../services/chatService';
import { normalizeChatModeSelection } from '../utils/chatMode.js';


const ChatSkeleton = () => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0d14]">
    <div className="text-[10px] uppercase font-mono tracking-widest text-zinc-600 animate-pulse">
      Initializing Interface...
    </div>
  </div>
);

function AppContent() {
  const { currentUser: user, userProfile } = useAuth();
  const { chatId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [chatSessions, setChatSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [loadingChats, setLoadingChats] = useState(true);
  const [bootstrapDeadlineReached, setBootstrapDeadlineReached] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [shareLoading, setShareLoading] = useState(false);
  const [pendingMessage, setPendingMessage] = useState(null);
  const [chatMode, setChatModeRaw] = useState(() => {
    try { return normalizeChatModeSelection(localStorage.getItem('relyce_chat_mode')); } catch { return 'auto'; }
  });
  const setChatMode = useCallback((mode) => {
    const normalized = normalizeChatModeSelection(mode);
    setChatModeRaw(normalized);
    try { localStorage.setItem('relyce_chat_mode', normalized); } catch {}
  }, []);
  const [personalities, setPersonalities] = useState([]);
  const [activePersonality, setActivePersonality] = useState(null);

  const isNavigatingRef = useRef(false);
  const lastUrlSessionRef = useRef(chatId);
  const userSelectedPersonalityRef = useRef(false);
  const emptySessionCreateInFlightRef = useRef(false);

  useEffect(() => {
    const uid = userProfile?.uniqueUserId;
    if (uid) {
        ChatService.getPersonalities(uid).then(result => {
            if (result.success && result.personalities) {
                setPersonalities(result.personalities);
                if (activePersonality) {
                    const updated = result.personalities.find(p => p.id === activePersonality.id);
                    if (updated) setActivePersonality(updated);
                }
                if (!activePersonality) {
                    const def = result.personalities.find(p => p.is_default && p.id === 'default_relyce') || result.personalities[0];
                    setActivePersonality(def);
                }
            } else {
                const defaultPersonality = { id: 'default_relyce', name: 'Relyce AI', description: 'Professional assistant', is_default: true };
                setPersonalities([defaultPersonality]);
                if (!activePersonality) setActivePersonality(defaultPersonality);
            }
        }).catch(err => {
            console.error(err);
            const defaultPersonality = { id: 'default_relyce', name: 'Relyce AI', description: 'Professional assistant', is_default: true };
            setPersonalities([defaultPersonality]);
            if (!activePersonality) setActivePersonality(defaultPersonality);
        });
    }
  }, [userProfile?.uniqueUserId]);

  const handleSetActivePersonality = useCallback((persona) => {
      userSelectedPersonalityRef.current = Date.now();
      setActivePersonality(persona);
      if (currentSessionId && user?.uid && persona?.id) {
          ChatService.updateSessionPersonality(user.uid, currentSessionId, persona.id);
      }
  }, [currentSessionId, user]);

  // Sync personality from session data - but never override a recent manual selection
  useEffect(() => {
    if (!currentSessionId || !chatSessions.length || !personalities.length) return;
    // Skip if user manually selected a personality within the last 3 seconds
    const timeSinceManualSelect = Date.now() - (userSelectedPersonalityRef.current || 0);
    if (timeSinceManualSelect < 3000) return;

    const currentSession = chatSessions.find(s => s.id === currentSessionId);
    
    if (currentSession?.personalityId) {
        const savedPersona = personalities.find(p => p.id === currentSession.personalityId);
        if (savedPersona && savedPersona.id !== activePersonality?.id) {
            setActivePersonality(savedPersona);
        }
    } else if (!activePersonality) {
        // Only set default if no personality is selected at all
        const defaultPersona = personalities.find(p => p.is_default && p.id === 'default_relyce') || personalities[0];
        if (defaultPersona) setActivePersonality(defaultPersona);
    }
  }, [currentSessionId, chatSessions, personalities, activePersonality?.id]);

  const memoizedChatSessions = useMemo(() => chatSessions || [], [chatSessions?.length]);

  useEffect(() => {
    if (chatId) lastUrlSessionRef.current = chatId;
  }, [chatId]);

  useEffect(() => {
    const handleCloseSidebar = () => setShowSidebar(false);
    window.addEventListener('closeSidebar', handleCloseSidebar);
    return () => window.removeEventListener('closeSidebar', handleCloseSidebar);
  }, []);

  // Fail-open bootstrap: never block first paint for slow Firestore/session fetch.
  useEffect(() => {
    const timer = setTimeout(() => setBootstrapDeadlineReached(true), 900);
    return () => clearTimeout(timer);
  }, []);

  const handleDownloadPDF = async () => {
    if (!messages || messages.length === 0) return;
    try {
      const { generateChatPDF } = await import('../../../utils/pdfGenerator.js');
      const blob = await generateChatPDF(messages, { title: 'Chat Conversation', date: new Date(), participants: ['User', 'Relyce AI'] });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relyce-chat-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
    }
  };

  const handleDownloadText = () => {
    if (!messages || messages.length === 0) return;
    try {
      const textContent = messages.map(msg => `[${msg.role.toUpperCase()}] (${new Date(msg.timestamp?.toDate ? msg.timestamp.toDate() : msg.createdAt).toLocaleString()})\n${msg.content}\n`).join('\n');
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
      console.error(error);
    }
  };

  const handleSetCurrentSession = useCallback((id) => {
    if (currentSessionId === id) { setShowSidebar(false); return; }
    setCurrentSessionId(id);
    setShowSidebar(false);
    window.history.replaceState(null, '', `/chat/${id}`);
  }, [currentSessionId]);

  const handleShareChat = useCallback(async () => {
    if (!currentSessionId || !user || messages.length === 0) return;
    setShareLoading(true);
    try {
      const shareId = crypto.randomUUID();
      const currentSession = chatSessions.find(s => s.id === currentSessionId);
      const sessionName = currentSession?.name || 'Chat Conversation';
      await addDoc(collection(db, 'sharedChats'), {
        shareId: shareId, title: sessionName,
        messages: messages.map(msg => ({ role: msg.role, content: msg.content, timestamp: msg.timestamp || msg.createdAt })),
        isPublic: true, sharedAt: serverTimestamp(), messageCount: messages.length
      });
      const shareUrl = `${window.location.origin}/shared/${shareId}`;
      await navigator.clipboard.writeText(shareUrl);
    } catch (error) {
      console.error(error);
    } finally {
      setShareLoading(false);
    }
  }, [currentSessionId, user, messages, chatSessions]);

  const handleToggleSidebarExpanded = useCallback((expanded) => setSidebarExpanded(expanded), []);

  const createNewSession = useCallback(async () => {
    if (!user) return;
    const newSessionId = crypto.randomUUID();
    setCurrentSessionId(newSessionId);
    setMessages([]);
    setShowSidebar(false);
    navigate(`/chat/${newSessionId}`, { replace: true });
    setDoc(doc(db, 'users', user.uid, 'chatSessions', newSessionId), { name: 'New Session', createdAt: serverTimestamp() }).catch(e => console.error(e));
  }, [user, navigate]);

  useEffect(() => {
    if (user) {
      setLoadingChats(true);
      const chatRef = collection(db, 'users', user.uid, 'chatSessions');
      const q = query(chatRef, orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
          const sessions = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
          setChatSessions(sessions);
          if (snapshot.metadata.hasPendingWrites) return;

          const lockNavigation = () => {
            isNavigatingRef.current = true;
            setTimeout(() => {
              isNavigatingRef.current = false;
            }, 450);
          };

          if (chatId && chatId !== currentSessionId && !isNavigatingRef.current) {
            if (sessions.find((s) => s.id === chatId)) {
              setCurrentSessionId(chatId);
            } else if (sessions.length > 0) {
              const fallbackId = sessions[0].id;
              setCurrentSessionId(fallbackId);
              lockNavigation();
              navigate(`/chat/${fallbackId}`, { replace: true });
            }
          } else if (!chatId && sessions.length > 0 && !currentSessionId && !isNavigatingRef.current) {
            const nextId = sessions[0].id;
            setCurrentSessionId(nextId);
            lockNavigation();
            navigate(`/chat/${nextId}`, { replace: true });
          } else if (!chatId && sessions.length === 0 && !emptySessionCreateInFlightRef.current) {
            emptySessionCreateInFlightRef.current = true;
            createNewSession().finally(() => {
              emptySessionCreateInFlightRef.current = false;
            });
          }
          setLoadingChats(false);
        }, (error) => { console.error(error); setLoadingChats(false); }
      );
      return () => unsubscribe();
    } else {
      setChatSessions([]); setCurrentSessionId(null); setLoadingChats(false);
    }
  }, [user, createNewSession, chatId, currentSessionId, navigate]);

  const handleMessagesUpdate = useCallback((newMessages) => setMessages(newMessages), []);

  // Listen for 'relyce-start-chat' event (from Settings > Manage Memory > See what Relyce learned)
  useEffect(() => {
    const handler = async (e) => {
      const msg = e.detail?.message;
      if (!msg || !user) return;
      // Create a brand new session
      const newId = crypto.randomUUID();
      setCurrentSessionId(newId);
      setMessages([]);
      navigate(`/chat/${newId}`, { replace: true });
      try {
        await setDoc(doc(db, 'users', user.uid, 'chatSessions', newId), { name: 'Memory Review', createdAt: serverTimestamp() });
      } catch (er) { console.error(er); }
      // Set pending message so ChatWindow auto-sends it
      setPendingMessage(msg);
    };
    window.addEventListener('relyce-start-chat', handler);
    return () => window.removeEventListener('relyce-start-chat', handler);
  }, [user, navigate]);

  if (loadingChats && !bootstrapDeadlineReached && !chatId && !currentSessionId) return <ChatSkeleton />;

  return (
    <div className="h-screen w-full bg-[#0b0c10] text-white p-2 md:p-3">
      <Helmet><title>Interface | Relyce</title><meta name="robots" content="noindex" /></Helmet>

      <div className="flex h-full w-full relative rounded-[20px] border border-white/10 bg-[#13151b] overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <ChatHistory
          chatSessions={memoizedChatSessions} currentSessionId={currentSessionId} setCurrentSessionId={handleSetCurrentSession}
          createNewSession={createNewSession} onToggleSidebar={handleToggleSidebarExpanded}
          className={`z-40 flex-shrink-0 ${showSidebar ? 'fixed inset-y-0 left-0 w-3/5 max-w-xs md:relative md:w-auto' : 'hidden md:block'}`}
        />

        <main className="flex-1 flex flex-col overflow-hidden relative min-w-0 w-full bg-gradient-to-b from-[#15171d] to-[#111318]">
          <ChatWindowHeader 
             onToggleSidebar={() => { if (window.innerWidth < 768) setShowSidebar(true); else setSidebarExpanded(!sidebarExpanded); }}
             sidebarExpanded={sidebarExpanded} currentSessionId={currentSessionId} userId={user?.uid} userUniqueId={userProfile?.uniqueUserId}
             messages={messages} chatMode={chatMode} onChatModeChange={setChatMode} onDownloadPDF={handleDownloadPDF} onDownloadText={handleDownloadText} onShare={handleShareChat}
             onCopyLink={async () => { if (!currentSessionId) return; await navigator.clipboard.writeText(`${window.location.origin}/chat/${currentSessionId}`); }}
             onDelete={() => { console.log("Delete clicked"); }} personalities={personalities} activePersonality={activePersonality} setActivePersonality={handleSetActivePersonality} setPersonalities={setPersonalities}
          />
          <ChatWindow
            currentSessionId={currentSessionId} userId={user?.uid} chatSessions={memoizedChatSessions} sidebarExpanded={sidebarExpanded}
            onToggleSidebar={() => { if (window.innerWidth < 768) setShowSidebar(true); else setSidebarExpanded(!sidebarExpanded); }}
            onMessagesUpdate={handleMessagesUpdate} chatMode={chatMode} onChatModeChange={setChatMode} activePersonality={activePersonality} setActivePersonality={handleSetActivePersonality} personalities={personalities} showHeader={false}
            initialMessage={pendingMessage} onInitialMessageConsumed={() => setPendingMessage(null)}
          />
        </main>

        {showSidebar && <div className="md:hidden fixed inset-0 bg-black/80 backdrop-blur-sm z-30" onClick={() => setShowSidebar(false)} />}
      </div>
    </div>
  );
}

export default AppContent;

