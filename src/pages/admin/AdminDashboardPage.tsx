import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Users, FileText, Building, ShieldCheck } from 'lucide-react';
import { GlassCard } from '../../components/ui/GlassCard';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { adminService } from '../../services/adminService';
import { useAuth } from '../../context/AuthContext';

export function AdminDashboardPage() {
  const { user } = useAuth();
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => adminService.getStats().then((r) => r.data),
    enabled: !!user,
  });

  if (isLoading) return <LoadingSpinner />;

  const cards = [
    { label: 'Total Users', value: stats?.total_users ?? 0, icon: Users },
    { label: 'Active Users', value: stats?.active_users ?? 0, icon: ShieldCheck },
    { label: 'Total Employees', value: stats?.total_employees ?? 0, icon: Building },
    { label: 'Total Salary Slips', value: stats?.total_slips ?? 0, icon: FileText },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-6xl mx-auto">
      <h2 className="text-xl font-bold text-neutral-900 dark:text-white sm:text-2xl">
        Admin Platform Overview
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((stat, i) => (
          <GlassCard key={i} className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white shrink-0">
              <stat.icon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">{stat.label}</p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white mt-0.5">{stat.value.toLocaleString()}</p>
            </div>
          </GlassCard>
        ))}
      </div>
    </motion.div>
  );
}
