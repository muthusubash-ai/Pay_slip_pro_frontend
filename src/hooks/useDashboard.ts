import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '../services/dashboardService';
import { useAuth } from '../context/AuthContext';
import { useAdminCompany } from '../context/AdminCompanyContext';
import { hasMinimumPlan } from '../lib/plans';

export function useDashboardStats() {
  const { user } = useAuth();
  const { selectedCompanyUserId, isAdmin } = useAdminCompany();
  const effectiveCompanyId = isAdmin ? selectedCompanyUserId : null;

  return useQuery({
    queryKey: ['dashboard-stats', effectiveCompanyId],
    queryFn: () => dashboardService.getStats(effectiveCompanyId).then((r) => r.data),
    enabled: !!user && (!isAdmin || effectiveCompanyId !== null),
  });
}

export function usePayrollSummary(month: number, year: number) {
  const { user } = useAuth();
  const { selectedCompanyUserId, isAdmin } = useAdminCompany();
  const effectiveCompanyId = isAdmin ? selectedCompanyUserId : null;

  return useQuery({
    queryKey: ['payroll-summary', effectiveCompanyId, month, year],
    queryFn: () => dashboardService.getPayrollSummary(month, year, effectiveCompanyId).then((r) => r.data),
    enabled: hasMinimumPlan(user, 'professional') && (!isAdmin || effectiveCompanyId !== null),
  });
}

export function useDepartmentBreakdown() {
  const { user } = useAuth();
  const { selectedCompanyUserId, isAdmin } = useAdminCompany();
  const effectiveCompanyId = isAdmin ? selectedCompanyUserId : null;

  return useQuery({
    queryKey: ['department-breakdown', effectiveCompanyId],
    queryFn: () => dashboardService.getDepartmentBreakdown(effectiveCompanyId).then((r) => r.data),
    enabled: hasMinimumPlan(user, 'enterprise') && (!isAdmin || effectiveCompanyId !== null),
  });
}
