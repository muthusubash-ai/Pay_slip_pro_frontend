import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { GlassCard } from '../../components/ui/GlassCard';
import { AnimatedInput } from '../../components/ui/AnimatedInput';
import { GradientButton } from '../../components/ui/GradientButton';
import { motion } from 'framer-motion';
import api from '../../services/api';

export function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
    }
  }, [user]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');
    try {
      const { data } = await api.put('/auth/me', { full_name: fullName });
      updateUser(data);
      setMessageType('success');
      setMessage('Profile updated successfully');
    } catch {
      setMessageType('error');
      setMessage('Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Profile</h2>
      <GlassCard>
        {message && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${messageType === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {message}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <AnimatedInput label="Email" value={user?.email || ''} disabled />
          <AnimatedInput label="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          <AnimatedInput
            label="Role"
            value={user?.role === 'admin' ? 'Administrator' : 'HR Manager'}
            disabled
          />
          <GradientButton type="submit" isLoading={isLoading}>Save Changes</GradientButton>
        </form>
      </GlassCard>
    </motion.div>
  );
}
