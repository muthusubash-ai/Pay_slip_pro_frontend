import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeeService } from '../services/employeeService';
import { useAuth } from '../context/AuthContext';

export function useEmployees(page = 1, search?: string, department?: string, sort?: string, per_page?: number, status: 'active' | 'inactive' | 'all' = 'active') {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['employees', page, search, department, sort, per_page, status],
    queryFn: () => employeeService.list({ page, search, department, sort, per_page, status }).then((r) => r.data),
    enabled: !!user,
  });
}

export function useEmployee(id: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['employee', id],
    queryFn: () => employeeService.get(id).then((r) => r.data),
    enabled: !!user && !!id,
  });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: employeeService.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  });
}

export function useUpdateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof employeeService.update>[1] }) =>
      employeeService.update(id, data),
    onSuccess: (_response, variables) => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      qc.invalidateQueries({ queryKey: ['employee', variables.id] });
      qc.invalidateQueries({ queryKey: ['attendance'] });
      qc.invalidateQueries({ queryKey: ['attendance-readiness'] });
      qc.invalidateQueries({ queryKey: ['leave-summary'] });
      qc.invalidateQueries({ queryKey: ['salary-slips'] });
      qc.invalidateQueries({ queryKey: ['salary-slips-for-period'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      qc.invalidateQueries({ queryKey: ['payroll-summary'] });
    },
  });
}

export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: employeeService.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      qc.invalidateQueries({ queryKey: ['department-breakdown'] });
    },
  });
}

export function useSendEmployeeInvite() {
  return useMutation({
    mutationFn: (id: number) => employeeService.sendInvite(id),
  });
}

export function useReactivateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, email }: { id: number; email?: string }) => employeeService.reactivate(id, { email }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      qc.invalidateQueries({ queryKey: ['department-breakdown'] });
    },
  });
}

export function usePermanentDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: employeeService.permanentDelete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      qc.invalidateQueries({ queryKey: ['department-breakdown'] });
    },
  });
}
