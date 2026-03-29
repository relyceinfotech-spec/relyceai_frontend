import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Plus, Upload, Search, X, FileText, Image, Square, Globe, Send } from 'lucide-react';
import { uploadFile } from '../../../utils/api.js';
import { uploadChatFileToFirebase } from '../../files/services/fileService.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import { normalizeChatMode, isAgentPremiumMode, resolveRuntimeChatMode } from '../utils/chatMode.js';

export default function ChatInput({ onSend, onFileUpload, onFileUploadComplete, botTyping, onStop, sessionId, chatMode, canUseFullAgent = false, membershipPlan = 'free' }) {
    const theme = 'dark';
    const { currentUser: user, userProfile, loading } = useAuth();
    const [text, setText] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [isWebSearchActive, setIsWebSearchActive] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [showExpandButton, setShowExpandButton] = useState(false);
    const [skipAutoResize, setSkipAutoResize] = useState(false);
    const [showReactChecklist, setShowReactChecklist] = useState(false);
    const [pendingSend, setPendingSend] = useState(null);
    const [uploadError, setUploadError] = useState(null);
    const [reactChecklist, setReactChecklist] = useState({
        product: '',
        audience: '',
        sections: '',
        theme: ''
    });
    const fileInputRef = useRef(null);
    const recognitionRef = useRef(null);
    const dropdownRef = useRef(null);
    const textareaRef = useRef(null);
    const inputContainerRef = useRef(null);
    const prevTextRef = useRef('');
    const effectiveMode = normalizeChatMode(chatMode);

    useEffect(() => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.warn('Speech API not supported');
            return;
        }
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recog = new SpeechRecognition();
        recog.lang = 'en-US';
        recog.interimResults = true;
        recog.continuous = false;
        recog.onresult = e => {
            let tr = '';
            for (let i = e.resultIndex; i < e.results.length; ++i) tr += e.results[i][0].transcript;
            setText(prev => prev + tr);
        };
        recog.onerror = () => setIsRecording(false);
        recog.onend = () => setIsRecording(false);
        recognitionRef.current = recog;

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, []);

    useEffect(() => {
        function handleClickOutside(e) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setDropdownOpen(false);
            }
        }
        if (dropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [dropdownOpen]);

    const isReactRequest = (value) => {
        if (!value) return false;
        return /\b(react|next\.?js|nextjs|jsx|tsx)\b/i.test(value);
    };

    const isContinuationPayload = (value) => {
        if (!value) return false;
        return /CONTINUE_AVAILABLE|Continue generating UI code|<PREVIOUS_OUTPUT>/i.test(value);
    };

    const shouldPromptReactChecklist = (value) => {
        if (effectiveMode !== 'smart') return false;
        if (isContinuationPayload(value)) return false;
        return isReactRequest(value);
    };

    const buildChecklistBlock = (useDefaults) => {
        if (useDefaults) {
            return "Proceed with sensible assumptions and dummy data.";
        }
        const lines = [
            "React Requirements:",
            reactChecklist.product ? `- Product: ${reactChecklist.product}` : null,
            reactChecklist.audience ? `- Audience: ${reactChecklist.audience}` : null,
            reactChecklist.sections ? `- Sections: ${reactChecklist.sections}` : null,
            reactChecklist.theme ? `- Theme: ${reactChecklist.theme}` : null
        ].filter(Boolean);
        if (lines.length === 1) {
            return "Proceed with sensible assumptions and dummy data.";
        }
        return lines.join("\n");
    };

    const finalizeSend = (payload, { includeChecklist = false, useDefaults = false } = {}) => {
        const checklistBlock = includeChecklist ? buildChecklistBlock(useDefaults) : '';
        const nextText = checklistBlock ? `${payload.text}\n\n${checklistBlock}` : payload.text;
        onSend({
            ...payload,
            text: nextText
        });
        setIsWebSearchActive(false);
        setText('');
        setUploadedFiles([]);
        setShowReactChecklist(false);
        setPendingSend(null);
        setReactChecklist({ product: '', audience: '', sections: '', theme: '' });
    };

    const handleSend = () => {
        const hasInput = Boolean(text.trim()) || uploadedFiles.length > 0;
        if (!hasInput && !botTyping) return;
        if (botTyping && !hasInput) {
            handleStop();
            return;
        }
        if (botTyping && hasInput && onStop) {
            // If user already typed a new prompt, stop current run first,
            // then continue with the new send flow below.
            onStop();
        }

        if (text.length > 5000) {
            console.warn("Message too long (max 5000 chars)");
            alert("Message must be under 5000 characters.");
            return;
        }

        const payload = {
            text: text.trim(),
            files: uploadedFiles,
            isWebSearch: isWebSearchActive
        };

        const runtimeModeForGate = payload.isWebSearch ? 'research_pro' : resolveRuntimeChatMode(chatMode, payload.text);
        if (isAgentPremiumMode(runtimeModeForGate) && !canUseFullAgent) {
            if (isContinuationPayload(payload.text)) {
                alert('Agent continuation is available on Plus, Pro, or Business plans.');
                return;
            }

            const trialKey = `relyce_agent_free_count:${user?.uid || 'anon'}:${sessionId || 'nosession'}`;
            const usedCount = Number(localStorage.getItem(trialKey) || '0');
            if (usedCount >= 2) {
                alert('Free Agent limit reached for this chat (2 messages). Upgrade to Plus, Pro, or Business for unlimited Agent usage.');
                return;
            }
            localStorage.setItem(trialKey, String(usedCount + 1));
        }

        if (shouldPromptReactChecklist(payload.text) && !showReactChecklist) {
            setPendingSend(payload);
            setShowReactChecklist(true);
            return;
        }

        finalizeSend(payload);
    };


    const handleStop = () => {
        if (onStop) {
            onStop(); 
        }
    };

    const handleFileChange = async e => {
        const file = e.target.files[0];
        if (!file) return;

        const previewId = Date.now().toString();
        const filePreview = { id: previewId, name: file.name, size: file.size, type: file.type, file: file };
        setUploadedFiles(prev => [...prev, filePreview]);
        setDropdownOpen(false);
        e.target.value = '';
        e.preventDefault();
        e.stopPropagation();

        if (onFileUpload) {
            onFileUpload(file.name);
            try {
                if (!user) {
                    console.error('No user found, cannot upload file');
                    if (onFileUploadComplete) onFileUploadComplete(previewId, false);
                    return;
                }
                
                const firebaseUid = user.uid;
                const uniqueUserId = userProfile?.uniqueUserId || user.uid;
                
                const resp = await uploadChatFileToFirebase(firebaseUid, uniqueUserId, sessionId, file);
                
                if (onFileUploadComplete) {
                    onFileUploadComplete(previewId, resp.success, resp.fileName, resp.fileId);
                }
                
                setUploadedFiles(prev => prev.map(f => 
                    f.id === previewId ? { ...f, fileId: resp.fileId, ragReady: true } : f
                ));
                
            } catch (error) {
                console.error('File upload error:', error);
                setUploadError(`Failed to upload ${file.name}: ${error.message || 'Unknown error'}`);
                if (onFileUploadComplete) {
                    onFileUploadComplete(previewId, false);
                }
            }
        }
    };

    const removeFile = (fileId) => {
        setUploadedFiles(prev => prev.filter(file => file.id !== fileId));
    };

    const getFileIcon = (fileType) => {
        if (fileType.startsWith('image/')) {
            return <Image size={16} className="text-white/50" />;
        } else if (fileType === 'application/pdf') {
            return <FileText size={16} className="text-white/50" />;
        } else {
            return <FileText size={16} className="text-white/50" />;
        }
    };

    const handleWebSearch = () => {
        setIsWebSearchActive(!isWebSearchActive);
    };

    const toggleRecording = () => {
        if (!recognitionRef.current) return;
        if (isRecording) {
            recognitionRef.current.stop();
        } else {
            recognitionRef.current.start();
        }
        setIsRecording(!isRecording);
    };

    const handleVoiceClick = () => {
        toggleRecording();
        setDropdownOpen(false);
    };

    const toggleExpand = () => {
        const newState = !isExpanded;

        if (textareaRef.current) {
            if (newState) {
                setIsExpanded(true);
                setSkipAutoResize(true);
                textareaRef.current.style.height = '240px';
                textareaRef.current.style.overflowY = 'auto';
                setTimeout(() => setSkipAutoResize(false), 100);
            } else {
                setIsExpanded(false);
                setSkipAutoResize(true);

                const target = textareaRef.current;
                const maxHeight = 112; 
                const minHeight = 40;

                target.style.height = 'auto';
                const scrollHeight = target.scrollHeight;

                if (scrollHeight <= minHeight) {
                    target.style.height = `${minHeight}px`;
                    target.style.overflowY = 'hidden';
                } else if (scrollHeight <= maxHeight) {
                    target.style.height = `${scrollHeight}px`;
                    target.style.overflowY = 'hidden';
                } else {
                    target.style.height = `${maxHeight}px`;
                    target.style.overflowY = 'auto';
                }

                setTimeout(() => setSkipAutoResize(false), 100);
            }
        }
    };

    const autoResizeTextarea = (target) => {
        if (!target) return;
        if (skipAutoResize) return;
        if (isExpanded) {
            target.style.height = '240px';
            target.style.overflowY = 'auto';
            return;
        }

        const maxHeight = 112;
        const minHeight = 40;

        if (!target.value.trim()) {
            target.style.height = `${minHeight}px`;
            target.style.overflowY = 'hidden';
            setShowExpandButton(false);
            return;
        }

        const currentHeight = target.style.height;
        target.style.height = 'auto';
        const scrollHeight = target.scrollHeight;
        
        if (scrollHeight <= minHeight) {
            target.style.height = `${minHeight}px`;
            target.style.overflowY = 'hidden';
            setShowExpandButton(false);
        } else if (scrollHeight <= maxHeight) {
            target.style.height = `${scrollHeight}px`;
            target.style.overflowY = 'hidden';
            setShowExpandButton(false);
        } else {
            target.style.height = `${maxHeight}px`;
            target.style.overflowY = 'auto';
            setShowExpandButton(true);
        }
    };

    const handleTextareaChange = (e) => {
        const newValue = e.target.value;
        setText(newValue);

        if (textareaRef.current && prevTextRef.current !== newValue) {
            prevTextRef.current = newValue;
            if (textareaRef.current.resizeTimeout) {
                clearTimeout(textareaRef.current.resizeTimeout);
            }
            textareaRef.current.resizeTimeout = setTimeout(() => {
                if (textareaRef.current) {
                    autoResizeTextarea(textareaRef.current);
                }
            }, 50);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.style.height = '40px';
                textareaRef.current.style.overflowY = 'hidden';
            }
        }, 100);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (textareaRef.current && prevTextRef.current !== text) {
            if (textareaRef.current.resizeEffectTimeout) {
                clearTimeout(textareaRef.current.resizeEffectTimeout);
            }
            textareaRef.current.resizeEffectTimeout = setTimeout(() => {
                autoResizeTextarea(textareaRef.current);
            }, 100);
        }
    }, [text, isExpanded, skipAutoResize]);

    if (loading) {
        return (
            <div className="w-full flex flex-col items-center">
                <div className="relative flex items-center w-full max-w-4xl px-2 py-2 bg-[#0a0d14] border-t border-white/5">
                    <div className="flex-1 px-2 py-3 text-center"><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mx-auto"></div></div>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="w-full flex flex-col items-center">
                <div className="relative flex items-center w-full max-w-4xl px-4 py-4 bg-[#0a0d14] border-t border-white/5">
                    <div className="flex-1 text-center">
                        <p className="text-[11px] uppercase tracking-widest text-white/50">
                            Authentication Required. <button onClick={() => window.location.href = '/login'} className="text-white hover:underline transition-all">Authenticate</button>
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full flex flex-col items-center mobile-chat-input-container">
            <style>{`
                .custom-textarea-scrollbar::-webkit-scrollbar { width: 2px; }
                .custom-textarea-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .dark .custom-textarea-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(255,255,255,0.2); }
                .no-resize-handle { resize: none !important; }
                @media (max-width: 768px) {
                  .chat-input-container { width: 100% !important; }
                  .websearch-text { display: none; }
                  .mobile-chat-input-container {
                    padding-bottom: env(safe-area-inset-bottom);
                  }
                }
                @media (min-width: 769px) {
                  .chat-input-container { width: 100% !important; max-width: 980px !important; }
                }
            `}</style>

            {uploadError && (
                <div className="w-full max-w-[980px] mx-auto mb-2 chat-input-container">
                    <div className="p-3 border bg-red-900/10 border-red-500/20 text-red-400 text-xs tracking-wide flex items-center justify-between rounded-xl">
                        <span>{uploadError}</span>
                        <button onClick={() => setUploadError(null)} className="text-red-400 hover:text-red-300">
                            <X size={14} />
                        </button>
                    </div>
                </div>
            )}
            
            {uploadedFiles.length > 0 && (
                <div className="w-full max-w-[980px] mx-auto mb-2 chat-input-container">
                    <div className="p-3 bg-[#12141b] border border-white/10 rounded-xl">
                        <div className="flex flex-wrap gap-2">
                            {uploadedFiles.map((file) => (
                                <div key={file.id} className="flex items-center gap-3 px-3 py-2 border bg-white/[0.03] border-white/10 text-xs rounded-lg">
                                    <div className="text-white/50">{getFileIcon(file.type)}</div>
                                    <div className="flex-1 min-w-0"><div className="font-mono truncate text-white/80" title={file.name}>{file.name}</div></div>
                                    <button onClick={() => removeFile(file.id)} className="transition-all text-white/40 hover:text-white" title="Remove file"><X size={14} /></button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Main Input Area */}
            <div 
                ref={inputContainerRef}
                className={`relative flex flex-col w-full max-w-[980px] mx-auto bg-[#1a1d26]/95 border transition-all duration-300 rounded-[30px] backdrop-blur-xl ${
                isFocused
                  ? 'border-white/35 shadow-[0_18px_48px_rgba(0,0,0,0.45)]'
                  : 'border-white/15 hover:border-white/25 shadow-[0_12px_34px_rgba(0,0,0,0.35)]'
                }`}
            >
                
                {/* Web Search/Deep Toggle (Moved Inside Top) */}
                {effectiveMode === 'smart' && (
                <div className="flex items-center px-4 pt-3 pb-1 gap-2">
                    <button
                        type="button"
                        onClick={() => setIsWebSearchActive(!isWebSearchActive)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-transparent transition-all duration-300 text-[10px] tracking-wide ${
                          isWebSearchActive
                            ? 'bg-cyan-400/10 text-cyan-200 border-cyan-300/30'
                            : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-100'
                        }`}
                        title="Toggle Web Search"
                    >
                    <Globe size={12} className={isWebSearchActive ? 'text-white' : ''} />
                    <span>{isWebSearchActive ? 'Web On' : 'Web Search'}</span>
                    </button>
                </div>
                )}
                
                {showReactChecklist && (
                    <div className="mb-4 border border-white/10 bg-white/5 p-4">
                        <div className="flex items-center justify-between gap-3 mb-4">
                            <div>
                                <div className="text-[11px] uppercase tracking-widest font-mono text-white">Interface Requirements Checklist</div>
                            </div>
                            <button onClick={() => { setShowReactChecklist(false); setPendingSend(null); }} className="text-white/40 hover:text-white transition-all"><X size={16} /></button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <input value={reactChecklist.product} onChange={(e) => setReactChecklist(prev => ({ ...prev, product: e.target.value }))} placeholder="Product or app name" className="w-full bg-[#0a0d14] border border-white/10 px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/40 transition-all font-light" />
                            <input value={reactChecklist.audience} onChange={(e) => setReactChecklist(prev => ({ ...prev, audience: e.target.value }))} placeholder="Target audience" className="w-full bg-[#0a0d14] border border-white/10 px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/40 transition-all font-light" />
                            <input value={reactChecklist.sections} onChange={(e) => setReactChecklist(prev => ({ ...prev, sections: e.target.value }))} placeholder="Key sections (hero, features...)" className="w-full bg-[#0a0d14] border border-white/10 px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/40 transition-all font-light" />
                            <input value={reactChecklist.theme} onChange={(e) => setReactChecklist(prev => ({ ...prev, theme: e.target.value }))} placeholder="Theme or vibe (dark, minimal...)" className="w-full bg-[#0a0d14] border border-white/10 px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/40 transition-all font-light" />
                        </div>
                        <div className="mt-4 flex flex-wrap gap-3">
                            <button onClick={() => pendingSend && finalizeSend(pendingSend, { includeChecklist: true, useDefaults: true })} className="px-4 py-2 text-[10px] uppercase font-mono tracking-widest bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-all border border-transparent">
                                SKIP DETAILS
                            </button>
                            <button onClick={() => pendingSend && finalizeSend(pendingSend, { includeChecklist: true, useDefaults: false })} className="px-4 py-2 text-[10px] uppercase font-mono tracking-widest bg-white text-black hover:bg-white/90 transition-all border border-white">
                                INITIALIZE GENERATION
                            </button>
                        </div>
                    </div>
                )}

                <div className="flex items-center px-3 sm:px-4 py-2.5 sm:py-3.5 w-full gap-1">
                    {/* File Upload Button (Desktop) */}
                    <div className="relative static" ref={dropdownRef}>
                        <button onClick={() => setDropdownOpen(prev => !prev)} className="group p-2.5 rounded-full transition-all text-white/50 hover:text-white hover:bg-white/8" title="Add content">
                            <Plus size={16} className="transition-transform group-hover:rotate-90" />
                        </button>
                        {dropdownOpen && (
                            <div className="absolute bottom-[calc(100%+8px)] left-0 shadow-2xl py-2 w-56 z-50 bg-[#171923] border border-white/10 rounded-xl flex flex-col items-start animate-in fade-in slide-in-from-bottom-2 duration-200">
                                <button onClick={() => { fileInputRef.current.click(); setDropdownOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 transition-colors text-left text-[10px] font-mono uppercase tracking-widest hover:bg-white/5 text-zinc-300 hover:text-white border-b border-white/5">
                                    <Upload size={14} />
                                    <span>Upload Document</span>
                                </button>
                                <button onClick={() => { handleVoiceClick(); setDropdownOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 transition-colors text-left text-[10px] font-mono uppercase tracking-widest hover:bg-white/5 text-zinc-300 hover:text-white relative">
                                    <Mic size={14} />
                                    <span>Voice Dictation</span>
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex-1">
                        <textarea
                            ref={textareaRef}
                            value={text}
                            onChange={handleTextareaChange}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                            placeholder="Ask anything..."
                            maxLength={5000}
                            className="w-full text-sm md:text-base outline-none border-none custom-textarea-scrollbar leading-relaxed no-resize-handle bg-transparent text-zinc-100 placeholder-zinc-500 disabled:opacity-60 font-light"
                            style={{
                                minHeight: '44px',
                                height: '44px',
                                maxHeight: '240px',
                                resize: 'none',
                                overflowY: 'hidden',
                                boxSizing: 'border-box',
                                padding: '10px 0'
                            }}
                            disabled={showReactChecklist}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => setIsFocused(false)}
                        />
                    </div>
                    
                    <button 
                        onClick={handleSend} 
                        disabled={showReactChecklist || (!text.trim() && uploadedFiles.length === 0 && !botTyping)} 
                        className={`ml-2 flex-shrink-0 flex items-center justify-center w-[42px] h-[42px] rounded-full border border-white/10 transition-all duration-300 ${
                          (botTyping && (!text.trim() && uploadedFiles.length === 0))
                            ? 'bg-white/10 border-white/30 text-white hover:bg-white/20'
                            : (!text.trim() && uploadedFiles.length === 0) || showReactChecklist
                              ? 'bg-transparent text-white/20 cursor-not-allowed hidden sm:flex'
                              : 'bg-gradient-to-br from-zinc-300 to-zinc-500 text-black hover:from-white hover:to-zinc-300'
                        }`}
                    >
                        {(botTyping && (!text.trim() && uploadedFiles.length === 0))
                          ? <Square size={14} className="fill-current" />
                          : <Send size={14} className="ml-0.5" />}
                    </button>
                </div>

                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="application/pdf,.txt,.md,.csv,.json,.docx" className="hidden" />
            </div>

            <p className="text-[11px] font-sans tracking-wide text-center mt-3 px-4 leading-relaxed text-zinc-500 pb-1">
                Relyce AI can make mistakes. Consider verifying important information.
            </p>
        </div>
    );
}
