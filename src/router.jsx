import { createBrowserRouter, Outlet, useLocation } from "react-router-dom";
import React, { Suspense, memo, useEffect } from "react";
import { useTheme } from "./context/ThemeContext";
import Header from "./components/layout/Header";
import Footer from "./components/layout/Footer";
import AdminProtectedRoute from "./features/auth/components/AdminProtectedRoute";
import SuperAdminProtectedRoute from "./features/auth/components/SuperAdminProtectedRoute";
import ProtectedRoute from "./features/auth/components/ProtectedRoute";
import ErrorPage from "./pages/ErrorPage";
import LoadingSpinner from "./components/loading/LoadingSpinner";
import HeroSkeleton from "./components/skeletons/HeroSkeleton";
import { usePreloadComponents } from "./hooks/usePreloadComponents";
import useRoleRedirect from "./hooks/useRoleRedirect";

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
const Settings = createLazyComponent(() => import("./features/settings/pages/SettingsPage.jsx"), 'Settings');
const UserFiles = createLazyComponent(() => import("./features/files/pages/UserFilesPage.jsx"), 'UserFiles');
const SharedChat = createLazyComponent(() => import("./features/chat/pages/SharedChatPage.jsx"), 'SharedChat');
const TermsPage = createLazyComponent(() => import("./pages/TermsPage.jsx"), 'TermsPage');
const PrivacyPage = createLazyComponent(() => import("./pages/PrivacyPage.jsx"), 'PrivacyPage');
const AdminDashboard = createLazyComponent(() => import("./features/admin/pages/AdminDashboard.jsx"), 'AdminDashboard');
const SuperAdminDashboard = createLazyComponent(() => import("./features/admin/pages/SuperAdminDashboard.jsx"), 'SuperAdminDashboard');
const VisualizeData = createLazyComponent(() => import("./features/visualize/pages/NivoVisualizeData.jsx"), 'VisualizeData');
const LibraryPage = createLazyComponent(() => import("./features/library/pages/LibraryPage.jsx"), 'LibraryPage');

// Wrapper for lazy loaded routes
const LazyWrapper = memo(({ children, useHeroSkeleton = false }) => {
  const fallback = useHeroSkeleton
    ? <HeroSkeleton />
    : <LoadingSpinner size="default" message="Loading..." />;
  return <Suspense fallback={fallback}>{children}</Suspense>;
});
LazyWrapper.displayName = 'LazyWrapper';

// Theme updater component
const ThemeUpdater = ({ isChatPage }) => {
  const { setIsChatPage } = useTheme();
  useEffect(() => setIsChatPage(isChatPage), [isChatPage, setIsChatPage]);
  return null;
};

const AppLayout = memo(() => {
  const location = useLocation();
  
  useEffect(() => window.scrollTo(0, 0), [location.pathname]);
  usePreloadComponents();
  useRoleRedirect();

  const appRoutes = ['/chat', '/library'];
  const isAppPage = appRoutes.includes(location.pathname) ||
    location.pathname.startsWith('/chat/') ||
    location.pathname.startsWith('/shared/') ||
    location.pathname.startsWith('/super') ||
    location.pathname.startsWith('/boss');

  if (isAppPage) {
    return (
      <>
        <ThemeUpdater isChatPage={true} />
        <div className="flex flex-col h-screen bg-black text-slate-100">
          <main className="flex-1 overflow-hidden"><Outlet /></main>
        </div>
      </>
    );
  }

  return (
    <>
      <ThemeUpdater isChatPage={false} />
      <div className="min-h-screen bg-black text-slate-100">
        <Header />
        <main><Outlet /></main>
        <Footer />
      </div>
    </>
  );
});
AppLayout.displayName = 'AppLayout';

const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { path: "/", element: <LazyWrapper useHeroSkeleton><Home /></LazyWrapper> },
      { path: "/chat", element: <ProtectedRoute><LazyWrapper><Chat /></LazyWrapper></ProtectedRoute> },
      { path: "/chat/:chatId", element: <ProtectedRoute><LazyWrapper><Chat /></LazyWrapper></ProtectedRoute> },
      { path: "/visualize", element: <LazyWrapper><VisualizeData /></LazyWrapper> },
      { path: "/personalities", element: <ProtectedRoute><LazyWrapper><Personalities /></LazyWrapper></ProtectedRoute> },
      { path: "/personalities/create", element: <ProtectedRoute><LazyWrapper><PersonalityEditor /></LazyWrapper></ProtectedRoute> },
      { path: "/personalities/edit/:id", element: <ProtectedRoute><LazyWrapper><PersonalityEditor /></LazyWrapper></ProtectedRoute> },
      { path: "/membership", element: <ProtectedRoute><LazyWrapper><Membership /></LazyWrapper></ProtectedRoute> },
      { path: "/login", element: <LazyWrapper><Auth /></LazyWrapper> },
      { path: "/signup", element: <LazyWrapper><Auth /></LazyWrapper> },
      { path: "/Signup", element: <LazyWrapper><Auth /></LazyWrapper> },
      { path: "/About", element: <LazyWrapper><About /></LazyWrapper> },
      { path: "/contact", element: <LazyWrapper><Contact /></LazyWrapper> },
      { path: "/settings", element: <LazyWrapper><Settings /></LazyWrapper> },
      { path: "/files", element: <LazyWrapper><UserFiles /></LazyWrapper> },
      { path: "/library", element: <ProtectedRoute><LazyWrapper><LibraryPage /></LazyWrapper></ProtectedRoute> },
      { path: "/shared/:shareId", element: <LazyWrapper><SharedChat /></LazyWrapper> },
      { path: "/terms", element: <LazyWrapper><TermsPage /></LazyWrapper> },
      { path: "/privacy", element: <LazyWrapper><PrivacyPage /></LazyWrapper> },
      { path: "/super", element: <AdminProtectedRoute><LazyWrapper><AdminDashboard /></LazyWrapper></AdminProtectedRoute> },
      { path: "/super/*", element: <AdminProtectedRoute><LazyWrapper><AdminDashboard /></LazyWrapper></AdminProtectedRoute> },
      { path: "/boss", element: <SuperAdminProtectedRoute requireSuperAdmin><LazyWrapper><SuperAdminDashboard /></LazyWrapper></SuperAdminProtectedRoute> },
      { path: "/boss/*", element: <SuperAdminProtectedRoute requireSuperAdmin><LazyWrapper><SuperAdminDashboard /></LazyWrapper></SuperAdminProtectedRoute> },
      { path: "/error", element: <ErrorPage /> },
      { path: "*", element: <ErrorPage title="Page Not Found" message="The page you're looking for doesn't exist." showLoginButton={false} /> },
    ],
  },
]);

export default router;