export interface User {
  id: number;
  email: string;
  full_name: string;
  role: 'admin' | 'hr_manager';
  is_active: boolean;
  plan: 'starter' | 'professional' | 'enterprise';
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
  is_active: boolean;
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
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
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

export interface AttendanceRecord {
  id: number;
  employee_id: number;
  date: string;
  status: 'present' | 'leave';
}

export interface EmployeeLeaveSummary {
  employee_id: number;
  employee_name: string;
  employee_code: string;
  month: number;
  year: number;
  total_days: number;
  leave_days: number;
  weekoff_days: number;
  present_days: number;
  leave_deduction: number;
}
