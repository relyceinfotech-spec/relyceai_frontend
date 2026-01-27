import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import ChatService from '../../../services/chatService';
import { ArrowLeft, Save, Sparkles, Globe, Brain, Zap } from 'lucide-react';

const PersonalityEditorPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { currentUser: user } = useAuth();
    
    // Form State
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [prompt, setPrompt] = useState('');
    const [contentMode, setContentMode] = useState('hybrid');
    const [isSystemPersona, setIsSystemPersona] = useState(false);
    
    // UI State
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const isEditing = !!id;

    useEffect(() => {
        const loadPersonality = async () => {
            if (!user) return;
            
            if (isEditing) {
                setLoading(true);
                try {
                    const res = await ChatService.getPersonalities(user.uid);
                    if (res.success) {
                        const persona = res.personalities.find(p => p.id === id);
                        if (persona) {
                            setName(persona.name);
                            setDescription(persona.description);
                            setPrompt(persona.prompt);
                            setContentMode(persona.content_mode || 'hybrid');
                            setIsSystemPersona(persona.is_system === true);
                        } else {
                            setError("Persona not found");
                        }
                    }
                } catch (err) {
                    setError("Failed to load persona");
                    console.error(err);
                } finally {
                    setLoading(false);
                }
            } else {
                // Default values for new persona
                setPrompt(`You are a helpful AI assistant named [Name].
Talk like a friendly expert.
Keep answers concise and helpful.`);
                setLoading(false);
            }
        };

        loadPersonality();
    }, [id, user, isEditing]);

    const handleSave = async () => {
        if (!name.trim()) {
            alert("Please enter a name");
            return;
        }

        setSaving(true);
        try {
            let result;
            if (isEditing) {
                result = await ChatService.updatePersonality(
                    user.uid, 
                    id, 
                    name, 
                    description, 
                    prompt, 
                    contentMode
                );
            } else {
                result = await ChatService.createPersonality(
                    user.uid, 
                    name, 
                    description, 
                    prompt, 
                    contentMode
                );
            }

            if (result.success) {
                navigate('/personalities');
            } else {
                alert("Failed to save: " + (result.error || "Unknown error"));
            }
        } catch (err) {
            console.error(err);
            alert("An error occurred while saving");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center text-zinc-400">
                <p>{error}</p>
                <button onClick={() => navigate('/personalities')} className="mt-4 text-emerald-400">
                    Go Back
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-zinc-100 flex flex-col">
            
            {/* Header */}
            <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-zinc-800">
                <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => navigate('/personalities')}
                            className="p-2 -ml-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <h1 className="font-bold text-lg">
                            {isEditing ? 'Edit Persona' : 'Create Persona'}
                        </h1>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8">
                <div className="space-y-8">
                    
                    {/* Primary Info */}
                    <section className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-zinc-400 mb-2">
                                Name
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g., Coding Buddy"
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all font-medium"
                                disabled={isSystemPersona && !user?.isAdmin} 
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-zinc-400 mb-2">
                                Short Description
                            </label>
                            <input
                                type="text"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="A brief tagline for this persona..."
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                            />
                        </div>
                    </section>

                    {/* Content Mode Selector */}
                    {!isSystemPersona && (
                        <section>
                            <label className="block text-sm font-medium text-zinc-400 mb-3">
                                Behavior Mode
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {/* Hybrid Mode */}
                                <button
                                    onClick={() => setContentMode('hybrid')}
                                    className={`relative p-4 rounded-xl border text-left transition-all duration-200
                                        ${contentMode === 'hybrid' 
                                            ? 'bg-emerald-500/10 border-emerald-500/50 ring-1 ring-emerald-500/50' 
                                            : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800'
                                        }`}
                                >
                                    <div className={`mb-2 ${contentMode === 'hybrid' ? 'text-emerald-400' : 'text-zinc-400'}`}>
                                        <Sparkles size={20} />
                                    </div>
                                    <h3 className={`font-semibold text-sm mb-1 ${contentMode === 'hybrid' ? 'text-emerald-300' : 'text-zinc-300'}`}>
                                        Smart Hybrid
                                    </h3>
                                    <p className="text-xs text-zinc-500 leading-relaxed">
                                        Intelligently switches between internal knowledge and web search.
                                    </p>
                                </button>

                                {/* Web Search Only */}
                                <button
                                    onClick={() => setContentMode('web_search')}
                                    className={`relative p-4 rounded-xl border text-left transition-all duration-200
                                        ${contentMode === 'web_search' 
                                            ? 'bg-blue-500/10 border-blue-500/50 ring-1 ring-blue-500/50' 
                                            : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800'
                                        }`}
                                >
                                    <div className={`mb-2 ${contentMode === 'web_search' ? 'text-blue-400' : 'text-zinc-400'}`}>
                                        <Globe size={20} />
                                    </div>
                                    <h3 className={`font-semibold text-sm mb-1 ${contentMode === 'web_search' ? 'text-blue-300' : 'text-zinc-300'}`}>
                                        Web Search
                                    </h3>
                                    <p className="text-xs text-zinc-500 leading-relaxed">
                                        Prioritizes live web results for every query.
                                    </p>
                                </button>

                                {/* LLM Only */}
                                <button
                                    onClick={() => setContentMode('llm_only')}
                                    className={`relative p-4 rounded-xl border text-left transition-all duration-200
                                        ${contentMode === 'llm_only' 
                                            ? 'bg-purple-500/10 border-purple-500/50 ring-1 ring-purple-500/50' 
                                            : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800'
                                        }`}
                                >
                                    <div className={`mb-2 ${contentMode === 'llm_only' ? 'text-purple-400' : 'text-zinc-400'}`}>
                                        <Brain size={20} />
                                    </div>
                                    <h3 className={`font-semibold text-sm mb-1 ${contentMode === 'llm_only' ? 'text-purple-300' : 'text-zinc-300'}`}>
                                        Pure LLM
                                    </h3>
                                    <p className="text-xs text-zinc-500 leading-relaxed">
                                        Uses internal knowledge only. Fast and focused.
                                    </p>
                                </button>
                            </div>
                        </section>
                    )}

                    {/* System Prompt */}
                    <section className="flex-1 flex flex-col min-h-[400px]">
                        <label className="block text-sm font-medium text-zinc-400 mb-2 flex items-center justify-between">
                            <span>System Instructions</span>
                            <span className="text-xs text-zinc-600 bg-zinc-900 px-2 py-1 rounded">Markdown Supported</span>
                        </label>
                        <div className="flex-1 relative group">
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="Define how your AI should behave..."
                                className="w-full h-full min-h-[400px] bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-sm font-mono text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-emerald-500/30 focus:bg-zinc-900 focus:ring-1 focus:ring-emerald-500/30 transition-all resize-none leading-relaxed"
                                spellCheck={false}
                            />
                            {/* Gradient hint */}
                            <div className="absolute bottom-4 right-4 text-[10px] text-zinc-600 pointer-events-none opacity-50">
                                {prompt.length} chars
                            </div>
                        </div>
                    </section>

                    {/* Footer Actions */}
                    <div className="pt-6 border-t border-zinc-800 flex items-center justify-end gap-3 sticky bottom-0 bg-black/90 pb-8 backdrop-blur sm:static sm:bg-transparent sm:pb-0">
                        <button
                            onClick={() => navigate('/personalities')}
                            className="px-6 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving || !name.trim()}
                            className="flex items-center gap-2 px-8 py-2.5 rounded-lg bg-emerald-500 text-black font-bold text-sm hover:bg-emerald-400 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                        >
                            {saving ? (
                                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                            ) : (
                                <Save size={16} />
                            )}
                            Save Persona
                        </button>
                    </div>

                </div>
            </main>
        </div>
    );
};

export default PersonalityEditorPage;
