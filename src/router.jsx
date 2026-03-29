import { createBrowserRouter, Outlet, useLocation, Navigate } from "react-router-dom";
import React, { Suspense, memo, useEffect } from "react";
import { useTheme } from "./context/ThemeContext";
import { useAuth } from "./context/AuthContext";
import Header from "./components/layout/Header";
import Footer from "./components/layout/Footer";
import AdminProtectedRoute from "./features/auth/components/AdminProtectedRoute";
import SuperAdminProtectedRoute from "./features/auth/components/SuperAdminProtectedRoute";
import ProtectedRoute from "./features/auth/components/ProtectedRoute";
import ErrorPage from "./pages/ErrorPage";
import HeroSkeleton from "./components/skeletons/HeroSkeleton";
import useRoleRedirect from "./hooks/useRoleRedirect";
import AuthProvider from "./context/AuthContext";

// Component cache for lazy loading
const componentCache = new Map();

const createLazyComponent = (importFn, name) => {
  if (componentCache.has(name)) return componentCache.get(name);
  const LazyComponent = React.lazy(importFn);
  componentCache.set(name, LazyComponent);
  return LazyComponent;
};

// Lazy loaded pages
const Home = createLazyComponent(() => import("./pages/Home.jsx"), 'Home');
const Chat = createLazyComponent(() => import("./features/chat/pages/ChatPage.jsx"), 'Chat');
const Personalities = createLazyComponent(() => import("./features/chat/pages/PersonalitiesPage.jsx"), 'Personalities');
const PersonalityEditor = createLazyComponent(() => import("./features/chat/pages/PersonalityEditorPage.jsx"), 'PersonalityEditor');
const Membership = createLazyComponent(() => import("./features/membership/pages/MembershipPage.jsx"), 'Membership');
const Auth = createLazyComponent(() => import("./features/auth/pages/AuthPage.jsx"), 'Auth');
const About = createLazyComponent(() => import("./pages/AboutPage.jsx"), 'About');
const Contact = createLazyComponent(() => import("./pages/ContactPage.jsx"), 'Contact');
const Features = createLazyComponent(() => import("./pages/FeaturesPage.jsx"), 'Features');
const Settings = createLazyComponent(() => import("./features/settings/pages/SettingsPage.jsx"), 'Settings');
const UserFiles = createLazyComponent(() => import("./features/files/pages/UserFilesPage.jsx"), 'UserFiles');
const SharedChat = createLazyComponent(() => import("./features/chat/pages/SharedChatPage.jsx"), 'SharedChat');
const TermsPage = createLazyComponent(() => import("./pages/TermsPage.jsx"), 'TermsPage');
const PrivacyPage = createLazyComponent(() => import("./pages/PrivacyPage.jsx"), 'PrivacyPage');
const AdminDashboard = createLazyComponent(() => import("./features/admin/pages/AdminDashboard.jsx"), 'AdminDashboard');
const SuperAdminDashboard = createLazyComponent(() => import("./features/admin/pages/SuperAdminDashboard.jsx"), 'SuperAdminDashboard');
const VisualizeData = createLazyComponent(() => import("./features/visualize/pages/NivoVisualizeData.jsx"), 'VisualizeData');
const LibraryPage = createLazyComponent(() => import("./features/library/pages/LibraryPage.jsx"), 'LibraryPage');
const Workspace = createLazyComponent(() => import("./pages/WorkspacePage.jsx"), 'Workspace');

// Wrapper for lazy loaded routes
const LazyWrapper = memo(({ children, useHeroSkeleton = false }) => {
  const fallback = useHeroSkeleton
    ? <HeroSkeleton />
    : (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0d14]">
        <div className="text-[10px] uppercase font-mono tracking-widest text-zinc-600 animate-pulse">
          Initializing Interface...
        </div>
      </div>
    );
  return <Suspense fallback={fallback}>{children}</Suspense>;
});
LazyWrapper.displayName = 'LazyWrapper';

// Theme updater component


// App Layout with AuthProvider (Logic Heavy)
// App Layout with AuthProvider (Logic Heavy)
const AppLayoutContent = memo(() => {
  const location = useLocation();
  const { roleError } = useAuth();

  useEffect(() => window.scrollTo(0, 0), [location.pathname]);
  
  // These hooks consume AuthContext, so they must be inside AuthProvider
  useRoleRedirect();

  const appRoutes = ['/chat', '/library'];
  const isAppPage = appRoutes.includes(location.pathname) ||
    location.pathname.startsWith('/chat/') ||
    location.pathname.startsWith('/shared/') ||
    location.pathname.startsWith('/super') ||
    location.pathname.startsWith('/boss');

  const roleErrorBanner = roleError ? (
    <div className="bg-amber-500/20 border border-amber-400 text-amber-100 px-4 py-3 text-sm">
      <p className="font-semibold">Role verification failed</p>
      <p className="text-amber-100/80">{roleError.message || 'Unable to verify your role. Please refresh or contact support.'}</p>
    </div>
  ) : null;

  if (isAppPage) {
    return (
        <div className="flex flex-col min-h-screen bg-black text-slate-100">
          {roleErrorBanner}
          <main className="flex-1 flex flex-col min-h-0"><Outlet /></main>
        </div>
    );
  }

  // Fallback for app routes that still want header/footer but need Auth
  return (
      <div className="min-h-screen bg-black text-slate-100">
        <Header />
        {roleErrorBanner}
        <main><Outlet /></main>
        <Footer />
      </div>
  );
});
AppLayoutContent.displayName = 'AppLayoutContent';

const AppLayout = memo(() => {
  return (
    <AuthProvider>
      <AppLayoutContent />
    </AuthProvider>
  );
});
AppLayout.displayName = 'AppLayout';

const router = createBrowserRouter([
  // 1. Marketing / Public Routes (Wrapped in AppLayout for Header/Footer)
  {
    element: <AppLayout />,
    children: [
      { path: "/", element: <LazyWrapper useHeroSkeleton><Home /></LazyWrapper> },
      { path: "/about", element: <LazyWrapper><About /></LazyWrapper> },
      { path: "/features", element: <LazyWrapper><Features /></LazyWrapper> },
      { path: "/contact", element: <LazyWrapper><Contact /></LazyWrapper> },
      { path: "/terms", element: <LazyWrapper><TermsPage /></LazyWrapper> },
      { path: "/privacy", element: <LazyWrapper><PrivacyPage /></LazyWrapper> },
    ],
  },

  // 2. Auth / App Routes (Wrapped in AppLayout)
  {
    element: <AppLayout />,
    errorElement: <ErrorPage />,
    children: [
      // Auth Pages
      { path: "/login", element: <LazyWrapper><Auth /></LazyWrapper> },
      { path: "/signup", element: <LazyWrapper><Auth /></LazyWrapper> },

      // Protected App Pages
      { path: "/chat", element: <ProtectedRoute><LazyWrapper><Chat /></LazyWrapper></ProtectedRoute> },
      { path: "/chat/:chatId", element: <ProtectedRoute><LazyWrapper><Chat /></LazyWrapper></ProtectedRoute> },
      { path: "/workspace", element: <ProtectedRoute><LazyWrapper><Workspace /></LazyWrapper></ProtectedRoute> },
      { path: "/visualize", element: <Navigate to="/workspace?tab=visualize" replace /> },
      { path: "/personalities", element: <ProtectedRoute><LazyWrapper><Personalities /></LazyWrapper></ProtectedRoute> },
      { path: "/personalities/create", element: <ProtectedRoute><LazyWrapper><PersonalityEditor /></LazyWrapper></ProtectedRoute> },
      { path: "/personalities/edit/:id", element: <ProtectedRoute><LazyWrapper><PersonalityEditor /></LazyWrapper></ProtectedRoute> },
      { path: "/membership", element: <ProtectedRoute><LazyWrapper><Membership /></LazyWrapper></ProtectedRoute> },
      
      { path: "/settings", element: <LazyWrapper><Settings /></LazyWrapper> },
      { path: "/settings/:tab", element: <LazyWrapper><Settings /></LazyWrapper> },
      { path: "/files", element: <Navigate to="/workspace?tab=files" replace /> },
      { path: "/library", element: <ProtectedRoute><LazyWrapper><LibraryPage /></LazyWrapper></ProtectedRoute> },
      { path: "/shared/:shareId", element: <LazyWrapper><SharedChat /></LazyWrapper> },
      
      // Admin Routes
      { path: "/super", element: <AdminProtectedRoute><LazyWrapper><AdminDashboard /></LazyWrapper></AdminProtectedRoute> },
      { path: "/super/*", element: <AdminProtectedRoute><LazyWrapper><AdminDashboard /></LazyWrapper></AdminProtectedRoute> },
      { path: "/boss", element: <SuperAdminProtectedRoute requireSuperAdmin><LazyWrapper><SuperAdminDashboard /></LazyWrapper></SuperAdminProtectedRoute> },
      { path: "/boss/*", element: <SuperAdminProtectedRoute requireSuperAdmin><LazyWrapper><SuperAdminDashboard /></LazyWrapper></SuperAdminProtectedRoute> },
    ],
  },
  
  // Error Routes
  { path: "/error", element: <ErrorPage /> },
  { path: "*", element: <ErrorPage title="Page Not Found" message="The page you're looking for doesn't exist." showLoginButton={false} /> },
]);

export default router;

