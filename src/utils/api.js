// src/utils/api.js
// FastAPI Backend Integration Layer
// Production-ready REST API and WebSocket communication

/**
 * FastAPI Backend Configuration
 * Set VITE_API_BASE_URL in your .env file
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
console.log("[Debug] API_BASE_URL =", API_BASE_URL); // Log for production debugging
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
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: { ...defaultHeaders, ...options.headers },
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Request failed' }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error.message);
    throw error;
  }
}

/**
 * Chat API - Send message to FastAPI and get response
 */
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

    if (personality) {
      if (personality.id) body.personality_id = personality.id;
      else body.personality = personality;
    }

    const result = await apiFetch('/chat', {
      method: 'POST',
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

    if (personality) {
      if (personality.id) body.personality_id = personality.id;
      else body.personality = personality;
    }

    const response = await fetch(`${API_BASE_URL}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
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
        } catch (e) {
          console.warn('Failed to parse SSE line:', line);
        }
      }
    }
  } catch (error) {
    console.error('streamChatMessage error:', error);
    yield `⚠️ Error: ${error.message}`;
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
  }
  
  /**
   * Connect to WebSocket chat
   * @param {string} chatId - Chat session ID
   * @param {string} token - Firebase auth token (optional)
   * @param {object} callbacks - {onToken, onDone, onError, onInfo}
   */
  connect(chatId, token = null, callbacks = {}) {
    this.chatId = chatId;
    this.onToken = callbacks.onToken || (() => {});
    this.onDone = callbacks.onDone || (() => {});
    this.onError = callbacks.onError || (() => {});
    this.onInfo = callbacks.onInfo || (() => {});
    
    const params = new URLSearchParams();
    if (token) params.append('token', token);
    params.append('chat_id', chatId);
    
    const wsUrl = `${WS_BASE_URL}/ws/chat?${params.toString()}`;
    
    try {
      this.socket = new WebSocket(wsUrl);
      
      this.socket.onopen = () => {
        console.log('[WS] Connected to chat:', chatId);
        this.reconnectAttempts = 0;
      };
      
      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'token':
              this.onToken(data.content);
              break;
            case 'done':
              this.onDone();
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
        console.log('[WS] Disconnected:', event.code, event.reason);
        this.attemptReconnect(token, callbacks);
      };
      
      this.socket.onerror = (error) => {
        console.error('[WS] Error:', error);
        this.onError('WebSocket connection error');
      };
      
    } catch (error) {
      console.error('[WS] Connection failed:', error);
      this.onError('Failed to connect');
    }
  }
  
  attemptReconnect(token, callbacks) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`[WS] Reconnecting... attempt ${this.reconnectAttempts}`);
      setTimeout(() => {
        this.connect(this.chatId, token, callbacks);
      }, 1000 * this.reconnectAttempts);
    }
  }
  
  /**
   * Send a chat message
   * @param {string} content - Message content
   * @param {string} chatMode - 'normal' | 'business' | 'deepsearch'
   */
  sendMessage(content, chatMode = 'normal') {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        type: 'message',
        content,
        chat_mode: chatMode
      }));
    } else {
      console.error('[WS] Socket not connected');
      this.onError('Not connected to server');
    }
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
    if (this.socket) {
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
export async function uploadFile(file, userId) {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('user_id', userId);
    
    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
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
export async function deleteFile(userId, fileName) {
  try {
    return await apiFetch(`/delete/${userId}/${encodeURIComponent(fileName)}`, {
      method: 'DELETE',
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
    return await apiFetch(`/history/${userId}/${sessionId}?limit=${limit}`);
  } catch (error) {
    console.error('getChatHistory error:', error);
    return { success: false, messages: [] };
  }
}

/**
 * Get Personalities
 */
export async function fetchPersonalities(userId) {
  try {
    return await apiFetch(`/personalities/${userId}`);
  } catch (error) {
    console.error('fetchPersonalities error:', error);
    return { success: false, personalities: [] };
  }
}

/**
 * Create Personality
 */
export async function createPersonality(userId, name, description, prompt) {
  try {
    return await apiFetch(`/personalities?user_id=${userId}`, {
      method: 'POST',
      body: JSON.stringify({
        name,
        description,
        prompt
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
export async function updatePersonality(userId, personalityId, name, description, prompt) {
    try {
      return await apiFetch(`/personalities/${personalityId}?user_id=${userId}`, {
        method: 'PUT',
        body: JSON.stringify({
          name,
          description,
          prompt
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
        return await apiFetch(`/personalities/${personalityId}?user_id=${userId}`, {
            method: 'DELETE'
        });
    } catch (error) {
        console.error('deletePersonality error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Check backend connection status
 */
export async function checkBackendHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, { method: 'GET' });
    return response.ok;
  } catch {
    return false;
  }
}

// Export API base URL for other modules
export { API_BASE_URL, WS_BASE_URL };
