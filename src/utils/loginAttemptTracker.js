/**
 * Login Attempt Tracker
 * 2-Layer Security: Frontend UX + Backend Enforcement
 */

import { API_BASE_URL } from './api';

const API_BASE = API_BASE_URL;
const STORAGE_KEY = 'login_attempts';

/**
 * Check if login is allowed (calls backend for real enforcement)
 * @param {string} email 
 * @returns {Promise<{ allowed: boolean, waitSeconds: number, attempts: number, message: string }>}
 */
export async function checkLoginAllowed(email) {
    try {
        const response = await fetch(`${API_BASE}/auth/check-limit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        if (!response.ok) {
            // Fail-open: allow if backend unreachable
            return { allowed: true, waitSeconds: 0, attempts: 0, message: '' };
        }

        const data = await response.json();
        return {
            allowed: data.allowed,
            waitSeconds: data.wait_seconds || 0,
            attempts: data.attempts || 0,
            message: data.message || ''
        };
    } catch (error) {
        console.warn('[LoginTracker] Backend check failed, allowing attempt:', error);
        return { allowed: true, waitSeconds: 0, attempts: 0, message: '' };
    }
}

/**
 * Record a failed login attempt (calls backend)
 * @param {string} email 
 * @returns {Promise<{ attempts: number, waitSeconds: number, message: string }>}
 */
export async function recordFailedLogin(email) {
    // Update localStorage for instant UI feedback
    updateLocalAttempts(email);

    try {
        const response = await fetch(`${API_BASE}/auth/record-failure`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        if (!response.ok) {
            return getLocalAttemptInfo(email);
        }

        const data = await response.json();
        return {
            attempts: data.attempts || 0,
            waitSeconds: data.wait_seconds || 0,
            message: data.message || ''
        };
    } catch (error) {
        console.warn('[LoginTracker] Failed to record attempt:', error);
        return getLocalAttemptInfo(email);
    }
}

/**
 * Clear attempts on successful login (calls backend)
 * @param {string} email 
 */
export async function clearLoginAttempts(email) {
    // Clear localStorage
    clearLocalAttempts(email);

    try {
        await fetch(`${API_BASE}/auth/clear-attempts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
    } catch (error) {
        console.warn('[LoginTracker] Failed to clear attempts:', error);
    }
}

// ============================================
// Local Storage Helpers (UX Layer)
// ============================================

function getLocalData() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : {};
    } catch {
        return {};
    }
}

function saveLocalData(data) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
        // Ignore storage errors
    }
}

function getEmailKey(email) {
    const normalized = email.toLowerCase().trim();
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
        const char = normalized.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0').slice(0, 16);
}

function updateLocalAttempts(email) {
    const data = getLocalData();
    const key = getEmailKey(email);
    const existing = data[key] || { attempts: 0, lastAttempt: 0 };

    // Reset if more than 30 min since last attempt
    if (Date.now() - existing.lastAttempt > 30 * 60 * 1000) {
        existing.attempts = 0;
    }

    existing.attempts += 1;
    existing.lastAttempt = Date.now();
    data[key] = existing;
    saveLocalData(data);
}

function getLocalAttemptInfo(email) {
    const data = getLocalData();
    const key = getEmailKey(email);
    const existing = data[key] || { attempts: 0, lastAttempt: 0 };

    // Progressive delays
    const delays = { 1: 0, 2: 0, 3: 30, 4: 120, 5: 600 };
    const attempts = existing.attempts;
    const waitSeconds = delays[Math.min(attempts, 5)] || 600;

    return {
        attempts,
        waitSeconds,
        message: attempts >= 5
            ? `Account temporarily locked. Try again in ${Math.ceil(waitSeconds / 60)} minutes.`
            : attempts >= 3
                ? `Too many attempts. Please wait ${waitSeconds} seconds.`
                : ''
    };
}

function clearLocalAttempts(email) {
    const data = getLocalData();
    const key = getEmailKey(email);
    delete data[key];
    saveLocalData(data);
}

export default {
    checkLoginAllowed,
    recordFailedLogin,
    clearLoginAttempts
};

