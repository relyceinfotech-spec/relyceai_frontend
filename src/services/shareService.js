import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';

class ShareService {
  static async shareChat(userId, sessionId, messages) {
    if (!sessionId || !userId || messages.length === 0) {
      throw new Error('No chat to share!');
    }

    const shareId = crypto.randomUUID();
    
    const sharedChatData = {
      shareId,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp || msg.createdAt
      })),
      sharedAt: serverTimestamp(),
      isPublic: true
    };

    await addDoc(collection(db, 'sharedChats'), sharedChatData);
    return `${window.location.origin}/shared/${shareId}`;
  }

  static async copyShareLink(shareUrl) {
    await navigator.clipboard.writeText(shareUrl);
  }
}

export default ShareService;
