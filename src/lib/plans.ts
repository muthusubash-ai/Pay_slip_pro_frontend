import type { User } from '../types';

export type Plan = 'starter' | 'professional' | 'enterprise';

export interface PlanDetails {
  id: Plan;
  name: string;
  price: string;
  period: string;
  employeeAccess: string;
  desc: string;
  features: string[];
  cta: string;
  popular: boolean;
}

export const PLAN_CATALOG: PlanDetails[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 'Free',
    period: '',
    employeeAccess: 'Up to 3 employees',
    desc: 'Essential payroll tools for small teams',
    features: [
      'Manage up to 3 employees',
      'Dashboard overview',
      'Employee salary profiles',
      'Basic monthly attendance save',
      'Monthly salary slip generation',
      'PDF salary slip downloads',
      'Email delivery to employees',
    ],
    cta: 'Start Free',
    popular: false,
  },
  {
    id: 'professional',
    name: 'Professional',
    price: '₹499',
    period: '/month',
    employeeAccess: 'Up to 10 employees',
    desc: 'Complete payroll management for growing teams',
    features: [
      'Everything in Starter',
      'Manage up to 10 employees',
      'Company logo and brand colours',
      'Detailed attendance and leave tracking',
      'Bulk salary slip generation',
      'Payroll reports and summaries',
    ],
    cta: 'Choose Professional',
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: '₹999',
    period: '/month',
    employeeAccess: 'Unlimited employees',
    desc: 'Scalable payroll operations for larger teams',
    features: [
      'Everything in Professional',
      'Unlimited employee records',
      'Department-wise payroll insights',
      'Advanced attendance summaries',
    ],
    cta: 'Choose Enterprise',
    popular: false,
  },
];

export function getPlanDetails(plan: Plan): PlanDetails {
  return PLAN_CATALOG.find((item) => item.id === plan) ?? PLAN_CATALOG[0];
}

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

export function isUserPlanExpired(user: User | null | undefined): boolean {
  if (!user) return false;
  if (user.is_plan_expired) return true;
  if (user.plan_expires_at) {
    return new Date(user.plan_expires_at).getTime() <= Date.now();
  }
  return false;
}

export function getUserPlanDaysRemaining(user: User | null | undefined): number | null {
  if (!user || !user.plan_expires_at) return null;
  const expiry = new Date(user.plan_expires_at).getTime();
  const diff = expiry - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function getUserPlanHoursRemaining(user: User | null | undefined): number | null {
  if (!user || !user.plan_expires_at) return null;
  const expiry = new Date(user.plan_expires_at).getTime();
  const diff = expiry - Date.now();
  if (diff <= 0) return 0;
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60)));
}

export function getUserPlanRemainingText(user: User | null | undefined): string | null {
  if (!user || !user.plan_expires_at) return null;
  const diff = new Date(user.plan_expires_at).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  if (diff <= 24 * 60 * 60 * 1000) {
    const hours = Math.max(1, Math.ceil(diff / (1000 * 60 * 60)));
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} remaining`;
  }
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return `${days} ${days === 1 ? 'day' : 'days'} remaining`;
}

export function getPlan(user: User | null | undefined): Plan {
  return user?.plan ?? 'starter';
}

export function hasMinimumPlan(user: User | null | undefined, minimumPlan: Plan): boolean {
  if (isUserPlanExpired(user)) {
    return minimumPlan === 'starter';
  }
  return PLAN_LEVELS[getPlan(user)] >= PLAN_LEVELS[minimumPlan];
}

export function getPlanHome(user: User | null | undefined): string {
  if (getPlan(user) === 'enterprise' && user?.is_platform_admin) return '/admin';
  return '/dashboard';
}
