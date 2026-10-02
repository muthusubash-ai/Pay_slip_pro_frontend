import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  MailCheck,
  Lock,
  Send,
  AlertCircle,
  UserPlus,
  ArrowLeft,
  KeyRound,
} from 'lucide-react';
import { MeshBackground } from '../../components/layout/MeshBackground';
import { GlassCard } from '../../components/ui/GlassCard';
import { AnimatedInput } from '../../components/ui/AnimatedInput';
import { GradientButton } from '../../components/ui/GradientButton';
import api from '../../services/api';
import { getPasswordPolicyError } from '../../lib/passwordPolicy';

type Step = 'email' | 'code' | 'done';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { email?: string } | null;

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState(state?.email?.trim() || '');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isNotRegistered, setIsNotRegistered] = useState(false);

  // If email was provided from the login modal, lock it so user cannot edit it
  const isEmailLocked = Boolean(state?.email?.trim());

  const handleSendCode = async (e?: FormEvent) => {
    e?.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Please enter your registered email address.');
      return;
    }

    setError('');
    setMessage('');
    setIsNotRegistered(false);
    setIsLoading(true);

    try {
      const res = await api.post('/auth/forgot-password', { email: cleanEmail });
      const data = res.data as { message: string; sent: boolean };
      if (data.sent) {
        setMessage('Reset code sent to your email. Check your inbox.');
        setStep('code');
      } else {
        setError(data.message || 'Failed to send reset code.');
      }
    } catch (err: unknown) {
      const respData =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { status?: number; data?: { detail?: string; message?: string } } }).response
          : undefined;

      const detail = respData?.data?.detail || respData?.data?.message || 'Failed to send reset code.';
      setError(detail);

      // If user is not registered in the database, flag to show register CTA
      if (
        respData?.status === 400 ||
        respData?.status === 404 ||
        detail.toLowerCase().includes('not registered') ||
        detail.toLowerCase().includes('register first')
      ) {
        setIsNotRegistered(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const passwordError = getPasswordPolicyError(newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/auth/reset-password', {
        email: email.trim(),
        token: code.trim(),
        new_password: newPassword,
      });
      setStep('done');
      setMessage('Password reset successful! Redirecting to login...');
      setTimeout(() => navigate('/login', { state: { openLogin: true } }), 1500);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { detail?: string; message?: string } } }).response?.data?.detail ||
            (err as { response?: { data?: { detail?: string; message?: string } } }).response?.data?.message
          : undefined;
      setError(msg || 'Failed to reset password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-start justify-center overflow-y-auto px-3 py-4 sm:items-center sm:px-4 sm:py-8">
      <MeshBackground />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md">
        <GlassCard className="p-5 sm:p-8">
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-black text-white flex items-center justify-center mx-auto mb-4 shadow-md">
              <KeyRound className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Reset Password</h1>
            <p className="text-gray-500 mt-2 text-sm">
              {step === 'email' && 'Verify your registered email to receive an OTP'}
              {step === 'code' && 'Enter the 6-digit OTP code sent to your email'}
              {step === 'done' && 'Password updated successfully'}
            </p>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm flex items-start gap-2.5"
              >
                <AlertCircle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium">{error}</p>
                  {isNotRegistered && (
                    <div className="mt-3 flex items-center gap-2">
                      <Link
                        to="/register"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white font-semibold text-xs hover:bg-red-700 transition-colors shadow-xs"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Register Now</span>
                      </Link>
                      <Link
                        to="/login"
                        className="inline-flex items-center gap-1 text-xs text-red-700 hover:text-red-900 underline font-medium px-2 py-1"
                      >
                        Back to Login
                      </Link>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {message && !error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl mb-4 text-sm flex items-center gap-2.5"
              >
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
                <span>{message}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* STEP 1: Email Verification & Send OTP Button */}
          {step === 'email' && (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-semibold text-neutral-500 uppercase tracking-widest">
                    Registered Email
                  </label>
                  {isEmailLocked && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-md">
                      <Lock className="w-3 h-3 text-neutral-500" />
                      Locked
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => !isEmailLocked && setEmail(e.target.value)}
                    readOnly={isEmailLocked}
                    required
                    placeholder="you@company.com"
                    className={`w-full px-4 py-3 rounded-xl border-2 text-sm outline-none transition-all ${
                      isEmailLocked
                        ? 'border-neutral-200 bg-neutral-100/80 text-neutral-700 cursor-not-allowed select-none'
                        : 'border-neutral-200 bg-neutral-50/50 text-neutral-900 focus:border-black focus:bg-white'
                    }`}
                  />
                  {isEmailLocked && (
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400">
                      <Lock className="w-4 h-4" />
                    </div>
                  )}
                </div>
                {isEmailLocked && (
                  <p className="text-[11px] text-neutral-400 mt-1.5 flex items-center gap-1">
                    <span>Email from login is locked to prevent unauthorized resets.</span>
                  </p>
                )}
              </div>

              <GradientButton type="submit" isLoading={isLoading} className="w-full flex items-center justify-center gap-2">
                <Send className="w-4 h-4" />
                <span>Send OTP</span>
              </GradientButton>

              <div className="text-center pt-2">
                <Link to="/login" className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-black transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to login</span>
                </Link>
              </div>
            </form>
          )}

          {/* STEP 2: Code Verification & New Password */}
          {step === 'code' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              {/* Premium, sleek OTP Sent Status Card */}
              <div className="bg-emerald-50/90 border border-emerald-200 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <MailCheck className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider">Code Sent To</p>
                    <p className="text-xs font-bold text-emerald-950 truncate">{email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600 text-white text-xs font-semibold whitespace-nowrap shrink-0 shadow-xs">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>OTP Sent</span>
                </div>
              </div>

              <AnimatedInput
                label="6-Digit Code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                placeholder="123456"
                maxLength={6}
              />

              <AnimatedInput
                label="New Password"
                type="password"
                showPasswordToggle
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                placeholder="12+ chars, upper, lower, number, special"
              />

              <AnimatedInput
                label="Confirm Password"
                type="password"
                showPasswordToggle
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Re-enter password"
              />

              <GradientButton type="submit" isLoading={isLoading} className="w-full">
                Reset Password
              </GradientButton>

              <div className="flex items-center justify-between pt-2 text-xs">
                <Link to="/login" className="inline-flex items-center gap-1 text-neutral-500 hover:text-black font-semibold transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to login</span>
                </Link>
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={isLoading}
                  className="text-black underline font-semibold cursor-pointer disabled:opacity-50"
                >
                  Resend OTP
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: Done */}
          {step === 'done' && (
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <p className="text-base font-bold text-neutral-900 mb-1">Password Changed Successfully</p>
              <p className="text-xs text-neutral-500 mb-6">Redirecting you to login with your new credentials...</p>
              <Link
                to="/login"
                className="inline-flex items-center justify-center w-full py-3 rounded-xl bg-black text-white font-semibold text-sm hover:bg-neutral-800 transition-colors"
              >
                Go to Login
              </Link>
            </div>
          )}
        </GlassCard>
      </motion.div>
    </div>
  );
}
