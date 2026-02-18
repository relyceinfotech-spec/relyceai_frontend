// src/utils/api.js
// FastAPI Backend Integration Layer
// Production-ready REST API and WebSocket communication
import { auth } from './firebaseConfig';

/**
 * FastAPI Backend Configuration
 * Set VITE_API_BASE_URL in your .env file
 */
const normalizeLocalhost = (url) => url.replace(/:\/\/localhost(?=[:/]|$)/, '://127.0.0.1');
const API_BASE_URL = normalizeLocalhost(
  import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080'
);

const WS_BASE_URL = API_BASE_URL.startsWith('https')
  ? API_BASE_URL.replace('https', 'wss')
  : API_BASE_URL.replace('http', 'ws');

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
    content_mode,
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
    content_mode,
    specialty,
    temperature: temp,
    ...sampling,
  };
}

export async function sendChatMessage(message, sessionId, userId, chatMode = 'normal', fileIds = [], personality = null, userSettings = null) {
  try {
    const body = {
      message,
      session_id: sessionId,
      user_id: userId,
      chat_mode: chatMode,
      file_ids: fileIds,
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
      tools_activated: result.tools_activated
    };
  } catch (error) {
    console.error('sendChatMessage error:', error);
    return { success: false, error: error.message, response: null };
  }
}

/**
 * Streaming Chat API - For Server-Sent Events (SSE) streaming
 */
export async function* streamChatMessage(message, sessionId, userId, chatMode = 'normal', fileIds = [], personality = null, userSettings = null) {
  try {
    const body = { 
      message, 
      session_id: sessionId, 
      user_id: userId, 
      chat_mode: chatMode, 
      file_ids: fileIds,
      user_settings: userSettings
    };

    const normalizedPersonality = normalizePersonalityForSend(personality);
    if (normalizedPersonality) {
      body.personality = normalizedPersonality;
      if (normalizedPersonality.id) body.personality_id = normalizedPersonality.id;
    }

    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Rate limited. Please wait a minute and try again.');
      }
      throw new Error(`HTTP ${response.status}`);
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      
      const lines = buffer.split('\n');
      // Keep the last partial line in the buffer
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (!line.trim() || !line.startsWith('data: ')) continue;
        
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === 'token') {
            yield data.content;
          } else if (data.type === 'done') {
            return;
          } else if (data.type === 'error') {
            throw new Error(data.content);
          }
        } catch {
          console.warn('Failed to parse SSE line:', line);
        }
      }
    }
  } catch (error) {
    console.error('streamChatMessage error:', error);
    yield `Error: ${error.message}`;
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
    // Prevent duplicate connection attempts to same chat
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
   * @param {string} chatMode - 'normal' | 'business' | 'deepsearch'
   * @param {object|null} personality - Active personality object
   * @param {object|null} userSettings - User preference settings
   */
  sendMessage(content, chatMode = 'normal', personality = null, userSettings = null) {
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
      this.socket.onclose = null;
      this.socket.close();
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
 * File Upload API
 */
export async function uploadFile(file) {
  try {
    const formData = new FormData();
    formData.append('file', file);
    const authHeaders = await getAuthHeaders();
    
    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      headers: authHeaders,
      body: formData,
    });
    
    if (!response.ok) throw new Error('Upload failed');
    return await response.json();
  } catch (error) {
    console.error('uploadFile error:', error);
    return { error: error.message };
  }
}

/**
 * File Delete API
 */
export async function deleteFile(fileName) {
  try {
    if (!auth.currentUser) {
      throw new Error('User not authenticated');
    }
    const uid = auth.currentUser.uid;
    const authHeaders = await getAuthHeaders();
    return await apiFetch(`/delete/${uid}/${encodeURIComponent(fileName)}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
  } catch (error) {
    console.error('deleteFile error:', error);
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
  return await apiFetch('/users/me', {
    headers: authHeaders,
  });
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
export async function createPersonality(userId, name, description, prompt, contentMode = 'hybrid', specialty = 'general') {
  try {
    const authHeaders = await getAuthHeaders();
    return await apiFetch(`/personalities`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name,
        description,
        prompt,
        content_mode: contentMode,
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
export async function updatePersonality(userId, personalityId, name, description, prompt, contentMode = 'hybrid', specialty = 'general') {
    try {
      const authHeaders = await getAuthHeaders();
      return await apiFetch(`/personalities/${personalityId}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          name,
          description,
          prompt,
          content_mode: contentMode,
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

// Export API base URL for other modules
export { API_BASE_URL, WS_BASE_URL };
