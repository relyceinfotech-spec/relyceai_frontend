import React, { useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Users,
    BarChart,
    DollarSign,
    CreditCard,
    Shield,
    Settings,
    TrendingUp,
    Package,
    LogOut,
    ChevronLeft,
    ChevronRight,
    Crown,
    Activity,
    SlidersHorizontal,
    Home,
    LayoutDashboard,
    FileText
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';

const AdminSidebar = memo(({ isSuperAdmin, isCollapsed, toggleSidebar, mobileOpen, closeMobile }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { logout, currentUser } = useAuth();

    // Determine active tab based on path
    const getActiveTab = () => {
        const path = location.pathname;
        const parts = path.split('/');
        // For /super/users -> users, for /super -> overview
        return parts[2] || 'overview';
    };

    const activeTab = getActiveTab();

    const superAdminMenuItems = [
        { id: 'overview', label: 'Overview', icon: BarChart },
        { id: 'analytics', label: 'AI Control', icon: Activity },
        { id: 'runtime', label: 'Runtime Control', icon: SlidersHorizontal },
        { id: 'users', label: 'User Management', icon: Users },
        { id: 'payments', label: 'Payments & Revenue', icon: DollarSign },
        { id: 'coupons', label: 'Coupons', icon: CreditCard },
        { id: 'membership', label: 'Membership Plans', icon: Package },
        { id: 'roles', label: 'Role Management', icon: Shield },
        { id: 'settings', label: 'System Settings', icon: Settings }
    ];

    const adminMenuItems = [
        { id: 'overview', label: 'Usage Dashboard', icon: TrendingUp },
        { id: 'monitoring', label: 'Chat Monitoring', icon: Activity },
        { id: 'alerts', label: 'Alerts Panel', icon: BarChart },
        { id: 'ai-debug', label: 'AI Debug', icon: Activity },
        { id: 'users', label: 'User Management', icon: Users },
        { id: 'bulk-export', label: 'Bulk & Export', icon: Package },
        { id: 'audit', label: 'Audit Timeline', icon: Shield },
        { id: 'logs', label: 'Basic Logs', icon: FileText }
    ];

    // Logic to determine which menu to show
    // If user is Super Admin BUT is currently viewing /boss routes, show Super Admin menu
    // If viewing /super routes, show Admin menu
    const isBossView = isSuperAdmin && location.pathname.startsWith('/boss');

    const menuItems = isBossView ? superAdminMenuItems : adminMenuItems;
    const basePath = isBossView ? '/boss' : '/super';

    const handleNavigation = (id) => {
        // If id is 'overview', navigate to root of base path or /overview
        const path = id === 'overview' ? basePath : `${basePath}/${id}`;
        navigate(path);
        if (mobileOpen) closeMobile();
    };

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/login');
        } catch (error) {
            console.error('Failed to logout', error);
        }
    };

    // Animation variants
    const sidebarVariants = {
        expanded: { width: 260 },
        collapsed: { width: 80 }
    };

    // Mobile Sidebar variants
    const mobileSidebarVariants = {
        closed: { x: "-100%" },
        open: { x: 0 }
    };

    const NavItem = ({ item, isActive }) => (
        <button
            onClick={() => handleNavigation(item.id)}
            className={`w-full flex items-center p-3 mb-1 transition-all duration-300 group relative overflow-hidden ${isActive
                ? 'text-white'
                : 'text-zinc-500 hover:text-zinc-200'
                }`}
        >
            {/* Active Indication - Glowing Left Border & Background */}
            {isActive && (
                <>
                    <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-emerald-400 shadow-[0_0_10px_2px_rgba(52,211,153,0.5)]" />
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-transparent" />
                </>
            )}
            
            {/* Hover Background - Subtle */}
            {!isActive && (
                <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}

            <div className="relative z-10 flex items-center w-full">
                <div className={`flex items-center justify-center ${isCollapsed ? 'w-full' : 'ml-2'}`}>
                    <item.icon className={`h-[18px] w-[18px] ${isActive ? 'text-emerald-400' : 'group-hover:text-emerald-400/70'} transition-colors`} strokeWidth={isActive ? 2 : 1.5} />
                </div>

                {!isCollapsed && (
                    <span className={`ml-4 text-sm tracking-wide ${isActive ? 'font-medium' : 'font-light'} truncate`}>
                        {item.label}
                    </span>
                )}

                {/* Tooltip for collapsed mode */}
                {isCollapsed && (
                    <div className="absolute left-full ml-4 px-3 py-1.5 bg-[#030508] text-white text-xs rounded-md opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl border border-white/10 transition-opacity">
                        {item.label}
                    </div>
                )}
            </div>
        </button>
    );

    return (
        <>
            {/* Desktop Sidebar */}
            <motion.div
                className={`hidden md:flex flex-col h-screen fixed left-0 top-0 border-r border-white/5 bg-black/40 backdrop-blur-3xl z-40 transition-all duration-300 ease-in-out overflow-hidden`}
                initial={false}
                animate={isCollapsed ? "collapsed" : "expanded"}
                variants={sidebarVariants}
                style={{ width: isCollapsed ? 80 : 260 }}
            >
                {/* Logo Area */}
                <div className="h-20 flex items-center justify-between px-6 border-b border-white/5">
                    <div className={`flex items-center space-x-4 overflow-hidden ${isCollapsed ? 'justify-center w-full space-x-0' : ''}`}>
                        <div className="relative group">
                            <div className="absolute -inset-1 bg-emerald-500 rounded-lg blur opacity-40 group-hover:opacity-60 transition duration-500"></div>
                            <div className="relative h-9 w-9 bg-black border border-white/10 flex items-center justify-center shrink-0">
                                {isBossView ? <Crown size={16} className="text-emerald-400" /> : <Shield size={16} className="text-emerald-400" />}
                            </div>
                        </div>
                        {!isCollapsed && (
                            <motion.span
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="font-light text-lg tracking-[0.1em] text-white uppercase text-[13px]"
                            >
                                {isBossView ? 'Supreme' : 'Admin'}
                            </motion.span>
                        )}
                    </div>
                </div>

                {/* Menu Items */}
                <div className="flex-1 overflow-y-auto py-6 theme-scrollbar">
                    <nav className="space-y-1">
                        {menuItems.map(item => (
                            <NavItem key={item.id} item={item} isActive={activeTab === item.id} />
                        ))}
                    </nav>
                </div>

                {/* Footer / User Profile */}
                <div className="p-4 border-t border-white/5 space-y-1">
                    {!isCollapsed && (
                        <div className="flex items-center p-3 mb-4 bg-white/5 border border-white/5 group hover:bg-white/10 transition-colors cursor-pointer">
                            {currentUser?.photoURL ? (
                                <img
                                    src={currentUser.photoURL}
                                    alt={currentUser.displayName || 'User'}
                                    className="h-10 w-10 object-cover shrink-0 ring-1 ring-emerald-500/30"
                                    referrerPolicy="no-referrer"
                                />
                            ) : (
                                <div className="h-10 w-10 bg-black border border-white/10 flex items-center justify-center text-xs font-light text-white shrink-0">
                                    {currentUser?.displayName?.charAt(0).toUpperCase() || currentUser?.email?.charAt(0).toUpperCase() || 'U'}
                                </div>
                            )}
                            <div className="ml-4 overflow-hidden">
                                <p className="text-[13px] font-medium text-white truncate tracking-wide">
                                    {currentUser?.displayName || 'User'}
                                </p>
                                <p className="text-[10px] text-zinc-500 truncate font-mono uppercase tracking-widest mt-0.5">
                                    {currentUser?.email}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Navigation Links */}
                    {isSuperAdmin && (
                        <>
                            {isBossView ? (
                                <button
                                    onClick={() => navigate('/super')}
                                    className={`w-full flex items-center p-3 text-zinc-500 hover:text-white hover:bg-white/5 transition-all duration-300 ${isCollapsed ? 'justify-center' : ''}`}
                                    title="Switch to Admin View"
                                >
                                    <LayoutDashboard size={18} strokeWidth={1.5} />
                                    {!isCollapsed && <span className="ml-4 text-[13px] tracking-wide font-light">Admin View</span>}
                                </button>
                            ) : (
                                <button
                                    onClick={() => navigate('/boss')}
                                    className={`w-full flex items-center p-3 text-emerald-400 hover:text-white hover:bg-emerald-900/20 transition-all duration-300 ${isCollapsed ? 'justify-center' : ''}`}
                                    title="Back to Super Admin"
                                >
                                    <Crown size={18} strokeWidth={1.5} />
                                    {!isCollapsed && <span className="ml-4 text-[13px] tracking-wide font-light">Super Admin</span>}
                                </button>
                            )}
                        </>
                    )}

                    <button
                        onClick={() => navigate('/')}
                        className={`w-full flex items-center p-3 text-zinc-500 hover:text-white hover:bg-white/5 transition-all duration-300 ${isCollapsed ? 'justify-center' : ''}`}
                        title="Back to Home"
                    >
                        <Home size={18} strokeWidth={1.5} />
                        {!isCollapsed && <span className="ml-4 text-[13px] tracking-wide font-light">Home Page</span>}
                    </button>

                    <button
                        onClick={handleLogout}
                        className={`w-full flex items-center p-3 text-red-500/70 hover:bg-red-500/5 hover:text-red-400 transition-all duration-300 ${isCollapsed ? 'justify-center' : ''
                            }`}
                        title="Logout"
                    >
                        <LogOut size={18} strokeWidth={1.5} />
                        {!isCollapsed && <span className="ml-4 text-[13px] tracking-wide font-light">Sign Out</span>}
                    </button>

                    <button
                        onClick={toggleSidebar}
                        className="absolute -right-3 top-20 bg-emerald-600 text-white p-1 rounded-full shadow-lg hover:bg-emerald-500 transition-colors border border-emerald-400 hidden md:flex"
                    >
                        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                    </button>
                </div>
            </motion.div>

            {/* Mobile Overlay */}
            <AnimatePresence>
                {mobileOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={closeMobile}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
                    />
                )}
            </AnimatePresence>

            {/* Mobile Sidebar */}
            <motion.div
                className="fixed inset-y-0 left-0 w-64 bg-[#030508] border-r border-white/5 z-50 md:hidden flex flex-col"
                initial="closed"
                animate={mobileOpen ? "open" : "closed"}
                exit="closed"
                variants={mobileSidebarVariants}
                transition={{ type: "spring", bounce: 0, duration: 0.3 }}
            >
                <div className="h-16 flex items-center px-6 border-b border-white/5">
                    <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center mr-3">
                        {isSuperAdmin ? <Crown size={18} className="text-white" /> : <Shield size={18} className="text-white" />}
                    </div>
                    <span className="font-bold text-lg text-white">Dashboard</span>
                </div>

                <div className="flex-1 overflow-y-auto py-4 px-4">
                    <nav className="space-y-2">
                        {menuItems.map(item => (
                            <NavItem key={item.id} item={item} isActive={activeTab === item.id} />
                        ))}
                    </nav>
                </div>

                <div className="p-4 border-t border-white/5">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center p-3 rounded-xl bg-red-500/10 text-red-400 font-medium hover:bg-red-500/20 transition-colors"
                    >
                        <LogOut size={18} className="mr-2" />
                        Sign Out
                    </button>
                </div>
            </motion.div>
        </>
    );
});

AdminSidebar.displayName = 'AdminSidebar';

export default AdminSidebar;
