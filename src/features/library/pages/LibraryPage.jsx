import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { storage, db } from '../../../utils/firebaseConfig';
import { API_BASE_URL } from '../../../utils/api';
import { ref, uploadBytesResumable, getDownloadURL, listAll, deleteObject } from 'firebase/storage';
import {
    collection, doc, addDoc, setDoc, updateDoc, deleteDoc, getDocs,
    query, orderBy, serverTimestamp, onSnapshot
} from 'firebase/firestore';
import {
    Upload, FileText, Trash2, Send, ArrowLeft, Library as LibraryIcon, File,
    ChevronLeft, Loader2, MessageSquare, Plus, Briefcase, Globe, History,
    PlusCircle, PanelLeft, X, Database
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

// Theme matched with minimalist Chat UI
const MessageComponent = ({ msg, isUser }) => (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-8 animate-fade-in`}>
        <div className={`max-w-[85%] md:max-w-[75%] px-6 py-5 ${isUser 
            ? 'bg-white/[0.03] border border-white/5 text-white rounded-[2px]' 
            : 'bg-transparent text-zinc-300'
        }`}>
            {!isUser && (
                <div className="flex items-center gap-3 mb-4">
                    <img src="/logo.svg" alt="Relyce AI" className="w-5 h-5 opacity-80 grayscale" />
                    <span className="text-[10px] tracking-widest uppercase text-emerald-500/80 font-mono">Knowledge Node</span>
                </div>
            )}
            <div className="text-sm font-light leading-relaxed whitespace-pre-wrap">{msg.content}</div>
        </div>
    </div>
);

const TypingIndicator = () => (
    <div className="flex justify-start mb-8">
        <div className="max-w-[85%] px-6 py-5 bg-transparent">
            <div className="flex items-center gap-3 mb-3">
                <img src="/logo.svg" alt="Relyce AI" className="w-5 h-5 opacity-80 grayscale" />
                <span className="flex space-x-1.5 items-center">
                    <div className="w-1 h-1 bg-zinc-500 animate-pulse" style={{ animationDelay: '0ms' }} />
                    <div className="w-1 h-1 bg-zinc-500 animate-pulse" style={{ animationDelay: '150ms' }} />
                    <div className="w-1 h-1 bg-zinc-500 animate-pulse" style={{ animationDelay: '300ms' }} />
                </span>
            </div>
        </div>
    </div>
);

const ModeSelector = ({ mode, onModeChange }) => (
    <div className="flex items-center gap-1 p-1 bg-[#0a0d14] border border-white/5 rounded-[2px]">
        <button
            onClick={() => onModeChange('general')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-[2px] text-[10px] font-mono tracking-widest uppercase transition-all duration-300 ${mode === 'general'
                ? 'bg-white/10 text-white'
                : 'text-zinc-600 hover:text-white hover:bg-white/[0.02]'
            }`}
        >
            <Globe size={12} strokeWidth={1.5} />
            <span className="hidden sm:inline">General</span>
        </button>
        <button
            onClick={() => onModeChange('business')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-[2px] text-[10px] font-mono tracking-widest uppercase transition-all duration-300 ${mode === 'business'
                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                : 'text-zinc-600 hover:text-white hover:bg-white/[0.02]'
            }`}
        >
            <Briefcase size={12} strokeWidth={1.5} />
            <span className="hidden sm:inline">Business</span>
        </button>
    </div>
);

const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m`;
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffHours < 24) return `${diffHours}h`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const ChatSessionItem = ({ session, isActive, onClick, onDelete }) => (
    <div
        onClick={onClick}
        className={`group flex items-center justify-between px-6 py-3 cursor-pointer border-l-[1px] transition-all duration-300 ${isActive 
            ? 'bg-white/[0.03] border-white/20 text-white' 
            : 'border-transparent hover:bg-white/[0.02] text-zinc-500 hover:text-zinc-300'
        }`}
    >
        <div className="flex items-center gap-3 overflow-hidden">
            <div className={`w-1.5 h-1.5 ${isActive ? 'bg-white' : 'bg-transparent border border-white/30'} flex-shrink-0 transition-all`} />
            <span className="text-xs tracking-wide truncate">{session.name || 'New Chat'}</span>
        </div>
        <button
            onClick={(e) => { e.stopPropagation(); onDelete(session.id); }}
            className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-600 hover:text-red-400 transition-all"
        >
            <Trash2 size={12} strokeWidth={1.5} />
        </button>
    </div>
);

export default function LibraryPage() {
    const { currentUser: user, userProfile, loading: authLoading } = useAuth();
    const navigate = useNavigate();

    const [files, setFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [loadingFiles, setLoadingFiles] = useState(true);

    const [sessions, setSessions] = useState([]);
    const [currentSessionId, setCurrentSessionId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loadingSessions, setLoadingSessions] = useState(true);

    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [chatMode, setChatMode] = useState('general');

    const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
    const [dragOver, setDragOver] = useState(false);
    const [activeTab, setActiveTab] = useState('files');

    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);

    const userId = user?.uid;
    const storageUserId = userProfile?.uniqueUserId || user?.uid;

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length]);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    useEffect(() => {
        if (!userId) {
            setSessions([]);
            setLoadingSessions(false);
            return;
        }

        const sessionsRef = collection(db, 'users', userId, 'librarySessions');
        const q = query(sessionsRef, orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const sessionList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setSessions(sessionList);
            setLoadingSessions(false);

            if (!currentSessionId && sessionList.length > 0) {
                setCurrentSessionId(sessionList[0].id);
            }
        }, (error) => {
            console.error('Error loading sessions:', error);
            setLoadingSessions(false);
        });

        return () => unsubscribe();
    }, [userId]);

    useEffect(() => {
        if (!userId || !currentSessionId) {
            setMessages([]);
            return;
        }

        const messagesRef = collection(db, 'users', userId, 'librarySessions', currentSessionId, 'messages');
        const q = query(messagesRef, orderBy('createdAt', 'asc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setMessages(msgList);
            
            // Auto scroll on new messages
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        });

        return () => unsubscribe();
    }, [userId, currentSessionId]);

    const loadFiles = useCallback(async () => {
        if (!storageUserId) return;
        setLoadingFiles(true);
        try {
            const storageRef = ref(storage, `library/users/${storageUserId}`);
            const result = await listAll(storageRef);
            const fileList = await Promise.all(
                result.items.map(async (item) => {
                    const url = await getDownloadURL(item);
                    return { name: item.name, fullPath: item.fullPath, url };
                })
            );
            setFiles(fileList);
        } catch (error) {
            console.error('Error loading files:', error);
            setFiles([]);
        } finally {
            setLoadingFiles(false);
        }
    }, [storageUserId]);

    useEffect(() => {
        if (storageUserId) loadFiles();
    }, [storageUserId, loadFiles]);

    const createNewSession = async () => {
        if (!userId) return null;
        const newSessionId = crypto.randomUUID();
        const sessionRef = doc(db, 'users', userId, 'librarySessions', newSessionId);

        try {
            await setDoc(sessionRef, {
                name: 'New Chat',
                mode: chatMode,
                messageCount: 0,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            setCurrentSessionId(newSessionId);
            setMessages([]);
            
            if (window.innerWidth < 768) setSidebarOpen(false);
            
            return newSessionId;
        } catch (error) {
            console.error('Error creating session:', error);
            return null;
        }
    };

    const deleteSession = async (sessionId) => {
        if (!userId || !window.confirm('Purge this conversational flow?')) return;
        try {
            const messagesRef = collection(db, 'users', userId, 'librarySessions', sessionId, 'messages');
            const msgSnapshot = await getDocs(messagesRef);
            for (const msgDoc of msgSnapshot.docs) {
                await deleteDoc(msgDoc.ref);
            }
            await deleteDoc(doc(db, 'users', userId, 'librarySessions', sessionId));

            if (currentSessionId === sessionId) {
                setCurrentSessionId(sessions.length > 1 ? sessions.find(s => s.id !== sessionId)?.id : null);
            }
        } catch (error) {
            console.error('Error deleting session:', error);
        }
    };

    const addMessage = async (role, content, sessionId) => {
        if (!userId || !sessionId) return;
        try {
            const messagesRef = collection(db, 'users', userId, 'librarySessions', sessionId, 'messages');
            await addDoc(messagesRef, {
                role,
                content,
                createdAt: serverTimestamp()
            });

            const sessionRef = doc(db, 'users', userId, 'librarySessions', sessionId);
            const updates = {
                updatedAt: serverTimestamp(),
                messageCount: messages.length + 1
            };

            if (role === 'user' && messages.length === 0) {
                updates.name = content.slice(0, 40) + (content.length > 40 ? '...' : '');
                updates.mode = chatMode;
            }

            await updateDoc(sessionRef, updates);
        } catch (error) {
            console.error('Error adding message:', error);
        }
    };

    const handleFileUpload = async (file) => {
        if (!storageUserId || !file) return;

        const allowedTypes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/csv', 'text/plain', 'text/html'
        ];

        if (!allowedTypes.includes(file.type) && !file.name.endsWith('.txt') && !file.name.endsWith('.md')) {
            alert('Unsupported file type.');
            return;
        }

        setUploading(true);
        setUploadProgress(0);

        try {
            const storageRef = ref(storage, `library/users/${storageUserId}/${file.name}`);
            const uploadTask = uploadBytesResumable(storageRef, file);

            uploadTask.on('state_changed',
                (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
                (error) => { console.error('Upload error:', error); setUploading(false); alert('Upload failed.'); },
                async () => { setUploading(false); setUploadProgress(0); await loadFiles(); }
            );
        } catch (error) {
            console.error('Upload error:', error);
            setUploading(false);
        }
    };

    const handleDeleteFile = async (file) => {
        if (!window.confirm(`Delete "${file.name}"?`)) return;
        try {
            const fileRef = ref(storage, file.fullPath);
            await deleteObject(fileRef);
            await loadFiles();
        } catch (error) {
            console.error('Delete error:', error);
            alert('Failed to delete file.');
        }
    };

    const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
    const handleDragLeave = () => setDragOver(false);
    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        const droppedFiles = Array.from(e.dataTransfer.files);
        if (droppedFiles.length > 0) handleFileUpload(droppedFiles[0]);
    };

    const handleSend = async () => {
        const text = inputText.trim();
        if (!text || files.length === 0) {
            if (files.length === 0) alert('Please upload at least one file to chat with.');
            return;
        }

        setInputText('');
        setIsTyping(true);

        let activeSessionId = currentSessionId;
        if (!activeSessionId) {
            activeSessionId = await createNewSession();
            if (!activeSessionId) {
                setIsTyping(false);
                alert('Failed to create session');
                return;
            }
        }

        await addMessage('user', text, activeSessionId);

        try {
            const response = await fetch(`${API_BASE_URL}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    user_id: storageUserId,
                    session_id: activeSessionId,
                    chat_mode: chatMode === 'business' ? 'agent' : 'smart'
                })
            });

            const data = await response.json();
            await addMessage('assistant', data.response || data.answer || data.detail || 'Could not process request.', activeSessionId);
        } catch (error) {
            console.error('Chat error:', error);
            await addMessage('assistant', 'System Error: Backend connection failed.', activeSessionId);
        } finally {
            setIsTyping(false);
        }
    };

    const getFileIcon = (fileName) => {
        return <FileText size={14} className="text-zinc-500" strokeWidth={1.5} />;
    };

    if (authLoading) {
        return (
            <div className="flex h-screen w-full bg-[#0a0d14] items-center justify-center">
                <div className="text-[10px] uppercase font-mono tracking-widest text-zinc-600 animate-pulse">Initializing Interface...</div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="flex h-screen w-full bg-[#0a0d14] text-white overflow-hidden justify-center items-center">
                <div className="text-center">
                    <Database size={32} className="mx-auto text-zinc-600 mb-6 opacity-50" strokeWidth={1} />
                    <h2 className="text-sm tracking-widest uppercase mb-6 font-mono text-zinc-400">Restricted Access</h2>
                    <button onClick={() => navigate('/login')} className="px-8 py-3 text-[11px] font-mono tracking-widest uppercase border border-white/10 hover:bg-white text-white hover:text-black transition-all duration-300 rounded-[2px]">
                        Authenticate
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen w-full bg-[#0a0d14] text-white font-sans overflow-hidden">
            <Helmet><title>Knowledge Engine | Relyce AI</title></Helmet>

            <style>{`
                .chat-history-scroll::-webkit-scrollbar { width: 2px; }
                .chat-history-scroll::-webkit-scrollbar-track { background: transparent; }
                .chat-history-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); }
                .chat-history-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.3); }
                .chat-history-scroll { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.1) transparent; }
            `}</style>

            {/* Ambient Lighting */}
            <div className="fixed inset-0 pointer-events-none opacity-[0.02] mix-blend-overlay z-0" 
                 style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }}>
            </div>
            <div className="fixed top-[60%] -left-[10%] w-[40vw] h-[40vw] bg-emerald-500/[0.02] rounded-full blur-[120px] mix-blend-screen pointer-events-none z-0" />

            {/* Mobile Overlay */}
            {sidebarOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
            )}

            {/* Sidebar */}
            <aside className={`
                fixed md:relative inset-y-0 left-0 z-50
                w-72 md:w-80 flex-shrink-0
                transform transition-transform duration-300 ease-in-out
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:hidden'}
                bg-[#0a0d14] border-r border-white/5 flex flex-col
            `}>
                {/* Header */}
                <div className="flex items-center justify-between p-6 mb-2">
                    <button onClick={() => navigate('/workspace?tab=files')} className="text-zinc-500 hover:text-white transition-colors" title="Back to Workspace">
                        <ArrowLeft size={16} />
                    </button>
                    <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-white/50">LIBRARY LOGS</span>
                    <button onClick={() => setSidebarOpen(false)} className="md:hidden text-zinc-500 hover:text-white">
                        <X size={16} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex px-6 mb-6">
                    <button
                        onClick={() => setActiveTab('files')}
                        className={`flex-1 pb-2 text-[10px] font-mono tracking-widest uppercase transition-all border-b ${activeTab === 'files' ? 'border-white text-white' : 'border-white/10 text-zinc-600 hover:text-zinc-300'}`}
                    >
                        Index
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex-1 pb-2 text-[10px] font-mono tracking-widest uppercase transition-all border-b ${activeTab === 'history' ? 'border-white text-white' : 'border-white/10 text-zinc-600 hover:text-zinc-300'}`}
                    >
                        History
                    </button>
                </div>

                {activeTab === 'files' ? (
                    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                        {/* Minimal Upload Button */}
                        <div className="px-6 mb-6">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                className="w-full flex items-center justify-center gap-2 py-3 border border-white/10 hover:border-white/30 text-[10px] font-mono tracking-widest uppercase transition-all duration-300 text-zinc-300 hover:text-white bg-white/[0.01]"
                            >
                                {uploading ? <Loader2 size={14} className="animate-spin text-emerald-500" /> : <Plus size={14} />}
                                {uploading ? `${Math.round(uploadProgress)}%` : 'Add File'}
                            </button>
                            <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.docx,.pptx,.xlsx,.csv,.txt,.md,.html"
                                onChange={(e) => { if (e.target.files[0]) { handleFileUpload(e.target.files[0]); e.target.value = ''; } }}
                            />
                        </div>

                        {/* File List */}
                        <div className="flex-1 overflow-y-auto chat-history-scroll pb-6">
                            <h3 className="px-6 text-[10px] uppercase font-mono tracking-widest text-white/30 mb-2">VECTORS ({files.length})</h3>
                            {loadingFiles ? (
                                <div className="flex justify-center py-8"><Loader2 size={16} className="animate-spin text-zinc-600" /></div>
                            ) : files.length === 0 ? (
                                <div className="px-6 py-8 text-center text-xs text-zinc-600 font-mono uppercase">Empty Index</div>
                            ) : (
                                <ul className="flex flex-col">
                                    {files.map((file, idx) => (
                                        <li key={idx} className="group relative border-l-2 border-transparent hover:bg-white/[0.02] hover:border-white/20 px-6 py-3 transition-colors">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3 overflow-hidden">
                                                    {getFileIcon(file.name)}
                                                    <span className="text-xs text-zinc-400 group-hover:text-zinc-300 truncate tracking-wide">{file.name}</span>
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteFile(file)}
                                                    className="opacity-0 group-hover:opacity-100 p-1 text-zinc-600 hover:text-red-400 transition-opacity"
                                                >
                                                    <Trash2 size={12} strokeWidth={1.5} />
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                        <div className="px-6 mb-6">
                            <button
                                onClick={createNewSession}
                                className="w-full py-3 bg-white text-black text-[10px] font-mono tracking-widest uppercase hover:bg-zinc-200 transition-colors"
                            >
                                Init Sequence
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto chat-history-scroll pb-6">
                            <h3 className="px-6 text-[10px] uppercase font-mono tracking-widest text-white/30 mb-2">SESSIONS</h3>
                            {loadingSessions ? (
                                <div className="flex justify-center py-8"><Loader2 size={16} className="animate-spin text-zinc-600" /></div>
                            ) : sessions.length === 0 ? (
                                <div className="px-6 py-8 text-center text-xs text-zinc-600 font-mono uppercase">No sequences found</div>
                            ) : (
                                <div className="flex flex-col">
                                    {sessions.map((session) => (
                                        <ChatSessionItem
                                            key={session.id}
                                            session={session}
                                            isActive={currentSessionId === session.id}
                                            onClick={() => { setCurrentSessionId(session.id); setChatMode(session.mode || 'general'); if(window.innerWidth < 768) setSidebarOpen(false); }}
                                            onDelete={deleteSession}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </aside>

            {/* Main Chat Area */}
            <main className="flex-1 flex flex-col relative min-w-0 z-10 w-full">
                {/* Header Match */}
                <header className="flex-shrink-0 h-16 border-b border-white/5 bg-transparent backdrop-blur-md flex items-center justify-between px-6 z-20">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="text-zinc-500 hover:text-white transition-colors"
                        >
                            <PanelLeft size={16} strokeWidth={1.5} />
                        </button>
                        <span className="font-light tracking-wide text-sm">Knowledge Base Engine</span>
                        <div className="hidden sm:flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                            <span className="text-[10px] font-mono tracking-widest uppercase text-emerald-500/80">Active</span>
                        </div>
                    </div>
                    <ModeSelector mode={chatMode} onModeChange={setChatMode} />
                </header>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto chat-history-scroll relative">
                    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8 md:py-12">
                        {messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
                                <Database size={48} className="text-zinc-800 mb-8" strokeWidth={1} />
                                <h1 className="text-3xl font-light tracking-tight mb-4">Awaiting Query...</h1>
                                <p className="text-sm font-light text-zinc-500 max-w-md">
                                    Connected to {files.length} indexed object{files.length !== 1 && 's'}. Switch modes or start typing to extract semantics.
                                </p>
                                {files.length === 0 && (
                                    <button onClick={() => { setActiveTab('files'); setSidebarOpen(true); }}
                                        className="mt-8 px-6 py-3 border border-white/10 hover:bg-white/5 transition-colors text-xs font-mono uppercase tracking-widest text-zinc-300">
                                        Mount Data
                                    </button>
                                )}
                            </div>
                        ) : (
                            <>
                                {messages.map((msg) => (
                                    <MessageComponent key={msg.id} msg={msg} isUser={msg.role === 'user'} />
                                ))}
                                {isTyping && <TypingIndicator />}
                                <div ref={messagesEndRef} className="h-4" />
                            </>
                        )}
                    </div>
                </div>

                {/* Input Area */}
                <div className="flex-shrink-0 w-full pt-4 pb-6 px-4 md:px-8">
                    <div className="max-w-4xl mx-auto relative group">
                        <div className="absolute inset-0 bg-white/[0.02] border border-white/10 group-focus-within:border-white/30 rounded-[2px] transition-colors duration-300 pointer-events-none" />
                        <div className="relative flex items-center bg-[#0a0d14]/50 backdrop-blur-md rounded-[2px] overflow-hidden">
                            <textarea
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                onKeyDown={(e) => { 
                                    if (e.key === 'Enter' && !e.shiftKey) { 
                                        e.preventDefault(); 
                                        handleSend(); 
                                    } 
                                }}
                                placeholder={files.length > 0 ? "Enter contextual query..." : "Requires data index to query..."}
                                disabled={files.length === 0}
                                className="flex-1 bg-transparent text-white placeholder-zinc-600 outline-none resize-none pt-4 pb-3 px-6 max-h-[150px] min-h-[56px] text-sm font-light leading-relaxed"
                                rows={1}
                            />
                            <div className="pr-4 py-3 self-end flex-shrink-0">
                                <button
                                    onClick={handleSend}
                                    disabled={!inputText.trim() || files.length === 0 || isTyping}
                                    className={`flex items-center justify-center p-2 transition-all duration-300 ${
                                        inputText.trim() && files.length > 0 && !isTyping
                                        ? 'bg-white text-black hover:bg-zinc-200 shadow-[0_0_15px_rgba(255,255,255,0.3)]'
                                        : 'bg-transparent text-zinc-600 pointer-events-none'
                                    }`}
                                >
                                    <Send size={16} strokeWidth={1.5} />
                                </button>
                            </div>
                        </div>
                        {files.length > 0 && (
                            <div className="absolute -bottom-6 left-0 right-0 text-center">
                                <span className="text-[9px] font-mono tracking-widest text-zinc-600 uppercase">Knowledge Base Chat Engine active</span>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}


