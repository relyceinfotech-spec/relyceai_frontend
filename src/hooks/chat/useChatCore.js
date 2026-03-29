import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import ChatService from '../../services/chatService';
import { isAssistantLikeRole } from './useChatUtils';
import { normalizeChatModeSelection } from '../../features/chat/utils/chatMode.js';


export default function useChatCore({
    currentSessionId,
    userId,
    externalChatMode,
    externalOnChatModeChange,
    userProfile,
    externalActivePersonality,
    externalSetActivePersonality,
    externalPersonalities
}) {
    const { currentUser: user } = useAuth();
    const { theme } = useTheme();

    // State
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [previousSessionId, setPreviousSessionId] = useState(null);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [backendConnected, setBackendConnected] = useState(false); // Renamed from wsConnected
    const [botTyping, setBotTyping] = useState(false);
    const [isReconnecting, setIsReconnecting] = useState(false);
    const [currentMessageId, setCurrentMessageId] = useState(null);
    const [userUniqueId, setUserUniqueId] = useState(null);
    const [showScrollToBottom, setShowScrollToBottom] = useState(false);
    const [internalChatMode, setInternalChatMode] = useState('auto');
    const [isDeepSearchActive, setIsDeepSearchActive] = useState(false);
    const [fileUploads, setFileUploads] = useState({});
    
    // Personality State (Internal)
    const [internalPersonalities, setInternalPersonalities] = useState([]);
    const [internalActivePersonality, setInternalActivePersonality] = useState(null);

    // Derived State
    const chatMode = normalizeChatModeSelection(externalChatMode !== undefined ? externalChatMode : internalChatMode);
    const baseSetChatMode = externalOnChatModeChange !== undefined ? externalOnChatModeChange : setInternalChatMode;
    const setChatMode = useCallback(
        (nextMode) => baseSetChatMode(normalizeChatModeSelection(nextMode)),
        [baseSetChatMode]
    );

    const personalities = externalPersonalities !== undefined ? externalPersonalities : internalPersonalities;
    const setPersonalities = externalPersonalities !== undefined ? (() => {}) : setInternalPersonalities;

    const activePersonality = externalActivePersonality !== undefined ? externalActivePersonality : internalActivePersonality;
    const setActivePersonality = externalSetActivePersonality !== undefined ? externalSetActivePersonality : setInternalActivePersonality;

    // Refs
    const messagesRef = useRef(messages);
    const messagesContainerRef = useRef(null);

    useEffect(() => { messagesRef.current = messages; }, [messages]);

    // Group messages into pairs
    const messagePairs = useMemo(() => {
        const pairs = [];
        let currentPair = null;
        messages.forEach((msg) => {
            if (msg.role === 'user') {
                if (currentPair) pairs.push(currentPair);
                currentPair = { question: msg, answer: null, id: msg.id };
            } else if (isAssistantLikeRole(msg.role) && currentPair) {
                currentPair.answer = msg;
            }
        });
        if (currentPair) pairs.push(currentPair);
        return pairs;
    }, [messages]);

    // Fetch user's unique ID - optimized to use profile first
    useEffect(() => {
        // Use uniqueUserId from userProfile if available (already fetched)
        const effectiveUserId = userProfile?.uniqueUserId;
        if (effectiveUserId) {
            setUserUniqueId(effectiveUserId);
            ChatService.setUserId(effectiveUserId);
            ChatService.setUniqueUserId(effectiveUserId);
            return;
        }
        
        // Fallback: only fetch if not available in profile
        if (userId) {
            ChatService.getUserUniqueId(userId).then(uniqueId => {
                if (uniqueId) {
                    setUserUniqueId(uniqueId);
                    ChatService.setUserId(uniqueId);
                    ChatService.setUniqueUserId(uniqueId);
                }
            }).catch(() => { /* silent */ });
        }
    }, [userProfile?.uniqueUserId, userId]);

    // Fetch Personalities when userUniqueId is available (Only if using internal state)
    useEffect(() => {
        if (userUniqueId && externalPersonalities === undefined) {
            ChatService.getPersonalities(userUniqueId).then(result => {
                if (result.success && result.personalities) {
                    setInternalPersonalities(result.personalities);
                    // Set default active if none selected
                    if (!internalActivePersonality) {
                        const def = result.personalities.find(p => p.is_default && p.id === 'default_relyce') || result.personalities[0];
                        setInternalActivePersonality(def);
                    }
                }
            });
        }
    }, [userUniqueId, externalPersonalities]);

    // Backend connection is tracked via WebSocket events

    return {
        messages, setMessages,
        loading, setLoading,
        previousSessionId, setPreviousSessionId,
        isTransitioning, setIsTransitioning,
        wsConnected: backendConnected, setWsConnected: setBackendConnected, // Keep prop name for compatibility
        botTyping, setBotTyping,
        isReconnecting, setIsReconnecting,
        currentMessageId, setCurrentMessageId,
        userUniqueId, setUserUniqueId,
        showScrollToBottom, setShowScrollToBottom,
        chatMode, setChatMode,
        isDeepSearchActive, setIsDeepSearchActive,
        fileUploads, setFileUploads,
        theme, user, userProfile,
        messagesRef, messagesContainerRef,
        messagePairs,
        personalities, setPersonalities,
        activePersonality, setActivePersonality
    };
}
