import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, CreditCard, LogOut, ShieldAlert, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { paymentService } from '../../services/paymentService';
import { PLAN_CATALOG, getPlanDetails } from '../../lib/plans';
import { useNavigate } from 'react-router-dom';

interface PlanExpiredModalProps {
  isOpen: boolean;
}

export function PlanExpiredModal({ isOpen }: PlanExpiredModalProps) {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();

  const currentPlan = (user?.plan === 'enterprise' ? 'enterprise' : 'professional') as 'professional' | 'enterprise';
  const [selectedPlan, setSelectedPlan] = useState<'professional' | 'enterprise'>(currentPlan);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !user) return null;

  const expiredDateFormatted = user.plan_expires_at
    ? `${new Date(user.plan_expires_at).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })} at ${new Date(user.plan_expires_at).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })}`
    : 'Recently';

  const handleRenewOrUpgrade = (targetPlan: 'professional' | 'enterprise') => {
    setErrorMessage(null);
    setIsProcessing(true);

    paymentService.startPaymentFlow(
      targetPlan,
      {
        name: user.full_name,
        email: user.email,
        contact: user.phone || undefined,
      },
      (newPlan, updatedUserData) => {
        setIsProcessing(false);
        const upgraded = updatedUserData || {
          ...user,
          plan: newPlan as 'professional' | 'enterprise',
          is_plan_expired: false,
          plan_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        };
        updateUser(upgraded);
      },
      (err) => {
        setIsProcessing(false);
        setErrorMessage(err || 'Payment was cancelled or failed.');
      }
    );
  };

  const handleSignOut = async () => {
    await logout();
    navigate('/login');
  };

  const currentPlanMeta = getPlanDetails(currentPlan);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-expired-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-red-500/30 bg-neutral-950 p-6 sm:p-8 text-white shadow-2xl shadow-red-950/50"
      >
        {/* Glow ambient background effect */}
        <div className="pointer-events-none absolute -top-24 -left-24 h-56 w-56 rounded-full bg-red-600/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-56 w-56 rounded-full bg-amber-600/15 blur-3xl" />

        {/* Header with warning icon */}
        <div className="relative text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/15 border border-red-500/30 text-red-400 shadow-inner">
            <ShieldAlert className="h-7 w-7 text-red-400 animate-pulse" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase bg-red-950/80 text-red-300 border border-red-800/60 mb-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-ping" />
            Plan Expired
          </div>

          <h2 id="plan-expired-title" className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
            Subscription Has Expired
          </h2>
          <p className="mt-1.5 text-xs sm:text-sm text-neutral-300">
            Your <span className="font-semibold text-white">{currentPlanMeta.name}</span> plan expired on{' '}
            <span className="font-semibold text-red-400">{expiredDateFormatted}</span>.
          </p>
        </div>

        {/* Warning callout */}
        <div className="relative mt-5 rounded-2xl border border-red-500/20 bg-red-950/30 p-3.5 text-xs text-neutral-300 text-center leading-relaxed">
          Dashboard access is temporarily frozen. Please renew or upgrade your plan to resume managing employees, tracking attendance, and generating salary slips.
        </div>

        {errorMessage && (
          <div className="mt-3 rounded-xl border border-rose-800/80 bg-rose-950/60 p-3 text-xs text-rose-300 text-center">
            {errorMessage}
          </div>
        )}

        {/* Plan Selection Cards */}
        <div className="mt-5 space-y-2.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 px-1">
            Choose Plan to Continue
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {PLAN_CATALOG.filter((p) => p.id !== 'starter').map((plan) => {
              const isSelected = selectedPlan === plan.id;
              const isExpiredPlan = currentPlan === plan.id;

              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlan(plan.id as 'professional' | 'enterprise')}
                  className={`relative flex flex-col justify-between rounded-2xl border p-3.5 text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'border-emerald-500 bg-neutral-900 shadow-md shadow-emerald-950/30 ring-1 ring-emerald-500'
                      : 'border-neutral-800 bg-neutral-900/60 hover:border-neutral-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-white">{plan.name}</span>
                      {isExpiredPlan && (
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300">
                          Previous
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-lg font-extrabold text-white">{plan.price}</span>
                      <span className="text-[10px] text-neutral-400">{plan.period}</span>
                    </div>
                    <p className="text-[10px] text-neutral-400 mt-1 leading-snug">{plan.employeeAccess}</p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-neutral-800/80 flex items-center justify-between text-[11px]">
                    <span className="text-neutral-400">{plan.id === 'professional' ? 'Bulk slips, reports' : 'Unlimited staff'}</span>
                    <div
                      className={`h-4 w-4 rounded-full flex items-center justify-center border ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-500 text-black'
                          : 'border-neutral-700 bg-transparent'
                      }`}
                    >
                      {isSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Primary Renew Button */}
        <div className="mt-6 space-y-3">
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => handleRenewOrUpgrade(selectedPlan)}
            className="w-full py-3.5 px-4 rounded-2xl font-bold text-sm text-neutral-950 bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 hover:from-emerald-300 hover:to-teal-200 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 disabled:opacity-50 cursor-pointer active:scale-[0.99]"
          >
            <CreditCard className="h-4 w-4" />
            <span>
              {isProcessing
                ? 'Processing Razorpay...'
                : selectedPlan === currentPlan
                ? `Renew ${selectedPlan.toUpperCase()} Plan (+30 Days) — ${getPlanDetails(selectedPlan).price}`
                : `Upgrade to ${selectedPlan.toUpperCase()} Plan — ${getPlanDetails(selectedPlan).price}`}
            </span>
            <ArrowRight className="h-4 w-4" />
          </button>

          {/* Sign Out link */}
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out and return to login
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
