// src/utils/api.js
// FastAPI Backend Integration Layer
// Production-ready REST API and WebSocket communication
import { auth } from './firebaseConfig';

/**
 * FastAPI Backend Configuration
 * Set VITE_API_BASE_URL in your .env file
 */
const normalizeLocalhost = (url) => url.replace(/:\/\/localhost(?=[:/]|$)/, '://127.0.0.1');
export const API_BASE_URL = normalizeLocalhost(
  import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080'
);

const RAG_BASE_URL = normalizeLocalhost(
  import.meta.env.VITE_RAG_BASE_URL || 'http://127.0.0.1:8081'
);

const WS_BASE_URL = API_BASE_URL.startsWith('https')
  ? API_BASE_URL.replace('https', 'wss')
  : API_BASE_URL.replace('http', 'ws');

async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1000, Number(timeoutMs) || 30000));
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Generic fetch wrapper for FastAPI endpoints
 */
async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };
  const mergedHeaders = { ...defaultHeaders, ...options.headers };
  const authHeader = mergedHeaders.Authorization || mergedHeaders.authorization;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: mergedHeaders,
    });
    
    if (!response.ok) {
      if ((response.status === 401 || response.status === 403) && authHeader) {
        // Dispatch unauthorized event for AuthContext to handle (Auto-Logout)
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      }
      if (response.status === 429) {
        throw new Error('Rate limited. Please wait a minute and try again.');
      }
      const error = await response.json().catch(() => ({ detail: 'Request failed' }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error.message);
    throw error;
  }
}

async function getAuthHeaders() {
  const user = auth.currentUser;
  if (!user) return {};
  try {
    const token = await user.getIdToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

/**
 * Chat API - Send message to FastAPI and get response
 */
const SPECIALTY_TEMPERATURES = {
  general: 0.65,
  coding: 0.2,
  business: 0.4,
  ecommerce: 0.55,
  creative: 0.9,
  music: 0.95,
  legal: 0.15,
  health: 0.3,
  education: 0.5,
};

function normalizePersonalityForSend(personality) {
  if (!personality) return null;
  const {
    id,
    name,
    prompt,
    description,
    specialty = 'general',
    temperature,
  } = personality;

  const rawTemp = typeof temperature === 'number'
    ? temperature
    : SPECIALTY_TEMPERATURES[specialty] ?? SPECIALTY_TEMPERATURES.general;

  const temp = Math.max(0, Math.min(1, rawTemp));

  // Specialty-based sampling tweaks (frontend hints; backend should still enforce)
  const sampling = {};
  if (specialty === 'coding') {
    sampling.top_p = 0.9;
    sampling.frequency_penalty = 0;
    sampling.presence_penalty = 0;
  } else if (specialty === 'creative') {
    sampling.top_p = 1;
    sampling.presence_penalty = 0.6;
  }

  return {
    id,
    name,
    prompt,
    description,
    specialty,
    temperature: temp,
    ...sampling,
  };
}

export async function sendChatMessage(message, sessionId, userId, chatMode = 'smart', personality = null, userSettings = null) {
  try {
    const body = {
      message,
      session_id: sessionId,
      user_id: userId,
      chat_mode: chatMode,
      user_settings: userSettings
    };

    const normalizedPersonality = normalizePersonalityForSend(personality);
    if (normalizedPersonality) {
      body.personality = normalizedPersonality;
      if (normalizedPersonality.id) body.personality_id = normalizedPersonality.id;
    }

    const authHeaders = await getAuthHeaders();
    const result = await apiFetch('/chat', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(body),
    });
    
    return {
      success: result.success,
      response: result.response,
      message_id: result.message_id,
      mode_used: result.mode_used,
      tools_activated: result.tools_activated,
      schema_version: result.schema_version,
      answer: result.answer,
      key_points: result.key_points,
      sources: result.sources,
      confidence: result.confidence,
      answer_type: result.answer_type,
      metadata: result.metadata,
      blocks: result.blocks,
      structured_response: result.structured_response
    };
  } catch (error) {
    console.error('sendChatMessage error:', error);
    return { success: false, error: error.message, response: null };
  }
}

/**
 * Streaming Chat API - For Server-Sent Events (SSE) streaming
 */
export async function* streamChatMessage(message, sessionId, userId, chatMode = "smart", personality = null, userSettings = null, fileIds = []) {
  try {
    const body = {
      message,
      session_id: sessionId,
      user_id: userId,
      chat_mode: chatMode,
      user_settings: userSettings,
      file_ids: Array.isArray(fileIds) ? fileIds : [],
    };

    const normalizedPersonality = normalizePersonalityForSend(personality);
    if (normalizedPersonality) {
      body.personality = normalizedPersonality;
      if (normalizedPersonality.id) body.personality_id = normalizedPersonality.id;
    }

    const authHeaders = await getAuthHeaders();

    // Canonical flow for all modes: submit -> task stream
    const submitResp = await fetchWithTimeout(`${API_BASE_URL}/chat/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      credentials: "include",
      body: JSON.stringify(body),
    }, 30000);

    if (!submitResp.ok) {
      if ([429, 503, 402].includes(submitResp.status)) {
        let type = "default";
        if (submitResp.status === 429) type = "429";
        if (submitResp.status === 503) type = "503";
        if (submitResp.status === 402) type = "spend_guard";
        window.dispatchEvent(new CustomEvent("governance_alert", { detail: { type } }));
        throw new Error(`GOVERNANCE_BLOCK_${type}`);
      }
      throw new Error(`HTTP ${submitResp.status}`);
    }

    const submitData = await submitResp.json();
    if (!submitData?.task_id) {
      throw new Error("Queued task id missing");
    }

    yield {
      type: "info",
      payload: {
        agent_state: "task_queued",
        task_id: submitData.task_id,
        lane: submitData.lane,
        queue_depth: submitData.queue_depth ?? 0,
        lane_queue_depth: submitData.lane_queue_depth ?? 0,
        stream_schema_version: submitData.stream_schema_version ?? 2,
      },
    };

    const streamUrl = `${API_BASE_URL}/chat/tasks/${submitData.task_id}/stream`;
    const streamMethod = "GET";
    const streamBody = undefined;

    const response = await fetchWithTimeout(streamUrl, {
      method: streamMethod,
      headers: { "Content-Type": "application/json", ...authHeaders },
      credentials: "include",
      body: streamBody,
    }, 30000);

    if (!response.ok) {
      if ([429, 503, 402].includes(response.status)) {
        let type = "default";
        if (response.status === 429) type = "429";
        if (response.status === 503) type = "503";
        if (response.status === 402) type = "spend_guard";
        window.dispatchEvent(new CustomEvent("governance_alert", { detail: { type } }));
        throw new Error(`GOVERNANCE_BLOCK_${type}`);
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const handleSsePayload = async function* (payloadText) {
      if (!payloadText) return;

      let normalized = String(payloadText).trim();
      if (!normalized) return;

      // Strip escaped trailing newlines sometimes appended by proxies.
      normalized = normalized.replace(/(?:\\r|\\n)+$/g, '').trim();

      // Split bundled SSE payloads that still contain nested data: frames.
      if (normalized.includes('data:')) {
        const bundled = normalized
          .split(/(?:\r?\n\r?\n|\n\n|\\n\\n)\s*(?=data:\s*|\{)/)
          .map((part) => part.replace(/^\s*data:\s*/, '').trim())
          .filter(Boolean);

        for (const part of bundled) {
          for await (const out of handleSsePayload(part)) {
            yield out;
          }
        }
        return;
      }

      let data;
      try {
        data = JSON.parse(normalized);
      } catch (e) {
        // Fallback: split concatenated JSON-like chunks and parse independently.
        const parts = normalized
          .split(/(?:\r?\n\r?\n|\n\n|\\n\\n)+/)
          .map((part) => part.trim())
          .filter(Boolean);

        if (parts.length > 1) {
          for (const part of parts) {
            for await (const out of handleSsePayload(part)) {
              yield out;
            }
          }
          return;
        }

        console.warn('Failed to parse SSE payload:', normalized, e);
        return;
      }

      if (data.type === 'token') {
        yield { type: 'token', content: data.text ?? data.content ?? '' };
      } else if (data.type === 'message_start') {
        yield {
          type: 'info',
          payload: {
            agent_state: 'message_start',
            message_id: data.message_id,
            mode: data.mode,
            stream_schema_version: data.stream_schema_version,
            timestamp: data.timestamp,
          },
        };
      } else if (data.type === 'progress') {
        yield {
          type: 'info',
          payload: {
            ...data,
            agent_state: data.state || 'progress',
            topic: data.label || '',
            percent: data.percent,
            followups: data.followups,
            action_chips: data.action_chips,
            followup_mode: data.followup_mode,
            lane: data.lane,
            timestamp: data.timestamp,
          },
        };
      } else if (data.type === 'tool_call' || data.type === 'tool_result') {
        yield {
          type: 'info',
          payload: {
            ...data,
            agent_state: data.type,
            tool: data.tool,
            call_id: data.call_id,
            status: data.status,
            topic: data.args_preview || '',
            error: data.error || '',
            timestamp: data.timestamp,
          },
        };
      } else if (data.type === 'source') {
        yield {
          type: 'info',
          payload: {
            agent_state: 'source',
            source: {
              id: data.id,
              url: data.url,
              title: data.title,
              provider: data.provider,
              confidence: data.confidence,
              type: data.type,
            },
            timestamp: data.timestamp,
          },
        };
      } else if (data.type === 'info') {
        if (data.content && typeof data.content === 'object') {
          yield { type: 'info', payload: data.content };
        } else {
          try {
            yield { type: 'info', payload: JSON.parse(data.content) };
          } catch {
            yield { type: 'info', payload: data.content };
          }
        }
      } else if (data.type === 'event') {
        const payload = data.content || {};
        yield { type: 'info', payload: { agent_state: payload.event || 'task_event', ...payload } };
      } else if (data.type === 'final') {
        yield { type: 'final_answer', payload: data };
      } else if (data.type === 'final_answer') {
        // Legacy fallback
        yield { type: 'final_answer', payload: data.content };
      } else if (data.type === 'done') {
        yield { type: 'done' };
      } else if (data.type === 'error') {
        throw new Error(data.message || data.content || 'Internal server error');
      }
    };
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split(/(?:\r?\n\r?\n|\\n\\n)(?=data:\s*)/);
      buffer = events.pop() || "";

      for (const eventText of events) {
        const payloadText = eventText
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n")
          .trim();

        for await (const out of handleSsePayload(payloadText)) {
          if (out.type === "done") return;
          yield out;
        }
      }
    }

    const tail = (buffer || "").trim();
    if (tail) {
      const payloadText = tail
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n")
        .trim();

      for await (const out of handleSsePayload(payloadText)) {
        if (out.type === "done") return;
        yield out;
      }
    }
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("Request timed out while waiting for backend response.");
      console.error("streamChatMessage timeout:", timeoutError);
      throw timeoutError;
    }
    console.error("streamChatMessage error:", error);
    throw error;
  }
}


export async function submitChatTask(message, sessionId, userId, chatMode = "agent", personality = null, userSettings = null) {
  const body = {
    message,
    session_id: sessionId,
    user_id: userId,
    chat_mode: chatMode,
    user_settings: userSettings,
    file_ids: [],
  };

  const normalizedPersonality = normalizePersonalityForSend(personality);
  if (normalizedPersonality) {
    body.personality = normalizedPersonality;
    if (normalizedPersonality.id) body.personality_id = normalizedPersonality.id;
  }

  const authHeaders = await getAuthHeaders();
  return apiFetch("/chat/submit", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify(body),
  });
}

export async function getChatTaskStatus(taskId) {
  const authHeaders = await getAuthHeaders();
  return apiFetch(`/chat/tasks/${taskId}`, { method: "GET", headers: authHeaders });
}

export async function getChatTaskEvents(taskId, afterSeq = 0) {
  const authHeaders = await getAuthHeaders();
  return apiFetch(`/chat/tasks/${taskId}/events?after_seq=${afterSeq}`, { method: "GET", headers: authHeaders });
}

export async function cancelChatTask(taskId) {
  const authHeaders = await getAuthHeaders();
  try {
    return await apiFetch(`/chat/tasks/${taskId}/cancel`, {
      method: 'POST',
      headers: authHeaders,
    });
  } catch (error) {
    return apiFetch(`/agent/cancel/${taskId}`, {
      method: 'POST',
      headers: authHeaders,
    });
  }
}

export async function confirmChatTask(taskId, confirm = true) {
  const authHeaders = await getAuthHeaders();
  try {
    return await apiFetch(`/chat/tasks/${taskId}/confirm`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ confirm: !!confirm }),
    });
  } catch (error) {
    return apiFetch(`/agent/confirm/${taskId}`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ confirm: !!confirm }),
    });
  }
}

/**
 * WebSocket Chat Manager
 * Supports multi-device connections to the same chat
 */
export class WebSocketChatManager {
  constructor() {
    this.socket = null;
    this.chatId = null;
    this.onToken = null;
    this.onDone = null;
    this.onError = null;
    this.onInfo = null;
    this.onFinalAnswer = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectTimeout = null;
    this.tokenProvider = null;
    this._isConnecting = false; // Sync flag for async token resolution gap
    this._isAuthed = false;
    this._pendingMessages = [];
    this._callbacks = null;
    this._connectionSeq = 0;
  }
  
  /**
   * Connect to WebSocket chat
   * @param {string} chatId - Chat session ID
   * @param {string|function} tokenProvider - Firebase auth token or async provider
   * @param {object} callbacks - {onToken, onDone, onError, onInfo}
   */
  async connect(chatId, tokenProvider = null, callbacks = {}) {
    // Prevent duplicate connection attempts to same chat if already connecting or connected
    if (this.chatId === chatId && (this.isConnected() || this.isConnecting())) {
        return;
    }

    this.chatId = chatId;
    this._isConnecting = true; // Mark as connecting immediately
    this._isAuthed = false;

    this._callbacks = callbacks;
    const connectionSeq = ++this._connectionSeq;

    this.onToken = callbacks.onToken || (() => {});
    this.onDone = callbacks.onDone || (() => {});
    this.onError = callbacks.onError || (() => {});
    this.onInfo = callbacks.onInfo || (() => {});
    this.onFinalAnswer = callbacks.onFinalAnswer || (() => {});
    this.onConnect = callbacks.onConnect || (() => {});
    this.onReconnect = callbacks.onReconnect || (() => {});
    this.tokenProvider = tokenProvider;
    
    if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
    }
    
    try {
        const resolvedToken = await this.resolveToken();
        if (this._connectionSeq !== connectionSeq) {
            return;
        }
        if (!resolvedToken) {
            this.onError('Unauthorized: missing token');
            this._isConnecting = false;
            return;
        }
        
        const wsUrl = `${WS_BASE_URL}/ws/chat`;
        
        // Close existing connection if any (only if this attempt is still current)
        if (this._connectionSeq === connectionSeq && this.socket) {
            this.socket.onclose = null;
            this.socket.close();
            this.socket = null;
        }

        this.socket = new WebSocket(wsUrl);
        const activeSocket = this.socket;
      
      this.socket.onopen = () => {
        if (this._connectionSeq !== connectionSeq || this.socket !== activeSocket) return;
        // console.log('[WS] Connected to chat:', chatId);
        this._isConnecting = false;
        this.reconnectAttempts = 0;
        this._isAuthed = false;
        this.onConnect();
        // Authenticate after connection opens
        this.socket.send(JSON.stringify({
          type: 'auth',
          token: resolvedToken,
          chat_id: chatId
        }));
      };
      
      this.socket.onmessage = (event) => {
        if (this._connectionSeq !== connectionSeq || this.socket !== activeSocket) return;
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'token':
              this.onToken(data.content);
              break;
            case 'done':
              this.onDone();
              break;
            case 'auth_ok':
              this._isAuthed = true;
              this.flushPendingMessages();
              break;
            case 'error':
              this.onError(data.content);
              break;
            case 'info':
              this.onInfo(data.content);
              break;
            case 'final_answer':
              this.onFinalAnswer(data.content);
              break;
            case 'pong':
              // Heartbeat response
              break;
          }
        } catch (e) {
          console.error('[WS] Parse error:', e);
        }
      };
      
      this.socket.onclose = (event) => {
        if (this._connectionSeq !== connectionSeq || this.socket !== activeSocket) return;
        // console.log('[WS] Disconnected:', event.code, event.reason);
        this._isConnecting = false; // Reset flag
        this._isAuthed = false;
        this.socket = null;
        if (event.code === 1008) {
          this.onError('Unauthorized: invalid or expired token');
          return;
        }
        this.attemptReconnect(callbacks);
      };
      
      this.socket.onerror = (error) => {
        if (this._connectionSeq !== connectionSeq || this.socket !== activeSocket) return;
        console.error('[WS] Error:', error);
        this._isConnecting = false; // Reset flag
        this._isAuthed = false;
        this.socket = null;
        this.onError('WebSocket connection error');
      };
      
    } catch (error) {
      console.error('[WS] Connection failed:', error);
      this._isConnecting = false;
      this.onError('Failed to connect');
    }
  }
  
  async resolveToken() {
    if (typeof this.tokenProvider === 'function') {
      try {
        return await this.tokenProvider();
      } catch {
        return null;
      }
    }
    return this.tokenProvider;
  }

  attemptReconnect(callbacks) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      this._isConnecting = true; // Mark as connecting during reconnect wait
      if (this.onReconnect) this.onReconnect();
      
      // console.log(`[WS] Reconnecting... attempt ${this.reconnectAttempts}`);
      
      this.reconnectTimeout = setTimeout(() => {
        this.connect(this.chatId, this.tokenProvider, callbacks);
      }, 1000 * this.reconnectAttempts);
    } else {
        this._isConnecting = false;
        if (this._pendingMessages.length) {
          this._pendingMessages = [];
          this.onError('Not connected to server');
        }
    }
  }
  
  /**
   * Send a chat message
   * @param {string} content - Message content
   * @param {string} chatMode - 'smart' | 'agent' | 'research_pro'
   * @param {object|null} personality - Active personality object
   * @param {object|null} userSettings - User preference settings
   */
  sendMessage(content, chatMode = 'smart', personality = null, userSettings = null) {
    const payload = {
      type: 'message',
      content,
      chat_mode: chatMode,
      user_settings: userSettings
    };

    if (personality) {
       // Pass ID if available, otherwise backend might not resolve it
       if (personality.id) payload.personality_id = personality.id;
    }

    if (this.socket && this.socket.readyState === WebSocket.OPEN && this._isAuthed) {
      this.socket.send(JSON.stringify(payload));
      return;
    }

    if (this.isConnecting() || !this._isAuthed) {
      this._pendingMessages.push(payload);
      return;
    }

    // Attempt reconnect if we have enough context
    if (this.chatId && this.tokenProvider) {
      this._pendingMessages.push(payload);
      this.connect(this.chatId, this.tokenProvider, this._callbacks || {});
      return;
    }

    console.error('[WS] Socket not connected');
    this.onError('Not connected to server');
  }
  
  /**
   * Stop current generation
   */
  stopGeneration() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'stop' }));
    }
  }
  
  /**
   * Send ping (heartbeat)
   */
  ping() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'ping' }));
    }
  }
  
  /**
   * Disconnect from WebSocket
   */
  disconnect() {
    this._isConnecting = false;
    this._isAuthed = false;
    this._connectionSeq += 1; // Invalidate any in-flight connection attempts
    this._pendingMessages = [];
    if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
    }
    if (this.socket) {
      if (this.socket.readyState === WebSocket.CONNECTING) {
        // Suppress browser error for closing a socket that hasn't connected yet
        this.socket.onerror = () => {};
      }
      this.socket.onclose = null;
      this.socket.close(1000); // 1000 = Normal Closure
      this.socket = null;
    }
  }
  
  /**
   * Check if connected
   */
  isConnected() {
    return this.socket && this.socket.readyState === WebSocket.OPEN;
  }

  /**
   * Check if connecting
   */
  isConnecting() {
    return this._isConnecting || (this.socket && this.socket.readyState === WebSocket.CONNECTING);
  }

  flushPendingMessages() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || !this._isAuthed) return;
    if (!this._pendingMessages.length) return;

    const queued = this._pendingMessages.splice(0, this._pendingMessages.length);
    for (const payload of queued) {
      this.socket.send(JSON.stringify(payload));
    }
  }
}

/**
 * Web Search API
 */
export async function webSearch(query, tools = ['Search']) {
  try {
    const result = await apiFetch('/search', {
      method: 'POST',
      body: JSON.stringify({ query, tools }),
    });
    return result;
  } catch (error) {
    console.error('webSearch error:', error);
    return { error: error.message };
  }
}

/**
 * File Upload API - routes to RAG server for document indexing
 */
export async function uploadFile(file, sessionId = 'general') {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('session_id', sessionId);
    
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/files/upload`, {
      method: 'POST',
      headers: { ...authHeaders },
      body: formData,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.detail || payload?.error || 'Upload failed');
    return payload;
  } catch (error) {
    console.error('uploadFile error:', error);
    return { error: error.message };
  }
}

/**
 * Get Chat History
 */
export async function getChatHistory(userId, sessionId, limit = 50) {
  try {
    const authHeaders = await getAuthHeaders();
    return await apiFetch(`/history/${sessionId}?limit=${limit}`, {
      headers: authHeaders,
    });
  } catch (error) {
    console.error('getChatHistory error:', error);
    return { success: false, messages: [] };
  }
}

/**
 * Get current user profile from backend (server-side Firestore read)
 */
export async function fetchUserProfile() {
  const authHeaders = await getAuthHeaders();
  const payload = await apiFetch('/users/me', {
    headers: authHeaders,
  });
  if (payload?.user) return payload;
  if (payload && typeof payload === 'object') {
    return { success: true, user: payload };
  }
  return { success: false, user: null };
}

/**
 * Admin: Get user profile from backend
 */
export async function fetchAdminUser(userId) {
  const authHeaders = await getAuthHeaders();
  return await apiFetch(`/admin/users/${encodeURIComponent(userId)}`, {
    headers: authHeaders,
  });
}

/**
 * Get Personalities
 */
export async function fetchPersonalities(userId) {
  try {
    const authHeaders = await getAuthHeaders();
    return await apiFetch(`/personalities/${userId}`, {
      headers: authHeaders,
    });
  } catch (error) {
    console.error('fetchPersonalities error:', error);
    return { success: false, personalities: [] };
  }
}

/**
 * Create Personality
 */
export async function createPersonality(userId, name, description, prompt, specialty = 'general') {
  try {
    const authHeaders = await getAuthHeaders();
    return await apiFetch(`/personalities`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name,
        description,
        prompt,
        specialty
      }),
    });
  } catch (error) {
    console.error('createPersonality error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update Personality
 */
export async function updatePersonality(userId, personalityId, name, description, prompt, specialty = 'general') {
    try {
      const authHeaders = await getAuthHeaders();
      return await apiFetch(`/personalities/${personalityId}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          name,
          description,
          prompt,
          specialty
        }),
      });
    } catch (error) {
      console.error('updatePersonality error:', error);
      return { success: false, error: error.message };
    }
}

/**
 * Delete Personality
 */
export async function deletePersonality(userId, personalityId) {
    try {
        const authHeaders = await getAuthHeaders();
        return await apiFetch(`/personalities/${personalityId}`, {
            method: 'DELETE',
            headers: authHeaders
        });
    } catch (error) {
        console.error('deletePersonality error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Check backend connection status
 */
let lastHealthCheckAt = 0;
let lastHealthPromise = null;

export async function checkBackendHealth() {
  const now = Date.now();
  if (lastHealthPromise && (now - lastHealthCheckAt) < 5000) {
    return lastHealthPromise;
  }
  lastHealthCheckAt = now;
  lastHealthPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/health`, { method: 'GET' });
      return response.ok;
    } catch {
      return false;
    }
  })();
  return lastHealthPromise;
}

// Export API base URLs for other modules
export { RAG_BASE_URL, WS_BASE_URL };



/**
 * Admin Ops: run inspector
 */
export async function getAdminRun(runId) {
  const authHeaders = await getAuthHeaders();
  return apiFetch(`/admin/ops/run/${encodeURIComponent(runId)}`, {
    method: 'GET',
    headers: authHeaders,
  });
}

/**
 * Admin Ops: replay run (trace_only|simulated|full_execution)
 */
export async function replayAdminRun(runId, mode = 'trace_only', allowFullExecution = false) {
  const authHeaders = await getAuthHeaders();
  return apiFetch(`/admin/ops/replay/${encodeURIComponent(runId)}`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      mode,
      allow_full_execution: !!allowFullExecution,
    }),
  });
}

/**
 * Admin Ops: dry-run planner/tooling preview
 */
export async function dryRunAdminAgent(query, mode = 'agent', topK = 5) {
  const authHeaders = await getAuthHeaders();
  return apiFetch('/admin/ops/dry-run', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      query,
      mode,
      top_k: topK,
    }),
  });
}

/**
 * Memory governance: delete memory item(s)
 */
export async function deleteMemory({ userId = null, factId = null, type = null, mode = 'soft', reason = 'user_request' } = {}) {
  const authHeaders = await getAuthHeaders();
  return apiFetch('/memory/delete', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      user_id: userId,
      fact_id: factId,
      type,
      mode,
      reason,
    }),
  });
}

/**
 * Memory governance: run decay/expiry pass (admin)
 */
export async function runMemoryDecay({ limit = 500, minEffectiveConfidence = 0.2 } = {}) {
  const authHeaders = await getAuthHeaders();
  return apiFetch('/memory/decay/run', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      limit,
      min_effective_confidence: minEffectiveConfidence,
    }),
  });
}
