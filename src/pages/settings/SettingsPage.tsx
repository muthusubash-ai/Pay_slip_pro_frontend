import { useState, useEffect, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { 
  User as UserIcon, 
  Building2, 
  Check, 
  CreditCard, 
  CheckCircle2, 
  ExternalLink,
  Star,
  Landmark,
  Edit3
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { GlassCard } from '../../components/ui/GlassCard';
import { AnimatedInput } from '../../components/ui/AnimatedInput';
import { GradientButton } from '../../components/ui/GradientButton';
import { PlanUpgradeModal } from '../../components/ui/PlanUpgradeModal';
import { companyService } from '../../services/companyService';
import { paymentService } from '../../services/paymentService';
import api from '../../services/api';
import { getPlanDetails, getPlanHome, PLAN_CATALOG } from '../../lib/plans';

export function SettingsPage() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [companyName, setCompanyName] = useState('');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [paymentNotice, setPaymentNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [upgradingPlan, setUpgradingPlan] = useState<'professional' | 'enterprise' | null>(null);
  const [celebrationPlan, setCelebrationPlan] = useState<'professional' | 'enterprise' | null>(null);

  const { data: company } = useQuery({
    queryKey: ['company'],
    queryFn: () => companyService.get().then((r) => r.data).catch(() => null),
    enabled: !!user,
  });

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      if (user.company_name && user.company_name !== '-') {
        setCompanyName(user.company_name);
      }
    }
  }, [user]);

  useEffect(() => {
    if (company?.company_name) {
      setCompanyName(company.company_name);
    }
  }, [company]);

  const handleProfileSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileMessage(null);
    try {
      const trimmedName = fullName.trim();
      const trimmedCompany = companyName.trim();

      // 1. Update user profile via /auth/me (updates full_name and company_name)
      const { data: updatedUserData } = await api.put('/auth/me', {
        full_name: trimmedName,
        company_name: trimmedCompany,
      });

      if (updatedUserData) {
        updateUser(updatedUserData);
      }

      // 2. Also update company directly via companyService
      if (trimmedCompany) {
        try {
          const compRes = await companyService.update({ company_name: trimmedCompany });
          if (compRes?.data) {
            queryClient.setQueryData(['company'], compRes.data);
          }
        } catch (compErr) {
          console.warn('Company service sync warning:', compErr);
        }
        queryClient.invalidateQueries({ queryKey: ['company'] });
      }

      setProfileMessage({ type: 'success', text: 'Profile and company details updated successfully!' });
      setIsEditingProfile(false);
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.full_name?.[0] ||
        err?.response?.data?.company_name?.[0] ||
        err?.response?.data?.detail ||
        'Failed to update profile details.';
      setProfileMessage({ type: 'error', text: errMsg });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleUpgrade = (targetPlan: 'professional' | 'enterprise') => {
    if (!user) return;
    setPaymentNotice(null);
    setUpgradingPlan(targetPlan);

    paymentService.startPaymentFlow(
      targetPlan,
      { name: user.full_name, email: user.email },
      (newPlan, updatedUserData) => {
        const upgraded = updatedUserData || { ...user, plan: newPlan as 'professional' | 'enterprise' };
        updateUser(upgraded);
        setUpgradingPlan(null);
        setCelebrationPlan(newPlan as 'professional' | 'enterprise');
      },
      (err) => {
        setUpgradingPlan(null);
        setPaymentNotice({
          type: 'error',
          text: err || 'Payment was cancelled or failed.',
        });
      }
    );
  };

  const currentPlan = user?.plan || 'starter';
  const planDetails = getPlanDetails(currentPlan);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">Settings & Profile</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Manage your personal information, organization details, and subscription plan.</p>
      </div>

      {paymentNotice && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`p-4 rounded-xl border text-sm font-medium flex items-center justify-between gap-3 ${
              paymentNotice.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
                : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300'
            }`}
          >
            <span>{paymentNotice.text}</span>
            <button onClick={() => setPaymentNotice(null)} className="opacity-60 hover:opacity-100 font-bold">✕</button>
          </motion.div>
        </AnimatePresence>
      )}

      {/* 1. User Profile Section */}
      <GlassCard className="p-5 sm:p-7">
        <div className="flex items-center gap-3 pb-5 mb-5 border-b border-neutral-100 dark:border-neutral-800">
          <div className="w-10 h-10 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center shadow-sm">
            <UserIcon className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">User Profile</h3>
              {isEditingProfile ? (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300">
                  Editing Mode
                </span>
              ) : (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                  View Mode
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Your personal details and account role</p>
          </div>
        </div>

        {profileMessage && (
          <div className={`mb-5 p-3 rounded-lg text-sm ${profileMessage.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'}`}>
            {profileMessage.text}
          </div>
        )}

        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AnimatedInput label="Email Address" value={user?.email || ''} disabled />
            <AnimatedInput 
              label="Full Name" 
              value={fullName} 
              onChange={(e) => setFullName(e.target.value)} 
              disabled={!isEditingProfile}
              required 
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AnimatedInput
              label="Registered Company"
              placeholder="Enter company name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              disabled={!isEditingProfile}
              required
            />
            <AnimatedInput
              label="Account Role"
              value={user?.role === 'admin' ? 'Administrator' : 'HR Manager'}
              disabled
            />
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-end gap-3">
            {!isEditingProfile ? (
              <button
                type="button"
                onClick={() => {
                  setProfileMessage(null);
                  setIsEditingProfile(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-neutral-900 hover:bg-black text-white dark:bg-white dark:hover:bg-neutral-100 dark:text-neutral-900 shadow-sm transition-all"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Edit Profile
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setFullName(user?.full_name || '');
                    setCompanyName(company?.company_name || user?.company_name || '');
                    setProfileMessage(null);
                    setIsEditingProfile(false);
                  }}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  Cancel
                </button>
                <GradientButton type="submit" isLoading={isSavingProfile} className="w-full sm:w-auto">
                  Save Changes
                </GradientButton>
              </>
            )}
          </div>
        </form>
      </GlassCard>

      {/* 2. Subscription Plan Section */}
      <GlassCard className="p-5 sm:p-7">
        <div className="flex items-center justify-between pb-5 mb-5 border-b border-neutral-100 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900">Subscription Plan</h3>
              <p className="text-xs text-neutral-500">Current tier and available plan upgrades</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-400">Current Status:</span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-neutral-900 text-white shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {currentPlan}
            </span>
          </div>
        </div>

        {/* Current Plan Overview Card */}
        <div className="p-4 sm:p-5 rounded-2xl bg-neutral-50 border border-neutral-200 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-neutral-900">{planDetails.name} Tier</h4>
              <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-medium">Active</span>
            </div>
            <p className="text-xs text-neutral-500 mt-1">{planDetails.desc}</p>
          </div>

          {currentPlan !== 'starter' && (
            <Link
              to="/settings/company"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-800 hover:text-black underline underline-offset-4"
            >
              <Building2 className="h-3.5 w-3.5" />
              Customize Company Branding & Details
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>

        {/* Plan Cards Catalog matching Login / Landing Page */}
        <div>
          <div className="mb-6">
            <h4 className="text-base font-bold text-neutral-900">Available Plans & Features</h4>
            <p className="text-xs text-neutral-500 mt-1">Upgrade or manage your subscription tier with instant Razorpay activation.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
            {PLAN_CATALOG.map((plan) => {
              const isCurrent = currentPlan === plan.id;
              const canUpgrade =
                (currentPlan === 'starter' && (plan.id === 'professional' || plan.id === 'enterprise')) ||
                (currentPlan === 'professional' && plan.id === 'enterprise');
              const isLower =
                (currentPlan === 'enterprise' && (plan.id === 'starter' || plan.id === 'professional')) ||
                (currentPlan === 'professional' && plan.id === 'starter');

              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col justify-between rounded-2xl border-2 p-5 sm:p-6 transition-all ${
                    plan.popular
                      ? 'border-neutral-900 bg-neutral-950 text-white shadow-xl dark-card-white lg:scale-[1.02]'
                      : 'border-neutral-200 bg-white text-neutral-900 dark:bg-[#18181b] dark:border-neutral-800 dark:text-white'
                  }`}
                >
                  {plan.popular && (
                    <div className="mb-3 flex justify-start sm:absolute sm:right-4 sm:top-4 sm:mb-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-white text-black dark:bg-black dark:text-white px-2.5 py-1 rounded-full flex items-center gap-1 card-badge shadow-sm">
                        <Star className="h-3 w-3 fill-current text-amber-400 dark:text-amber-300" /> Most Popular
                      </span>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className={`text-base font-bold ${plan.popular ? 'text-white card-title' : 'text-neutral-900 dark:text-white'}`}>
                        {plan.name}
                      </h4>
                      {isCurrent && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          Active
                        </span>
                      )}
                    </div>
                    <p className={`text-xs mb-4 min-h-[32px] ${plan.popular ? 'text-neutral-400 card-subtext' : 'text-neutral-500 dark:text-neutral-400'}`}>
                      {plan.desc}
                    </p>

                    <div className="flex items-baseline gap-1 mb-5">
                      <span className={`text-3xl font-extrabold ${plan.popular ? 'text-white card-price' : 'text-neutral-900 dark:text-white'}`}>
                        {plan.price}
                      </span>
                      {plan.period && (
                        <span className={`text-xs ${plan.popular ? 'text-neutral-400 card-subtext' : 'text-neutral-500 dark:text-neutral-400'}`}>
                          {plan.period}
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2.5">
                      {plan.employeeAccess}
                    </div>

                    <ul className="mb-6 space-y-2.5">
                      {plan.features.map((feat) => (
                        <li key={feat} className="flex items-start gap-2.5 text-xs">
                          <CheckCircle2
                            className={`h-4 w-4 shrink-0 mt-0.5 ${
                              plan.popular ? 'text-emerald-400 card-icon' : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          />
                          <span className={plan.popular ? 'text-neutral-300 card-feature' : 'text-neutral-600 dark:text-neutral-300'}>
                            {feat}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Action Button */}
                  <div className="pt-2">
                    {isCurrent ? (
                      <div className="w-full py-2.5 px-4 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800 text-xs font-semibold flex items-center justify-center gap-2">
                        <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        Current Active Plan
                      </div>
                    ) : canUpgrade ? (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        disabled={upgradingPlan !== null}
                        onClick={() => handleUpgrade(plan.id as 'professional' | 'enterprise')}
                        className={`w-full py-2.5 px-4 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-60 shadow-sm ${
                          plan.popular
                            ? 'bg-white text-black hover:bg-neutral-100 keep-dark'
                            : 'bg-neutral-900 text-white hover:bg-neutral-800 keep-white'
                        }`}
                      >
                        <CreditCard className="h-4 w-4" />
                        {upgradingPlan === plan.id ? 'Processing...' : `Upgrade to ${plan.name} (${plan.price})`}
                      </motion.button>
                    ) : isLower ? (
                      <div className="w-full py-2.5 px-4 rounded-xl bg-neutral-100 text-neutral-500 dark:bg-neutral-800/60 dark:text-neutral-400 text-xs font-medium flex items-center justify-center gap-2">
                        Included in your current plan
                      </div>
                    ) : (
                      <div className="w-full py-2.5 px-4 rounded-xl bg-neutral-100 text-neutral-500 dark:bg-neutral-800/60 dark:text-neutral-400 text-xs font-medium flex items-center justify-center gap-2">
                        {plan.name} Tier
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Accepted Payment Methods from Landing Page */}
          <div className="mt-8 pt-6 border-t border-neutral-100 dark:border-neutral-800 text-center">
            <p className="text-[11px] text-neutral-400 font-medium uppercase tracking-[0.15em] mb-4">
              Accepted Payment Methods
            </p>
            <div className="flex items-center justify-center gap-3.5 flex-wrap">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs shadow-sm">
                <svg className="h-3 w-auto shrink-0" viewBox="0 0 36 12" fill="none">
                  <path d="M13.6 0.3L9.0 11.7H6.1L3.7 2.5C3.5 1.7 3.3 1.4 2.7 1.1C1.8 0.6 0.8 0.2 0 0L0.1 0.3H4.9C5.5 0.3 6.0 0.7 6.1 1.4L7.3 7.8L10.3 0.3H13.6ZM24.7 8.0C24.7 5.0 20.6 4.8 20.6 3.4C20.6 3.0 21.0 2.5 22.0 2.4C22.5 2.3 23.9 2.3 25.4 3.0L26.0 0.6C25.2 0.3 24.1 0 22.7 0C19.9 0 17.9 1.5 17.9 3.6C17.9 5.2 19.3 6.1 20.4 6.6C21.5 7.2 21.9 7.5 21.9 8.0C21.9 8.8 20.9 9.1 19.9 9.1C18.5 9.1 17.3 8.7 16.7 8.4L16.0 10.9C16.8 11.3 18.2 11.6 19.7 11.6C22.7 11.6 24.7 10.1 24.7 8.0ZM32.0 11.7H34.8L32.4 0.3H29.8C29.2 0.3 28.7 0.6 28.5 1.1L24.3 11.7H27.4L28.0 10.0H31.6L32.0 11.7ZM28.9 7.6L30.4 3.4L31.3 7.6H28.9ZM17.2 0.3L14.7 11.7H12.0L14.5 0.3H17.2Z" fill="#1434CB"/>
                </svg>
                <span className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400">Visa</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs shadow-sm">
                <svg className="h-3.5 w-auto shrink-0" viewBox="0 0 24 16" fill="none">
                  <circle cx="7" cy="8" r="7" fill="#EB001B"/>
                  <circle cx="17" cy="8" r="7" fill="#F79E1B"/>
                  <path d="M12 2.3A6.97 6.97 0 0 0 9.5 8 6.97 6.97 0 0 0 12 13.7 6.97 6.97 0 0 0 14.5 8 6.97 6.97 0 0 0 12 2.3Z" fill="#FF5F00"/>
                </svg>
                <span className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400">Mastercard</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs shadow-sm">
                <span className="px-1 py-0.5 rounded bg-emerald-600 text-white font-extrabold text-[8px] leading-none">UPI</span>
                <span className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400">UPI / QR</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs shadow-sm">
                <Landmark className="h-3.5 w-3.5 text-blue-600" />
                <span className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400">Net Banking</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs shadow-sm">
                <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none">
                  <path d="M15.2 2L6 14h6l-1.2 8L20 10h-6l1.2-8z" fill="#02042B" className="dark:fill-white"/>
                </svg>
                <span className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">Razorpay Secured</span>
              </div>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Celebration Upgrade Modal */}
      {celebrationPlan && (
        <PlanUpgradeModal
          isOpen={!!celebrationPlan}
          plan={celebrationPlan}
          onConfirm={() => {
            const target = celebrationPlan;
            setCelebrationPlan(null);
            const upgradedUser = user ? { ...user, plan: target } : undefined;
            navigate(getPlanHome(upgradedUser));
          }}
          onClose={() => setCelebrationPlan(null)}
        />
      )}
    </motion.div>
  );
}
