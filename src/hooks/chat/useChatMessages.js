import { useEffect, useCallback, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../utils/firebaseConfig';
import ShareService from '../../services/shareService';
import PDFService from '../../services/pdfService';
import ChatService from '../../services/chatService';
import { WebSocketChatManager, streamChatMessage, cancelChatTask, confirmChatTask } from '../../utils/api';
import { isAssistantLikeRole } from './useChatUtils';
import { normalizeChatMode, resolveRuntimeChatMode } from '../../features/chat/utils/chatMode.js';

const WS_CHAT_ENABLED = String(import.meta.env.VITE_WS_CHAT_ENABLED || '').toLowerCase() === 'true';

let sharedWsManager = null;
let currentSessionId = null;

const getWsManager = (sessionId) => {
    if (sharedWsManager && currentSessionId !== sessionId) {
        sharedWsManager.disconnect();
        sharedWsManager = null;
    }
    if (!sharedWsManager) {
        sharedWsManager = new WebSocketChatManager();
        currentSessionId = sessionId;
    }
    return sharedWsManager;
};

const resetWsManager = () => {
    if (sharedWsManager) {
        sharedWsManager.disconnect();
        sharedWsManager = null;
        currentSessionId = null;
    }
};

export default function useChatMessages({ core, currentSessionId, userId, onMessagesUpdate }) {
    const {
        messagesRef, setMessages, setBotTyping, setCurrentMessageId,
        setWsConnected, setIsReconnecting, isReconnecting,
        chatMode, setFileUploads, userUniqueId, setIsDeepSearchActive,
        activePersonality, userProfile
    } = core;

    const lastSessionIdRef = useRef(null);
    const streamingMessageIdRef = useRef(null);
    const wsManagerRef = useRef(null);
    const tokenBufferRef = useRef('');
    const pendingFlushRef = useRef('');
    const streamModeRef = useRef('smart');
    const finalAnswerRef = useRef('');
    const wsCallbacksRef = useRef(null);
    const tokenProviderRef = useRef(null);

    const sanitizeCasualReply = useCallback((text) => {
        if (!text) return '';
        let out = String(text);
        out = out.replace(/\r/g, '');
        out = out.replace(/^\s*direct answer\s*:?\s*/i, '');
        out = out.replace(/\bFollow-up Questions?:[\s\S]*$/i, '');
        out = out.replace(/^\s*#+\s*/gm, '');
        out = out.replace(/(^|\n)\s*[^\n]{0,20}#{2,}\s*/g, '$1');
        out = out.replace(/\n{3,}/g, '\n\n').trim();
        return out;
    }, []);

    const normalizeReasoningLabel = useCallback((value) => {
        let out = String(value || '');
        out = out.replace(/\b(inbuild|inbuilt|built[-\s]?in)\b/gi, 'LLM');
        out = out.replace(/\bLLM\s+reasoning\s+done\b/gi, 'LLM reasoning complete');
        out = out.replace(/\s+/g, ' ').trim();
        return out;
    }, []);

    const _shortText = useCallback((value, max = 120) => {
        const normalized = normalizeReasoningLabel(value);
        if (!normalized) return '';
        if (normalized.length <= max) return normalized;
        return `${normalized.slice(0, Math.max(0, max - 3))}...`;
    }, [normalizeReasoningLabel]);

    const formatExecutionLogEntry = useCallback((rawPayload) => {
        const payload = (rawPayload && typeof rawPayload === 'object')
            ? rawPayload
            : { message: String(rawPayload || '').trim() };

        const state = String(payload.agent_state || payload.event || '').trim().toLowerCase();
        const tool = _shortText(payload.tool || payload.name || '', 64);
        const topic = _shortText(payload.topic || payload.label || payload.message || '', 140);
        const sourceTitle = _shortText(payload?.source?.title || payload?.source?.url || '', 120);
        const status = String(payload.status || '').trim().toLowerCase();
        const error = _shortText(payload.error || '', 120);
        const silent = Boolean(payload.silent || payload.ui_silent || payload.hidden);
        const mode = String(payload.mode || '').trim().toLowerCase();
        const lane = String(payload.lane || '').trim().toLowerCase();
        const nodeCount = Number(payload.node_count || 0);
        const similarity = Number(payload.similarity || 0);
        const rawResultCount = Number(payload.result_count ?? payload.resultCount ?? 0);
        const resultCount = Number.isFinite(rawResultCount) && rawResultCount > 0 ? Math.floor(rawResultCount) : 0;
        const resultItems = Array.isArray(payload.result_items)
            ? payload.result_items
                .map((item) => {
                    if (!item || typeof item !== 'object') return null;
                    const title = _shortText(item.title || item.name || item.snippet || item.url || item.link || '', 80);
                    const url = String(item.url || item.link || '').trim();
                    if (!title) return null;
                    return { title, url };
                })
                .filter(Boolean)
                .slice(0, 10)
            : [];
        const readTitle = _shortText(payload.read_title || payload.readTitle || '', 140);
        const readUrl = String(payload.read_url || payload.readUrl || '').trim();
        const resultHint = _shortText(payload.result_hint || payload.resultHint || '', 220);
        const argsPreview = _shortText(payload.args_preview || payload.argsPreview || '', 160);
        const nodeId = _shortText(payload.node_id || payload.nodeId || '', 64);
        const toolLower = tool.toLowerCase();
        const isSearchTool = toolLower.includes('search') || toolLower.includes('news') || toolLower.includes('weather') || toolLower.includes('finance');
        const isReadTool = toolLower.includes('summarize_url') || toolLower.includes('web_fetch') || toolLower.includes('extract');
        const prettyTopic = topic || sourceTitle;
        const rawNoiseText = String(
            payload.error || payload.message || payload.detail || payload.label || topic || ''
        ).toLowerCase();
        if (
            (rawNoiseText.includes('robots.txt') || rawNoiseText.includes('does not allow automated scraping')) &&
            (isReadTool || rawNoiseText.includes('read failed') || rawNoiseText.includes('read '))
        ) {
            return null;
        }
        const callKey = [nodeId, toolLower, argsPreview || prettyTopic].filter(Boolean).join('|').toLowerCase();

        const makeEntry = (title, detail = '', kind = 'progress', statusValue = 'running', extra = {}) => {
            const safeTitle = _shortText(title, 180);
            const safeDetail = _shortText(detail, 280);
            if (!safeTitle) return null;
            const dedupeSeed = [
                state,
                safeTitle,
                safeDetail,
                kind,
                statusValue,
                extra?.resultCount ? `count:${extra.resultCount}` : '',
                Array.isArray(extra?.resultItems)
                    ? `items:${extra.resultItems.map((x) => x?.title || '').join('|')}`
                    : '',
            ].join('|').toLowerCase();
            return {
                text: safeTitle,
                title: safeTitle,
                detail: safeDetail,
                kind,
                status: statusValue,
                state,
                dedupeKey: dedupeSeed,
                callKey,
                ...extra,
            };
        };

        if (state === 'tool_call') {
            if (isSearchTool) {
                return makeEntry(
                    prettyTopic ? `Searching "${prettyTopic}"` : 'Searching the web',
                    prettyTopic
                        ? `Looking for relevant and recent sources about "${prettyTopic}".`
                        : 'Looking for relevant and recent sources.',
                    'search',
                    'running',
                );
            }
            if (isReadTool) {
                return makeEntry(
                    prettyTopic ? `Reading "${prettyTopic}"` : 'Reading source',
                    'Extracting useful information from the selected source.',
                    'read',
                    'running',
                );
            }
            if (topic) return makeEntry(`Using ${tool || 'tool'}`, `Input: ${topic}`, 'tool', 'running');
            return makeEntry(`Using ${tool || 'tool'}`, '', 'tool', 'running');
        }

        if (state === 'tool_result') {
            if (silent) return null;
            if (status === 'ok' || status === 'success' || status === 'completed') {
                if (isSearchTool) {
                    const searchDetail = resultCount > 0
                        ? `Found ${resultCount} results`
                        : (resultHint || 'Search completed');
                    return makeEntry(
                        prettyTopic ? `Searched "${prettyTopic}"` : 'Search completed',
                        searchDetail,
                        'search',
                        'done',
                        {
                            resultCount,
                            resultItems,
                            resultHint: searchDetail,
                        },
                    );
                }
                if (isReadTool) {
                    const readLabel = readTitle || prettyTopic;
                    return makeEntry(
                        readLabel ? `Read "${readLabel}"` : 'Read completed',
                        resultHint || 'Key details extracted from the source.',
                        'read',
                        'done',
                        {
                            readTitle: readLabel || '',
                            readUrl,
                        },
                    );
                }
                return makeEntry(`Finished ${tool || 'tool'}`, 'Analyzing tool output.', 'tool', 'done');
            }
            if (status === 'blocked') {
                if (isSearchTool) {
                    return makeEntry(
                        prettyTopic ? `Search blocked for "${prettyTopic}"` : 'Search blocked',
                        error || 'Tool access was blocked by policy or permissions.',
                        'search',
                        'error',
                    );
                }
                if (isReadTool) {
                    return makeEntry(
                        prettyTopic ? `Read blocked for "${prettyTopic}"` : 'Read blocked',
                        error || 'Tool access was blocked by policy or permissions.',
                        'read',
                        'error',
                    );
                }
                return makeEntry(`Blocked ${tool || 'tool'}`, error || 'Tool access was blocked by policy or permissions.', 'tool', 'error');
            }
            if (status === 'failed' || status === 'error') {
                const lowerError = String(error || '').toLowerCase();
                if (
                    isReadTool &&
                    (
                        lowerError.includes('robots.txt') ||
                        lowerError.includes('does not allow automated scraping') ||
                        lowerError.includes('http 403') ||
                        lowerError.includes('forbidden') ||
                        lowerError.includes('access denied') ||
                        lowerError.includes('no_readable_url_candidates')
                    )
                ) {
                    return null;
                }
                if (isSearchTool) {
                    return makeEntry(
                        prettyTopic ? `Search failed for "${prettyTopic}"` : 'Search failed',
                        error || 'Live web retrieval failed. No reliable sources were fetched.',
                        'search',
                        'error',
                    );
                }
                if (isReadTool) {
                    return makeEntry(
                        prettyTopic ? `Read failed for "${prettyTopic}"` : 'Read failed',
                        error || 'Source retrieval failed.',
                        'read',
                        'error',
                    );
                }
                return makeEntry(`Failed ${tool || 'tool'}`, error || 'Tool execution failed.', 'tool', 'error');
            }
            if (status === 'throttled') {
                if (isSearchTool) {
                    return makeEntry(
                        prettyTopic ? `Search throttled for "${prettyTopic}"` : 'Search throttled',
                        error || 'Search provider throttled this request. Retry in a moment.',
                        'search',
                        'error',
                    );
                }
                if (isReadTool) {
                    return makeEntry(
                        prettyTopic ? `Read throttled for "${prettyTopic}"` : 'Read throttled',
                        error || 'Provider throttled this request. Retry in a moment.',
                        'read',
                        'error',
                    );
                }
                return makeEntry(`Throttled ${tool || 'tool'}`, error || 'Provider throttled this request. Retry in a moment.', 'tool', 'error');
            }
            return makeEntry(`Result from ${tool || 'tool'} received`, '', 'tool', 'done');
        }

        if (state === 'planning_complete') {
            if (mode === 'query_cache_hit') {
                return makeEntry(
                    'Plan ready - using recent cached answer',
                    'A close recent query match was found, so response can be produced quickly.',
                    'planning',
                    'done',
                );
            }
            if (mode === 'retrieval_hit') {
                const suffix = similarity > 0 ? ` (${Math.round(similarity * 100)}% match)` : '';
                return makeEntry(
                    `Plan ready - using trusted knowledge cache${suffix}`,
                    'Verified stored knowledge was found and selected for response generation.',
                    'planning',
                    'done',
                );
            }
            if (mode === 'confidence_gate') {
                return makeEntry(
                    'Plan ready - no tool run needed',
                    'This request can be answered directly without external tool calls.',
                    'planning',
                    'done',
                );
            }
            if (mode === 'fast_path') {
                return makeEntry(
                    'Plan ready - fast tool path selected',
                    'A quick path was chosen for faster response.',
                    'planning',
                    'done',
                );
            }
            if (nodeCount > 0) return makeEntry(`Plan ready with ${nodeCount} steps`, '', 'planning', 'done');
            return makeEntry('Plan ready', '', 'planning', 'done');
        }

        if (state === 'running') {
            if (lane === 'heavy') return makeEntry('Running on heavy lane', 'Using deeper reasoning and tool workflow.', 'planning', 'running');
            if (lane === 'fast') return makeEntry('Running on fast lane', 'Using low-latency path for quick reply.', 'planning', 'running');
            return makeEntry('Running', '', 'planning', 'running');
        }

        const stateMap = {
            task_queued: makeEntry('Queued for execution', 'Request is waiting in queue.', 'planning', 'running'),
            queued: makeEntry('Queued', 'Request is waiting in queue.', 'planning', 'running'),
            message_start: makeEntry('Agent started', 'Execution has started.', 'planning', 'running'),
            task_started: makeEntry('Task started', 'Beginning the task workflow.', 'planning', 'running'),
            initializing: makeEntry('Understanding request', topic || 'Analyzing intent and constraints.', 'reasoning', 'running'),
            analyzing_request: makeEntry('Understanding your request', topic || 'Breaking down the request into actionable steps.', 'reasoning', 'running'),
            no_tool_needed: makeEntry(
                topic || 'I can answer this directly without external tools.',
                '',
                'reasoning',
                'done'
            ),
            retrieval_hit: makeEntry('Using cached verified knowledge', topic || 'Found relevant validated context in memory.', 'reasoning', 'done'),
            tool_memory_hit: makeEntry('Reusing trusted memory evidence', topic || 'Loaded relevant facts from prior verified runs.', 'reasoning', 'done'),
            route_selected: makeEntry(topic || 'Selected execution route', '', 'reasoning', 'running'),
            planning: makeEntry(topic || 'Planning next steps', '', 'reasoning', 'running'),
            workspace_update: makeEntry('Updated findings from latest step', '', 'reasoning', 'running'),
            verification_started: makeEntry('Verifying evidence', 'Checking source quality and consistency.', 'reasoning', 'running'),
            verification_complete: makeEntry('Verification complete', 'Evidence checks finished.', 'reasoning', 'done'),
            confidence_update: makeEntry('Updated confidence estimate', '', 'reasoning', 'running'),
            critic_check: makeEntry('Running quality check', 'Reviewing response quality and safety.', 'reasoning', 'running'),
            repair_cycle: makeEntry('Repairing strategy after review', 'Adjusting the plan based on quality checks.', 'reasoning', 'running'),
            additional_research_triggered: makeEntry('Need more evidence - continuing research', '', 'reasoning', 'running'),
            synthesis_started: makeEntry('Drafting final response', 'Composing final answer from findings.', 'reasoning', 'running'),
            final_answer: makeEntry('Final answer ready', '', 'success', 'done'),
            completed: makeEntry('Completed', '', 'success', 'done'),
            cancelled: makeEntry('Cancelled', '', 'error', 'error'),
            progress: makeEntry(topic && topic !== state ? topic : 'Working on next step', '', 'reasoning', 'running'),
            task_progress: makeEntry(topic && topic !== state ? topic : 'Working on next step', '', 'reasoning', 'running'),
            source: makeEntry('Found source', sourceTitle || '', 'source', 'done'),
        };

        if (stateMap[state]) return stateMap[state];
        if (topic) return makeEntry(topic, '', 'reasoning', 'running');
        if (state) return makeEntry(_shortText(state.replace(/_/g, ' '), 80), '', 'reasoning', 'running');
        return null;
    }, [_shortText]);

    const appendExecutionLog = useCallback((logs, payload) => {
        const current = Array.isArray(logs) ? logs : [];
        const nextEntry = formatExecutionLogEntry(payload);
        if (!nextEntry) return current;

        const getText = (entry) => {
            if (typeof entry === 'string') return String(entry).trim();
            if (entry && typeof entry === 'object') return String(entry.text || entry.title || '').trim();
            return '';
        };
        const getKey = (entry) => {
            if (entry && typeof entry === 'object' && entry.dedupeKey) return String(entry.dedupeKey);
            return getText(entry).toLowerCase();
        };

        const prev = current[current.length - 1];
        if (prev && getKey(prev) === getKey(nextEntry)) return current;

        const lowerNext = getText(nextEntry).toLowerCase();
        const hasText = (needle) => current.some((x) => getText(x).toLowerCase() === needle);
        if (lowerNext === 'queued' && hasText('queued')) return current;
        if (lowerNext === 'task started' && hasText('agent started')) return current;
        
        let merged = current;
        // Replace stale running "Searching..." / "Reading..." row with the completed row.
        if (nextEntry.state === 'tool_result' && nextEntry.callKey) {
            merged = current.filter((entry) => {
                if (!entry || typeof entry !== 'object') return true;
                const sameCall = String(entry.callKey || '') === String(nextEntry.callKey || '');
                const isRunning = String(entry.status || '').toLowerCase() === 'running';
                const isToolCall = String(entry.state || '').toLowerCase() === 'tool_call';
                return !(sameCall && isRunning && isToolCall);
            });
        }
        if (String(nextEntry.state || '').toLowerCase() === 'final_answer') {
            merged = merged.filter((entry) => {
                if (!entry || typeof entry !== 'object') return true;
                const status = String(entry.status || '').toLowerCase();
                const kind = String(entry.kind || '').toLowerCase();
                return !(status === 'running' && (kind === 'search' || kind === 'read' || kind === 'tool'));
            });
        }
        return [...merged, nextEntry].slice(-80);
    }, [formatExecutionLogEntry]);

    const finalizeStream = useCallback(() => {
        const botMsgId = streamingMessageIdRef.current;
        if (!botMsgId) return;
        const chunk = tokenBufferRef.current;
        const pendingChunk = pendingFlushRef.current;
        tokenBufferRef.current = "";
        pendingFlushRef.current = "";

        setMessages(prev => prev.map(msg =>
            msg.id === botMsgId
                ? {
                    ...msg,
                    content: (() => {
                        const streamed = (msg.content || '') + pendingChunk + chunk;
                        const structuredAnswer =
                            msg?.structured_response?.response ||
                            msg?.structured_response?.answer ||
                            finalAnswerRef.current;
                        if (streamed.trim()) return streamed;
                        if (structuredAnswer) return sanitizeCasualReply(structuredAnswer);
                        return streamed;
                    })(),
                    isStreaming: false,
                    isGenerating: false,
                    isSearching: false
                  }
                : msg
        ));
        setBotTyping(false);
        setIsDeepSearchActive(false);
        setCurrentMessageId(null);
        streamingMessageIdRef.current = null;
        finalAnswerRef.current = '';
    }, [setMessages, setBotTyping, setIsDeepSearchActive, setCurrentMessageId, sanitizeCasualReply]);

    const _hasLiveMessageText = useCallback((msg) => {
        const current = String(msg?.content || '').trim();
        const buffered = String(tokenBufferRef.current || '').trim();
        const pending = String(pendingFlushRef.current || '').trim();
        return Boolean(current || buffered || pending);
    }, []);

    const failStream = useCallback((err) => {
        const botMsgId = streamingMessageIdRef.current;
        if (botMsgId) {
            const buffered = tokenBufferRef.current;
            const existing = messagesRef.current?.find(msg => msg.id === botMsgId);
            const hasContent = Boolean((existing?.content || '').trim()) || Boolean(buffered);

            if (hasContent) {
                finalizeStream();
                return;
            }

            setMessages(prev => prev.map(msg =>
                msg.id === botMsgId
                    ? {
                        ...msg,
                        content: (msg.content || '') + `\nError: ${err}`,
                        isError: true,
                        isStreaming: false,
                        isGenerating: false,
                        isSearching: false
                      }
                    : msg
            ));
        }
        setBotTyping(false);
        setIsDeepSearchActive(false);
        setCurrentMessageId(null);
        streamingMessageIdRef.current = null;
        finalAnswerRef.current = '';
    }, [finalizeStream, messagesRef, setMessages, setBotTyping, setIsDeepSearchActive, setCurrentMessageId]);

    // --- UI Control Global Wiring ---
    useEffect(() => {
        window.handleAgentConfirm = async (confirmStatus, executionId) => {
            if (!executionId) return;
            try {
                await confirmChatTask(executionId, confirmStatus);
                
                // Optimistically update the UI to avoid lag
                setMessages(prev => prev.map(msg => {
                    const targetId = msg.agentMeta?.task_id || msg.agentMeta?.execution_id;
                    if (targetId === executionId) {
                        return {
                            ...msg,
                            agentMeta: {
                                ...msg.agentMeta,
                                agent_state: confirmStatus ? "using_tool" : "cancelled",
                                completed: !confirmStatus
                            }
                        };
                    }
                    return msg;
                }));
            } catch (err) {
                console.warn('Failed to send confirm signal:', err);
            }
        };
        
        return () => {
            delete window.handleAgentConfirm;
        };
    }, [setMessages]);


    useEffect(() => {
        let isActive = true;

        if (!WS_CHAT_ENABLED) {
            if (wsManagerRef.current) {
                wsManagerRef.current.disconnect();
                wsManagerRef.current = null;
            }
            setWsConnected(false);
            return () => {};
        }

        if (!userId || typeof userId !== 'string' || userId.length < 10) return;

        // Clear message tracking when session changes
        if (lastSessionIdRef.current !== currentSessionId) {
            if (lastSessionIdRef.current && wsManagerRef.current) {
                wsManagerRef.current.disconnect();
                wsManagerRef.current = null;
            }
            lastSessionIdRef.current = currentSessionId;
        }
        
        if (!wsManagerRef.current) {
            wsManagerRef.current = getWsManager(currentSessionId);
        }

        // Initialize WebSocket Connection
        const initWebSocket = async () => {
            if (!currentSessionId) return;
            
            // Skip if already connected to this session or currently connecting
            const manager = wsManagerRef.current;
            if (manager?.chatId === currentSessionId && (manager?.isConnected() || manager?.isConnecting())) {
                return;
            }
            
            const tokenProvider = async () => {
                try {
                    if (auth.currentUser) {
                        return await auth.currentUser.getIdToken(false);
                    }
                    throw new Error('No authenticated user');
                } catch (e) {
                    console.error("Failed to get auth token for WS", e);
                    throw e;
                }
            };
            tokenProviderRef.current = tokenProvider;

            const callbacks = {
                onConnect: () => {
                    setWsConnected(true);
                    setIsReconnecting(false);
                },
                onReconnect: () => {
                    setIsReconnecting(true);
                    setWsConnected(false);
                },
                onToken: (token) => {
                    // Buffer the token
                    tokenBufferRef.current += token;
                },
                onInfo: (infoText) => {
                    const botMsgId = streamingMessageIdRef.current;
                    if (!botMsgId) return;

                    setMessages(prev => prev.map(msg => {
                        if (msg.id !== botMsgId) return msg;

                        // Default to current state to prevent flickering
                        let isSearching = msg.isSearching;
                        let searchQuery = msg.searchQuery;
                        let intelligence = msg.intelligence || null;
                        
                        let agentMeta = msg.agentMeta || {};
                        let executionLog = msg.executionLog || [];
                        let parsedInfo = null;

                        if (infoText === "processing") {
                            isSearching = false;
                        } else if (infoText === "stopped") {
                            isSearching = false;
                        } else if (infoText.startsWith("Searching with:")) {
                            isSearching = true;
                            searchQuery = infoText.replace("Searching with:", "").trim();
                            tokenBufferRef.current = "";
            finalAnswerRef.current = ""; // Clear buffer on search start
                            pendingFlushRef.current = "";
                        } else if (infoText.startsWith("INTEL:")) {
                            // Intelligence metadata from backend
                            try {
                                const newIntel = JSON.parse(infoText.slice(6));
                                intelligence = intelligence ? { ...intelligence, ...newIntel } : newIntel;
                            } catch (e) {
                                console.warn('[WS] Failed to parse INTEL payload:', e);
                            }
                        } else {
                            try {
                                parsedInfo = JSON.parse(infoText);
                                
                                const hasFollowups = Array.isArray(parsedInfo.followups);
                                const hasActionChips = Array.isArray(parsedInfo.action_chips);

                                // Ignore unrelated INFO payloads, but keep followup payloads even without agent_state.
                                if (!parsedInfo.agent_state && !agentMeta?.agent_state && !hasFollowups && !hasActionChips && !parsedInfo.followup_mode) {
                                    return msg;
                                }

                                const nextMeta = parsedInfo.agent_state ? { ...agentMeta, ...parsedInfo } : agentMeta;

                                agentMeta = nextMeta;
                                
                                executionLog = appendExecutionLog(executionLog, parsedInfo);
                            } catch (e) {
                                // Not JSON or fallback string
                                executionLog = appendExecutionLog(executionLog, { message: infoText });
                            }
                        }

                        const nextFollowups = Array.isArray(parsedInfo?.followups)
                            ? parsedInfo.followups
                            : (Array.isArray(msg.followups) ? msg.followups : []);
                        const nextActionChips = Array.isArray(parsedInfo?.action_chips)
                            ? parsedInfo.action_chips
                            : (Array.isArray(msg.actionChips) ? msg.actionChips : []);
                        const nextFollowupMode = parsedInfo?.followup_mode || msg.followupMode || null;

                        return {
                            ...msg,
                            isSearching,
                            searchQuery,
                            intelligence,
                            agentMeta,
                            executionLog,
                            followups: nextFollowups,
                            actionChips: nextActionChips,
                            followupMode: nextFollowupMode,
                        };
                    }));
                },
                onFinalAnswer: (structured) => {
                    const botMsgId = streamingMessageIdRef.current;
                    if (!botMsgId || !structured || typeof structured !== 'object') return;
                    const resolvedFinal = String(structured?.response || structured?.answer || '').trim();
                    if (resolvedFinal) {
                        finalAnswerRef.current = resolvedFinal;
                    }

                    setMessages(prev => prev.map(msg => {
                        if (msg.id !== botMsgId) return msg;
                        const canHydrateFromFinal = Boolean(resolvedFinal) && !_hasLiveMessageText(msg);
                        return {
                            ...msg,
                            schema_version: structured?.schema_version || msg.schema_version,
                            answer: structured?.answer || msg.answer,
                            key_points: Array.isArray(structured?.key_points) ? structured.key_points : (msg.key_points || []),
                            sources: Array.isArray(structured?.sources) ? structured.sources : (msg.sources || []),
                            confidence: typeof structured?.confidence === 'number' ? structured.confidence : msg.confidence,
                            confidence_level: structured?.confidence_level || msg.confidence_level,
                            answer_type: structured?.answer_type || msg.answer_type,
                            metadata: structured?.metadata || msg.metadata,
                            blocks: Array.isArray(structured?.blocks) ? structured.blocks : (msg.blocks || []),
                            structured_response: structured,
                            content: canHydrateFromFinal ? sanitizeCasualReply(resolvedFinal) : msg.content,
                        };
                    }));
                },
                onDone: () => {
                    finalizeStream();
                },
                onError: (err) => {
                    console.error("WS Error:", err);
                    setWsConnected(false);
                    failStream(err);
                }
            };
            wsCallbacksRef.current = callbacks;

            if (!isActive) return;
            wsManagerRef.current.connect(currentSessionId, tokenProvider, callbacks);
        };

        if (currentSessionId) {
            initWebSocket();
        }

        return () => {
            isActive = false;
            if (wsManagerRef.current) {
                wsManagerRef.current.disconnect();
            }
            setWsConnected(false);
        };
    }, [currentSessionId, userId, setWsConnected, setMessages, setBotTyping, setIsDeepSearchActive, setCurrentMessageId, setIsReconnecting, finalizeStream, failStream]);

    // Heartbeat & Buffer Flush Effect - use ref to avoid re-running on every render
    const setMessagesRef = useRef(setMessages);
    useEffect(() => {
        setMessagesRef.current = setMessages;
    }, [setMessages]);

useEffect(() => {
        const pingInterval = setInterval(() => {
             if (wsManagerRef.current) wsManagerRef.current.ping();
        }, 25000);

        let animationFrameId = null;
        let lastFlushTime = 0;
        let pendingContent = pendingFlushRef.current || "";
        let isScheduled = false;

        const performFlush = (timestamp) => {
            isScheduled = false;
            animationFrameId = null;

            // Keep agent/research_pro streaming unchanged; smooth smart by batching larger token chunks.
            const modeNow = normalizeChatMode(streamModeRef.current);
            const isNormalLike = modeNow === 'smart';
            const flushIntervalMs = isNormalLike ? 80 : 40;
            const flushCharThreshold = isNormalLike ? 96 : 48;

            const chunk = tokenBufferRef.current;
            if (chunk) {
                tokenBufferRef.current = '';
                pendingContent += chunk;
                pendingFlushRef.current = pendingContent;
            }

            if (pendingContent.length > 0 && streamingMessageIdRef.current) {
                if ((timestamp - lastFlushTime) < flushIntervalMs && pendingContent.length < flushCharThreshold) {
                    scheduleFlush();
                    return;
                }
                const botMsgId = streamingMessageIdRef.current;
                const contentToFlush = pendingContent;
                pendingContent = "";
                pendingFlushRef.current = "";
                lastFlushTime = timestamp;

                const setMessages = setMessagesRef.current;
                setMessages(prev => {
                    const idx = prev.findIndex(msg => msg.id === botMsgId);
                    if (idx === -1) return prev;
                    if (prev[idx].content === (prev[idx].content || '') + contentToFlush) return prev;
                    const newArr = [...prev];
                    newArr[idx] = {
                        ...prev[idx],
                        content: (prev[idx].content || '') + contentToFlush,
                        isStreaming: true
                    };
                    return newArr;
                });
            }

            // Keep scheduling only while there is buffered content to flush.
            if (tokenBufferRef.current || pendingContent) {
                scheduleFlush();
            }
        };

        const scheduleFlush = () => {
            if (isScheduled) return;
            isScheduled = true;
            animationFrameId = requestAnimationFrame(performFlush);
        };

        // When a token arrives, we now just ensure a flush is scheduled
        // The actual scheduling is triggered by the onToken callback via the manager
        const checkBuffer = () => {
            if (tokenBufferRef.current || pendingContent) {
                scheduleFlush();
            }
        };

        const bufferCheckInterval = setInterval(checkBuffer, 45);

        return () => {
            clearInterval(pingInterval);
            clearInterval(bufferCheckInterval);
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
        };
    }, []);

    const handleReconnect = async () => {
        if (!WS_CHAT_ENABLED) {
            setWsConnected(false);
            return;
        }
        if (isReconnecting) return;
        setIsReconnecting(true);
        try {
            if (currentSessionId && tokenProviderRef.current && wsCallbacksRef.current) {
                wsManagerRef.current.connect(currentSessionId, tokenProviderRef.current, wsCallbacksRef.current);
            }
        } catch { /* silent */ }
        finally { setIsReconnecting(false); }
    };

    const handleStop = useCallback(async () => {
        // Find the execution ID of the current streaming message
        const botMsgId = streamingMessageIdRef.current;
        let activeExecutionId = null;
        if (botMsgId) {
            const currentMsg = messagesRef.current?.find(m => m.id === botMsgId);
            if (currentMsg?.agentMeta?.task_id || currentMsg?.agentMeta?.execution_id) {
                activeExecutionId = currentMsg.agentMeta.task_id || currentMsg.agentMeta.execution_id;
            }
        }
        
        if (activeExecutionId) {
            try {
                await cancelChatTask(activeExecutionId);
            } catch (err) {
                console.warn('Failed to send cancel signal to agent execution branch', err);
            }
        }
        
        if (wsManagerRef.current) {
            wsManagerRef.current.stopGeneration();
        }
        tokenBufferRef.current = ""; // Clear buffer
        pendingFlushRef.current = "";
        setBotTyping(false);
        setIsDeepSearchActive(false);
        setCurrentMessageId(null);
        streamingMessageIdRef.current = null;
        finalAnswerRef.current = '';
    }, [setBotTyping, setCurrentMessageId, setIsDeepSearchActive, messagesRef]);

    const handleFileUpload = useCallback((fileName) => {
        const uploadId = `${fileName}-${Date.now()}`;
        setFileUploads(prev => ({ ...prev, [uploadId]: { name: fileName, progress: 0, status: 'uploading' } }));
        return uploadId;
    }, [setFileUploads]);

    const handleFileUploadComplete = useCallback((uploadId, success, filePath, fileId = null) => {
        setFileUploads(prev => {
            const updated = { ...prev };
            if (updated[uploadId]) {
                updated[uploadId] = { 
                    ...updated[uploadId], 
                    progress: 100, 
                    status: success ? 'completed' : 'failed', 
                    filePath: success ? filePath : null,
                    fileId: fileId
                };
            }
            return updated;
        });
    }, [setFileUploads]);


    const isPdfMakerRequest = useCallback((input = '') => {
        const q = String(input || '').toLowerCase();
        if (!q.includes('pdf')) return false;
        return /(make|create|convert|export|download|save|generate)/.test(q);
    }, []);

    const resolvePdfContent = useCallback((input = '') => {
        const q = String(input || '').trim();
        const lower = q.toLowerCase();
        const quoted = q.match(/"([\s\S]+?)"|'([\s\S]+?)'/);

        if (/\b(this chat|full chat|entire chat|all chat|these chats|whole chat)\b/.test(lower)) {
            return { type: 'chat', content: '', title: 'Chat Conversation' };
        }

        if (/\b(last answer|last response|last message)\b/.test(lower)) {
            const lastBot = [...(messagesRef.current || [])].reverse().find(m => isAssistantLikeRole(m.role) && (m.content || '').trim());
            if (lastBot) {
                return { type: 'text', content: String(lastBot.content || ''), title: 'Last Assistant Response' };
            }
        }

        if (quoted && (quoted[1] || quoted[2])) {
            return { type: 'text', content: String(quoted[1] || quoted[2]), title: 'Requested Content' };
        }

        const cleaned = q
            .replace(/\b(make|create|convert|export|download|save|generate)\b/gi, '')
            .replace(/\b(this|these|that|as|to|into|in)\b/gi, '')
            .replace(/\b(pdf|document|file|content|chat|please)\b/gi, '')
            .replace(/[\s:,-]+/g, ' ')
            .trim();

        if (cleaned) {
            return { type: 'text', content: cleaned, title: 'Requested Content' };
        }

        return { type: 'chat', content: '', title: 'Chat Conversation' };
    }, [messagesRef]);

    const safePdfFilename = useCallback((title = 'relyce-export') => {
        const base = String(title || 'relyce-export').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'relyce-export';
        return `${base}-${new Date().toISOString().slice(0, 10)}.pdf`;
    }, []);
    const handleSend = useCallback(async (messageData) => {
        if (!userId || typeof userId !== 'string' || userId.length < 10) return;
        if (!currentSessionId || typeof currentSessionId !== 'string') return;

        let text = '', files = [], isWebSearch = false;
        if (typeof messageData === 'string') text = messageData;
        else if (messageData && typeof messageData === 'object') {
            text = String(messageData.text || '');
            files = Array.isArray(messageData.files) ? messageData.files : [];
            isWebSearch = Boolean(messageData.isWebSearch);
        }

        if (text.length > 10000) text = text.substring(0, 10000);

        const trimmedText = text.trim();
        if (trimmedText && files.length === 0 && isPdfMakerRequest(trimmedText)) {
            const tempMessageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            const botMessageId = `bot_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            const userMessage = {
                id: tempMessageId,
                role: 'user',
                content: trimmedText,
                timestamp: new Date().toISOString(),
            };

            try {
                const target = resolvePdfContent(trimmedText);
                const filename = safePdfFilename(target.title || 'relyce-export');
                if (target.type === 'chat') {
                    const exportMessages = (messagesRef.current || []).filter(m => (m.content || '').trim());
                    await PDFService.generateAndDownloadChatPDF(
                        exportMessages,
                        { title: target.title || 'Chat Conversation', date: new Date(), participants: ['User', 'Relyce AI'] },
                        filename
                    );
                } else {
                    await PDFService.generateAndDownloadTextPDF(
                        target.content,
                        { title: target.title || 'Document Export', date: new Date(), participants: ['User', 'Relyce AI'] },
                        filename
                    );
                }

                setMessages(prev => [...prev, userMessage, {
                    id: botMessageId,
                    role: 'bot',
                    content: `PDF ready. Downloaded as ${filename}`,
                    timestamp: new Date().toISOString(),
                }]);
            } catch (error) {
                console.error('PDF maker failed:', error);
                setMessages(prev => [...prev, userMessage, {
                    id: botMessageId,
                    role: 'bot',
                    content: 'PDF generation failed. Please try again.',
                    isError: true,
                    timestamp: new Date().toISOString(),
                }]);
            }
            return;
        }

        if (trimmedText || files.length > 0) {
            tokenBufferRef.current = "";
            finalAnswerRef.current = "";
            const tempMessageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            const botMessageId = `bot_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            streamingMessageIdRef.current = botMessageId;
            
            // Add user message to UI immediately
            const userMessage = {
                id: tempMessageId,
                role: 'user',
                content: text,
                files: files.map(({ file, ...metadata }) => metadata),
                timestamp: new Date().toISOString(),
            };
            
            // Add empty bot message placeholder for streaming
            const botMessagePlaceholder = {
                id: botMessageId,
                role: 'bot',
                content: '',
                timestamp: new Date().toISOString(),
                isStreaming: true,
                isGenerating: true,
            };
            
            setMessages(prev => [...prev, userMessage, botMessagePlaceholder]);
            setBotTyping(true);
            setIsDeepSearchActive(isWebSearch);
            
            // Save user message to Firebase handled by Backend now
            // const messageId = await ChatService.addMessage(userId, currentSessionId, "user", text, files);
            // setCurrentMessageId(messageId);
            setCurrentMessageId(tempMessageId); // Use temp ID locally

            // Update session name if needed
            if (currentSessionId && userId) {
                try {
                    // Update session name optimistically or lazily
                    const plainText = text.replace(/[#>*_`\[\]]/g, '').trim();
                     // Check current name first
                    const sessionRef = doc(db, "users", userId, "chatSessions", currentSessionId);
                    // Async check without awaiting to blocking UI
                    getDoc(sessionRef).then(sessionSnap => {
                         const currentName = sessionSnap.exists() ? String(sessionSnap.data().name || "").trim() : "";
                         const isDefaultName = !currentName || ["new chat", "new session", "conversation"].includes(currentName.toLowerCase());
                         if (isDefaultName) {
                            let chatName = plainText.substring(0, 60);
                            if (chatName.length < plainText.length) chatName += "...";
                            if (!chatName) chatName = "Conversation";
                            ChatService.updateSessionName(userId, currentSessionId, chatName);
                        }
                    });
                } catch { /* silent */ }
            }

            // Send via WebSocket (preferred), fallback to SSE if not connected
            try {
                const effectiveMode = isWebSearch ? 'research_pro' : resolveRuntimeChatMode(chatMode, text);
                streamModeRef.current = effectiveMode;
                const personalityToSend = effectiveMode === 'smart' ? activePersonality : null;
                const userSettings = userProfile?.settings || null;
                const fileIds = files.map((f) => f.fileId).filter(Boolean);

                // Reliability-first: keep agent on SSE queued stream path until WS path is fully stable.
                const preferWs = false;
                if (preferWs && wsManagerRef.current && wsManagerRef.current.isConnected()) {
                    wsManagerRef.current.sendMessage(text, effectiveMode, personalityToSend, userSettings);
                    return;
                }

                if (!preferWs) {
                    setWsConnected(false);
                }

                for await (const chunk of streamChatMessage(
                    text,
                    currentSessionId,
                    userId,
                    effectiveMode,
                    personalityToSend,
                    userSettings,
                    fileIds
                )) {
                    if (chunk.type === 'token') {
                        tokenBufferRef.current += chunk.content;
                    } else if (chunk.type === 'info') {
                        // Dispatch to the message's agentMeta to be tracked by AgentMetaBlock
                        setMessages(prev => prev.map(msg => {
                            if (msg.id === streamingMessageIdRef.current) {
                                const payload = (chunk.payload && typeof chunk.payload === 'object')
                                  ? chunk.payload
                                  : { message: String(chunk.payload || '').trim() };
                                const currentLogs = msg.executionLog || [];
                                const nextLogs = appendExecutionLog(currentLogs, payload);
                                const infoAnswer = String(payload?.response || payload?.answer || '').trim();
                                if (infoAnswer) {
                                  finalAnswerRef.current = infoAnswer;
                                }
                                const canHydrateFromInfoAnswer = Boolean(infoAnswer) && !_hasLiveMessageText(msg);
                                
                                return {
                                    ...msg,
                                    agentMeta: payload.agent_state ? { ...msg.agentMeta, ...payload } : (msg.agentMeta || {}),
                                    executionLog: nextLogs,
                                    content: canHydrateFromInfoAnswer ? sanitizeCasualReply(infoAnswer) : msg.content,
                                    followups: Array.isArray(payload?.followups)
                                      ? payload.followups
                                      : (Array.isArray(msg.followups) ? msg.followups : []),
                                    actionChips: Array.isArray(payload?.action_chips)
                                      ? payload.action_chips
                                      : (Array.isArray(msg.actionChips) ? msg.actionChips : []),
                                    followupMode: payload?.followup_mode || msg.followupMode || null,
                                };
                            }
                            return msg;
                        }));
                                        } else if (chunk.type === 'final_answer') {
                        const structured = chunk.payload || null;
                        const resolvedFinal = String(structured?.response || structured?.answer || '').trim();
                        finalAnswerRef.current = resolvedFinal;
                        setMessages(prev => prev.map(msg => {
                            if (msg.id !== streamingMessageIdRef.current) return msg;
                            const canHydrateFromFinal = Boolean(resolvedFinal) && !_hasLiveMessageText(msg);
                            const fallbackContent = canHydrateFromFinal
                              ? sanitizeCasualReply(resolvedFinal)
                              : ((msg.content || '').trim() ? msg.content : (finalAnswerRef.current ? sanitizeCasualReply(finalAnswerRef.current) : msg.content));
                            return {
                                ...msg,
                                executionLog: appendExecutionLog(msg.executionLog || [], { agent_state: 'final_answer' }),
                                schema_version: structured?.schema_version || msg.schema_version,
                                answer: structured?.answer || msg.answer,
                                key_points: Array.isArray(structured?.key_points) ? structured.key_points : (msg.key_points || []),
                                sources: Array.isArray(structured?.sources) ? structured.sources : (msg.sources || []),
                                confidence: typeof structured?.confidence === 'number' ? structured.confidence : msg.confidence,
                                confidence_level: structured?.confidence_level || msg.confidence_level,
                                answer_type: structured?.answer_type || msg.answer_type,
                                metadata: structured?.metadata || msg.metadata,
                                blocks: Array.isArray(structured?.blocks) ? structured.blocks : (msg.blocks || []),
                                structured_response: structured,
                                content: fallbackContent,
                            };
                        }));
                    }
                }

                finalizeStream();

            } catch (error) {
                console.error('Error sending message via WS/SSE:', error);
                if (error?.message?.includes('GOVERNANCE_BLOCK')) {
                    finalizeStream();
                } else if (error?.message?.toLowerCase?.().includes('task cancelled')) {
                    // User-initiated stop should not surface as a hard chat failure.
                    finalizeStream();
                } else {
                    failStream(error?.message || 'Failed to send message.');
                }
            }
        }
    }, [userId, currentSessionId, chatMode, userUniqueId, setMessages, setBotTyping, setCurrentMessageId, setIsDeepSearchActive, activePersonality, userProfile, setWsConnected, finalizeStream, failStream, isPdfMakerRequest, resolvePdfContent, safePdfFilename, messagesRef, sanitizeCasualReply, appendExecutionLog, _hasLiveMessageText]);

    const handleDownloadPDF = async (msgs) => {
        if (!msgs?.length) return alert('No chat to download!');
        try {
            const blob = await PDFService.generateChatPDF(msgs, { title: 'Chat Conversation', date: new Date(), participants: ['User', 'Relyce AI'] });
            PDFService.downloadPDF(blob, `relyce-chat-${new Date().toISOString().slice(0, 10)}.pdf`);
        } catch { alert('Failed to generate PDF.'); }
    };

    const handleShare = async (msgs) => {
        if (!currentSessionId || !userId || !msgs?.length) return alert('No chat to share!');
        try {
            const shareUrl = await ShareService.shareChat(userId, currentSessionId, msgs);
            if (navigator.share) await navigator.share({ title: 'Relyce AI Chat', url: shareUrl });
            else { await ShareService.copyShareLink(shareUrl); alert('Share link copied!'); }
        } catch { alert('Failed to share chat.'); }
    };

    const handleCopyLink = async (msgs) => {
        if (!currentSessionId || !userId || !msgs?.length) return alert('No chat to share!');
        try {
            const shareUrl = await ShareService.shareChat(userId, currentSessionId, msgs);
            await ShareService.copyShareLink(shareUrl);
            alert('Share link copied!');
        } catch { alert('Failed to create share link.'); }
    };

    return { handleSend, handleStop, handleReconnect, handleFileUpload, handleFileUploadComplete, handleDownloadPDF, handleShare, handleCopyLink };
}


















