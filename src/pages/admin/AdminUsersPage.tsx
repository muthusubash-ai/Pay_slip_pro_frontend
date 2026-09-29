import { motion } from 'framer-motion';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { GlassCard } from '../../components/ui/GlassCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { AnimatedList } from '../../components/ui/AnimatedList';
import { GradientButton } from '../../components/ui/GradientButton';
import { adminService } from '../../services/adminService';
import { useAuth } from '../../context/AuthContext';
import type { User } from '../../types';

export function AdminUsersPage() {
  const { user: authUser } = useAuth();
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', page],
    queryFn: () => adminService.listUsers(page).then((r) => r.data),
    enabled: !!authUser,
  });

  const toggleUser = useMutation({
    mutationFn: ({ userId, is_active }: { userId: number; is_active: boolean }) =>
      adminService.updateUser(userId, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const updateRole = useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: string }) =>
      adminService.updateUser(userId, { role }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const users: User[] = data?.items || [];
  const pages: number = data?.pages || 0;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-6xl mx-auto">
      <h2 className="text-xl font-bold text-neutral-900 dark:text-white sm:text-2xl">User Management</h2>
      <GlassCard>
        {isLoading ? (
          <LoadingSpinner />
        ) : !users.length ? (
          <EmptyState icon={<Users className="h-12 w-12" />} title="No users" description="No users found on the platform." />
        ) : (
          <>
            <AnimatedList>
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex flex-col gap-4 rounded-xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 p-4 sm:flex-row sm:items-center sm:justify-between transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-neutral-900 dark:text-white text-sm">{user.full_name}</p>
                    <p className="break-all text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{user.email}</p>
                  </div>
                  <div className="grid grid-cols-2 items-center gap-2 min-[420px]:flex min-[420px]:flex-wrap sm:justify-end sm:gap-3">
                    <select
                      value={user.role}
                      onChange={(e) => updateRole.mutate({ userId: user.id, role: e.target.value })}
                      className="col-span-2 w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-1.5 text-xs text-neutral-900 dark:text-white focus:border-black dark:focus:border-white focus:outline-none min-[420px]:col-auto min-[420px]:w-auto font-medium"
                    >
                      <option value="hr_manager">HR Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                        user.is_active
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                      }`}
                    >
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <GradientButton
                      variant={user.is_active ? 'danger' : 'primary'}
                      onClick={() => toggleUser.mutate({ userId: user.id, is_active: !user.is_active })}
                      className="w-full !px-3 !py-1.5 text-xs min-[420px]:w-auto"
                    >
                      {user.is_active ? 'Deactivate' : 'Activate'}
                    </GradientButton>
                  </div>
                </div>
              ))}
            </AnimatedList>

            {pages > 1 && (
              <div className="flex flex-wrap items-center justify-center gap-2 mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-xs font-semibold text-neutral-700 dark:text-neutral-300 disabled:opacity-40 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  Previous
                </button>
                <span className="text-xs text-neutral-600 dark:text-neutral-400 font-medium">Page {page} of {pages}</span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                  disabled={page >= pages}
                  className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-xs font-semibold text-neutral-700 dark:text-neutral-300 disabled:opacity-40 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </GlassCard>
    </motion.div>
  );
}
