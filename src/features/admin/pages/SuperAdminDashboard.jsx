import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  getAllUsers,
  updateUserRole,
  updateUserMembership,
  getUserStatistics,
  getPaymentAnalytics,
  getAllCoupons,
  saveCoupon,
  deleteCoupon,
  toggleCouponStatus,
  deleteUser,
  savePricingChanges as savePricingToFirestore,
  updateCoupon,
  getCurrentPricing,
  getHighStakesMetrics,
  getHighStakesThresholds,
  updateHighStakesThresholds,
  getAgentDebugInsights,
  getAgentModeCheck,
  updateAgentDebugConfig,
  createAdaptiveSnapshot,
  rollbackAdaptiveSnapshot,
} from '../services/adminDashboard';
import { MEMBERSHIP_PLANS } from '../services/adminDashboard';
import AdminLayout from '../layouts/AdminLayout';
import SuperAdminOverviewTab from '../components/SuperAdminOverviewTab';
import SuperAdminUsersTab from '../components/SuperAdminUsersTab';
import SuperAdminPaymentsTab from '../components/SuperAdminPaymentsTab';
import SuperAdminCouponsTab from '../components/SuperAdminCouponsTab';
import SuperAdminPricingTab from '../components/SuperAdminPricingTab';
import SuperAdminRolesTab from '../components/SuperAdminRolesTab';
import SettingsTab from '../components/SettingsTab';
import AnalyticsTab from '../components/AnalyticsTab';
import SuperAdminRuntimeControlTab from '../components/SuperAdminRuntimeControlTab';
import AdminCapabilityMatrix from '../components/AdminCapabilityMatrix';

const SuperAdminDashboard = () => {
  const { currentUser: user } = useAuth();
  const location = useLocation();

  const getTabFromPath = () => {
    const parts = location.pathname.split('/');
    if (parts[1] === 'boss' || parts[1] === 'super') return parts[2] || 'overview';
    return 'overview';
  };

  const [activeTab, setActiveTab] = useState(getTabFromPath());
  useEffect(() => {
    setActiveTab(getTabFromPath());
  }, [location.pathname]);

  const [admins, setAdmins] = useState([]);
  const [superadmins, setSuperadmins] = useState([]);
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [statistics, setStatistics] = useState({});
  const [paymentAnalytics, setPaymentAnalytics] = useState({ payments: [], analytics: {} });
  const [editingPrices, setEditingPrices] = useState(false);
  const [tempPrices, setTempPrices] = useState({});
  const [coupons, setCoupons] = useState([]);
  const [hsRange, setHsRange] = useState('24h');
  const [highStakesMetrics, setHighStakesMetrics] = useState({});
  const [agentDebugInsights, setAgentDebugInsights] = useState({});
  const [hsThresholds, setHsThresholds] = useState({
    source_fail_spike: 0.30,
    low_confidence_spike: 0.40,
    recency_fail_spike: 0.25,
  });
  const [newCoupon, setNewCoupon] = useState({
    code: '',
    monthlyDiscount: '',
    yearlyDiscount: '',
    type: 'percentage',
    description: '',
    active: true,
  });

  const fetchAllData = useCallback(async () => {
    if (!user?.uid) return;
    try {
      setLoading(true);
      const [usersData, statsData, paymentData, couponData, currentPricing] = await Promise.all([
        getAllUsers(user.uid),
        getUserStatistics(user.uid),
        getPaymentAnalytics(user.uid),
        getAllCoupons(user.uid),
        getCurrentPricing(),
      ]);

      const [hsMetricsResult, hsThresholdsResult, debugInsightsResult] = await Promise.allSettled([
        getHighStakesMetrics(hsRange),
        getHighStakesThresholds(),
        getAgentDebugInsights(hsRange, 25),
      ]);

      setAllUsers(usersData);
      setStatistics(statsData);
      setPaymentAnalytics(paymentData);
      setCoupons(couponData);
      setTempPrices(currentPricing);
      setHighStakesMetrics(hsMetricsResult.status === 'fulfilled' ? (hsMetricsResult.value || {}) : {});
      setHsThresholds(hsThresholdsResult.status === 'fulfilled' ? (hsThresholdsResult.value || hsThresholds) : hsThresholds);
      setAgentDebugInsights(debugInsightsResult.status === 'fulfilled' ? (debugInsightsResult.value || {}) : {});

      const superAdminUsers = usersData.filter((x) => x.role === 'superadmin');
      const adminUsers = usersData.filter((x) => x.role === 'admin');
      setAdmins(adminUsers);
      setSuperadmins(superAdminUsers);
    } catch (error) {
      console.error('Error fetching super admin data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [user?.uid, hsRange]);

  useEffect(() => {
    if (user?.uid) fetchAllData();
  }, [fetchAllData, user?.uid]);

  const handleSearchInput = (email) => {
    setSearchEmail(email);
    if (searchTimeout) clearTimeout(searchTimeout);
    if (!email.trim()) {
      setSearchResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      setIsSearching(true);
      try {
        const q = email.toLowerCase();
        const results = allUsers.filter((u) => (u.email || '').toLowerCase().includes(q));
        setSearchResults(results);
        if (results.length === 0) toast.error('No user found with this email');
      } finally {
        setIsSearching(false);
      }
    }, 350);
    setSearchTimeout(timeout);
  };

  const searchUserByEmail = () => {
    handleSearchInput(searchEmail);
  };

  const changeUserRole = async (userId, newRole, currentRole) => {
    try {
      if (newRole === currentRole) {
        toast.error('User already has this role');
        return;
      }
      await updateUserRole(userId, newRole, user.uid);
      toast.success(`User role updated to ${newRole}`);
      await fetchAllData();
    } catch (error) {
      console.error('Error updating user role:', error);
      toast.error('Failed to update user role');
    }
  };

  const changeUserPlan = async (userId, newPlan) => {
    try {
      await updateUserMembership(userId, newPlan, 'monthly', null, user.uid);
      toast.success(`User plan updated to ${newPlan}`);
      await fetchAllData();
    } catch (error) {
      console.error('Error updating user plan:', error);
      toast.error('Failed to update user plan');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
    try {
      await deleteUser(userId, user.uid);
      toast.success('User deleted successfully');
      await fetchAllData();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
    }
  };

  const savePricingChanges = async () => {
    try {
      const processed = { ...tempPrices };
      Object.keys(processed).forEach((planId) => {
        const plan = processed[planId];
        if (plan.monthly && plan.yearly) {
          const base = plan.monthly * 12;
          const discount = base > 0 ? ((base - plan.yearly) / base) * 100 : 0;
          processed[planId] = { ...plan, yearlyDiscountPercentage: parseFloat(discount.toFixed(1)) };
        }
      });
      await savePricingToFirestore(processed, user.uid);
      Object.keys(processed).forEach((planId) => {
        if (MEMBERSHIP_PLANS[planId]) MEMBERSHIP_PLANS[planId] = { ...MEMBERSHIP_PLANS[planId], ...processed[planId] };
      });
      setEditingPrices(false);
      toast.success('Pricing updated successfully');
    } catch (error) {
      console.error('Error saving pricing:', error);
      toast.error('Failed to save pricing');
    }
  };

  const addCoupon = async () => {
    if (!newCoupon.code || (!newCoupon.monthlyDiscount && !newCoupon.yearlyDiscount) || !newCoupon.description) {
      toast.error('Please fill all required coupon fields');
      return;
    }
    try {
      const payload = {
        code: newCoupon.code.toUpperCase(),
        monthlyDiscount: newCoupon.monthlyDiscount ? parseFloat(newCoupon.monthlyDiscount) : 0,
        yearlyDiscount: newCoupon.yearlyDiscount ? parseFloat(newCoupon.yearlyDiscount) : 0,
        type: newCoupon.type,
        description: newCoupon.description,
        active: newCoupon.active,
        createdAt: new Date(),
      };
      const result = await saveCoupon(payload, user.uid);
      if (!result.success) {
        toast.error(result.message || 'Failed to add coupon');
        return;
      }
      const updated = await getAllCoupons(user.uid);
      setCoupons(updated);
      setNewCoupon({ code: '', monthlyDiscount: '', yearlyDiscount: '', type: 'percentage', description: '', active: true });
      toast.success('Coupon added successfully');
    } catch (error) {
      console.error('Error adding coupon:', error);
      toast.error('Failed to add coupon');
    }
  };

  const handleToggleCouponStatus = async (id, currentStatus) => {
    try {
      const result = await toggleCouponStatus(id, !currentStatus, user.uid);
      if (!result.success) {
        toast.error(result.message || 'Failed to update coupon');
        return;
      }
      const updated = await getAllCoupons(user.uid);
      setCoupons(updated);
      toast.success('Coupon status updated');
    } catch (error) {
      console.error('Error updating coupon status:', error);
      toast.error('Failed to update coupon status');
    }
  };

  const handleUpdateCoupon = async (id, updateData) => {
    try {
      if (!updateData.code || (!updateData.monthlyDiscount && !updateData.yearlyDiscount)) {
        toast.error('Code and at least one discount type are required');
        return false;
      }
      const result = await updateCoupon(id, updateData, user.uid);
      if (!result.success) {
        toast.error(result.message || 'Failed to update coupon');
        return false;
      }
      const updated = await getAllCoupons(user.uid);
      setCoupons(updated);
      toast.success('Coupon updated successfully');
      return true;
    } catch (error) {
      console.error('Error updating coupon:', error);
      toast.error('Failed to update coupon');
      return false;
    }
  };

  const handleDeleteCoupon = async (id) => {
    if (!window.confirm('Are you sure you want to delete this coupon?')) return;
    try {
      const result = await deleteCoupon(id, user.uid);
      if (!result.success) {
        toast.error(result.message || 'Failed to delete coupon');
        return;
      }
      const updated = await getAllCoupons(user.uid);
      setCoupons(updated);
      toast.success('Coupon deleted');
    } catch (error) {
      console.error('Error deleting coupon:', error);
      toast.error('Failed to delete coupon');
    }
  };

  const handleSaveHsThresholds = async (nextThresholds) => {
    try {
      const saved = await updateHighStakesThresholds(nextThresholds);
      setHsThresholds(saved || nextThresholds);
      toast.success('High-stakes thresholds updated');
    } catch (error) {
      console.error('Failed to update thresholds:', error);
      toast.error('Failed to update thresholds');
    }
  };

  const handleSaveAgentDebugConfig = async (nextConfig) => {
    try {
      const saved = await updateAgentDebugConfig(nextConfig || {});
      setAgentDebugInsights((prev) => ({ ...(prev || {}), config: saved || nextConfig }));
      toast.success('Agent debug config updated');
    } catch (error) {
      console.error('Failed to update debug config:', error);
      toast.error('Failed to update debug config');
    }
  };

  const handleAgentModeCheck = async (input, requestedMode) => {
    return await getAgentModeCheck(input, requestedMode);
  };

  const handleCreateAdaptiveSnapshot = async (label = 'manual') => {
    const result = await createAdaptiveSnapshot(label);
    const fresh = await getAgentDebugInsights(hsRange, 25);
    setAgentDebugInsights(fresh || {});
    toast.success(`Adaptive snapshot created (${result?.snapshot_id || 'ok'})`);
    return result;
  };

  const handleRollbackAdaptiveSnapshot = async () => {
    const result = await rollbackAdaptiveSnapshot();
    const fresh = await getAgentDebugInsights(hsRange, 25);
    setAgentDebugInsights(fresh || {});
    toast.success(result?.restored ? 'Adaptive snapshot rollback applied' : 'No snapshot to rollback');
    return result;
  };

  const getPageTitle = (tab) => {
    if (tab === 'overview') return 'Super Admin Overview';
    if (tab === 'analytics') return 'Core AI Control';
    if (tab === 'runtime') return 'Live Runtime Control';
    if (tab === 'users') return 'User Management';
    if (tab === 'payments') return 'Transactions & Revenue';
    if (tab === 'coupons') return 'Coupon Management';
    if (tab === 'membership') return 'Membership Plans';
    if (tab === 'roles') return 'Role Assignments';
    if (tab === 'settings') return 'System Settings';
    return 'Super Dashboard';
  };

  const tabVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
  };

  return (
    <AdminLayout isSuperAdmin={true} title={getPageTitle(activeTab)}>
      <AdminCapabilityMatrix currentRole="superadmin" />

      {activeTab === 'overview' && (
        <SuperAdminOverviewTab
          tabVariants={tabVariants}
          statistics={{ ...statistics, monthlyRevenue: paymentAnalytics?.analytics?.totalRevenue || 0 }}
          allUsers={allUsers}
          admins={admins}
          superadmins={superadmins}
        />
      )}

      {activeTab === 'analytics' && (
        <AnalyticsTab
          tabVariants={tabVariants}
          statistics={statistics}
          users={allUsers}
          highStakesMetrics={highStakesMetrics}
          agentDebugInsights={agentDebugInsights}
          hsRange={hsRange}
          onHsRangeChange={setHsRange}
          hsThresholds={hsThresholds}
          onHsThresholdsSave={handleSaveHsThresholds}
          onAgentDebugConfigSave={handleSaveAgentDebugConfig}
          onAgentModeCheck={handleAgentModeCheck}
          onAdaptiveSnapshot={handleCreateAdaptiveSnapshot}
          onAdaptiveRollback={handleRollbackAdaptiveSnapshot}
        />
      )}

      {activeTab === 'runtime' && (
        <SuperAdminRuntimeControlTab
          config={agentDebugInsights?.config || {}}
          onSaveConfig={handleSaveAgentDebugConfig}
          onSnapshot={handleCreateAdaptiveSnapshot}
          onRollback={handleRollbackAdaptiveSnapshot}
        />
      )}

      {activeTab === 'users' && (
        <SuperAdminUsersTab
          tabVariants={tabVariants}
          searchEmail={searchEmail}
          handleSearchInput={handleSearchInput}
          searchUserByEmail={searchUserByEmail}
          isSearching={isSearching}
          searchResults={searchResults}
          changeUserRole={changeUserRole}
          changeUserPlan={changeUserPlan}
          deleteUser={handleDeleteUser}
          admins={admins}
          superadmins={superadmins}
          loading={loading}
        />
      )}

      {activeTab === 'payments' && (
        <SuperAdminPaymentsTab
          tabVariants={tabVariants}
          paymentAnalytics={paymentAnalytics}
          onSyncSuccess={fetchAllData}
        />
      )}

      {activeTab === 'coupons' && (
        <SuperAdminCouponsTab
          tabVariants={tabVariants}
          coupons={coupons}
          newCoupon={newCoupon}
          setNewCoupon={setNewCoupon}
          addCoupon={addCoupon}
          handleToggleCouponStatus={handleToggleCouponStatus}
          handleDeleteCoupon={handleDeleteCoupon}
          handleUpdateCoupon={handleUpdateCoupon}
        />
      )}

      {activeTab === 'membership' && (
        <SuperAdminPricingTab
          tabVariants={tabVariants}
          editingPrices={editingPrices}
          setEditingPrices={setEditingPrices}
          tempPrices={tempPrices}
          setTempPrices={setTempPrices}
          savePricingChanges={savePricingChanges}
        />
      )}

      {activeTab === 'roles' && (
        <SuperAdminRolesTab
          tabVariants={tabVariants}
          allUsers={allUsers}
          admins={admins}
          superadmins={superadmins}
          onPlanChange={changeUserPlan}
        />
      )}

      {activeTab === 'settings' && (
        <SettingsTab
          coupons={coupons}
          addCoupon={addCoupon}
          handleToggleCouponStatus={handleToggleCouponStatus}
          handleDeleteCoupon={handleDeleteCoupon}
          newCoupon={newCoupon}
          setNewCoupon={setNewCoupon}
        />
      )}
    </AdminLayout>
  );
};

export default SuperAdminDashboard;
