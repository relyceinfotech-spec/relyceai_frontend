import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../../../context/AuthContext.jsx';
import { updateUserMembership } from '../services/membershipService';
import { handleRazorpayPayment, prefetchRazorpay } from '../services/paymentService';
import { getCurrentPricing } from '../../admin/services/adminDashboard';
import { validateCoupon, getAllCoupons } from '../../../utils/couponManagement';
import { BUSINESS_PLAN_IDS, PERSONAL_PLAN_IDS, mergePricingWithCatalog } from '../planCatalog';
import toast, { Toaster } from 'react-hot-toast';

const AnimatedGradientText = ({ children, className }) => (
  <span className={`bg-clip-text text-transparent bg-gradient-to-r from-zinc-100 via-zinc-400 to-zinc-100 animate-[bg-pan_8s_linear_infinite] ${className}`} style={{ backgroundSize: '200% auto' }}>
    {children}
  </span>
);

export default function Membership() {
  const { currentUser: user, membership, refreshUserProfile } = useAuth();

  const [scrollY, setScrollY] = useState(0);
  const [tab, setTab] = useState('personal');
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [loading, setLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(null);
  const [plansData, setPlansData] = useState({ personal: [], business: [] });

  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [availableCoupons, setAvailableCoupons] = useState([]);
  const [showAvailableCoupons, setShowAvailableCoupons] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Fetch current pricing from Firestore
  useEffect(() => {
    prefetchRazorpay();
    const fetchPricing = async () => {
      try {
        setLoading(true);
        const pricing = mergePricingWithCatalog(await getCurrentPricing());
        const personalPlans = PERSONAL_PLAN_IDS.map((planId) => pricing[planId]);
        const businessPlans = BUSINESS_PLAN_IDS.map((planId) => pricing[planId]);
        setPlansData({ personal: personalPlans, business: businessPlans });
      } catch (error) { 
        console.error('Error fetching pricing:', error); 
      } finally { 
        setTimeout(() => setLoading(false), 300); 
      }
    };
    fetchPricing();
  }, []);

  // Fetch coupons
  useEffect(() => {
    const fetchCoupons = async () => { 
        try { 
            const coupons = await getAllCoupons(); 
            setAvailableCoupons(coupons.filter(c => c.active)); 
        } catch (e) { 
            console.error(e); 
        } 
    };
    fetchCoupons();
  }, []);

  const applyCoupon = async () => {
    if (!couponCode.trim()) { setCouponError('Please enter a coupon code'); return; }
    try {
      const coupon = await validateCoupon(couponCode);
      if (coupon) {
        setAppliedCoupon(coupon);
        setCouponError('');
        toast.success(`Coupon applied: ${coupon.description}`, { style: { background: '#111', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }});
      }
      else { setCouponError('Invalid coupon code'); setAppliedCoupon(null); }
    } catch (error) { console.error(error); setCouponError('Error validating coupon.'); }
  };

  const removeCoupon = () => {
    setCouponCode('');
    setAppliedCoupon(null);
    setCouponError('');
    setShowAvailableCoupons(false);
  };

  const calculateFinalPrice = (plan) => {
    if (plan.monthlyPrice === 0) return 0;
    let price = billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
    if (appliedCoupon) {
      const discount = billingCycle === 'yearly' ? (appliedCoupon.yearlyDiscount || appliedCoupon.monthlyDiscount || 0) : (appliedCoupon.monthlyDiscount || 0);
      if (appliedCoupon.type === 'percentage') { price = price * (1 - discount / 100); }
      else { price = Math.max(0, price - discount); }
    }
    return Math.round(price);
  };

  const handlePurchase = async (planId) => {
    if (!user) { toast.error('Please log in to choose a plan.', { style: { background: '#111', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}); return; }
    if (membership?.plan === planId) { toast.error('This is already your current plan.', { style: { background: '#111', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}); return; }
    setIsPurchasing(planId);
    try {
      const plan = [...plansData.personal, ...plansData.business].find(p => p.id === planId);
      const finalPrice = calculateFinalPrice(plan);
      
      if (planId === 'free') { 
        await updateUserMembership(user.uid, planId, billingCycle); 
        toast.success('Successfully downgraded to Free plan!', { style: { background: '#111', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}); 
        setIsPurchasing(null);
      } else {
        handleRazorpayPayment(
          plan,
          finalPrice,
          user,
          billingCycle,
          async (paymentData) => {
             try {
                // Using paymentData to log or handle explicitly to satisfy linting
                console.log('Payment processed:', paymentData.razorpay_payment_id);
                await refreshUserProfile();
                toast.success(`Successfully upgraded to ${plan.title} plan!`, { style: { background: '#111', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }});
             } catch (err) {
                console.error(err);
                toast.error('Payment successful but failed to update membership.', { style: { background: '#111', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }});
             } finally {
                setIsPurchasing(null);
             }
          },
          (error) => {
            console.error(error);
            setIsPurchasing(null);
          }
        );
      }
    } catch (err) { 
        console.error(err); 
        toast.error('Something went wrong. Please try again.', { style: { background: '#111', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}); 
        setIsPurchasing(null);
    }
  };

  return (
    <main className="relative min-h-screen bg-[#030508] text-white selection:bg-white/10 selection:text-white font-sans overflow-hidden">
      <Helmet>
        <title>Pricing | Relyce AI</title>
        <meta name="description" content="Select the architecture that scales with your intelligence needs." />
      </Helmet>
      
      <Toaster position="bottom-right" />

      {/* Atmospheric Overlays */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div 
            className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] bg-emerald-500/[0.015] rounded-full blur-[140px] mix-blend-screen transition-transform duration-1000 ease-out" 
            style={{ transform: `translateY(${scrollY * 0.05}px)`}}
        />
        <div 
           className="absolute inset-0 opacity-[0.02] mix-blend-overlay pointer-events-none" 
           style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
        />
      </div>

      <div className="relative z-10 w-full max-w-[1400px] mx-auto px-6 lg:px-12 pt-32 pb-40">
        
        {/* --- Header --- */}
        <div className="mb-24 flex flex-col md:flex-row justify-between items-start md:items-end gap-12 border-b border-white/5 pb-16">
            <div className="max-w-3xl">
                <div className="mb-8 flex items-center gap-4">
                    <span className="text-[10px] tracking-[0.2em] font-mono text-zinc-500 uppercase">Valuation</span>
                    <div className="w-12 h-px bg-white/10" />
                </div>
                
                <h1 className="text-5xl sm:text-7xl md:text-[80px] font-medium tracking-tight leading-[1] -ml-1">
                    <AnimatedGradientText>Architecture</AnimatedGradientText><br />
                    <span className="text-zinc-500">Topology.</span>
                </h1>
            </div>

            <div className="max-w-sm flex flex-col items-start md:items-end text-left md:text-right">
                <p className="text-lg text-zinc-400 font-light leading-relaxed mb-8">
                    Select the computational plane that aligns with your scale. Transparent, unmetered value scaling.
                </p>
                {/* Billing Toggle UI */}
                <div className="inline-flex items-center gap-6 border border-white/10 rounded-full px-6 py-3">
                    <button 
                        onClick={() => setBillingCycle('monthly')}
                        className={`text-xs uppercase tracking-widest transition-colors ${billingCycle === 'monthly' ? 'text-white font-medium' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                        Monthly
                    </button>
                    <div className="w-px h-4 bg-white/10" />
                    <button 
                        onClick={() => setBillingCycle('yearly')}
                        className={`text-xs uppercase tracking-widest transition-colors flex items-center gap-2 ${billingCycle === 'yearly' ? 'text-white font-medium' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                        Annually <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">SAVE 17%</span>
                    </button>
                </div>
            </div>
        </div>

        {/* --- Content Tabs --- */}
        <div className="flex gap-12 mb-16 border-b border-white/5">
            <button 
                onClick={() => setTab('personal')}
                className={`pb-4 text-[10px] uppercase font-mono tracking-[0.2em] transition-all relative ${tab === 'personal' ? 'text-white' : 'text-zinc-600 hover:text-zinc-400'}`}
            >
                Core Models
                {tab === 'personal' && <div className="absolute bottom-[-1px] left-0 right-0 h-px bg-white" />}
            </button>
            <button 
                onClick={() => setTab('business')}
                className={`pb-4 text-[10px] uppercase font-mono tracking-[0.2em] transition-all relative ${tab === 'business' ? 'text-white' : 'text-zinc-600 hover:text-zinc-400'}`}
            >
                Enterprise Grade
                {tab === 'business' && <div className="absolute bottom-[-1px] left-0 right-0 h-px bg-white" />}
            </button>
        </div>

        {/* --- Coupon Interaction --- */}
        <div className="mb-20 max-w-lg">
             <div className="flex items-end gap-6">
                 <div className="flex-1 relative group">
                    <input 
                        type="text" 
                        value={couponCode} 
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        disabled={!!appliedCoupon}
                        className="w-full bg-transparent border-b border-white/10 py-2 text-white font-mono text-sm focus:outline-none focus:border-white transition-colors peer placeholder-transparent"
                        placeholder="VOUCHER CODE"
                    />
                    <label className="absolute left-0 top-2 text-zinc-600 text-xs font-mono transition-all peer-focus:-top-4 peer-focus:text-[9px] peer-focus:text-zinc-400 peer-valid:-top-4 peer-valid:text-[9px] pointer-events-none tracking-widest">
                        VOUCHER CODE
                    </label>
                 </div>
                 <button 
                    onClick={appliedCoupon ? removeCoupon : applyCoupon}
                    className="text-xs font-mono uppercase tracking-widest text-zinc-400 hover:text-white transition-colors pb-2 border-b border-transparent hover:border-white"
                >
                    {appliedCoupon ? '[ X_REMOVE ]' : '[ APPLY ]'}
                </button>
             </div>
             {couponError && <p className="text-[10px] text-red-500/80 font-mono mt-2 uppercase">{couponError}</p>}
             {appliedCoupon && (
                 <p className="text-[10px] text-emerald-400 font-mono mt-2 uppercase tracking-wider">
                     <span className="text-emerald-500 mr-2">»</span> {appliedCoupon.description} ACTIVE
                 </p>
             )}
             {!appliedCoupon && !showAvailableCoupons && availableCoupons.length > 0 && (
                 <button onClick={() => setShowAvailableCoupons(true)} className="text-[9px] text-zinc-600 hover:text-zinc-400 font-mono mt-4 uppercase underline underline-offset-4">
                     View Directory
                 </button>
             )}
             {showAvailableCoupons && !appliedCoupon && (
                 <div className="mt-6 border border-white/10 p-4 font-mono text-[10px]">
                     <div className="flex justify-between items-center mb-4 text-zinc-500 uppercase">
                         <span>Available Vouchers</span>
                         <button onClick={() => setShowAvailableCoupons(false)} className="hover:text-white">[ X ]</button>
                     </div>
                     <div className="space-y-4">
                        {availableCoupons.map((c) => (
                            <div key={c.id} className="flex justify-between items-center group cursor-pointer" onClick={() => { setCouponCode(c.code); setShowAvailableCoupons(false); }}>
                                <span className="text-white group-hover:text-emerald-400 transition-colors uppercase">{c.code}</span>
                                <span className="text-zinc-500 group-hover:text-zinc-300 transition-colors tracking-wide">{c.description}</span>
                            </div>
                        ))}
                     </div>
                 </div>
             )}
        </div>

        {/* --- Plans Display --- */}
        {loading ? (
             <div className="h-64 flex items-center justify-center">
                 <span className="text-[10px] uppercase font-mono tracking-widest text-zinc-600 animate-pulse">Syncing nodes...</span>
             </div>
        ) : (
            <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-[1px] bg-white/5 border border-white/5">
                {plansData[tab].map((plan, index) => {
                    const isCurrentPlan = membership?.plan === plan.id;
                    const finalPrice = calculateFinalPrice(plan);

                    return (
                        <div key={plan.id} className={`bg-[#030508] p-10 flex flex-col transition-all duration-700 ${plan.popular ? 'bg-gradient-to-b from-white/[0.02] to-transparent relative' : ''}`}>
                            
                            {/* Decorative Corner */}
                            <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-emerald-500/30 opacity-0 group-hover:opacity-100 transition-opacity" />

                            <div className="mb-12">
                                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500 block mb-2">{String(index + 1).padStart(2, '0')}</span>
                                <h3 className="text-2xl font-light tracking-wide text-white">{plan.title}</h3>
                                {plan.popular && <span className="text-[9px] text-emerald-400 uppercase tracking-widest mt-2 block font-mono">Recommended Node</span>}
                            </div>

                            <div className="mb-12">
                                <span className="text-xs text-zinc-500 uppercase tracking-widest">INR</span>
                                <div className="text-5xl font-light tracking-tighter mt-2">{finalPrice === 0 ? '0' : finalPrice}</div>
                                {finalPrice > 0 && <div className="text-xs text-zinc-600 font-mono mt-2">/ {billingCycle === 'yearly' ? 'ANNUM' : 'MONTH'}</div>}
                            </div>

                            <div className="flex-1">
                                <div className="text-[9px] uppercase font-mono text-zinc-600 tracking-[0.2em] mb-6 border-b border-white/10 pb-4">Parameters</div>
                                <ul className="space-y-4 border-l border-white/5 pl-4">
                                    {plan.features.map((feature, i) => (
                                        <li key={i} className="text-sm font-light text-zinc-400 flex items-start">
                                            <span className="text-emerald-500/50 mr-3 text-xs leading-5">›</span>
                                            <span className="leading-snug">{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="mt-16 pt-8 border-t border-white/5">
                                <button
                                    onClick={() => handlePurchase(plan.id)}
                                    disabled={isPurchasing === plan.id || isCurrentPlan}
                                    className={`w-full text-xs uppercase tracking-widest font-mono py-4 transition-all duration-500 flex items-center justify-between group ${isCurrentPlan ? 'text-zinc-600 cursor-not-allowed' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
                                >
                                    <span>{isPurchasing === plan.id ? 'Initializing...' : isCurrentPlan ? '[ Active Node ]' : 'Initialize'}</span>
                                    {!isCurrentPlan && <span className="opacity-0 group-hover:opacity-100 transition-opacity text-emerald-500 font-sans">→</span>}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        )}

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes bg-pan {
            0% { background-position: 0% center; }
            100% { background-position: -200% center; }
        }
      `}} />
    </main>
  );
}
