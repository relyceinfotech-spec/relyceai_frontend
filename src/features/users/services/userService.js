import { doc, setDoc, getDoc, collection, updateDoc, query, getDocs, serverTimestamp, runTransaction } from 'firebase/firestore';
import { db } from '../../../utils/firebaseConfig';
import { createUserFolderStructure } from '../../files/services/fileService';
import { MEMBERSHIP_PLANS } from '../../membership/services/membershipService';

export async function generateUserId() {
    const counterRef = doc(db, 'counters', 'userIds');
    
    try {
        // Use a transaction to ensure atomic read-modify-write
        const generatedId = await runTransaction(db, async (transaction) => {
            const counterSnap = await transaction.get(counterRef);
            let nextIdNumber = 1;

            if (counterSnap.exists()) {
                const currentCounter = counterSnap.data().currentId || 0;
                nextIdNumber = currentCounter + 1;
                transaction.update(counterRef, { currentId: nextIdNumber, lastUpdated: new Date() });
            } else {
                // Counter doesn't exist - scan users for max ID (only happens once)
                console.log('[generateUserId] Counter does not exist, scanning users...');
                const usersRef = collection(db, 'users');
                const snapshot = await getDocs(usersRef);
                let maxIdNumber = 0;
                snapshot.docs.forEach(userDoc => {
                    const userData = userDoc.data();
                    if (userData.uniqueUserId?.startsWith('RA')) {
                        const idNumber = parseInt(userData.uniqueUserId.substring(2));
                        if (!isNaN(idNumber) && idNumber > maxIdNumber) maxIdNumber = idNumber;
                    }
                });
                nextIdNumber = maxIdNumber + 1;
                transaction.set(counterRef, { currentId: nextIdNumber, lastUpdated: new Date() });
                console.log('[generateUserId] Created counter with currentId:', nextIdNumber);
            }
            
            return `RA${nextIdNumber.toString().padStart(3, '0')}`;
        });
        
        console.log('[generateUserId] Generated unique ID:', generatedId);
        return generatedId;
    } catch (error) {
        console.error('[generateUserId] Transaction failed:', error);
        // Fallback: Use timestamp + random suffix for uniqueness
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 5).toUpperCase();
        const fallbackId = `RA${timestamp.toString().slice(-4)}${randomSuffix}`;
        console.log('[generateUserId] Using fallback ID:', fallbackId);
        return fallbackId;
    }
}

export async function createUserProfile(userData, membershipPlan = 'free') {
    const userId = userData.uid;
    const userEmail = userData.email;
    const userName = userData.displayName || userEmail.split('@')[0];
    const uniqueUserId = await generateUserId();

    const now = new Date();
    const planDetails = MEMBERSHIP_PLANS[membershipPlan.toUpperCase()];
    const expiryDate = planDetails?.duration !== 'unlimited' ? new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)) : null;

    const userProfile = {
        email: userEmail,
        displayName: userName,
        userId, uniqueUserId,
        role: 'user',
        accountCreatedAt: serverTimestamp(),
        accountCreatedDate: now.toISOString(),
        lastLoginAt: serverTimestamp(),
        membership: {
            plan: membershipPlan,
            planName: planDetails.name,
            status: 'active',
            startDate: now.toISOString(),
            expiryDate: expiryDate?.toISOString() || null,
            isExpired: false,
            billingCycle: 'monthly',
            autoRenew: false,
            paymentStatus: membershipPlan === 'free' ? 'free' : 'pending'
        },
        usage: {
            totalChats: 0, totalMessages: 0, totalFilesUploaded: 0,
            storageUsedMB: 0, monthlyQuotaUsed: 0, lastResetDate: now.toISOString()
        },
        settings: { notifications: true, emailUpdates: true, dataRetention: true }
    };

    await setDoc(doc(db, 'users', userId), userProfile);
    await createUserFolderStructure(userId, userName);
    return userProfile;
}

export async function updateUserUsage(userId, updates) {
    try {
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);
        if (!userDoc.exists()) return;

        const currentUsage = userDoc.data().usage;
        const usageUpdates = {};
        if (updates.chats) usageUpdates['usage.totalChats'] = currentUsage.totalChats + updates.chats;
        if (updates.messages) usageUpdates['usage.totalMessages'] = currentUsage.totalMessages + updates.messages;
        if (updates.filesUploaded) usageUpdates['usage.totalFilesUploaded'] = currentUsage.totalFilesUploaded + updates.filesUploaded;
        if (updates.storageUsedMB) usageUpdates['usage.storageUsedMB'] = currentUsage.storageUsedMB + updates.storageUsedMB;
        if (updates.quotaUsed) usageUpdates['usage.monthlyQuotaUsed'] = currentUsage.monthlyQuotaUsed + updates.quotaUsed;
        await updateDoc(userRef, usageUpdates);
    } catch { /* silent */ }
}

export async function updateUserLastLogin(userId) {
    try {
        await updateDoc(doc(db, 'users', userId), { lastLoginAt: serverTimestamp() });
    } catch { /* silent */ }
}

export async function assignUserIdToExistingUser(userId, userData) {
    try {
        if (userData.uniqueUserId) return userData.uniqueUserId;
        const uniqueUserId = await generateUserId();
        await updateDoc(doc(db, 'users', userId), { uniqueUserId, updatedAt: serverTimestamp() });
        return uniqueUserId;
    } catch { return null; }
}

export async function ensureUserHasId(userId) {
    try {
        const userDocRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userDocRef);
        if (!userDoc.exists()) {
            console.warn('[ensureUserHasId] User document does not exist for:', userId);
            return null;
        }

        const userData = userDoc.data();
        if (userData.uniqueUserId) {
            return userData.uniqueUserId;
        }

        console.log('[ensureUserHasId] Generating new uniqueUserId for user:', userId);
        const uniqueUserId = await generateUserId();
        console.log('[ensureUserHasId] Generated uniqueUserId:', uniqueUserId);
        
        await updateDoc(userDocRef, { uniqueUserId, updatedAt: serverTimestamp() });
        console.log('[ensureUserHasId] Successfully assigned uniqueUserId:', uniqueUserId, 'to user:', userId);
        
        return uniqueUserId;
    } catch (error) {
        console.error('[ensureUserHasId] Error assigning uniqueUserId:', error);
        return null;
    }
}

export async function getUserRole(userId) {
    try {
        const userData = await getUserData(userId);
        if (!userData) return 'user';
        const role = userData.role || 'user';
        return role === 'super_admin' ? 'superadmin' : role;
    } catch { return 'user'; }
}

export async function getUserData(userId) {
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        return userDoc.exists() ? userDoc.data() : null;
    } catch { return null; }
}
