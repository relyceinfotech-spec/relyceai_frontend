import React, { useState, useEffect, useCallback } from "react";
import { Helmet } from 'react-helmet-async';
import { useAuth } from "../../../context/AuthContext.jsx";
import { useNavigate, useLocation } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { createUserProfile } from '../../users/services/userService';

// Import auth components
import { AuthStyles } from '../components/AuthStyles';
import { SuccessMessage, LoadingSpinner } from '../components/SuccessMessage';
import { DesktopAuthView } from '../components/DesktopAuthView';
import { MobileAuthView } from '../components/MobileAuthView';

// Import security utilities
import { validatePassword } from '../../../utils/passwordValidation';
import { 
  checkLoginAllowed, 
  recordFailedLogin, 
  clearLoginAttempts 
} from '../../../utils/loginAttemptTracker';

export default function AuthPage() {
  const { currentUser: user, auth, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [rightPanelActive, setRightPanelActive] = useState(false);
  const [isMobileSignUp, setIsMobileSignUp] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Check if user is already logged in
  const isAlreadyLoggedIn = !loading && user &&
    (location.pathname === '/login' || location.pathname === '/Login' ||
      location.pathname === '/Signup' || location.pathname === '/signup');

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpConfirm, setSignUpConfirm] = useState("");
  const [error, setError] = useState("");

  // Security state
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check lockout status when email changes
  useEffect(() => {
    const checkLockout = async () => {
      if (!loginEmail) {
        setIsLocked(false);
        setLockoutSeconds(0);
        return;
      }
      const result = await checkLoginAllowed(loginEmail);
      setIsLocked(!result.allowed);
      setLockoutSeconds(result.waitSeconds);
    };
    checkLockout();
  }, [loginEmail]);

  // Handle redirect after successful auth or when user is already logged in
  useEffect(() => {
    if (!loading && user && !showSuccess) {
      if (location.pathname === '/login' || location.pathname === '/Login' || location.pathname === '/Signup' || location.pathname === '/signup') {
        setSuccessMessage("You are already logged in! Redirecting to home...");
        setShowSuccess(true);
      } else {
        navigate('/chat');
      }
    }
  }, [user, loading, navigate, showSuccess, location]);

  // Handle success redirect timer
  useEffect(() => {
    if (showSuccess) {
      const timer = setTimeout(() => {
        navigate('/');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showSuccess, navigate]);

  const resetMessages = () => {
    setError("");
    setShowSuccess(false);
    setSuccessMessage("");
  };

  // Handle lockout expiry
  const handleLockoutExpire = useCallback(() => {
    setIsLocked(false);
    setLockoutSeconds(0);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    resetMessages();

    // Check if locked
    if (isLocked) {
      setError(`Please wait ${Math.ceil(lockoutSeconds / 60)} minutes before trying again.`);
      return;
    }

    // Check backend rate limit before attempting
    const rateCheck = await checkLoginAllowed(loginEmail);
    if (!rateCheck.allowed) {
      setIsLocked(true);
      setLockoutSeconds(rateCheck.waitSeconds);
      setError(rateCheck.message || "Too many failed attempts. Please wait.");
      return;
    }

    setIsSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      // Clear attempts on successful login
      await clearLoginAttempts(loginEmail);
      setSuccessMessage("Login successful! Redirecting to home...");
      setShowSuccess(true);
    } catch (err) {
      if (err.code === 'auth/invalid-credential') {
        // Record failed attempt
        const result = await recordFailedLogin(loginEmail);
        if (result.waitSeconds > 0) {
          setIsLocked(true);
          setLockoutSeconds(result.waitSeconds);
        }
        setError(result.message || "Incorrect email or password. Please try again.");
      } else {
        setError("An error occurred. Please try again later.");
        console.error("Login Error:", err);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    resetMessages();

    // Validate password strength
    const validation = validatePassword(signUpPassword);
    if (!validation.isValid) {
      setError(`Password must have: ${validation.errors.join(', ')}`);
      return;
    }

    if (signUpPassword !== signUpConfirm) {
      return setError("Passwords do not match.");
    }

    setIsSubmitting(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, signUpEmail, signUpPassword);
      await createUserProfile({
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        displayName: userCredential.user.displayName
      }, 'free');
      setSuccessMessage("Account created successfully! Welcome to Relyce AI.");
      setShowSuccess(true);
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        setError("This email is already registered. Please sign in.");
        setLoginEmail(signUpEmail);
        setRightPanelActive(false);
        setIsMobileSignUp(false);
      } else if (err.code === "auth/weak-password") {
        setError("Password is too weak. Please use a stronger password.");
      } else {
        setError("An error occurred during sign-up.");
        console.error("Signup Error:", err);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    resetMessages();
    const provider = new GoogleAuthProvider();
    setIsSubmitting(true);
    try {
      const result = await signInWithPopup(auth, provider);
      if (result.user.metadata.creationTime === result.user.metadata.lastSignInTime) {
        setSuccessMessage("Account created successfully with Google! Welcome to Relyce AI.");
      } else {
        setSuccessMessage("Login successful with Google! Redirecting to home...");
      }
      setShowSuccess(true);
    } catch (err) {
      setError("Failed to sign in with Google.");
      console.error("Google Sign-In Error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show success message
  if (showSuccess) {
    return (
      <>
        <AuthStyles />
        <SuccessMessage message={successMessage} />
      </>
    );
  }

  // Show loading spinner
  if (loading) {
    return <LoadingSpinner />;
  }

  // Show already logged in message
  if (isAlreadyLoggedIn) {
    return (
      <>
        <AuthStyles />
        <SuccessMessage message="You are already logged in! Redirecting to home..." />
      </>
    );
  }

  // Shared props for auth views
  const authViewProps = {
    loginEmail,
    setLoginEmail,
    loginPassword,
    setLoginPassword,
    signUpEmail,
    setSignUpEmail,
    signUpPassword,
    setSignUpPassword,
    signUpConfirm,
    setSignUpConfirm,
    error,
    handleLogin,
    handleSignUp,
    handleGoogleSignIn,
    // Security props
    isLocked,
    lockoutSeconds,
    isSubmitting,
    onLockoutExpire: handleLockoutExpire,
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 font-sans bg-[#0a0d14]">
      <Helmet>
        <title>{location.pathname === '/login' ? 'Login' : 'Sign Up'} - Relyce AI</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <AuthStyles />

      {/* Desktop View */}
      <DesktopAuthView
        {...authViewProps}
        rightPanelActive={rightPanelActive}
        setRightPanelActive={setRightPanelActive}
      />

      {/* Mobile View */}
      <MobileAuthView
        {...authViewProps}
        isMobileSignUp={isMobileSignUp}
        setIsMobileSignUp={setIsMobileSignUp}
      />
    </div>
  );
}

