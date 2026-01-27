import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Edit2, Trash2, Plus, Shield, Sparkles } from 'lucide-react';
import ChatService from '../../../services/chatService';
import { useAuth } from '../../../context/AuthContext';

const PersonalitiesPage = () => {
    const navigate = useNavigate();
    const { currentUser: user } = useAuth();
    const [personalities, setPersonalities] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchPersonalities = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const uid = user.uid;
            const res = await ChatService.getPersonalities(uid);
            if (res.success) {
                setPersonalities(res.personalities);
            }
        } catch (error) {
            console.error("Failed to load personalities", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchPersonalities();
        }
    }, [user]);

    const handleDelete = async (e, p) => {
        e.stopPropagation();
        if (window.confirm(`Delete "${p.name}"?`)) {
            try {
                const uid = user.uid;
                const success = await ChatService.deletePersonality(uid, p.id);
                if (success) {
                    fetchPersonalities();
                }
            } catch (error) {
                console.error("Failed to delete", error);
            }
        }
    };

    const handleEdit = (e, p) => {
        e.stopPropagation();
        navigate(`/personalities/edit/${p.id}`);
    };

    return (
        <div className="min-h-screen pt-20 pb-12 bg-black text-white">
            <div className="max-w-4xl mx-auto px-4 sm:px-6">
                
                {/* Header */}
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-white">
                            Personas
                        </h1>
                        <p className="text-zinc-500 text-sm mt-1">
                            Manage your AI personalities
                        </p>
                    </div>
                    
                    <button
                        onClick={() => navigate('/personalities/create')}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-black font-semibold text-sm hover:bg-emerald-400 transition-colors"
                    >
                        <Plus size={18} strokeWidth={2.5} />
                        <span className="hidden sm:inline">New Persona</span>
                    </button>
                </div>

                {/* List */}
                {loading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-20 rounded-lg animate-pulse bg-zinc-900" />
                        ))}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {personalities.map(p => {
                            const isSystemLocked = p.is_system === true;
                            const isEditable = !isSystemLocked;
                            
                            return (
                                <div 
                                    key={p.id} 
                                    className="group flex items-center gap-4 p-4 rounded-lg bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700 transition-colors"
                                >
                                    {/* Avatar */}
                                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-lg font-bold shrink-0
                                        ${isSystemLocked 
                                            ? 'bg-blue-500/20 text-blue-400' 
                                            : 'bg-emerald-500/20 text-emerald-400'
                                        }`}
                                    >
                                        {p.name.charAt(0).toUpperCase()}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold text-white truncate">
                                                {p.name}
                                            </h3>
                                            {isSystemLocked && (
                                                <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                                    <Shield size={10} /> System
                                                </span>
                                            )}
                                            {p.is_default && !isSystemLocked && (
                                                <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                                    <Sparkles size={10} /> Template
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-zinc-500 truncate mt-0.5">
                                            {p.description}
                                        </p>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {isEditable ? (
                                            <>
                                                {!p.is_default && (
                                                    <button 
                                                        onClick={(e) => handleDelete(e, p)}
                                                        className="p-2 rounded-lg hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                                <button 
                                                    onClick={(e) => handleEdit(e, p)}
                                                    className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                            </>
                                        ) : (
                                            <span className="text-xs text-zinc-600 px-2">
                                                Locked
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Empty state */}
                        {personalities.length === 0 && (
                            <div className="text-center py-12 text-zinc-500">
                                <User size={40} className="mx-auto mb-4 opacity-30" />
                                <p>No personas yet</p>
                                <button
                                    onClick={() => navigate('/personalities/create')}
                                    className="mt-4 text-emerald-400 hover:text-emerald-300 text-sm font-medium"
                                >
                                    Create your first persona →
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PersonalitiesPage;
