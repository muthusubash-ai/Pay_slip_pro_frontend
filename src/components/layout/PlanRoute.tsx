import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getPlanHome, hasMinimumPlan, type Plan } from '../../lib/plans';

interface PlanRouteProps {
  minimumPlan: Plan;
  children: React.ReactNode;
  adminOnly?: boolean;
}

export function PlanRoute({ minimumPlan, children, adminOnly = false }: PlanRouteProps) {
  const { user } = useAuth();

  if (!hasMinimumPlan(user, minimumPlan) || (adminOnly && user?.role !== 'admin')) {
    return <Navigate to={getPlanHome(user)} replace />;
  }

  return <>{children}</>;
}
