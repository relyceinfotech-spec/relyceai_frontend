import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useRef,
} from "react";
import { onIdTokenChanged } from "firebase/auth";
import { auth } from "../utils/firebaseConfig";
import { API_BASE_URL, fetchUserProfile as fetchUserProfileApi } from "../utils/api";
import { createUserProfile } from "../features/users/services/userService";
import {
  getUserMembership,
  checkMembershipExpiry,
} from "../features/membership/services/membershipService";

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

// Cache for user profiles to prevent repeated fetches
const userProfileCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const MEMBERSHIP_EXPIRY_GRACE_HOURS = 48;

// This is the single, correct AuthProvider component
export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [membership, setMembership] = useState(null);
  const [loading, setLoading] = useState(true);
  const [roleError, setRoleError] = useState(null);
  const [claimsRole, setClaimsRole] = useState(null);
  // Use Ref to track initialization within the closure
  const initialLoadComplete = useRef(false);
  const backendInitDone = useRef(false);
  const backendInitInFlight = useRef(false);
  const backendInitAttempt = useRef(0);
  const backendInitRetryTimer = useRef(null);
  const backendInitUserId = useRef(null);
  const tokenCheckInFlight = useRef(false);
  const uniqueIdInitAttempted = useRef(new Set());

  const fetchUserProfile = async (uid, skipExpensiveOperations = false) => {
    try {
      const cacheKey = `${uid}_${skipExpensiveOperations}`;

      const payload = await fetchUserProfileApi();
      if (payload?.user) {
        const userData = payload.user;

        if (!userData.uniqueUserId) {
          const alreadyAttempted = uniqueIdInitAttempted.current.has(uid);
          if (!alreadyAttempted) {
            uniqueIdInitAttempted.current.add(uid);
            console.log(
              "[AuthContext] uniqueUserId missing, triggering backend init...",
            );
            try {
              const token = await auth.currentUser?.getIdToken(true);
              const initResponse = await fetch(`${API_BASE_URL}/users/init`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
              });

              if (initResponse.ok) {
                const initData = await initResponse.json().catch(() => null);
                if (initData?.uniqueUserId) {
                  userData.uniqueUserId = initData.uniqueUserId;
                  console.log(
                    "[AuthContext] Assigned uniqueUserId:",
                    initData.uniqueUserId,
                  );
                }
              }
            } catch (initErr) {
              console.warn("[AuthContext] Backend init call failed:", initErr);
            }
          }
        } else {
          uniqueIdInitAttempted.current.delete(uid);
        }

        if (!skipExpensiveOperations) {
          checkMembershipExpiry(uid, userData).catch(console.error);
        }

        let membershipData;
        try {
          membershipData = await getUserMembership(uid, userData);
        } catch (err) {
          console.warn("Failed to get membership data:", err);
          membershipData = userData.membership || null;
        }

        // Keep frontend expiry behavior aligned with backend grace logic.
        if (membershipData && membershipData.plan !== 'free' && membershipData.expiryDate) {
          const expiryMs = new Date(membershipData.expiryDate).getTime();
          if (!Number.isNaN(expiryMs)) {
            const graceCutoffMs = expiryMs + MEMBERSHIP_EXPIRY_GRACE_HOURS * 60 * 60 * 1000;
            if (Date.now() > graceCutoffMs) {
              membershipData.plan = 'free';
              membershipData.planName = 'Free';
              membershipData.status = 'expired';
              membershipData.isExpired = true;

              if (userData.membership) {
                userData.membership.plan = 'free';
                userData.membership.planName = 'Free';
                userData.membership.status = 'expired';
                userData.membership.isExpired = true;
              }
            }
          }
        }

        userProfileCache.set(cacheKey, {
          userProfile: userData,
          membership: membershipData,
          timestamp: Date.now(),
        });

        setUserProfile(userData);
        setMembership(membershipData);

        return userData;
      }

      try {
        const newProfile = await createUserProfile({
          uid,
          email: auth.currentUser?.email,
        });
        setUserProfile(newProfile);
        setMembership(newProfile.membership);
        return newProfile;
      } catch (err) {
        console.error("Failed to create user profile:", err);
        return null;
      }
    } catch (err) {
      console.error("Error fetching user profile:", err);
      return null;
    }
  };

  useEffect(() => {
    let profileRefreshTimer = null;

    const clearBackendInitRetry = () => {
      if (backendInitRetryTimer.current) {
        clearTimeout(backendInitRetryTimer.current);
        backendInitRetryTimer.current = null;
      }
    };

    const clearProfileRefresh = () => {
      if (profileRefreshTimer) {
        clearInterval(profileRefreshTimer);
        profileRefreshTimer = null;
      }
    };

    const startProfileRefresh = (authUser) => {
      clearProfileRefresh();
      if (!authUser) return;

      // Initial fetch with retry logic
      let attempts = 0;
      const maxAttempts = 3;

      const tryFetch = async () => {
        // Checking expiry is now cheap due to optimization, so pass false
        const profile = await fetchUserProfile(authUser.uid, false);
        if (profile) {
          // Success, start interval
          profileRefreshTimer = setInterval(() => {
            fetchUserProfile(authUser.uid, false);
          }, 60000);
        } else {
          // Failed, retry if attempts remain
          attempts++;
          if (attempts < maxAttempts) {
            console.log(
              `[AuthContext] Profile fetch failed, retrying (attempt ${attempts})...`,
            );
            setTimeout(tryFetch, 2000 * attempts); // Backoff: 2s, 4s
          } else {
            console.warn(
              "[AuthContext] Profile fetch failed after retries, falling back to interval",
            );
            // Fallback to interval anyway, maybe network comes back later
            profileRefreshTimer = setInterval(() => {
              fetchUserProfile(authUser.uid, false);
            }, 60000);
          }
        }
      };

      tryFetch();
    };

    const callBackendInit = async (authUser) => {
      if (!authUser) return;

      if (backendInitUserId.current !== authUser.uid) {
        backendInitUserId.current = authUser.uid;
        backendInitDone.current = false;
        backendInitInFlight.current = false;
        backendInitAttempt.current = 0;
        clearBackendInitRetry();
      }

      if (backendInitDone.current || backendInitInFlight.current) return;
      backendInitInFlight.current = true;
      backendInitAttempt.current += 1;

      try {
        const token = await authUser.getIdToken();
        const response = await fetch(`${API_BASE_URL}/users/init`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        backendInitDone.current = true;
        clearBackendInitRetry();
      } catch (initErr) {
        console.warn(
          "[AuthContext] Backend init call failed, will retry:",
          initErr,
        );
        const cappedAttempt = Math.min(backendInitAttempt.current, 5);
        const delayMs = Math.min(1000 * 2 ** cappedAttempt, 15000);
        clearBackendInitRetry();
        backendInitRetryTimer.current = setTimeout(() => {
          callBackendInit(authUser);
        }, delayMs);
      } finally {
        backendInitInFlight.current = false;
      }
    };

    const authUnsubscribe = onIdTokenChanged(auth, async (authUser) => {
      setLoading(true);
      setUser(authUser);
      if (authUser) {
        try {
          if (!tokenCheckInFlight.current) {
            tokenCheckInFlight.current = true;
            await authUser.getIdToken();
          }
          const tokenResult = await authUser.getIdTokenResult(true);
          const claims = tokenResult?.claims || {};
          const roleFromClaims =
            claims.role ||
            (claims.superadmin ? "superadmin" : claims.admin ? "admin" : "");
          const normalizedRole =
            roleFromClaims === "super_admin" ? "superadmin" : roleFromClaims;
          setClaimsRole(normalizedRole || "user");
        } catch (tokenErr) {
          console.error("[Auth] Token refresh failed:", tokenErr);
          setRoleError(tokenErr);
          setClaimsRole(null);
          setLoading(false);
          auth.signOut();
          return;
        } finally {
          tokenCheckInFlight.current = false;
        }
        if (!authUser) {
          backendInitUserId.current = null;
          uniqueIdInitAttempted.current.clear();
          backendInitDone.current = false;
          backendInitInFlight.current = false;
          backendInitAttempt.current = 0;
          clearBackendInitRetry();
          clearProfileRefresh();
          setUserProfile(null);
          setMembership(null);
          setRoleError(null);
          setClaimsRole(null);
          setLoading(false);
          return;
        }

        callBackendInit(authUser);
        startProfileRefresh(authUser);
        if (!initialLoadComplete.current) {
          initialLoadComplete.current = true;
        }
        setLoading(false);
      } else {
        backendInitUserId.current = null;
        uniqueIdInitAttempted.current.clear();
        backendInitDone.current = false;
        backendInitInFlight.current = false;
        backendInitAttempt.current = 0;
        clearBackendInitRetry();
        clearProfileRefresh();
        setUserProfile(null);
        setMembership(null);
        setRoleError(null);
        setClaimsRole(null);
        setLoading(false);
      }
    });

    const handleUnauthorized = () => {
      console.warn("[Auth] Session expired or unauthorized. Logging out...");
      auth.signOut();
    };
    window.addEventListener("auth:unauthorized", handleUnauthorized);

    return () => {
      authUnsubscribe();
      clearBackendInitRetry();
      clearProfileRefresh();
      window.removeEventListener("auth:unauthorized", handleUnauthorized);
    };
  }, []); // Remove dependency on initialLoadComplete to avoid re-subscribing loop

  const refreshUserProfile = async () => {
    if (user) {
      // Clear cache before refreshing to ensure fresh data
      userProfileCache.clear();
      await fetchUserProfile(user.uid, false); // Don't skip expensive operations on manual refresh
    }
  };

  const role = user ? claimsRole || "user" : null;

  const value = React.useMemo(
    () => ({
      currentUser: user,
      userProfile,
      membership,
      role, // Role derived from token claims
      roleError,
      auth,
      loading,
      refreshUserProfile,
      refreshUserRole: refreshUserProfile, // Alias for backward compatibility
    }),
    [
      user,
      userProfile,
      membership,
      role,
      loading,
      roleError,
      refreshUserProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}




