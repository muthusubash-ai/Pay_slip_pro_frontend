import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MeshBackground } from '../../components/layout/MeshBackground';
import { GlassCard } from '../../components/ui/GlassCard';
import { AnimatedInput } from '../../components/ui/AnimatedInput';
import { GradientButton } from '../../components/ui/GradientButton';
import api from '../../services/api';

type Step = 'email' | 'code' | 'done';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSendCode = async (e?: FormEvent) => {
    e?.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email });
      const data = res.data as { message: string; sent: boolean };
      if (data.sent) {
        setMessage('Reset code sent to your email. Check your inbox.');
        setStep('code');
      } else {
        setError(data.message || 'Failed to send reset code.');
      }
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      setError(msg || 'Failed to send reset code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/auth/reset-password', {
        email,
        token: code,
        new_password: newPassword,
      });
      setStep('done');
      setMessage('Password reset successful! Redirecting to login...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      setError(msg || 'Failed to reset password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <MeshBackground />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md">
        <GlassCard className="p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Reset Password</h1>
            <p className="text-gray-500 mt-2">
              {step === 'email' && 'Enter your email to receive a reset code'}
              {step === 'code' && 'Enter the 6-digit code sent to your email'}
              {step === 'done' && 'Password updated successfully'}
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4">
              {error}
            </div>
          )}
          {message && !error && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl mb-4">
              {message}
            </div>
          )}

          {step === 'email' && (
            <form onSubmit={handleSendCode} className="space-y-4">
              <AnimatedInput
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@company.com"
              />
              <GradientButton type="submit" isLoading={isLoading} className="w-full">
                Send Reset Code
              </GradientButton>
              <p className="text-center text-sm">
                <Link to="/login" className="text-black underline">Back to login</Link>
              </p>
            </form>
          )}

          {step === 'code' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600">
                Code sent to <strong>{email}</strong>
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
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                placeholder="Min 6 characters"
              />
              <AnimatedInput
                label="Confirm Password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Re-enter password"
              />
              <GradientButton type="submit" isLoading={isLoading} className="w-full">
                Reset Password
              </GradientButton>
              <div className="flex justify-between text-sm">
                <button
                  type="button"
                  onClick={() => { setStep('email'); setError(''); setMessage(''); }}
                  className="text-black underline"
                >
                  Change email
                </button>
                <button
                  type="button"
                  onClick={() => handleSendCode()}
                  className="text-black underline"
                >
                  Resend code
                </button>
              </div>
            </form>
          )}

          {step === 'done' && (
            <div className="text-center">
              <p className="text-green-600 mb-4">Redirecting to login...</p>
              <Link to="/login" className="text-black underline">Go to login</Link>
            </div>
          )}
        </GlassCard>
      </motion.div>
    </div>
  );
}
