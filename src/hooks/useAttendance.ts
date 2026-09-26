import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { attendanceService } from '../services/attendanceService';
import { useAuth } from '../context/AuthContext';
import { hasMinimumPlan } from '../lib/plans';

export function useMonthlyAttendance(employeeId: number, month: number, year: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['attendance', employeeId, month, year],
    queryFn: () =>
      attendanceService.getMonthlyAttendance(employeeId, month, year).then((r) => r.data),
    enabled: !!user && employeeId > 0,
  });
}

export function useLeaveSummary(month: number, year: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['leave-summary', month, year],
    queryFn: () => attendanceService.getLeaveSummary(month, year).then((r) => r.data),
    enabled: hasMinimumPlan(user, 'enterprise'),
  });
}

export function useMarkAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { employee_id: number; date: string; status: string }) =>
      attendanceService.markAttendance(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance'] });
      qc.invalidateQueries({ queryKey: ['leave-summary'] });
    },
  });
}

export function useBulkMarkLeaves() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      employee_id: number;
      month: number;
      year: number;
      leave_dates: string[];
      weekoff_dates: string[];
    }) => attendanceService.bulkMarkLeaves(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance'] });
      qc.invalidateQueries({ queryKey: ['leave-summary'] });
    },
  });
}
