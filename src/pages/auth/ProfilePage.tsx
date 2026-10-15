import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../context/LanguageContext';
import { GlassCard } from '../../components/ui/GlassCard';
import { AnimatedInput } from '../../components/ui/AnimatedInput';
import { GradientButton } from '../../components/ui/GradientButton';
import { motion } from 'framer-motion';
import api from '../../services/api';

export function ProfilePage() {
  const { user, updateUser } = useAuth();
  const { t } = useTranslation();
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
      setMessage(t('common.saved'));
    } catch {
      setMessageType('error');
      setMessage(t('common.error'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto">
      <h2 className="mb-5 text-xl font-bold text-gray-900 dark:text-white sm:mb-6 sm:text-2xl">{t('settings.profileSettings')}</h2>
      <GlassCard>
        {message && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${messageType === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-950/60 dark:text-green-300' : 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300'}`}>
            {message}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <AnimatedInput label={t('settings.email')} value={user?.email || ''} disabled />
          <AnimatedInput label={t('settings.fullName')} value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          <AnimatedInput
            label={t('settings.accountRole')}
            value={user?.role === 'admin' ? t('settings.administrator') : t('settings.hrManager')}
            disabled
          />
          <GradientButton type="submit" isLoading={isLoading} className="w-full sm:w-auto">{t('settings.saveChanges')}</GradientButton>
        </form>
      </GlassCard>
    </motion.div>
  );
}
