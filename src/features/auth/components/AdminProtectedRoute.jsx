import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import ErrorPage from '../../../pages/ErrorPage';

const AdminProtectedRoute = ({ children }) => {
  const { currentUser, loading, role, roleError, refreshUserProfile } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);
  const [error, setError] = useState(null);
  const roleRefreshAttemptedRef = useRef({ uid: null, attempted: false });

  useEffect(() => {
    const uid = currentUser?.uid || null;
    if (roleRefreshAttemptedRef.current.uid !== uid) {
      roleRefreshAttemptedRef.current = { uid, attempted: false };
    }
  }, [currentUser?.uid]);

  useEffect(() => {
    const checkAdminRole = async () => {
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

        // Ensure we have the latest profile if role is still missing (attempt once per user).
        if (!role) {
          if (!roleRefreshAttemptedRef.current.attempted) {
            roleRefreshAttemptedRef.current.attempted = true;
            await refreshUserProfile?.();
            return;
          }
        }

        const normalizedRole = role === 'super_admin' ? 'superadmin' : role;

        if (!normalizedRole) {
          setIsAdmin(false);
          setError('Unable to verify your role. Please refresh or contact support.');
          return;
        }

        if (normalizedRole === 'admin' || normalizedRole === 'superadmin') {
          setIsAdmin(true);
          setError(null);
        } else {
          setIsAdmin(false);
          setError('Page not found or you don\'t have permission to access this area.');
        }
      } catch (error) {
        console.error('Error checking admin role:', error);
        setIsAdmin(false);
        setError(error?.message || 'Page not found.');
      } finally {
        setRoleLoading(false);
      }
    };

    checkAdminRole();
  }, [currentUser?.uid, loading, role, roleError, refreshUserProfile]);

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
          <p className="text-zinc-600 dark:text-zinc-400">Loading...</p>
        </div>
      </div>
    );
  }

  // If user is not logged in, show nothing (navigation handled in useEffect)
  if (!currentUser) {
    return null;
  }

  // If user is not admin or there's an error, show error page
  if (!isAdmin || error) {
    return <ErrorPage
      title="Page Not Found"
      message={error || "The page you're looking for doesn't exist or you don't have permission to access it."}
      showLoginButton={false}
    />;
  }

  // If user is admin, render the protected content
  return children;
};

export default AdminProtectedRoute;
