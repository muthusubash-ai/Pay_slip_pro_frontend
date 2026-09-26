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
  const [role, setRole] = useState(user?.role || 'hr_manager');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setRole(user.role || 'hr_manager');
    }
  }, [user]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');
    try {
      const { data } = await api.put('/auth/me', { full_name: fullName, role });
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
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'hr_manager')}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white outline-none transition-colors focus:border-black"
            >
              <option value="hr_manager">HR Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <GradientButton type="submit" isLoading={isLoading}>Save Changes</GradientButton>
        </form>
      </GlassCard>
    </motion.div>
  );
}
