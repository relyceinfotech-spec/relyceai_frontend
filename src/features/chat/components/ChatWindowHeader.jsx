import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, MoreVertical, Settings, Share, Copy, Trash2, Database, User, Plus, Download, FileText, Settings as Gear, Users } from 'lucide-react';
import ChatService from '../../../services/chatService';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../utils/firebaseConfig';
import { useAuth } from '../../../context/AuthContext';
import { normalizeChatMode, normalizeChatModeSelection } from '../utils/chatMode.js';


// Download component for the header
const DownloadMenu = ({ onDownloadPDF, onDownloadText }) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (buttonRef.current && !buttonRef.current.contains(e.target) && !e.target.closest('.download-menu-content')) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-4 py-2 transition-all duration-300 text-[10px] font-mono uppercase tracking-widest hover:bg-white/[0.05] border border-transparent hover:border-white/10 ${isOpen ? 'text-white bg-white/[0.05]' : 'text-zinc-400 hover:text-white'}`}
        title="Download chat"
      >
        <Download size={14} />
        <span className="sm:inline hidden">Export</span>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-3 py-2 w-48 z-50 bg-[#0a0d14] border border-white/10 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 download-menu-content">
          <button
            onClick={() => { onDownloadText(); setIsOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 transition-colors text-left text-[10px] uppercase font-mono tracking-widest hover:bg-white/5 text-zinc-300 hover:text-white"
          >
            <FileText size={14} />
            As Text File
          </button>
          <button
            onClick={() => { onDownloadPDF(); setIsOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 transition-colors text-left text-[10px] uppercase font-mono tracking-widest hover:bg-white/5 text-zinc-300 hover:text-white border-t border-white/5"
          >
            <FileText size={14} />
            As PDF File
          </button>
        </div>
      )}
    </div>
  );
};

const ChatWindowHeader = ({
  onToggleSidebar,
  sidebarExpanded,
  currentSessionId,
  userId,
  messages,
  chatMode,
  onChatModeChange,
  tokenData,
  onDownloadPDF,
  onDownloadText,
  onShare,
  onCopyLink,
  onDelete,
  personalities,
  activePersonality,
  setActivePersonality,
  setPersonalities,
  userUniqueId,
  canUseFullAgent = false,
  membershipPlan = 'free'
}) => {
  const { currentUser: user, userProfile } = useAuth();
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const headerMenuButtonRef = useRef(null);
  const headerMenuRef = useRef(null);
  const navigate = useNavigate();

  // Mode Dropdown State
  const [modeDropdownOpen, setModeDropdownOpen] = useState(false);
  const modeButtonRef = useRef(null);
  const selectedMode = normalizeChatModeSelection(chatMode);
  const effectiveMode = normalizeChatMode(chatMode);

  // Personality Dropdown State
  const [personalityDropdownOpen, setPersonalityDropdownOpen] = useState(false);
  const personalityButtonRef = useRef(null);

  // Relyce AI Behavioral Logic
  const [thinkingVisibility, setThinkingVisibility] = useState('auto');
  const [savingThinkingVisibility, setSavingThinkingVisibility] = useState(false);

  // Close menus on outside click - centralized
  useEffect(() => {
    if (!headerMenuOpen && !modeDropdownOpen && !personalityDropdownOpen) return;
    
    const handler = (e) => {
      if (headerMenuOpen && headerMenuRef.current && !headerMenuRef.current.contains(e.target) && !headerMenuButtonRef.current?.contains(e.target)) {
        setHeaderMenuOpen(false);
      }
      
      if (modeDropdownOpen && modeButtonRef.current && !modeButtonRef.current.contains(e.target) && !e.target.closest('.mode-dropdown-content')) {
        setModeDropdownOpen(false);
      }

      if (personalityDropdownOpen && personalityButtonRef.current && !personalityButtonRef.current.contains(e.target) && !e.target.closest('.personality-dropdown-content')) {
        setPersonalityDropdownOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [headerMenuOpen, modeDropdownOpen, personalityDropdownOpen]);


  useEffect(() => {
    const visibility = userProfile?.settings?.personalization?.thinkingVisibility;
    if (visibility) {
      setThinkingVisibility(visibility);
    }
  }, [userProfile?.settings?.personalization?.thinkingVisibility]);



  const handleThinkingVisibilityChange = async (value) => {
    if (value === thinkingVisibility) return;
    setThinkingVisibility(value);
    if (!user?.uid) return;
    try {
      setSavingThinkingVisibility(true);
      await updateDoc(doc(db, 'users', user.uid), {
        'settings.personalization.thinkingVisibility': value
      });
    } catch (err) {
      console.error('[ThinkingVisibility] Failed to save setting:', err);
    } finally {
      setSavingThinkingVisibility(false);
    }
  };

  const handleShareClick = async () => {
    setIsSharing(true);
    try {
      await onShare(messages);
    } finally {
      setIsSharing(false);
      setHeaderMenuOpen(false);
    }
  };

  const handleCopyLinkClick = async () => {
    try {
      if (onCopyLink) {
          await onCopyLink(messages);
      } else {
          if (!currentSessionId) return;
          const shareUrl = `${window.location.origin}/chat/${currentSessionId}`;
          await navigator.clipboard.writeText(shareUrl);
          alert('Link copied to clipboard!');
      }
    } finally {
      setHeaderMenuOpen(false);
    }
  };

  const handleSettingsClick = () => {
    navigate('/settings');
    setHeaderMenuOpen(false);
  };

  return (
    <>
    <div className="sticky top-0 left-0 right-0 z-50 transition-colors duration-300 mobile-sticky-header">
      {/* Header glass panel */}
      <div className="bg-[#0a0d14]/50 backdrop-blur-3xl border-b border-white/[0.04]">
      <div className={`flex items-center justify-between py-3 px-4 transition-all duration-300 ${sidebarExpanded ? 'md:px-6' : 'md:px-8'}`}>
        
        {/* Left side - Menu & Title & Selectors */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink min-w-0">
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-full transition-colors md:hidden mr-1 text-zinc-400 hover:text-white hover:bg-white/[0.05]"
            title="Open menu"
          >
            <Menu size={20} />
          </button>
          
          <div className="relative">
            <button
              ref={modeButtonRef}
              onClick={() => setModeDropdownOpen(!modeDropdownOpen)}
              className={`flex items-center gap-2 px-4 py-2 transition-all duration-300 text-[10px] font-mono uppercase tracking-widest border ${modeDropdownOpen ? 'bg-white/[0.05] text-white border-white/10' : 'text-zinc-400 bg-transparent border-transparent hover:bg-white/[0.02] hover:text-white hover:border-white/5'}`}
            >
              <span>
                {selectedMode === 'auto'
                  ? 'Auto ⭐'
                  : effectiveMode === 'research_pro'
                  ? (canUseFullAgent ? 'Research Pro' : 'Research Pro (Trial)')
                  : effectiveMode === 'agent'
                    ? (canUseFullAgent ? 'Structured Agent' : 'Agent Trial')
                    : 'Smart'}
              </span>
              <svg className={`w-3.5 h-3.5 transition-transform duration-300 ${modeDropdownOpen ? 'rotate-180 text-white' : 'text-zinc-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" /></svg>
            </button>

            {modeDropdownOpen && (
              <div className="absolute top-full left-0 mt-3 py-2 w-56 z-50 bg-[#0a0d14] border border-white/10 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 mode-dropdown-content">
                <button onClick={() => { if(onChatModeChange) onChatModeChange('auto'); setModeDropdownOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left text-[10px] font-mono uppercase tracking-widest ${selectedMode === 'auto' ? 'bg-white/5 text-white' : 'hover:bg-white/5 text-zinc-400 hover:text-white'}`}>
                  Auto ⭐
                </button>
                <button onClick={() => { if(onChatModeChange) onChatModeChange('smart'); setModeDropdownOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left text-[10px] font-mono uppercase tracking-widest border-t border-white/[0.05] ${selectedMode === 'smart' ? 'bg-white/5 text-white' : 'hover:bg-white/5 text-zinc-400 hover:text-white'}`}>
                  Smart
                </button>
                <button onClick={() => { if(onChatModeChange) onChatModeChange('agent'); setModeDropdownOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left text-[10px] font-mono uppercase tracking-widest border-t border-white/[0.05] ${selectedMode === 'agent' ? 'bg-white/5 text-white' : 'hover:bg-white/5 text-zinc-400 hover:text-white'}`}>
                  {canUseFullAgent ? 'Structured Agent' : 'Structured Agent (Trial)'}
                </button>
                <button onClick={() => { if(onChatModeChange) onChatModeChange('research_pro'); setModeDropdownOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left text-[10px] font-mono uppercase tracking-widest border-t border-white/[0.05] ${selectedMode === 'research_pro' ? 'bg-white/5 text-white' : 'hover:bg-white/5 text-zinc-400 hover:text-white'}`}>
                  {canUseFullAgent ? 'Research Pro' : 'Research Pro (Trial)'}
                </button>
              </div>
            )}
          </div>

          {(selectedMode === 'auto' || effectiveMode === 'smart') && (
            <div className="relative">
                <button ref={personalityButtonRef} onClick={(e) => { e.stopPropagation(); setPersonalityDropdownOpen(!personalityDropdownOpen); }} className={`flex items-center gap-2 px-4 py-2 transition-all duration-300 text-[10px] font-mono uppercase tracking-widest border ${personalityDropdownOpen ? 'bg-white/[0.05] text-white border-white/10' : 'text-zinc-400 bg-transparent border-transparent hover:bg-white/[0.02] hover:text-white hover:border-white/5'}`} disabled={!personalities || personalities.length === 0}>
                <User size={14} className={personalityDropdownOpen ? "text-white" : "text-zinc-500"} />
                <span className="max-w-[80px] sm:max-w-[120px] truncate">{activePersonality ? activePersonality.name : 'Loading...'}</span>
                <svg className={`w-3.5 h-3.5 transition-transform duration-300 ${personalityDropdownOpen ? 'rotate-180 text-white' : 'text-zinc-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" /></svg>
                </button>

                {personalityDropdownOpen && (
                <div className="absolute top-full left-0 mt-3 py-2 w-64 z-50 bg-[#0a0d14] border border-white/10 shadow-2xl overflow-hidden max-h-[400px] overflow-y-auto custom-chat-scrollbar animate-in fade-in slide-in-from-top-2 duration-200 personality-dropdown-content" onClick={(e) => e.stopPropagation()}>
                    <div className="px-4 py-2.5 text-[10px] text-zinc-500 font-mono uppercase tracking-widest border-b border-white/[0.05] mb-1">
                        Select Persona
                    </div>
                    
                    {personalities && personalities.map(p => (
                        <div key={p.id} className="group relative flex items-center justify-between w-full hover:bg-white/5 transition-colors">
                            <button onClick={() => { setActivePersonality(p); setPersonalityDropdownOpen(false); }} className={`flex-1 flex items-center justify-between px-4 py-3 text-left text-xs font-medium tracking-wide ${activePersonality?.id === p.id ? 'text-white bg-white/[0.02]' : 'text-zinc-400'}`}>
                                <span className="truncate">{p.name}</span>
                            </button>
                            
                            {!p.is_system && (
                                <div className="absolute right-2 flex items-center">
                                    <button onClick={(e) => { e.stopPropagation(); setPersonalityDropdownOpen(false); navigate(`/personalities/edit/${p.id}`); }} className="p-2 rounded-full transition-colors text-zinc-500 hover:text-white hover:bg-white/10" title="Configure">
                                        <Gear size={14} />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                    
                    <div className="my-1 border-t border-white/[0.05]"></div>
                    
                    <button onClick={() => { navigate('/personalities/create'); setPersonalityDropdownOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 transition-colors text-left text-xs font-medium tracking-wide text-zinc-300 hover:text-white hover:bg-white/5">
                        <Plus size={14} /> New Persona
                    </button>
                </div>
                )}
            </div>
          )}


        </div>

        {/* Right side - Actions */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <DownloadMenu onDownloadPDF={onDownloadPDF} onDownloadText={onDownloadText} />

            <button onClick={handleShareClick} disabled={isSharing} className={`hidden sm:flex items-center gap-2 px-4 py-2 border border-transparent hover:border-white/10 transition-all duration-300 text-[10px] font-mono tracking-widest uppercase ${isSharing ? 'bg-white/[0.05] text-white cursor-wait' : 'text-zinc-400 hover:text-white hover:bg-white/[0.05]'}`}>
                <Share size={14} className={isSharing ? 'animate-pulse text-white/50' : ''} />
                <span>{isSharing ? 'Sharing' : 'Share'}</span>
            </button>

            <div className="relative">
                <button ref={headerMenuButtonRef} onClick={() => setHeaderMenuOpen(!headerMenuOpen)} className={`p-2 border border-transparent hover:border-white/10 transition-all duration-300 ${headerMenuOpen ? 'bg-white/[0.05] text-white' : 'text-zinc-400 hover:text-white hover:bg-white/[0.05]'}`}>
                <MoreVertical size={18} />
                </button>

                {headerMenuOpen && (
                <div ref={headerMenuRef} className="absolute top-full right-0 mt-3 py-2 w-72 z-50 bg-[#0a0d14] border border-white/10 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                     {(selectedMode === 'auto' || effectiveMode === 'smart') && (
                        <button onClick={() => { setHeaderMenuOpen(false); navigate('/personalities'); }} className="w-full flex items-center gap-3 px-5 py-3.5 transition-colors text-left text-[10px] font-mono tracking-widest uppercase hover:bg-white/5 text-zinc-200 hover:text-white border-b border-white/[0.05]">
                            <Users size={14} className="text-zinc-400" />
                            Persona Directory
                        </button>
                    )}

                    <button onClick={handleSettingsClick} className="w-full flex items-center gap-3 px-5 py-3.5 transition-colors text-left text-[10px] font-mono tracking-widest uppercase hover:bg-white/5 text-zinc-300 hover:text-white border-b border-white/[0.05]">
                        <Settings size={14} className="text-zinc-400" />
                        System Preferences
                    </button>

                    <button onClick={handleShareClick} className="w-full flex items-center gap-3 px-5 py-3.5 transition-colors text-left text-xs font-medium tracking-wide hover:bg-white/5 text-zinc-300 hover:text-white border-t border-white/[0.05]" disabled={isSharing}>
                        <Share size={16} className="text-zinc-400" />
                        {isSharing ? 'Processing...' : 'Export Public Link'}
                    </button>
                    
                    <button onClick={handleCopyLinkClick} className="w-full flex items-center gap-3 px-5 py-3.5 transition-colors text-left text-xs font-medium tracking-wide hover:bg-white/5 text-zinc-300 hover:text-white">
                        <Copy size={16} className="text-zinc-400" />
                        Copy Direct URL
                    </button>
                    
                </div>
                )}
            </div>
        </div>
      </div>
      {/* Subtle gradient border at the bottom of header */}
      <div className="h-px bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
      </div>
    </div>
    </>
  );
};

export default ChatWindowHeader;

