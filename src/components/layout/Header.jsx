import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../../utils/firebaseConfig";
import { useAuth } from "../../context/AuthContext";
import {
  Menu,
  X,
  ChevronDown,
  Settings,
  LogOut,
  Plus,
  CreditCard,
  Shield,
  Crown,
  Library
} from "lucide-react";
import gsap from "gsap";

export default function Header() {
  const { currentUser: user, userProfile, membership, loading, role } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [userPlan, setUserPlan] = useState('free');
  const dropdownRef = useRef(null);
  const sidebarRef = useRef(null);
  const backdropRef = useRef(null);
  const tl = useRef(null);
  const [userAvatar, setUserAvatar] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Set user plan from membership data
    if (membership) {
      setUserPlan(membership.plan || 'free');
    } else if (userProfile?.membership) {
      setUserPlan(userProfile.membership.plan || 'free');
    } else {
      setUserPlan('free');
    }

    // Set avatar - prioritize custom uploaded photo over Google photo
    if (userProfile?.photoURL) {
      // Custom uploaded photo takes priority
      setUserAvatar(userProfile.photoURL);
    } else if (user?.photoURL) {
      // Fall back to Google profile photo
      setUserAvatar(user.photoURL);
    } else {
      setUserAvatar(null);
    }
  }, [user, userProfile, membership]);

  // Effect to close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRef]);

  // GSAP Animation for Sidebar
  useEffect(() => {
    // Only initialize GSAP timeline if refs are available
    if (sidebarRef.current && backdropRef.current) {
      gsap.set(sidebarRef.current, { xPercent: -100 });
      gsap.set(backdropRef.current, { autoAlpha: 0 });

      // Create timeline only once
      if (!tl.current) {
        tl.current = gsap.timeline({ paused: true })
          .to(backdropRef.current, { autoAlpha: 1, duration: 0.3 })
          .to(sidebarRef.current, { xPercent: 0, duration: 0.4, ease: "power3.out" }, "-=0.2");
      }
    }
  }, []);

  useEffect(() => {
    // Only play/reverse timeline if it exists
    if (tl.current) {
      isMenuOpen ? tl.current.play() : tl.current.reverse();
    }
  }, [isMenuOpen]);

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsDropdownOpen(false);
      setIsMenuOpen(false);
    } catch (error) {
      alert("Logout failed: " + error.message);
    }
  };

  const navItems = [
    { label: "Home", path: "/" },
    { label: "About", path: "/about" },
    { label: "Contact", path: "/contact" },
    { label: "Pricing", path: "/membership" },
    { label: "Visualize", path: "/visualize" },
    { label: "Chat", path: "/chat" },
  ];

  return (
    <header className="sticky top-0 h-[10vh] w-full border-b border-emerald-500/30 z-50 bg-black text-white">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 py-3">
        <Link to="/" className="flex items-center gap-4">
          <img src="/logo.svg" alt="Relyce AI" className="w-12 h-12 object-contain" />
          <span className="text-3xl font-extrabold text-white">Relyce AI</span>
        </Link>

        <nav className="hidden lg:flex items-center gap-6">
          {navItems.map(({ label, path }) => (
            <Link key={label} to={path} className="text-lg font-medium text-gray-300 hover:text-emerald-400 transition-colors duration-200">
              {label}
            </Link>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-4">
          {user ? (
            // --- NEW USER DROPDOWN MENU ---
            <div
              className="relative"
              ref={dropdownRef}
              onMouseEnter={() => setIsDropdownOpen(true)}
              onMouseLeave={() => {
                // Use a timeout to allow moving to the dropdown menu
                setTimeout(() => {
                  if (dropdownRef.current && !dropdownRef.current.matches(':hover')) {
                    setIsDropdownOpen(false);
                  }
                }, 100);
              }}
            >
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-3 p-1.5 rounded-full hover:bg-zinc-800 transition-colors"
              >
                {userAvatar ? (
                  <>
                  <img
                    src={userAvatar}
                    alt="Profile"
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-full border border-emerald-500/30"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 hidden items-center justify-center font-bold text-emerald-300 border border-emerald-500/30 absolute top-1.5 left-1.5 pointer-events-none">
                    {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
                  </div>
                  </>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center font-bold text-emerald-300 border border-emerald-500/30">
                    {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
                <div className="text-left">
                  <p className="font-semibold text-white truncate max-w-[150px]">{user.displayName || user.email}</p>
                  <p className="text-xs text-emerald-400 capitalize">
                    {(role === 'admin' || role === 'superadmin') ? 'Unlimited Access' : `${userPlan} Plan`}
                  </p>
                </div>
                <ChevronDown size={20} className={`text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isDropdownOpen && (
                <div
                  className="absolute top-full right-0 mt-3 w-64 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden bg-zinc-900 animate-fade-in-down"
                  onMouseEnter={() => setIsDropdownOpen(true)}
                  onMouseLeave={() => setIsDropdownOpen(false)}
                >
                  <div className="p-4 border-b border-zinc-700">
                    <p className="font-semibold text-white truncate">{user.displayName || "User"}</p>
                    <p className="text-sm text-zinc-400 truncate">{user.email}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full">
                        {(role === 'admin' || role === 'superadmin') ? 'Unlimited Access' : userPlan.charAt(0).toUpperCase() + userPlan.slice(1)}
                      </span>
                      {role === 'superadmin' && (
                        <span className="text-xs text-yellow-400 bg-yellow-500/10 px-2 py-1 rounded-full flex items-center gap-1">
                          <Crown className="w-3 h-3" />
                          {loading ? '...' : 'Super Admin'}
                        </span>
                      )}
                      {role === 'admin' && (
                        <span className="text-xs text-blue-400 bg-blue-500/10 px-2 py-1 rounded-full flex items-center gap-1">
                          <Shield className="w-3 h-3" />
                          {loading ? '...' : 'Admin'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="p-2">
                    <Link to="/settings" onClick={() => setIsDropdownOpen(false)} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors">
                      <Settings size={18} /><span>Settings</span>
                    </Link>
                    <Link to="/files" onClick={() => setIsDropdownOpen(false)} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors">
                      <Plus size={18} /><span>My Files</span>
                    </Link>
                    <Link to="/library" onClick={() => setIsDropdownOpen(false)} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors">
                      <Library size={18} /><span>Library</span>
                    </Link>
                    <Link to="/membership" onClick={() => setIsDropdownOpen(false)} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors">
                      <CreditCard size={18} /><span>Change Plan</span>
                    </Link>
                    {(role === 'admin' || role === 'superadmin') && (
                      <Link to="/super" onClick={() => setIsDropdownOpen(false)} className="flex items-center gap-3 w-full px-3 py-2.5 text-emerald-300 hover:bg-emerald-500/10 hover:text-emerald-200 rounded-md transition-colors">
                        <Shield size={18} /><span>Admin Dashboard</span>
                      </Link>
                    )}
                    {role === 'superadmin' && (
                      <Link to="/boss" onClick={() => setIsDropdownOpen(false)} className="flex items-center gap-3 w-full px-3 py-2.5 text-yellow-300 hover:bg-yellow-500/10 hover:text-yellow-200 rounded-md transition-colors">
                        <Crown size={18} /><span>Super Admin Panel</span>
                      </Link>
                    )}
                  </div>
                  <div className="p-2 border-t border-zinc-700">
                    <button onClick={() => { handleLogout(); setIsDropdownOpen(false); }} className="flex items-center gap-3 w-full px-3 py-2.5 text-red-400 hover:bg-red-500/10 rounded-md transition-colors">
                      <LogOut size={18} /><span>Logout</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={() => navigate("/login")} type="button" className="px-5 py-2.5 text-lg font-medium text-gray-300 hover:text-white transition-colors">Login</button>
              <button onClick={() => navigate("/signup")} type="button" className="px-5 py-2.5 text-lg bg-emerald-500 text-black font-semibold rounded-lg hover:bg-emerald-400 transform transition-transform hover:-translate-y-0.5">Sign Up</button>
            </div>
          )}
        </div>

        <button className="lg:hidden text-zinc-400 hover:text-white transition" onClick={toggleMenu} aria-label="Menu">
          <Menu size={28} />
        </button>
      </div>

      {/* Mobile Sidebar & Backdrop */}
      <div
        ref={backdropRef}
        onClick={toggleMenu}
        className={`fixed inset-0 z-40 lg:hidden bg-black/60 backdrop-blur-sm pointer-events-auto`}
        style={{ display: 'block' }}
      />

      <aside
        ref={sidebarRef}
        className={`fixed top-0 left-0 h-screen w-72 z-50 lg:hidden border-r bg-zinc-900 border-zinc-800 text-white`}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="Relyce AI" className="w-8 h-8 object-contain" />
            <span className="text-xl font-bold">Relyce AI</span>
          </div>
          <button onClick={toggleMenu} className="text-zinc-400 hover:text-white" aria-label="Close">
            <X size={22} />
          </button>
        </div>
        <nav className="p-4 space-y-2">
          {navItems.map(({ label, path }) => (
            <Link
              key={label}
              to={path}
              onClick={() => setIsMenuOpen(false)}
              className="block px-3 py-2 rounded-lg font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white"
            >
              {label}
            </Link>
          ))}
          {user && (
            <Link
              to="/settings"
              onClick={() => setIsMenuOpen(false)}
              className="block px-3 py-2 rounded-lg font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white"
            >
              Settings
            </Link>
          )}
        </nav>

        <div className="mt-auto p-4 border-t border-zinc-800">
          {user ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {userAvatar ? (
                  <>
                  <img 
                    src={userAvatar} 
                    alt="Profile" 
                    referrerPolicy="no-referrer"
                    className="w-9 h-9 rounded-full border border-emerald-500/30" 
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                  <div className="w-9 h-9 rounded-full bg-emerald-500/20 hidden items-center justify-center font-bold text-emerald-300 border border-emerald-500/30 absolute">
                    {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
                  </div>
                  </>
                ) : (
                  <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center font-bold text-emerald-300 border border-emerald-500/30">
                    {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold truncate max-w-[140px]">{user.displayName || user.email}</p>
                  <p className="text-xs text-emerald-400 capitalize">{(role === 'admin' || role === 'superadmin') ? 'Unlimited Access' : `${userPlan} Plan`}</p>
                </div>
              </div>
              <button onClick={handleLogout} className="text-red-400 hover:text-red-300" aria-label="Logout">
                <LogOut size={20} />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => { setIsMenuOpen(false); navigate('/login'); }} className="px-4 py-2 rounded-lg text-zinc-300 bg-zinc-800 hover:bg-zinc-700">
                Login
              </button>
              <button onClick={() => { setIsMenuOpen(false); navigate('/Signup'); }} className="px-4 py-2 rounded-lg bg-emerald-500 text-black font-semibold hover:bg-emerald-400">
                Sign Up
              </button>
            </div>
          )}
        </div>
      </aside>

    </header>
  );
}
