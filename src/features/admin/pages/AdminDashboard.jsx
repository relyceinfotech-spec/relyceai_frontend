import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext.jsx';
import toast, { Toaster } from 'react-hot-toast';
import AdminLayout from '../layouts/AdminLayout';
import UsersTab from '../components/UsersTab';
import AdminUsageTab from '../components/AdminUsageTab';
import AdminMonitoringTab from '../components/AdminMonitoringTab';
import AdminAlertsTab from '../components/AdminAlertsTab';
import AdminLogsTab from '../components/AdminLogsTab';
import AdminCapabilityMatrix from '../components/AdminCapabilityMatrix';
import {
  getAllUsers,
  updateUserMembership,
  getUserStatistics,
  getPaymentAnalytics,
  getAdminOpsInsights,
  deleteUser,
} from '../services/adminDashboard';

const AdminDashboard = () => {
  const { currentUser: user } = useAuth();
  const location = useLocation();

  const getTabFromPath = () => {
    const parts = location.pathname.split('/');
    if (parts[1] === 'super') return parts[2] || 'overview';
    return 'overview';
  };

  const [activeTab, setActiveTab] = useState(getTabFromPath());
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [statistics, setStatistics] = useState({});
  const [paymentAnalytics, setPaymentAnalytics] = useState({ payments: [], analytics: {} });
  const [opsInsights, setOpsInsights] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const searchTimeoutRef = useRef(null);
  const usersPerPage = 20;

  useEffect(() => {
    setActiveTab(getTabFromPath());
  }, [location.pathname]);

  const loadAdminData = useCallback(async () => {
    if (!user?.uid) return;
    try {
      setLoading(true);
      const [usersRes, statsRes, paymentRes, opsRes] = await Promise.allSettled([
        getAllUsers(user.uid),
        getUserStatistics(user.uid),
        getPaymentAnalytics(user.uid),
        getAdminOpsInsights('24h', 40),
      ]);

      const usersData = usersRes.status === 'fulfilled' ? usersRes.value : [];
      const sanitizedUsers = usersData.filter((u) => !['superadmin', 'super_admin'].includes(String(u.role || '').toLowerCase()));

      setUsers(sanitizedUsers);
      setFilteredUsers(sanitizedUsers);
      setStatistics(statsRes.status === 'fulfilled' ? (statsRes.value || {}) : {});
      setPaymentAnalytics(paymentRes.status === 'fulfilled' ? (paymentRes.value || { payments: [], analytics: {} }) : { payments: [], analytics: {} });
      setOpsInsights(opsRes.status === 'fulfilled' ? (opsRes.value || {}) : {});
    } catch (error) {
      console.error('Error loading admin dashboard data:', error);
      toast.error('Failed to load admin dashboard data');
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  const handleSearch = useCallback((term) => {
    setSearchTerm(term);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    searchTimeoutRef.current = setTimeout(() => {
      if (!term.trim()) {
        setFilteredUsers(users);
        setCurrentPage(1);
        return;
      }
      const needle = term.toLowerCase();
      const result = users.filter((u) =>
        (u.email || '').toLowerCase().includes(needle) ||
        (u.displayName || '').toLowerCase().includes(needle) ||
        (u.uniqueUserId || '').toLowerCase().includes(needle)
      );
      setFilteredUsers(result);
      setCurrentPage(1);
    }, 250);
  }, [users]);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredUsers(users);
      return;
    }
    const needle = searchTerm.toLowerCase();
    setFilteredUsers(
      users.filter((u) =>
        (u.email || '').toLowerCase().includes(needle) ||
        (u.displayName || '').toLowerCase().includes(needle) ||
        (u.uniqueUserId || '').toLowerCase().includes(needle)
      )
    );
  }, [users, searchTerm]);

  const handleMembershipChange = async (userId, newPlan, duration = 'monthly') => {
    try {
      await updateUserMembership(userId, newPlan, duration, null, user.uid);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, membership: { ...(u.membership || {}), plan: newPlan, billingCycle: duration } } : u))
      );
      toast.success(`Updated plan to ${newPlan}`);
    } catch (error) {
      console.error('Failed to update membership:', error);
      toast.error('Failed to update membership');
    }
  };

  const handleDeleteUser = async (userId, userEmail) => {
    setUserToDelete({ id: userId, email: userEmail });
    setShowDeleteModal(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      await deleteUser(userToDelete.id, user.uid);
      setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id));
      setFilteredUsers((prev) => prev.filter((u) => u.id !== userToDelete.id));
      toast.success(`Deleted ${userToDelete.email}`);
    } catch (error) {
      console.error('Failed to delete user:', error);
      toast.error('Failed to delete user');
    } finally {
      setShowDeleteModal(false);
      setUserToDelete(null);
    }
  };

  const getPageTitle = (tab) => {
    if (tab === 'overview') return 'Usage Dashboard';
    if (tab === 'monitoring') return 'Chat Monitoring';
    if (tab === 'alerts') return 'Alerts Panel';
    if (tab === 'users') return 'User Management';
    if (tab === 'logs') return 'Basic Logs';
    return 'Admin Dashboard';
  };

  const indexOfLastUser = currentPage * usersPerPage;
  const indexOfFirstUser = indexOfLastUser - usersPerPage;
  const currentUsers = filteredUsers.slice(indexOfFirstUser, indexOfLastUser);
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / usersPerPage));

  return (
    <AdminLayout isSuperAdmin={false} title={getPageTitle(activeTab)}>
      <Toaster />
      <AdminCapabilityMatrix currentRole="admin" />

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-zinc-900 rounded-xl p-6 w-full max-w-md border border-zinc-800 shadow-2xl">
            <h3 className="text-lg font-semibold mb-4 text-white">Confirm User Deletion</h3>
            <p className="text-zinc-300 mb-2">
              Delete <span className="font-semibold text-white">{userToDelete?.email}</span>?
            </p>
            <p className="text-sm text-zinc-400 mb-6">This action cannot be undone.</p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setUserToDelete(null);
                }}
                className="px-4 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteUser}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'overview' && (
        <AdminUsageTab
          statistics={statistics}
          paymentAnalytics={paymentAnalytics}
          opsInsights={opsInsights}
        />
      )}

      {activeTab === 'monitoring' && <AdminMonitoringTab opsInsights={opsInsights} />}

      {activeTab === 'alerts' && <AdminAlertsTab opsInsights={opsInsights} />}

      {activeTab === 'users' && (
        <UsersTab
          searchTerm={searchTerm}
          handleSearch={handleSearch}
          loading={loading}
          currentUsers={currentUsers}
          handleRoleChange={() => {}}
          accessLevel="admin"
          getRoleOptions={() => [{ value: 'user', label: 'User' }]}
          handleMembershipChange={handleMembershipChange}
          planOptions={[
            { label: 'Free', value: 'free' },
            { label: 'Starter', value: 'starter' },
            { label: 'Plus', value: 'plus' },
            { label: 'Pro', value: 'pro' },
            { label: 'Business', value: 'business' },
          ]}
          handleDeleteUser={handleDeleteUser}
          totalPages={totalPages}
          currentPage={currentPage}
          paginate={setCurrentPage}
          indexOfFirstUser={indexOfFirstUser}
          indexOfLastUser={indexOfLastUser}
          filteredUsersLength={filteredUsers.length}
        />
      )}

      {activeTab === 'logs' && <AdminLogsTab opsInsights={opsInsights} />}
    </AdminLayout>
  );
};

export default AdminDashboard;
