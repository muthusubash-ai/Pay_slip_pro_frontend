import { useState, useMemo, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { isAxiosError } from 'axios';
import { Eye, EyeOff, Check, X, CreditCard } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { MeshBackground } from '../../components/layout/MeshBackground';
import { GlassCard } from '../../components/ui/GlassCard';
import { AnimatedInput } from '../../components/ui/AnimatedInput';
import { GradientButton } from '../../components/ui/GradientButton';
import { getPlanDetails, getPlanHome, PLAN_CATALOG, type Plan } from '../../lib/plans';
import { paymentService } from '../../services/paymentService';
import { getPasswordPolicyError, getPasswordStrength } from '../../lib/passwordPolicy';

export function RegisterPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan>(() => {
    const stored = sessionStorage.getItem('selected_plan');
    if (stored === 'professional' || stored === 'enterprise') return stored;
    return 'starter';
  });
  const { register, updateUser } = useAuth();
  const navigate = useNavigate();

  const strength = useMemo(() => getPasswordStrength(password), [password]);

  const selectedPlanDetails = getPlanDetails(selectedPlan);

  const handlePlanChange = (plan: Plan) => {
    setSelectedPlan(plan);
    if (plan === 'starter') {
      sessionStorage.removeItem('selected_plan');
    } else {
      sessionStorage.setItem('selected_plan', plan);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const trimmedName = fullName.trim();
    if (!trimmedName || !/^[a-zA-Z\s.'-]+$/.test(trimmedName)) {
      setError('Full name must contain only letters and spaces (numbers are not allowed).');
      return;
    }
    const passwordError = getPasswordPolicyError(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setIsLoading(true);
    try {
      const registeredUser = await register(email, password, trimmedName);
      if (selectedPlan === 'professional' || selectedPlan === 'enterprise') {
        paymentService.startPaymentFlow(
          selectedPlan,
          { name: registeredUser.full_name, email: registeredUser.email },
          (newPlan) => {
            const upgradedUser = { ...registeredUser, plan: newPlan as 'professional' | 'enterprise' };
            updateUser(upgradedUser);
            sessionStorage.removeItem('selected_plan');
            navigate(getPlanHome(upgradedUser));
          },
          (message) => {
            setError(`Account created with Free Starter plan! (Payment: ${message})`);
            sessionStorage.removeItem('selected_plan');
            setTimeout(() => {
              navigate(getPlanHome(registeredUser));
            }, 2500);
          },
        );
      } else {
        sessionStorage.removeItem('selected_plan');
        navigate(getPlanHome(registeredUser));
      }
    } catch (err: unknown) {
      const fallback = 'Registration failed. Email may already be in use.';
      const msg = isAxiosError<{ message?: string; detail?: string }>(err)
        ? err.response?.data?.message || err.response?.data?.detail || err.message || fallback
        : err instanceof Error
          ? err.message
          : fallback;
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const Rule = ({ met, text }: { met: boolean; text: string }) => (
    <span className={`flex items-center gap-1 text-xs ${met ? 'text-green-600' : 'text-gray-400'}`}>
      {met ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />} {text}
    </span>
  );

  return (
    <div className="min-h-screen flex items-start justify-center overflow-y-auto px-3 py-4 sm:items-center sm:px-4 sm:py-8">
      <MeshBackground />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-lg">
        <GlassCard className="p-5 sm:p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Create Account</h1>
            <p className="text-gray-500 mt-2">Get started with PaySlip Pro</p>
          </div>
          {error && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm">{error}</div>}

          {/* Plan Selector */}
          <div className="mb-5">
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Selected Plan
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {PLAN_CATALOG.map((p) => {
                const isSelected = selectedPlan === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handlePlanChange(p.id)}
                    className={`relative min-h-20 rounded-xl border p-3 text-left transition-all ${
                      isSelected
                        ? 'border-black bg-neutral-900 text-white shadow-md'
                        : 'border-gray-200 bg-white hover:border-gray-300 text-gray-800'
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-neutral-900 shadow-sm">
                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                      </span>
                    )}
                    <div className="mb-1 flex items-center gap-1.5 pr-7">
                      <span className="text-xs font-bold">{p.name}</span>
                    </div>
                    <div className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                      {p.price}<span className={`text-[10px] font-normal ${isSelected ? 'text-neutral-300' : 'text-gray-500'}`}>{p.period}</span>
                    </div>
                    <div className={`text-[10px] leading-4 ${isSelected ? 'text-neutral-300' : 'text-gray-500'}`}>{p.employeeAccess}</div>
                  </button>
                );
              })}
            </div>
            
            {/* Informational badge */}
            <div className="mt-2.5 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs leading-5">
              {selectedPlan === 'starter' ? (
                <span className="text-green-700 font-medium flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                  Starter is free and supports up to 3 employees. No payment required.
                </span>
              ) : (
                <span className="text-neutral-800 font-medium flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5 text-neutral-600 shrink-0" />
                  {selectedPlanDetails.name} ({selectedPlanDetails.price}{selectedPlanDetails.period}) · {selectedPlanDetails.employeeAccess}. Razorpay opens after registration.
                </span>
              )}
            </div>
          </div>

          {selectedPlan !== 'starter' && (
            <div className="mb-5 p-3.5 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-left">
              <div>
                <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Existing Starter User?</p>
                <p className="text-xs font-bold text-neutral-900">Sign in to upgrade your existing account without registering again</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  sessionStorage.setItem('selected_plan', selectedPlan);
                  navigate(`/login?plan=${selectedPlan}`);
                }}
                className="px-3 py-1.5 rounded-lg bg-black text-white text-xs font-semibold hover:bg-neutral-800 transition-colors whitespace-nowrap shadow-sm"
              >
                Sign In & Upgrade
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatedInput
              label="Full Name"
              value={fullName}
              onChange={(e) => {
                const lettersOnly = e.target.value.replace(/[^a-zA-Z\s.'-]/g, '');
                setFullName(lettersOnly);
              }}
              required
              placeholder="John Doe"
            />
            <AnimatedInput label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@company.com" />
            <div className="relative">
              <AnimatedInput label="Password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Minimum 12 characters" />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-[38px] text-gray-400 hover:text-black transition-colors"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {/* Password strength indicator */}
            {password.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${strength.color}`} style={{ width: `${(strength.passed / 5) * 100}%` }} />
                  </div>
                  <span className={`text-xs font-medium ${strength.passed >= 5 ? 'text-green-600' : strength.passed >= 3 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {strength.label}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <Rule met={strength.checks.minLength} text="12+ characters" />
                  <Rule met={strength.checks.uppercase} text="Uppercase" />
                  <Rule met={strength.checks.lowercase} text="Lowercase" />
                  <Rule met={strength.checks.number} text="Number" />
                  <Rule met={strength.checks.special} text="Special char" />
                </div>
              </div>
            )}
            <div className="relative">
              <AnimatedInput label="Confirm Password" type={showConfirm ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="Repeat password" />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-[38px] text-gray-400 hover:text-black transition-colors"
              >
                {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            <GradientButton type="submit" isLoading={isLoading} className="w-full">
              {selectedPlan === 'starter'
                ? 'Create Free Account'
                : selectedPlan === 'professional'
                ? 'Create Account & Pay ₹499'
                : 'Create Account & Pay ₹999'}
            </GradientButton>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 uppercase">or</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Google Sign-Up */}
          <a
            href={`${import.meta.env.VITE_API_URL || ''}/api/v1/auth/google/login`}
            className="flex items-center justify-center gap-3 w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white hover:bg-gray-50 transition-colors font-medium text-gray-700"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Sign up with Google
          </a>

          <p className="mt-4 text-center text-sm text-gray-500">
            Already have an account? <Link to="/login" className="text-black hover:text-gray-700 underline">Sign in</Link>
          </p>
        </GlassCard>
      </motion.div>
    </div>
  );
}
