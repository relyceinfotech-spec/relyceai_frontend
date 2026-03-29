import React, { useState, useEffect, useRef, useMemo, memo, useCallback } from "react";
import ReactDOM from "react-dom";
import { useAuth } from "../../../context/AuthContext.jsx";
import { useTheme } from "../../../context/ThemeContext.jsx";
import { useNavigate } from "react-router-dom";
import { LogIn, Plus, MessageSquare, Settings, LogOut, MoreVertical, FilePenLine, Trash2, AlertTriangle, Menu, Share, Copy, X, Search, Pin, GripVertical } from "lucide-react";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../../utils/firebaseConfig.js";

// Transparent Header Component
const TransparentHeader = ({ onToggleSidebar, isSidebarExpanded, currentSessionId }) => {
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const headerMenuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target)) {
        setHeaderMenuOpen(false);
      }
    };
    if (headerMenuOpen) {
      document.addEventListener('mousedown', handler);
    }
    return () => document.removeEventListener('mousedown', handler);
  }, [headerMenuOpen]);

  const handleShare = () => {
    const currentUrl = `${window.location.origin}/chat/${currentSessionId}`;
    if (navigator.share) {
      navigator.share({ title: 'Relyce AI Chat', text: 'Check out this AI chat conversation', url: currentUrl });
    } else {
      navigator.clipboard.writeText(currentUrl); alert('Chat link copied to clipboard!');
    }
    setHeaderMenuOpen(false);
  };

  const handleCopyLink = () => {
    const currentUrl = `${window.location.origin}/chat/${currentSessionId}`;
    navigator.clipboard.writeText(currentUrl);
    alert('Chat link copied to clipboard!');
    setHeaderMenuOpen(false);
  };

  const handleDelete = () => {
    if (confirm('Delete this conversation?')) { console.log('Delete conversation'); }
    setHeaderMenuOpen(false);
  };

  return (
    <div className="absolute top-0 left-0 right-0 z-50 backdrop-blur-md border-b bg-black/40 border-white/5">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onToggleSidebar} className="p-2 transition hover:bg-white/5 text-white" title={isSidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}>
            <Menu size={20} />
          </button>
          <img src="/logo.svg" alt="Relyce AI" className="w-8 h-8 opacity-80" />
          <span className="font-medium text-lg tracking-wide text-white">RELYCE</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleShare} className="flex items-center gap-2 px-3 py-2 transition text-xs tracking-wider uppercase text-white hover:bg-white/5">
            <Share size={14} /><span>Share</span>
          </button>
          <div className="relative" ref={headerMenuRef}>
            <button onClick={() => setHeaderMenuOpen(!headerMenuOpen)} className="p-2 transition hover:bg-white/5 text-white">
              <MoreVertical size={20} />
            </button>
            {headerMenuOpen && (
              <div className="absolute top-12 right-0 border shadow-2xl py-2 w-48 z-50 bg-[#0a0d14] border-white/10">
                <button onClick={handleShare} className="w-full flex items-center gap-3 px-4 py-2 transition text-left text-xs uppercase tracking-wider hover:bg-white/5 text-white">
                  <Share size={14} />Share
                </button>
                <button onClick={handleCopyLink} className="w-full flex items-center gap-3 px-4 py-2 transition text-left text-xs uppercase tracking-wider hover:bg-white/5 text-white">
                  <Copy size={14} />Copy link
                </button>
                <button onClick={handleDelete} className="w-full flex items-center gap-3 px-4 py-2 transition text-left text-xs uppercase tracking-wider hover:bg-white/5 text-red-400">
                  <Trash2 size={14} />Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Floating Dropdown Menu Component
const DropdownMenu = ({ coords, session, onRename, onDelete, onPin, onClose }) => {
  const menuRef = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const menuStyle = { position: 'absolute', top: `${coords.bottom + 4}px`, left: `${coords.right - 144}px` };

  return ReactDOM.createPortal(
    <div ref={menuRef} style={menuStyle} className="border shadow-2xl z-[999] w-36 overflow-hidden animate-fade-in-fast bg-[#0a0d14] border-white/10">
      <button onClick={onPin} className="w-full flex items-center gap-2 px-3 py-3 text-xs tracking-wider uppercase text-left transition hover:bg-white/5 text-slate-300">
        <Pin size={12} className={session.isPinned ? 'text-white' : ''} /> {session.isPinned ? 'Unpin' : 'Pin'}
      </button>
      <button onClick={onRename} className="w-full flex items-center gap-2 px-3 py-3 text-xs tracking-wider uppercase text-left transition hover:bg-white/5 text-slate-300">
        <FilePenLine size={12} /> Rename
      </button>
      <button onClick={onDelete} className="w-full flex items-center gap-2 px-3 py-3 text-xs tracking-wider uppercase text-left transition hover:bg-white/5 text-red-400">
        <Trash2 size={12} /> Delete
      </button>
    </div>,
    document.body
  );
};

// Custom Modal for Delete Confirmation
const DeleteConfirmationModal = ({ session, onConfirm, onCancel }) => {
  const modalRef = useRef(null);
  useEffect(() => {
    const handleKeyDown = (event) => { if (event.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 animate-fade-in-fast" onClick={onCancel}>
      <div ref={modalRef} className="border p-8 max-w-sm w-full text-center bg-[#0a0d14] border-white/10" onClick={e => e.stopPropagation()}>
        <div className="mx-auto w-12 h-12 flex items-center justify-center border bg-red-500/5 border-red-500/20 mb-6">
          <Trash2 className="text-red-400" size={20} />
        </div>
        <h2 className="text-xl font-light tracking-wide mt-4 text-white uppercase">Initialize Deletion?</h2>
        <p className="mt-4 text-sm tracking-wide leading-relaxed text-slate-400">
          Confirm purge of sequence: <br/><span className="text-white font-mono mt-2 block opacity-80">{session.name}</span>
        </p>
        <div className="flex gap-4 mt-8">
          <button onClick={onCancel} className="w-full py-3 text-xs tracking-wider uppercase transition border border-white/10 hover:bg-white/5 text-slate-300">Cancel</button>
          <button onClick={onConfirm} className="w-full py-3 text-xs tracking-wider uppercase transition bg-white text-black hover:bg-white/90">Confirm Purge</button>
        </div>
      </div>
    </div>
  );
};

// Simplified User Profile Component
const UserProfile = memo(({ user, userProfile, userName, isExpanded, auth, navigate }) => {
  const photoURL = userProfile?.photoURL || user?.photoURL;
  const userIcon = photoURL ? (
    <img src={photoURL} alt={userName} className="w-6 h-6 object-cover grayscale opacity-80" loading="lazy" />
  ) : (
    <div className="w-6 h-6 flex items-center justify-center font-mono text-xs bg-white/5 text-white border border-white/10">
      {userName.charAt(0).toUpperCase()}
    </div>
  );

  return (
    <>
      <SidebarItem icon={userIcon} text={userName} isExpanded={isExpanded} />
      <SidebarItem icon={<Settings size={16} />} text="Settings" isExpanded={isExpanded} onClick={() => navigate('/settings')} />
      {user ? (
        <SidebarItem icon={<LogOut size={16} className="text-white/50" />} text={<span className="text-white/50">Sign Out</span>} onClick={() => auth.signOut()} isExpanded={isExpanded} />
      ) : (
        <SidebarItem icon={<LogIn size={16} className="text-white" />} text={<span className="text-white">Sign In</span>} onClick={() => navigate('/login')} isExpanded={isExpanded} />
      )}
    </>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.isExpanded === nextProps.isExpanded &&
    prevProps.userName === nextProps.userName &&
    prevProps.user?.photoURL === nextProps.user?.photoURL &&
    prevProps.userProfile?.photoURL === nextProps.userProfile?.photoURL &&
    prevProps.user?.uid === nextProps.user?.uid
  );
});

// Memoized SidebarItem component
const SidebarItem = memo(({ icon, text, onClick, isExpanded, isActive = false }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center ${isExpanded ? 'gap-4 px-4' : 'justify-center px-0'} py-3 text-xs tracking-widest uppercase transition-all duration-300 ${isActive
      ? "bg-white/5 text-white border-l-2 border-white"
      : "text-slate-400 hover:text-white hover:bg-white/[0.02] border-l-2 border-transparent"
      }`}
  >
    <div className="flex-shrink-0 opacity-80">{icon}</div>
    {isExpanded && <span className="whitespace-nowrap opacity-100">{text}</span>}
  </button>
));

const ZetoChatHistory = memo(function ZetoChatHistory({
  chatSessions,
  currentSessionId,
  setCurrentSessionId,
  createNewSession,
  showHeader = false,
  onToggleSidebar,
  className = ""
}) {
  const { currentUser: user, userProfile, auth, loading } = useAuth();
  const [isExpanded, setIsExpanded] = useState(true);
  const navigate = useNavigate();
  const [menuSession, setMenuSession] = useState(null);
  const [menuCoords, setMenuCoords] = useState(null);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [sessionToDelete, setSessionToDelete] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [pinnedIds, setPinnedIds] = useState([]);
  const [customOrder, setCustomOrder] = useState([]);

  useEffect(() => { setPinnedIds([]); setCustomOrder([]); }, [user?.uid]);
  
  const [draggedSessionId, setDraggedSessionId] = useState(null);
  const [dragOverSessionId, setDragOverSessionId] = useState(null);

  const handleToggleSidebar = useCallback(() => {
    setIsExpanded(!isExpanded);
    if (onToggleSidebar) onToggleSidebar(!isExpanded);
  }, [isExpanded, onToggleSidebar]);

  const userName = user ? user.displayName || user.email?.split("@")[0] : "Guest";

  const sortedSessions = useMemo(() => {
    const filtered = [...chatSessions].filter(session => session.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return filtered.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  }, [chatSessions, searchQuery]);
  
  const pinnedSessions = useMemo(() => { return sortedSessions.filter(s => pinnedIds.includes(s.id)); }, [sortedSessions, pinnedIds]);
  
  const unpinnedSessions = useMemo(() => {
    const unpinned = sortedSessions.filter(s => !pinnedIds.includes(s.id));
    if (customOrder.length > 0) {
      return unpinned.sort((a, b) => {
        const aIdx = customOrder.indexOf(a.id);
        const bIdx = customOrder.indexOf(b.id);
        if (aIdx === -1 && bIdx === -1) return 0;
        if (aIdx === -1) return 1;
        if (bIdx === -1) return -1;
        return aIdx - bIdx;
      });
    }
    return unpinned;
  }, [sortedSessions, pinnedIds, customOrder]);

  const handleRename = useCallback(async (sessionId, newName) => {
    if (!newName || newName.trim() === "") { setEditingSessionId(null); return; }
    const ref = doc(db, "users", user.uid, "chatSessions", sessionId);
    await updateDoc(ref, { name: newName.trim() });
    setEditingSessionId(null);
  }, [user]);

  const handleDelete = useCallback(async () => {
    if (!sessionToDelete) return;
    const ref = doc(db, "users", user.uid, "chatSessions", sessionToDelete.id);
    await deleteDoc(ref);
    if (currentSessionId === sessionToDelete.id) {
      const nextSession = sortedSessions.find(s => s.id !== sessionToDelete.id);
      setCurrentSessionId(nextSession ? nextSession.id : null);
    }
    setSessionToDelete(null);
  }, [sessionToDelete, user, currentSessionId, sortedSessions, setCurrentSessionId]);

  const handleMenuClick = useCallback((e, session) => {
    e.stopPropagation();
    if (menuSession?.id === session.id) { setMenuSession(null); } 
    else { const rect = e.currentTarget.getBoundingClientRect(); setMenuCoords({ top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right }); setMenuSession(session); }
  }, [menuSession]);
  
  const handlePin = useCallback((sessionId) => {
    setPinnedIds(prev => prev.includes(sessionId) ? prev.filter(id => id !== sessionId) : [...prev, sessionId]);
    setMenuSession(null);
  }, [user]);
  
  const handleDragStart = (e, sessionId) => { setDraggedSessionId(sessionId); e.dataTransfer.effectAllowed = 'move'; };
  const handleDragOver = (e, sessionId) => { e.preventDefault(); if (sessionId !== draggedSessionId) setDragOverSessionId(sessionId); };
  
  const handleDrop = (e, targetSessionId) => {
    e.preventDefault();
    if (!draggedSessionId || draggedSessionId === targetSessionId) return;
    if (pinnedIds.includes(draggedSessionId) || pinnedIds.includes(targetSessionId)) return;
    const unpinnedIds = unpinnedSessions.map(s => s.id);
    const fromIdx = unpinnedIds.indexOf(draggedSessionId);
    const toIdx = unpinnedIds.indexOf(targetSessionId);
    if (fromIdx !== -1 && toIdx !== -1) {
      const newOrder = [...unpinnedIds];
      newOrder.splice(fromIdx, 1);
      newOrder.splice(toIdx, 0, draggedSessionId);
      setCustomOrder(newOrder);
    }
    setDraggedSessionId(null); setDragOverSessionId(null);
  };
  
  const handleDragEnd = () => { setDraggedSessionId(null); setDragOverSessionId(null); };
  if (loading) {
    return (
      <div className={`hidden md:flex flex-col h-full border-r transition-colors bg-[#0a0d14] border-white/5 ${className}`}>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-[10px] uppercase font-mono tracking-widest text-zinc-600 animate-pulse">Scanning...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={`hidden md:flex flex-col h-full border-r transition-colors bg-[#0a0d14] border-white/5 ${className}`}>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="mb-6 opacity-50"><LogIn size={32} className="text-white" /></div>
          <h2 className="text-sm tracking-widest uppercase mb-4 text-white">Auth Required</h2>
          <button onClick={() => navigate('/login')} className="px-6 py-3 text-xs tracking-widest uppercase transition bg-white text-black hover:bg-white/90">
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`flex flex-col h-full flex-shrink-0 transition-all duration-300 ${isExpanded ? "w-80" : "w-16"} ${className} relative overflow-hidden bg-[#111318] text-white border-r border-white/10`}>
        <div className="flex flex-col gap-0 flex-shrink-0 pt-6">
          <div className="md:hidden flex justify-end px-4 mb-4">
            <button onClick={() => window.dispatchEvent(new CustomEvent('closeSidebar'))} className="p-2 text-white/50 hover:text-white hover:bg-white/5 transition" title="Close Sidebar"><X size={20} /></button>
          </div>

          <div className={`flex items-center ${isExpanded ? 'justify-between px-6' : 'justify-center'} mb-8`}>
            {isExpanded && (
              <div className="flex items-center gap-3">
                <img src="/logo.svg" alt="Relyce AI" className="w-6 h-6 opacity-90" />
                <span className="text-2xl font-semibold tracking-wide text-white">Relyce</span>
              </div>
            )}
            <button onClick={handleToggleSidebar} className="p-2 text-white/50 hover:text-white hover:bg-white/5 transition" title={isExpanded ? "Pin sidebar open" : "Expand sidebar"}>
              <Menu size={18} />
            </button>
          </div>

          <div className="px-4 mb-8">
             <button onClick={createNewSession} className={`group relative w-full flex items-center justify-center gap-2 py-3.5 bg-white/[0.04] text-white border border-white/10 hover:border-white/20 hover:bg-white/[0.07] transition-all duration-300 rounded-2xl ${isExpanded ? '' : 'px-0'}`}>
                {isExpanded ? (
                   <>
                     <Plus size={16} className="text-zinc-200" />
                     <span className="text-lg font-medium tracking-wide text-zinc-100">New Chat</span>
                   </>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                )}
             </button>
          </div>

          {isExpanded ? (
            <div className="relative mb-6 px-4">
              <input type="text" placeholder="Search Chats" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/[0.03] rounded-xl border border-white/10 py-2.5 pl-3 pr-8 text-sm tracking-wide text-white placeholder-white/35 focus:outline-none focus:border-white/30 transition-colors"
               />
               <Search size={14} className="absolute right-6 top-3 text-white/30" />
            </div>
          ) : (
            <SidebarItem icon={<Search size={16} />} text="Search" onClick={() => {}} isExpanded={isExpanded} />
          )}
        </div>

        <style>{`
          .chat-item { transition: all 0.2s ease-out; }
          .chat-list { will-change: auto; }
          .chat-history-scroll::-webkit-scrollbar { width: 2px; }
          .chat-history-scroll::-webkit-scrollbar-track { background: transparent; }
          .chat-history-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); }
          .chat-history-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.3); }
          .chat-history-scroll { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.1) transparent; }
        `}</style>
        
        <div className={`chat-history-scroll overflow-y-auto overflow-x-hidden ${isExpanded ? "opacity-100 px-0" : "opacity-0 pointer-events-none"}`} style={{ height: 'calc(100vh - 280px)', maxHeight: 'calc(100vh - 280px)' }}>
          {pinnedSessions.length > 0 && (
            <div className="mb-6">
              <h3 className="px-6 text-[11px] font-medium tracking-wide text-white/40 mb-2 flex items-center gap-2">
                <Pin size={10} /> PINNED
              </h3>
              <ul className="chat-list">
                {pinnedSessions.map((session) => (
                  <li key={session.id} className="relative group">
                    <div onClick={() => !editingSessionId && setCurrentSessionId(session.id)}
                      className={`chat-item w-full flex items-center justify-between px-6 py-3 cursor-pointer border-l-2 ${session.id === currentSessionId
                        ? 'bg-white/[0.03] border-white/20 text-white'
                        : 'border-transparent hover:bg-white/[0.02] text-white/60 hover:text-white/90'
                      }`}
                    >
                      <span className="truncate flex-1 flex items-center text-xs tracking-wide">
                        <span className="w-1.5 h-1.5 bg-white/40 rounded-full mr-3 opacity-50 flex-shrink-0"></span>
                        {session.name}
                      </span>
                      {isExpanded && !editingSessionId && (
                        <button onClick={(e) => handleMenuClick(e, session)} className={`p-1.5 opacity-0 group-hover:opacity-100 hover:text-white text-white/40 transition-all`}>
                          <MoreVertical size={14} />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
             <h3 className="px-6 text-[11px] font-medium tracking-wide text-white/40 mb-2">Chats</h3>
             <ul className="chat-list">
               {unpinnedSessions.map((session) => (
                 <li key={session.id} className={`relative group ${dragOverSessionId === session.id ? 'border-t border-white/20' : ''}`}
                   draggable={!editingSessionId} onDragStart={(e) => handleDragStart(e, session.id)} onDragOver={(e) => handleDragOver(e, session.id)} onDrop={(e) => handleDrop(e, session.id)} onDragEnd={handleDragEnd}
                 >
                   <div onClick={() => !editingSessionId && setCurrentSessionId(session.id)}
                     className={`chat-item w-full flex items-center justify-between px-6 py-3 cursor-pointer border-l-[1px] ${editingSessionId === session.id
                       ? 'bg-white/10 border-white'
                       : ''
                       } ${session.id === currentSessionId
                         ? 'bg-white/5 border-white/20 text-white'
                         : 'border-transparent hover:bg-white/[0.02] text-white/60 hover:text-white/90'
                       } ${draggedSessionId === session.id ? 'opacity-30' : ''}`}
                   >
                     {editingSessionId === session.id ? (
                       <input type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={() => handleRename(session.id, editValue)} onKeyDown={(e) => { if (e.key === 'Enter') handleRename(session.id, editValue); if (e.key === 'Escape') setEditingSessionId(null); }} autoFocus
                         className="w-full bg-transparent outline-none flex-1 text-white text-xs tracking-wide" />
                     ) : (
                       <span className="truncate flex-1 flex items-center text-xs tracking-wide">
                          <span className={`${session.id === currentSessionId ? 'bg-white' : 'bg-transparent border border-white/30'} w-1.5 h-1.5 flex-shrink-0 mr-3 transition-all duration-300`}></span>
                         {session.name}
                       </span>
                     )}
                     {isExpanded && !editingSessionId && (
                       <button onClick={(e) => handleMenuClick(e, session)} className={`p-1.5 text-white/40 hover:text-white opacity-0 group-hover:opacity-100 transition-all`}>
                         <MoreVertical size={14} />
                       </button>
                     )}
                   </div>
                 </li>
               ))}
             </ul>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 py-4 border-t border-white/5 bg-[#0a0d14]">
          <UserProfile user={user} userProfile={userProfile} userName={userName} isExpanded={isExpanded} auth={auth} navigate={navigate} />
        </div>
      </div>

      {menuSession && menuCoords && (
        <DropdownMenu coords={menuCoords} session={{ ...menuSession, isPinned: pinnedIds.includes(menuSession.id) }} onClose={() => setMenuSession(null)}
          onPin={() => handlePin(menuSession.id)} onRename={() => { setEditingSessionId(menuSession.id); setEditValue(menuSession.name); setMenuSession(null); }}
          onDelete={() => { setSessionToDelete(menuSession); setMenuSession(null); }}
        />
      )}

      {sessionToDelete && (
        <DeleteConfirmationModal session={sessionToDelete} onConfirm={handleDelete} onCancel={() => setSessionToDelete(null)} />
      )}
    </>
  );
}, (prevProps, nextProps) => {
  const shouldUpdate = (
    prevProps.currentSessionId !== nextProps.currentSessionId ||
    prevProps.className !== nextProps.className ||
    prevProps.showHeader !== nextProps.showHeader ||
    prevProps.chatSessions.length !== nextProps.chatSessions.length
  );
  return !shouldUpdate;
});

export default ZetoChatHistory;
