import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { attendanceService } from '../services/attendanceService';
import { useAuth } from '../context/AuthContext';
import { useAdminCompany } from '../context/AdminCompanyContext';
import { hasMinimumPlan } from '../lib/plans';

export function useMonthlyAttendance(employeeId: number, month: number, year: number, isEligible = true) {
  const { user } = useAuth();
  const { selectedCompanyUserId, isAdmin } = useAdminCompany();
  const effectiveCompanyId = isAdmin ? selectedCompanyUserId : null;

  return useQuery({
    queryKey: ['attendance', effectiveCompanyId, employeeId, month, year],
    queryFn: () =>
      attendanceService
        .getMonthlyAttendance(employeeId, month, year, effectiveCompanyId)
        .then((r) => r.data),
    enabled: !!user && employeeId > 0 && isEligible && (!isAdmin || effectiveCompanyId !== null),
  });
}

export function useAttendanceReadiness(month: number, year: number) {
  const { user } = useAuth();
  const { selectedCompanyUserId, isAdmin } = useAdminCompany();
  const effectiveCompanyId = isAdmin ? selectedCompanyUserId : null;

  return useQuery({
    queryKey: ['attendance-readiness', effectiveCompanyId, month, year],
    queryFn: () =>
      attendanceService.getReadiness(month, year, effectiveCompanyId).then((r) => r.data),
    enabled: !!user && (!isAdmin || effectiveCompanyId !== null),
  });
}

export function useLeaveSummary(month: number, year: number) {
  const { user } = useAuth();
  const { selectedCompanyUserId, isAdmin } = useAdminCompany();
  const effectiveCompanyId = isAdmin ? selectedCompanyUserId : null;

  return useQuery({
    queryKey: ['leave-summary', effectiveCompanyId, month, year],
    queryFn: () =>
      attendanceService.getLeaveSummary(month, year, effectiveCompanyId).then((r) => r.data),
    enabled: hasMinimumPlan(user, 'professional') && (!isAdmin || effectiveCompanyId !== null),
  });
}

export function useMarkAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { employee_id: number; date: string; status: string }) =>
      attendanceService.markAttendance(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance'] });
      qc.invalidateQueries({ queryKey: ['attendance-readiness'] });
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
      half_day_dates?: string[];
      permission_dates?: string[];
    }) => attendanceService.bulkMarkLeaves(data),
    onSuccess: () => {
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
