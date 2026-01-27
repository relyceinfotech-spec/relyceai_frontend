import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, getDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import { sendChatMessage, checkBackendHealth, fetchPersonalities, createPersonality, updatePersonality, deletePersonality } from '../utils/api';

class ChatService {
  static async addMessage(userId, sessionId, role, content, files = []) {
    const processedFiles = files.map(({ file, ...metadata }) => metadata);

    if (!sessionId || !userId) return Date.now().toString();

    try {
      const messagesRef = collection(db, 'users', userId, 'chatSessions', sessionId, 'messages');
      const docRef = await addDoc(messagesRef, {
        role,
        content,
        files: processedFiles,
        timestamp: serverTimestamp(),
        createdAt: new Date().toISOString(),
      });
      return docRef.id;
    } catch {
      return Date.now().toString();
    }
  }

  static subscribeToMessages(userId, sessionId, callback) {
    if (!userId || !sessionId) {
      callback([]);
      return () => {};
    }

    const messagesRef = collection(db, 'users', userId, 'chatSessions', sessionId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, () => callback([]));
  }

  static async updateSessionName(userId, sessionId, newName) {
    if (sessionId && userId) {
      const sessionRef = doc(db, 'users', userId, 'chatSessions', sessionId);
      await updateDoc(sessionRef, { name: newName });
    }
  }

  static async getUserUniqueId(userId) {
    try {
      if (userId) {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) return userDoc.data().uniqueUserId || null;
      }
      return null;
    } catch {
      return null;
    }
  }

  static async sendMessage(message, sessionId, userId, chatMode = 'standard', fileIds = [], personality = null) {
    try {
      const result = await sendChatMessage(message, sessionId, userId, chatMode, fileIds, personality);
      return result;
    } catch (error) {
      console.error('ChatService.sendMessage error:', error);
      return { success: false, error: error.message };
    }
  }

  // Personalities
  static async getPersonalities(userId) {
    try {
      return await fetchPersonalities(userId);
    } catch (error) {
      console.error('ChatService.getPersonalities error:', error);
      return { success: false, personalities: [] };
    }
  }

  static async createPersonality(userId, name, description, prompt, contentMode = 'hybrid') {
    try {
      return await createPersonality(userId, name, description, prompt, contentMode);
    } catch (error) {
      console.error('ChatService.createPersonality error:', error);
      return { success: false, error: error.message };
    }
  }

  static async updatePersonality(userId, personalityId, name, description, prompt, contentMode = 'hybrid') {
    try {
      return await updatePersonality(userId, personalityId, name, description, prompt, contentMode);
    } catch (error) {
        console.error('ChatService.updatePersonality error:', error);
        return { success: false, error: error.message };
    }
  }

  static async deletePersonality(userId, personalityId) {
    try {
        return await deletePersonality(userId, personalityId);
    } catch (error) {
        console.error('ChatService.deletePersonality error:', error);
        return { success: false, error: error.message };
    }
  }

  // Check if backend is reachable
  static async checkConnection() {
    return await checkBackendHealth();
  }

  // Legacy methods - kept for compatibility but no longer used
  static setUserId(/* userId */) { /* no-op for REST API */ }
  static setUniqueUserId(/* uniqueUserId */) { /* no-op for REST API */ }
  static setCurrentSessionId(/* sessionId */) { /* no-op for REST API */ }
}

export default ChatService;