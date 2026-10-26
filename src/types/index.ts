export interface User {
  id: number;
  email: string;
  full_name: string;
  phone?: string | null;
  /** HR-facing notifications (leave requests, etc.) go here instead of `email` when set. */
  notification_email?: string | null;
  company_name?: string;
  role: 'admin' | 'hr_manager';
  is_active: boolean;
  is_platform_admin: boolean;
  plan: 'starter' | 'professional' | 'enterprise';
  plan_expires_at?: string | null;
  is_plan_expired?: boolean;
  plan_days_left?: number | null;
  created_at: string;
}

export interface Employee {
  id: number;
  user_id: number;
  employee_code: string;
  full_name: string;
  email: string;
  phone: string | null;
  department: string | null;
  designation: string | null;
  date_of_joining: string;
  bank_account_number: string | null;
  bank_name: string | null;
  ifsc_code: string | null;
  pan_number: string | null;
  basic_salary: number;
  hra: number;
  conveyance_allowance: number;
  medical_allowance: number;
  special_allowance: number;
  pf_deduction: number;
  professional_tax: number;
  tds: number;
  esi: number;
  /** Optional per-employee shift timing (24-hour "HH:MM"); falls back to the company default when unset. */
  shift_start_time?: string | null;
  shift_end_time?: string | null;
  /** Optional - lets attendance registration sanity-check the captured face against the recorded gender. */
  gender?: 'MALE' | 'FEMALE' | null;
  is_active: boolean;
  /** Set when the employee was deactivated; they're permanently deleted 30 days after this. */
  deactivated_at?: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface SalarySlip {
  id: number;
  user_id: number;
  employee_id: number;
  month: number;
  year: number;
  basic_salary: number;
  hra: number;
  conveyance_allowance: number;
  medical_allowance: number;
  special_allowance: number;
  gross_salary: number;
  pf_deduction: number;
  professional_tax: number;
  tds: number;
  esi: number;
  total_deductions: number;
  leave_days: number;
  leave_deduction: number;
  net_pay: number;
  status: 'draft' | 'generated' | 'sent';
  generated_at: string;
  emailed_at: string | null;
  employee?: Employee;
}

export interface Company {
  id: number;
  user_id: number;
  company_name: string;
  logo_url: string | null;
  logo_data: string | null;
  primary_color: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  pay_day: number;
  financial_year_start: number;
  pf_number: string | null;
  tan_number: string | null;
  office_lat?: number | null;
  office_lng?: number | null;
  allowed_radius_meters?: number | null;
  /** Recurring weekly off days. Monday=0 ... Sunday=6. */
  weekly_off_days?: number[];
  /** Permission requests allowed per month with 0 salary deduction. */
  permission_days_per_month?: number;
  office_timing?: string | null;
  office_start_time?: string | null;
  office_end_time?: string | null;
  /** When true, HR can set a custom shift start/end time per employee (optional per employee). */
  enable_employee_shift_timing?: boolean;
  /** Whether company settings editing is locked on the user's current subscription plan. */
  is_locked?: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
  active_count?: number;
  inactive_count?: number;
}

export interface DashboardStats {
  total_employees: number;
  active_employees: number;
  total_payroll: number;
  current_month_salary: number;
}

export interface PayrollSummary {
  month: number;
  year: number;
  total_gross: number;
  total_deductions: number;
  total_net: number;
  slip_count: number;
}

// Matches backend /dashboard/department-breakdown: one record per employee
// (see backend app/schemas/dashboard.py::DepartmentBreakdown).
export interface DepartmentBreakdown {
  department: string;
  employee_name: string;
  designation: string;
  employee_code: string;
  basic_salary: number;
}

export type DayStatus = 'present' | 'leave' | 'half_day' | 'permission' | 'weekoff' | 'weekoff_halfday';

export interface AttendanceRecord {
  id?: number | null;
  employee_id: number;
  date: string;
  status: DayStatus;
  check_in?: string | null;
  check_out?: string | null;
  duration_hours?: number | null;
  is_late?: boolean;
  /** The underlying biometric Attendance record id - needed to fix a forgotten check-out. */
  bio_record_id?: number | null;
  /** A temporary step-out/return pair during the day under an approved permission request. */
  permission_out?: string | null;
  permission_in?: string | null;
  biometric_status?: string | null;
  leave_type?: string | null;
  distance_meters?: number | null;
}

export interface EmployeeLeaveSummary {
  employee_id: number;
  employee_name: string;
  employee_code: string;
  month: number;
  year: number;
  total_days: number;
  leave_days: number;
  half_day_days: number;
  permission_days: number;
  effective_leave_days: number;
  weekoff_days: number;
  weekoff_halfday_days?: number;
  company_week_off_days?: number;
  present_days: number;
  leave_deduction: number;
  gross_salary?: number;
  net_payable: number;
  is_joining_month?: boolean;
  date_of_joining?: string | null;
}
