import { useEffect, useCallback, useRef } from 'react';
import ChatService from '../../services/chatService';
import { isElementScrollable, isAssistantLikeRole } from './useChatUtils';

// In-memory message cache - ChatGPT style
const messageCache = new Map();

export default function useChatSession({
    core,
    currentSessionId,
    userId,
    onMessagesUpdate
}) {
    const {
        setMessages, setLoading,
        previousSessionId, setPreviousSessionId,
        setIsTransitioning, setBotTyping, setCurrentMessageId,
        showScrollToBottom, setShowScrollToBottom,
        messagesContainerRef, messages, messagesRef
    } = core;

    useEffect(() => {
        if (currentSessionId) ChatService.setCurrentSessionId(currentSessionId);
    }, [currentSessionId]);

    useEffect(() => {
        // Save scroll position before switching
        if (previousSessionId && messagesContainerRef.current && isElementScrollable(messagesContainerRef.current)) {
            sessionStorage.setItem(`scrollPosition_${previousSessionId}`, messagesContainerRef.current.scrollTop.toString());
        }

        // Cache previous session messages before switching (ChatGPT-style)
        if (previousSessionId && messages && messages.length > 0) {
            messageCache.set(previousSessionId, messages);
        }

        if (!currentSessionId || !userId) {
            setMessages([]);
            setLoading(false);
            setIsTransitioning(false);
            setBotTyping(false);
            setCurrentMessageId(null);
            if (onMessagesUpdate) onMessagesUpdate([]);
            return;
        }
        
        // Don't set loading=true - let UI show immediately with cache or empty state

        const isSessionChange = previousSessionId && previousSessionId !== currentSessionId;
        if (isSessionChange) {
            // ChatGPT-style: Instantly show cached messages if available
            const cachedMessages = messageCache.get(currentSessionId);
            if (cachedMessages && cachedMessages.length > 0) {
                // Instantly show cached - no loading, no transition!
                setMessages(cachedMessages);
                if (onMessagesUpdate) onMessagesUpdate(cachedMessages);
            }
            // Don't show any loading state - let it appear smooth
            setBotTyping(false);
            setCurrentMessageId(null);
        }
        setPreviousSessionId(currentSessionId);

        const unsubscribe = ChatService.subscribeToMessages(userId, currentSessionId, (firebaseMessages) => {
            const dedupedMessages = Array.isArray(firebaseMessages) ? firebaseMessages : [];
            
            let shouldShowTyping = false;
            if (dedupedMessages.length > 0) {
                const lastMessage = dedupedMessages[dedupedMessages.length - 1];
                if (lastMessage.role === 'user') {
                    let hasBotResponse = false;
                    for (let i = dedupedMessages.length - 1; i >= 0; i--) {
                        if (isAssistantLikeRole(dedupedMessages[i].role)) { hasBotResponse = true; break; }
                        else if (dedupedMessages[i].role === 'user' && i !== dedupedMessages.length - 1) break;
                    }
                    if (!hasBotResponse) shouldShowTyping = true;
                }
            }
            
            // Check if we have a streaming message in progress - don't overwrite it
            const currentMessages = messagesRef.current || [];
            const hasStreamingMessage = currentMessages.some(m => m.isStreaming);
            
            if (hasStreamingMessage) {
                // Don't overwrite while streaming - just update cache
                if (currentSessionId && dedupedMessages.length > 0) {
                    messageCache.set(currentSessionId, dedupedMessages);
                }
                return;
            }
            
            setMessages(dedupedMessages);
            // Update cache with latest messages from Firebase
            if (currentSessionId && dedupedMessages.length > 0) {
                messageCache.set(currentSessionId, dedupedMessages);
            }
            if (onMessagesUpdate) onMessagesUpdate(dedupedMessages);
            setLoading(false);
            setIsTransitioning(false);
            setBotTyping(shouldShowTyping);
        });

        return () => {
            if (currentSessionId && messagesContainerRef.current && isElementScrollable(messagesContainerRef.current)) {
                sessionStorage.setItem(`scrollPosition_${currentSessionId}`, messagesContainerRef.current.scrollTop.toString());
            }
            unsubscribe();
        };
    }, [currentSessionId, userId]);

    useEffect(() => {
        const handleScroll = () => {
            if (!messagesContainerRef.current) return;
            const container = messagesContainerRef.current;
            const isNearBottom = container.scrollTop >= (container.scrollHeight - container.clientHeight - 100);
            const isScrolledUp = container.scrollTop < (container.scrollHeight - container.clientHeight - (window.innerHeight * 3));

            if (isNearBottom) setShowScrollToBottom(false);
            else if (isScrolledUp) setShowScrollToBottom(true);

            if (isElementScrollable(container) && currentSessionId) {
                clearTimeout(container.scrollTimer);
                container.scrollTimer = setTimeout(() => {
                    sessionStorage.setItem(`scrollPosition_${currentSessionId}`, container.scrollTop.toString());
                }, 100);
            }
        };

        const container = messagesContainerRef.current;
        if (container) {
            container.addEventListener('scroll', handleScroll);
            return () => container.removeEventListener('scroll', handleScroll);
        }
    }, [showScrollToBottom, currentSessionId]);

    const scrollToBottom = useCallback(() => {
        if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTo({ top: messagesContainerRef.current.scrollHeight, behavior: 'smooth' });
            setShowScrollToBottom(false);
        }
    }, [messagesContainerRef]);

    const handleDelete = useCallback(() => {
        if (confirm('Delete this conversation?')) { /* Logic from parent */ }
    }, []);

    return { scrollToBottom, handleDelete };
}
