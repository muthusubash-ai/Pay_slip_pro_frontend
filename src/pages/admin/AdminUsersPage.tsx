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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">User Management</h2>
      <GlassCard>
        {isLoading ? (
          <LoadingSpinner />
        ) : !users.length ? (
          <EmptyState icon={<Users className="h-12 w-12" />} title="No users" description="No users found on the platform." />
        ) : (
          <>
            <AnimatedList>
              {users.map((user) => (
                <div key={user.id} className="flex flex-col gap-4 rounded-xl border border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">{user.full_name}</p>
                    <p className="break-all text-sm text-gray-500">{user.email}</p>
                  </div>
                  <div className="grid grid-cols-2 items-center gap-2 min-[420px]:flex min-[420px]:flex-wrap sm:justify-end sm:gap-3">
                    <select
                      value={user.role}
                      onChange={(e) => updateRole.mutate({ userId: user.id, role: e.target.value })}
                      className="col-span-2 w-full rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm focus:border-black focus:outline-none min-[420px]:col-auto min-[420px]:w-auto"
                    >
                      <option value="hr_manager">HR Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <GradientButton
                      variant={user.is_active ? 'danger' : 'primary'}
                      onClick={() => toggleUser.mutate({ userId: user.id, is_active: !user.is_active })}
                      className="w-full !px-3 !py-1.5 text-sm min-[420px]:w-auto"
                    >
                      {user.is_active ? 'Deactivate' : 'Activate'}
                    </GradientButton>
                  </div>
                </div>
              ))}
            </AnimatedList>

            {pages > 1 && (
              <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1 rounded-lg border border-gray-200 disabled:opacity-50">Previous</button>
                <span className="text-sm text-gray-600">Page {page} of {pages}</span>
                <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages} className="px-3 py-1 rounded-lg border border-gray-200 disabled:opacity-50">Next</button>
              </div>
            )}
          </>
        )}
      </GlassCard>
    </motion.div>
  );
}
