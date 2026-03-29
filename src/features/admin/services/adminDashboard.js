import { collection, getDocs, doc, query, where, orderBy, getDoc, Timestamp, setDoc } from 'firebase/firestore';
import { db, auth } from '../../../utils/firebaseConfig';
import { API_BASE_URL } from '../../../utils/api';
import { parseHighStakesMetricsPayload, DEFAULT_HS_THRESHOLDS } from './highStakesMetricsAdapter';
import { verifyAdminAccess, validateRoleChange } from './adminSecurity';
import { generateUserId } from '../../users/services/userService';
import { getDefaultPricing, mergePricingWithCatalog } from '../../membership/planCatalog';

export const MEMBERSHIP_PLANS = getDefaultPricing();

export const getAllUsers = async (requesterId) => {
  const { isAdmin, isSuperAdmin, error } = await verifyAdminAccess(requesterId);
  if (error || (!isAdmin && !isSuperAdmin)) throw new Error('Unauthorized access to user data');

  const snapshot = await getDocs(collection(db, 'users'));
  const users = snapshot.docs.map(userDoc => {
    const data = userDoc.data();
    // Inline downgrade so admin sees accurate active state before cron
    if (data.membership && data.membership.plan !== 'free' && data.membership.expiryDate) {
        if (new Date(data.membership.expiryDate) < new Date()) {
            data.membership.plan = 'free';
            data.membership.planName = 'Free';
            data.membership.status = 'expired';
            data.membership.isExpired = true;
        }
    }
    return {
      id: userDoc.id, 
      ...data,
      stats: { filesUploaded: 0, conversations: 0, folders: 0 } // Default stats to avoid UI breaking
    };
  });

  return users.sort((a, b) => {
    const idA = a.uniqueUserId ? parseInt(String(a.uniqueUserId).replace(/\D/g, ''), 10) || 0 : 0;
    const idB = b.uniqueUserId ? parseInt(String(b.uniqueUserId).replace(/\D/g, ''), 10) || 0 : 0;
    return idA - idB;
  });
};

export const getUserStats = async (userId) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) return { filesUploaded: 0, conversations: 0, folders: 0 };

    const userData = userDoc.data();
    let filesUploaded = 0, conversations = 0, folders = 0;

    try { filesUploaded = (await getDocs(collection(db, 'users', userId, 'files'))).size; } catch { if (userData.files) filesUploaded = Object.keys(userData.files).length; }
    try { conversations = (await getDocs(collection(db, 'users', userId, 'conversations'))).size; } catch { if (userData.conversations) conversations = Object.keys(userData.conversations).length; }
    try { folders = (await getDocs(collection(db, 'users', userId, 'folders'))).size; } catch { folders = 3; }

    return { filesUploaded, conversations, folders, lastActivity: userData.lastActivity || userData.createdAt, totalUsage: userData.usage || 0 };
  } catch { return { filesUploaded: 0, conversations: 0, folders: 0 }; }
};

export const getUserStatistics = async (requesterId) => {
  try {
    const { isAdmin, isSuperAdmin, error } = await verifyAdminAccess(requesterId);
    if (error || (!isAdmin && !isSuperAdmin)) throw new Error('Unauthorized access to statistics');

    const snapshot = await getDocs(collection(db, 'users'));
    let totalUsers = 0, premiumUsers = 0, monthlyRevenue = 0, newUsersThisMonth = 0;
    const now = new Date();

    let currentPricing;
    try { currentPricing = await getCurrentPricing(); } catch { currentPricing = MEMBERSHIP_PLANS; }

    snapshot.docs.forEach(d => {
      const userData = d.data();
      totalUsers++;
      const createdAt = userData.createdAt?.toDate?.() || new Date(userData.createdAt);
      if (createdAt?.getMonth() === now.getMonth() && createdAt?.getFullYear() === now.getFullYear()) newUsersThisMonth++;

      const membership = userData.membership;
      if (membership && membership.plan !== 'free' && membership.expiryDate) {
          if (new Date(membership.expiryDate) < new Date()) {
              membership.plan = 'free';
          }
      }

      if (membership?.plan && membership.plan !== 'free') {
        premiumUsers++;
        const plan = membership.plan, billingCycle = membership.billingCycle || 'monthly';
        if (currentPricing[plan]) monthlyRevenue += billingCycle === 'yearly' ? currentPricing[plan].yearly / 12 : currentPricing[plan].monthly;
      }
    });

    return { totalUsers, premiumUsers, freeUsers: totalUsers - premiumUsers, monthlyRevenue: Math.round(monthlyRevenue), newUsersThisMonth, conversionRate: totalUsers > 0 ? Math.round((premiumUsers / totalUsers) * 100) : 0 };
  } catch { return { totalUsers: 0, premiumUsers: 0, freeUsers: 0, monthlyRevenue: 0, newUsersThisMonth: 0, conversionRate: 0 }; }
};

export const updateUserMembership = async (userId, newPlan, billingCycle = 'monthly', paymentData = null, requesterId) => {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${API_BASE_URL}/admin/membership/update`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      target_uid: userId,
      plan: newPlan,
      billing_cycle: billingCycle,
      payment: paymentData || null
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to update membership');
  }

  return await response.json();
};

export const getUsersByPlan = async (planType, requesterId) => {
  try {
    const { isAdmin, isSuperAdmin, error } = await verifyAdminAccess(requesterId);
    if (error || (!isAdmin && !isSuperAdmin)) throw new Error('Unauthorized access to user data');
    const snapshot = await getDocs(collection(db, 'users'));
    return snapshot.docs.map(d => {
        const data = d.data();
        if (data.membership && data.membership.plan !== 'free' && data.membership.expiryDate) {
            if (new Date(data.membership.expiryDate) < new Date()) {
                data.membership.plan = 'free';
            }
        }
        return { id: d.id, ...data };
    }).filter(d => (d.membership?.plan || 'free') === planType)
      .sort((a,b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));
  } catch { return []; }
};

export const getRecentActivity = async (limit = 10, requesterId) => {
  try {
    const { isAdmin, isSuperAdmin, error } = await verifyAdminAccess(requesterId);
    if (error || (!isAdmin && !isSuperAdmin)) throw new Error('Unauthorized access to activity data');
    const q = query(collection(db, 'users'), orderBy('lastActivity', 'desc'));
    return (await getDocs(q)).docs.slice(0, limit).map(d => {
      const data = d.data();
      return { userId: d.id, email: data.email, lastActivity: data.lastActivity, plan: data.membership?.plan || 'free', action: 'Last seen' };
    });
  } catch { return []; }
};

export const exportUserData = async (format = 'json', requesterId) => {
  const { isAdmin, isSuperAdmin, error } = await verifyAdminAccess(requesterId);
  if (error || (!isAdmin && !isSuperAdmin)) throw new Error('Unauthorized access to export data');
  const users = await getAllUsers(requesterId);
  if (format === 'csv') {
    const headers = ['ID', 'Email', 'Plan', 'Created At', 'Expires At', 'Files', 'Conversations'];
    return [headers, ...users.map(u => [u.id, u.email, u.membership?.plan || 'free', u.createdAt?.toDate?.()?.toISOString() || '', u.membership?.expiryDate?.toDate?.()?.toISOString() || '', u.stats?.filesUploaded || 0, u.stats?.conversations || 0])];
  }
  return users;
};

export const getRevenueAnalytics = async (requesterId) => {
  try {
    const { isAdmin, isSuperAdmin, error } = await verifyAdminAccess(requesterId);
    if (error || (!isAdmin && !isSuperAdmin)) throw new Error('Unauthorized access to revenue analytics');

    const pricing = await getCurrentPricing();
    const planPricing = {
      starter: { monthly: pricing.starter?.monthly || 199, yearly: pricing.starter?.yearly || 1999 },
      plus: { monthly: pricing.plus?.monthly || 999, yearly: pricing.plus?.yearly || 9999 },
      pro: { monthly: pricing.pro?.monthly || 1999, yearly: pricing.pro?.yearly || 19999 },
      business: { monthly: pricing.business?.monthly || 2499, yearly: pricing.business?.yearly || 24999 }
    };
    const analytics = { daily: {}, monthly: {}, planBreakdown: { starter: { count: 0, revenue: 0 }, plus: { count: 0, revenue: 0 }, pro: { count: 0, revenue: 0 }, business: { count: 0, revenue: 0 } }, totalRevenue: 0 };

    (await getDocs(collection(db, 'users'))).docs.forEach(d => {
      const data = d.data();
      const membership = data.membership;
      if (membership && membership.plan !== 'free' && membership.expiryDate) {
          if (new Date(membership.expiryDate) < new Date()) {
              membership.plan = 'free';
          }
      }
      if (membership?.plan && membership.plan !== 'free' && planPricing[membership.plan]) {
        const revenue = (membership.billingCycle || 'monthly') === 'yearly' ? planPricing[membership.plan].yearly : planPricing[membership.plan].monthly;
        analytics.planBreakdown[membership.plan].count++;
        analytics.planBreakdown[membership.plan].revenue += revenue;
        analytics.totalRevenue += revenue;
      }
    });
    return analytics;
  } catch { return { daily: {}, monthly: {}, planBreakdown: { starter: { count: 0, revenue: 0 }, plus: { count: 0, revenue: 0 }, pro: { count: 0, revenue: 0 }, business: { count: 0, revenue: 0 } }, totalRevenue: 0 }; }
};

export const testPaymentsCollection = async () => {
  try { await getDocs(collection(db, 'payments')); return true; } catch { return false; }
};

export const getPaymentAnalytics = async (requesterId) => {
  try {
    const { isAdmin, isSuperAdmin, error } = await verifyAdminAccess(requesterId);
    if (error || (!isAdmin && !isSuperAdmin)) throw new Error('Unauthorized access to payment analytics');

    if (!await testPaymentsCollection()) return { payments: [], analytics: { totalRevenue: 0, monthlyRevenue: {}, planDistribution: { starter: { count: 0, revenue: 0 }, plus: { count: 0, revenue: 0 }, pro: { count: 0, revenue: 0 }, business: { count: 0, revenue: 0 } }, paymentMethods: { card: 0, upi: 0, netbanking: 0 } } };

    const payments = [], analytics = { totalRevenue: 0, monthlyRevenue: {}, planDistribution: { starter: { count: 0, revenue: 0 }, plus: { count: 0, revenue: 0 }, pro: { count: 0, revenue: 0 }, business: { count: 0, revenue: 0 } }, paymentMethods: { card: 0, upi: 0, netbanking: 0 } };

    (await getDocs(collection(db, 'payments'))).docs.forEach(d => {
      try {
        const data = { id: d.id, ...d.data() };
        payments.push(data);
        analytics.totalRevenue += data.amount || 0;
        if (data.timestamp) {
          const date = data.timestamp.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
          const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
          analytics.monthlyRevenue[key] = (analytics.monthlyRevenue[key] || 0) + (data.amount || 0);
        }
        if (data.plan && analytics.planDistribution[data.plan]) { analytics.planDistribution[data.plan].count++; analytics.planDistribution[data.plan].revenue += data.amount || 0; }
        if (data.method && analytics.paymentMethods[data.method] !== undefined) analytics.paymentMethods[data.method]++;
      } catch { /* silent */ }
    });

    payments.sort((a, b) => {
      try { return (b.timestamp?.toDate?.() || new Date(b.timestamp || 0)).getTime() - (a.timestamp?.toDate?.() || new Date(a.timestamp || 0)).getTime(); } catch { return 0; }
    });
    return { payments, analytics };
  } catch { return { payments: [], analytics: { totalRevenue: 0, monthlyRevenue: {}, planDistribution: { starter: { count: 0, revenue: 0 }, plus: { count: 0, revenue: 0 }, pro: { count: 0, revenue: 0 }, business: { count: 0, revenue: 0 } }, paymentMethods: { card: 0, upi: 0, netbanking: 0 } } }; }
};

export const updateUserRole = async (userId, newRole, requesterId) => {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${API_BASE_URL}/admin/change-role`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ target_uid: userId, new_role: newRole })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to update role');
  }

  return await response.json();
};

export const calculateYearlyPrice = (monthlyPrice, discountPercentage) => {
  if (monthlyPrice === 0) return 0;
  return Math.round(monthlyPrice * 12 * (1 - discountPercentage / 100));
};

export const savePricingChanges = async (updatedPrices, requesterId) => {
  const { isAdmin, isSuperAdmin, error } = await verifyAdminAccess(requesterId);
  if (error || (!isAdmin && !isSuperAdmin)) throw new Error('Unauthorized access to pricing updates');

  const processedPrices = { ...updatedPrices };
  Object.keys(processedPrices).forEach(planId => {
    const plan = processedPrices[planId];
    if (plan.monthly !== undefined && plan.yearlyDiscountPercentage !== undefined) {
      processedPrices[planId] = { ...plan, yearly: calculateYearlyPrice(plan.monthly, plan.yearlyDiscountPercentage) };
    } else if (plan.monthly !== undefined && plan.yearly === undefined) {
      processedPrices[planId] = { ...plan, yearly: plan.monthly * 12, yearlyDiscountPercentage: 0 };
    }
  });

  await setDoc(doc(db, 'config', 'pricing'), { plans: processedPrices, updatedAt: Timestamp.fromDate(new Date()), updatedBy: requesterId }, { merge: true });
  return { success: true, message: 'Pricing updated successfully!' };
};

export const getCurrentPricing = async () => {
  try {
    const pricingDoc = await getDoc(doc(db, 'config', 'pricing'));
    const rawPricing = pricingDoc.exists() ? (pricingDoc.data().plans || {}) : {};
    return mergePricingWithCatalog(rawPricing);
  } catch {
    return mergePricingWithCatalog();
  }
};

export const validateCoupon = async (couponCode) => {
  try { const { validateCoupon: fn } = await import('../../../utils/couponManagement'); return await fn(couponCode); } catch { return null; }
};

export const saveCoupon = async (couponData, requesterId) => {
  try {
    const { isAdmin, isSuperAdmin, error } = await verifyAdminAccess(requesterId);
    if (error || (!isAdmin && !isSuperAdmin)) throw new Error('Unauthorized');
    const { saveCoupon: fn } = await import('../../../utils/couponManagement');
    return await fn(couponData);
  } catch (e) { return { success: false, message: 'Failed: ' + e.message }; }
};

export const getAllCoupons = async (requesterId) => {
  try {
    const { isAdmin, isSuperAdmin, error } = await verifyAdminAccess(requesterId);
    if (error || (!isAdmin && !isSuperAdmin)) throw new Error('Unauthorized');
    const { getAllCoupons: fn } = await import('../../../utils/couponManagement');
    return await fn();
  } catch { return []; }
};

export const updateCoupon = async (couponId, updateData, requesterId) => {
  try {
    const { isAdmin, isSuperAdmin, error } = await verifyAdminAccess(requesterId);
    if (error || (!isAdmin && !isSuperAdmin)) throw new Error('Unauthorized');
    const { updateCoupon: fn } = await import('../../../utils/couponManagement');
    return await fn(couponId, updateData);
  } catch (e) { return { success: false, message: 'Failed: ' + e.message }; }
};

export const deleteCoupon = async (couponId, requesterId) => {
  try {
    const { isAdmin, isSuperAdmin, error } = await verifyAdminAccess(requesterId);
    if (error || (!isAdmin && !isSuperAdmin)) throw new Error('Unauthorized');
    const { deleteCoupon: fn } = await import('../../../utils/couponManagement');
    return await fn(couponId);
  } catch (e) { return { success: false, message: 'Failed: ' + e.message }; }
};

export const toggleCouponStatus = async (couponId, active, requesterId) => {
  try {
    const { isAdmin, isSuperAdmin, error } = await verifyAdminAccess(requesterId);
    if (error || (!isAdmin && !isSuperAdmin)) throw new Error('Unauthorized');
    const { toggleCouponStatus: fn } = await import('../../../utils/couponManagement');
    return await fn(couponId, active);
  } catch (e) { return { success: false, message: 'Failed: ' + e.message }; }
};

export const deleteUser = async (userId, requesterId) => {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to delete user');
  }

  return await response.json();
};

export const getUsersByMembership = async (membershipType, requesterId) => {
  try {
    const { isAdmin, isSuperAdmin, error } = await verifyAdminAccess(requesterId);
    if (error || (!isAdmin && !isSuperAdmin)) throw new Error('Unauthorized');
    const snapshot = await getDocs(collection(db, 'users'));
    return snapshot.docs.map(d => {
        const data = d.data();
        if (data.membership && data.membership.plan !== 'free' && data.membership.expiryDate) {
            if (new Date(data.membership.expiryDate) < new Date()) {
                data.membership.plan = 'free';
            }
        }
        return { id: d.id, ...data };
    }).filter(d => (d.membership?.plan || 'free') === membershipType);
  } catch { return []; }
};

export const checkPaymentStatus = async (paymentId) => {
  try {
     const token = await auth.currentUser?.getIdToken();
     if (!token) throw new Error('Not authenticated');
     const response = await fetch(`${API_BASE_URL}/payment/admin/check-payment/${paymentId}`, {
        method: 'GET',
        headers: {
           'Authorization': `Bearer ${token}`
        }
     });
     if (!response.ok) {
        throw new Error((await response.json()).detail || 'Failed to check payment');
     }
     return await response.json();
  } catch (error) {
     throw error;
  }
};

export const syncPaymentManual = async (paymentId, userId, planId) => {
  try {
     const token = await auth.currentUser?.getIdToken();
     if (!token) throw new Error('Not authenticated');
     const response = await fetch(`${API_BASE_URL}/payment/admin/sync-payment/${paymentId}`, {
        method: 'POST',
        headers: {
           'Content-Type': 'application/json',
           'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ user_id: userId, plan_id: planId })
     });
     if (!response.ok) {
        throw new Error((await response.json()).detail || 'Failed to sync payment');
     }
     return await response.json();
  } catch (error) {
     throw error;
  }
};

export const getHighStakesMetrics = async (range = "24h") => {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${API_BASE_URL}/admin/high-stakes-metrics?range=${encodeURIComponent(range)}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to load high-stakes metrics');
  }

  const data = await response.json();
  return parseHighStakesMetricsPayload(data);
};

export const getHighStakesThresholds = async () => {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${API_BASE_URL}/admin/high-stakes-thresholds`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to load high-stakes thresholds');
  }

  const data = await response.json();
  const t = data?.thresholds || {};
  return {
    source_fail_spike: Number(t.source_fail_spike ?? DEFAULT_HS_THRESHOLDS.source_fail_spike),
    low_confidence_spike: Number(t.low_confidence_spike ?? DEFAULT_HS_THRESHOLDS.low_confidence_spike),
    recency_fail_spike: Number(t.recency_fail_spike ?? DEFAULT_HS_THRESHOLDS.recency_fail_spike),
  };
};

export const updateHighStakesThresholds = async (thresholds) => {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${API_BASE_URL}/admin/high-stakes-thresholds`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ thresholds })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to update high-stakes thresholds');
  }

  const data = await response.json();
  return data?.thresholds || thresholds;
};

export const getAgentDebugInsights = async (range = '24h', limit = 25) => {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(
    `${API_BASE_URL}/admin/agent-debug?range=${encodeURIComponent(range)}&limit=${encodeURIComponent(limit)}`,
    {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to load agent debug insights');
  }

  const data = await response.json();
  return data?.data || {};
};

export const getAdminOpsInsights = async (range = '24h', limit = 25) => {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(
    `${API_BASE_URL}/admin/ops-insights?range=${encodeURIComponent(range)}&limit=${encodeURIComponent(limit)}`,
    {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to load operational insights');
  }

  const data = await response.json();
  return data?.data || {};
};

export const getAgentModeCheck = async (input, requestedMode = 'smart') => {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${API_BASE_URL}/admin/agent-debug/mode-check`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      input: String(input || ''),
      requested_mode: String(requestedMode || 'smart')
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to run agent mode check');
  }

  const data = await response.json();
  return data?.data || {};
};

export const updateAgentDebugConfig = async (configPatch) => {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${API_BASE_URL}/admin/agent-debug-config`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(configPatch || {})
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to update agent debug config');
  }

  const data = await response.json();
  return data?.config || {};
};

export const createAdaptiveSnapshot = async (label = 'manual') => {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${API_BASE_URL}/admin/agent-debug/adaptive/snapshot`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ label: String(label || 'manual') })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to create adaptive snapshot');
  }

  const data = await response.json();
  return data?.data || {};
};

export const rollbackAdaptiveSnapshot = async () => {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${API_BASE_URL}/admin/agent-debug/adaptive/rollback`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to rollback adaptive snapshot');
  }

  const data = await response.json();
  return data?.data || {};
};




