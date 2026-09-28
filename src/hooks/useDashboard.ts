import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '../services/dashboardService';
import { useAuth } from '../context/AuthContext';
import { hasMinimumPlan } from '../lib/plans';

export function useDashboardStats() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardService.getStats().then((r) => r.data),
    enabled: !!user,
  });
}

export function usePayrollSummary(month: number, year: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['payroll-summary', month, year],
    queryFn: () => dashboardService.getPayrollSummary(month, year).then((r) => r.data),
    enabled: hasMinimumPlan(user, 'professional'),
  });
}

export function useDepartmentBreakdown() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['department-breakdown'],
    queryFn: () => dashboardService.getDepartmentBreakdown().then((r) => r.data),
    enabled: hasMinimumPlan(user, 'enterprise'),
  });
}
