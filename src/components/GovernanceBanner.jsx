import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';

export const GovernanceBanner = () => {
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    const handleGovernanceAlert = (e) => {
      setAlert({
        type: e.detail?.type || 'governance',
        message: e.detail?.message || 'Platform constraints detected.',
        level: e.detail?.level || 'warning' // 'warning' | 'error'
      });
      
      // Auto-dismiss after 8s
      setTimeout(() => setAlert(null), 8000);
    };

    window.addEventListener('governance_alert', handleGovernanceAlert);
    return () => window.removeEventListener('governance_alert', handleGovernanceAlert);
  }, []);

  if (!alert) return null;

  const contentMap = {
    '429': {
      title: "Rate Limit Enforced",
      desc: "System cooling down. Please wait before issuing new requests.",
      color: "border-amber-500/50 text-amber-500 bg-amber-500/10"
    },
    '503': {
      title: "Circuit Breaker Active",
      desc: "Agent dependencies are stabilizing. Execution paused.",
      color: "border-red-500/50 text-red-500 bg-red-500/10"
    },
    'deps_timeout': {
      title: "Dependency Timeout",
      desc: alert.message || "A backend dependency timed out. Please retry.",
      color: "border-orange-500/50 text-orange-400 bg-orange-500/10"
    },
    'service_unavailable': {
      title: "Service Unavailable",
      desc: alert.message || "Service is temporarily unavailable. Please retry shortly.",
      color: "border-red-500/50 text-red-400 bg-red-500/10"
    },
    'spend_guard': {
      title: "Spend Guard Triggered",
      desc: "Usage budget approached. Tasks limited to low-cost ops.",
      color: "border-orange-500/50 text-orange-500 bg-orange-500/10"
    },
    'default': {
      title: "Platform Notice",
      desc: alert.message,
      color: "border-emerald-500/50 text-emerald-500 bg-emerald-500/10"
    }
  };

  const config = contentMap[alert.type] || contentMap['default'];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="fixed top-2 md:top-6 left-0 right-0 z-[100] flex justify-center px-4 pointer-events-none"
      >
        <div className={`pointer-events-auto flex items-start gap-4 p-4 pl-5 pr-10 rounded-2xl border backdrop-blur-xl shadow-2xl ${config.color} max-w-md w-full`}>
          <AlertTriangle className="mt-0.5 shrink-0" size={18} />
          <div className="flex flex-col gap-1">
            <span className="text-[14px] font-semibold tracking-wide drop-shadow-md">
              {config.title}
            </span>
            <span className="text-[13px] opacity-90 leading-snug font-light">
              {config.desc}
            </span>
          </div>
          <button 
            onClick={() => setAlert(null)}
            className="absolute top-4 right-4 opacity-50 hover:opacity-100 transition-opacity"
          >
            <X size={16} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
