import type { User } from '../types';

export type Plan = 'starter' | 'professional' | 'enterprise';

const PLAN_LEVELS: Record<Plan, number> = {
  starter: 0,
  professional: 1,
  enterprise: 2,
};

export const EMPLOYEE_LIMITS: Record<Plan, number | null> = {
  starter: 3,
  professional: 10,
  enterprise: null,
};

export function getPlan(user: User | null | undefined): Plan {
  return user?.plan ?? 'starter';
}

export function hasMinimumPlan(user: User | null | undefined, minimumPlan: Plan): boolean {
  return PLAN_LEVELS[getPlan(user)] >= PLAN_LEVELS[minimumPlan];
}

export function getPlanHome(user: User | null | undefined): string {
  if (getPlan(user) === 'starter') return '/employees';
  if (getPlan(user) === 'enterprise' && user?.role === 'admin') return '/admin';
  return '/dashboard';
}
