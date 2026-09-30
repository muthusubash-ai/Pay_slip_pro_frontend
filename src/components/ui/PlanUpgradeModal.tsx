import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  CheckCircle2, 
  ArrowRight, 
  Zap, 
  Building2, 
  Users, 
  CalendarDays, 
  ShieldCheck, 
  BarChart3,
  Crown
} from 'lucide-react';
import { GradientButton } from './GradientButton';

interface PlanUpgradeModalProps {
  isOpen: boolean;
  plan: 'professional' | 'enterprise';
  onConfirm: () => void;
  onClose?: () => void;
}

export function PlanUpgradeModal({ isOpen, plan, onConfirm, onClose }: PlanUpgradeModalProps) {
  const [countdown, setCountdown] = useState(5);
  const isProfessional = plan === 'professional';

  useEffect(() => {
    if (!isOpen) {
      setCountdown(5);
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onConfirm();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, onConfirm]);

  const professionalPerks = [
    { icon: Users, label: 'Up to 10 Employees', desc: 'Expand your workforce limit' },
    { icon: Building2, label: 'Company Branding', desc: 'Custom logo and primary brand colors' },
    { icon: CalendarDays, label: 'Detailed Attendance Reports', desc: 'Attendance and leave summaries beyond Starter monthly attendance save' },
    { icon: Zap, label: 'Bulk Salary Slips', desc: 'Generate slips for all employees in one click' },
    { icon: BarChart3, label: 'Payroll Summaries', desc: 'Detailed financial trends & reports' },
  ];

  const enterprisePerks = [
    { icon: Crown, label: 'Unlimited Employees', desc: 'Zero limit on staff and payroll scale' },
    { icon: Building2, label: 'Multi-Company Payroll', desc: 'Manage payroll across multiple organizations' },
    { icon: BarChart3, label: 'Department Insights', desc: 'Deep breakdown of department payroll costs' },
    { icon: ShieldCheck, label: 'Admin Oversight', desc: 'Advanced user management and role security' },
    { icon: Zap, label: 'Enterprise Performance', desc: 'Priority processing and dedicated tools' },
  ];

  const perks = isProfessional ? professionalPerks : enterprisePerks;
  const planTitle = isProfessional ? 'Professional' : 'Enterprise';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-neutral-950/75 backdrop-blur-md"
            onClick={onClose || onConfirm}
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-[#121217] border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden p-6 sm:p-8 z-10 my-auto text-left"
          >
            {/* Top decorative gradient glow */}
            <div 
              className={`absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-40 blur-3xl pointer-events-none opacity-40 rounded-full ${
                isProfessional ? 'bg-emerald-500' : 'bg-purple-600'
              }`} 
            />

            {/* Header with celebratory icon */}
            <div className="text-center relative">
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', delay: 0.1, stiffness: 260 }}
                className={`mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-lg ${
                  isProfessional 
                    ? 'bg-gradient-to-tr from-emerald-600 to-teal-400 text-white shadow-emerald-500/25'
                    : 'bg-gradient-to-tr from-purple-700 via-indigo-600 to-amber-400 text-white shadow-purple-500/30'
                }`}
              >
                {isProfessional ? <Sparkles className="w-8 h-8" /> : <Crown className="w-8 h-8" />}
              </motion.div>

              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-2.5 ${
                isProfessional
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60'
                  : 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300 dark:border-purple-700/60'
              }`}>
                <CheckCircle2 className="w-3.5 h-3.5" />
                Payment Confirmed · Database Updated
              </span>

              <h2 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white tracking-tight">
                Welcome to {planTitle} Dashboard
              </h2>

              <p className="mt-2 text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 max-w-md mx-auto leading-relaxed">
                Your account is now activated as <strong>{planTitle} Tier</strong> in the system. All premium features and limits have been unlocked!
              </p>
            </div>

            {/* Unlocked Features Box */}
            <div className="mt-6 p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800 space-y-2.5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
                Unlocked with {planTitle}:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {perks.map((perk, i) => (
                  <div key={i} className="flex items-start gap-2 text-left">
                    <div className="w-5 h-5 rounded-md bg-neutral-200/80 dark:bg-neutral-800 flex items-center justify-center shrink-0 mt-0.5">
                      <perk.icon className="w-3 h-3 text-neutral-700 dark:text-neutral-300" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 leading-tight">
                        {perk.label}
                      </p>
                      <p className="text-[10px] text-neutral-500 dark:text-neutral-400 leading-tight mt-0.5">
                        {perk.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Countdown and CTA */}
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400 px-1">
                <span>Auto-redirecting to your dashboard</span>
                <span className="font-mono font-bold text-neutral-800 dark:text-neutral-200">{countdown}s</span>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 w-full bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 5, ease: 'linear' }}
                  className={`h-full ${isProfessional ? 'bg-emerald-500' : 'bg-purple-500'}`}
                />
              </div>

              <GradientButton
                onClick={onConfirm}
                className="w-full py-3.5 text-sm font-bold flex items-center justify-center gap-2 shadow-lg"
              >
                Go to {planTitle} Dashboard
                <ArrowRight className="w-4 h-4" />
              </GradientButton>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
