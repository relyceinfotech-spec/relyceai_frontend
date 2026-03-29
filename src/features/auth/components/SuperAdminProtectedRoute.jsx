import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import ErrorPage from '../../../pages/ErrorPage';

const SuperAdminProtectedRoute = ({ children, requireSuperAdmin = false }) => {
  const { currentUser, loading, role, roleError, refreshUserProfile } = useAuth();
  const navigate = useNavigate();
  const [hasAccess, setHasAccess] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const roleRefreshAttemptedRef = useRef({ uid: null, attempted: false });

  useEffect(() => {
    const uid = currentUser?.uid || null;
    if (roleRefreshAttemptedRef.current.uid !== uid) {
      roleRefreshAttemptedRef.current = { uid, attempted: false };
    }
  }, [currentUser?.uid]);

  useEffect(() => {
    const checkUserRole = async () => {
      // Wait for auth context to initialize
      if (loading) {
        return;
      }

      if (!currentUser) {
        setRoleLoading(false);
        return;
      }

      try {
        setRoleLoading(true);

        if (roleError) {
          throw roleError;
        }

        if (!role) {
          if (!roleRefreshAttemptedRef.current.attempted) {
            roleRefreshAttemptedRef.current.attempted = true;
            await refreshUserProfile?.();
            return;
          }
        }

        const normalizedRole = role === 'super_admin' ? 'superadmin' : role;
        setUserRole(normalizedRole);

        if (!normalizedRole) {
          setHasAccess(false);
          setError('Unable to verify your role. Please refresh or contact support.');
          return;
        }

        // If route requires super admin (/boss routes)
        if (requireSuperAdmin) {
          if (normalizedRole === 'superadmin') {
            setHasAccess(true);
          } else {
            setHasAccess(false);
            setError('Access denied. Super admin privileges required.');
          }
        }
        // For /super routes - allow both admin and superadmin
        else {
          if (normalizedRole === 'admin' || normalizedRole === 'superadmin') {
            setHasAccess(true);
          } else {
            setHasAccess(false);
            setError('Access denied. Admin privileges required.');
          }
        }
      } catch (error) {
        console.error('Error checking user role:', error);
        setHasAccess(false);
        setUserRole(null);
        setError(error?.message || 'Access denied.');
      } finally {
        setRoleLoading(false);
      }
    };

    checkUserRole();
  }, [currentUser?.uid, loading, requireSuperAdmin, role, roleError, refreshUserProfile]);

  // Handle navigation in useEffect to avoid React warning
  useEffect(() => {
    if (!loading && !roleLoading) {
      if (!currentUser) {
        navigate('/');
      }
    }
  }, [currentUser, loading, roleLoading, navigate]);

  // Show loading while checking auth and role
  if (loading || roleLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-zinc-600 dark:text-zinc-400">Verifying access...</p>
        </div>
      </div>
    );
  }

  // If user is not logged in, show nothing (navigation handled in useEffect)
  if (!currentUser) {
    return null;
  }

  // If user doesn't have access or there's an error, show error page
  if (!hasAccess || error) {
    return <ErrorPage
      title="Access Denied"
      message={error || "You don't have permission to access this area."}
      showLoginButton={false}
    />;
  }

  // If user has access, render the protected content
  return children;
};

export default SuperAdminProtectedRoute;
