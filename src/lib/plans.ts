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
      'Attendance and leave tracking',
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

export function getPlan(user: User | null | undefined): Plan {
  return user?.plan ?? 'starter';
}

export function hasMinimumPlan(user: User | null | undefined, minimumPlan: Plan): boolean {
  return PLAN_LEVELS[getPlan(user)] >= PLAN_LEVELS[minimumPlan];
}

export function getPlanHome(user: User | null | undefined): string {
  if (getPlan(user) === 'enterprise' && user?.role === 'admin') return '/admin';
  return '/dashboard';
}
