import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Trash2, AlertCircle } from 'lucide-react';
import { GlassCard } from '../../components/ui/GlassCard';
import { AnimatedInput } from '../../components/ui/AnimatedInput';
import { GradientButton } from '../../components/ui/GradientButton';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useEmployee, useUpdateEmployee, useDeleteEmployee, useEmployees } from '../../hooks/useEmployees';
import { DEPARTMENT_OPTIONS, DESIGNATION_OPTIONS } from '../../lib/employeeOptions';
import { ThemedSelect } from '../../components/ui/ThemedSelect';
import { BankNamePicker } from '../../components/ui/BankNamePicker';
import { IfscLookupField } from '../../components/ui/IfscLookupField';
import { ThemedDatePicker } from '../../components/ui/ThemedDatePicker';
import { companyService } from '../../services/companyService';
import { useTranslation } from '../../context/LanguageContext';

export function EmployeeEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { data: emp, isLoading } = useEmployee(Number(id));
  const { data: employeesData } = useEmployees(1, undefined, undefined, undefined, 500);
  const existingEmployees = employeesData?.items || [];
  const updateEmployee = useUpdateEmployee();
  const deleteEmployee = useDeleteEmployee();
  const [error, setError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const { data: company } = useQuery({
    queryKey: ['company'],
    queryFn: () => companyService.get().then((r) => r.data),
  });
  const shiftTimingEnabled = Boolean(company?.enable_employee_shift_timing);

  const handleDeactivate = () => {
    setDeleteError('');
    if (!confirm('Are you sure you want to deactivate and remove this employee?')) return;
    deleteEmployee.mutate(Number(id), {
      onSuccess: () => {
        navigate('/employees', { replace: true });
      },
      onError: (err: unknown) => {
        const msg =
          err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
            : undefined;
        setDeleteError(msg || 'Failed to deactivate employee. Please try again.');
      },
    });
  };

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    department: '',
    designation: '',
    date_of_joining: '',
    bank_name: '',
    bank_account_number: '',
    ifsc_code: '',
    pan_number: '',
    basic_salary: '',
    hra: '',
    conveyance_allowance: '',
    medical_allowance: '',
    special_allowance: '',
    pf_deduction: '',
    professional_tax: '',
    tds: '',
    esi: '',
    shift_start_time: '',
    shift_end_time: '',
    gender: '' as '' | 'MALE' | 'FEMALE',
  });

  useEffect(() => {
    if (emp) {
      setForm({
        full_name: emp.full_name,
        email: emp.email,
        phone: emp.phone || '',
        department: emp.department || '',
        designation: emp.designation || '',
        date_of_joining: emp.date_of_joining || '',
        bank_name: emp.bank_name || '',
        bank_account_number: emp.bank_account_number || '',
        ifsc_code: emp.ifsc_code || '',
        pan_number: emp.pan_number || '',
        basic_salary: String(emp.basic_salary),
        hra: String(emp.hra),
        conveyance_allowance: String(emp.conveyance_allowance),
        medical_allowance: String(emp.medical_allowance),
        special_allowance: String(emp.special_allowance),
        pf_deduction: String(emp.pf_deduction),
        professional_tax: String(emp.professional_tax),
        tds: String(emp.tds),
        esi: String(emp.esi),
        shift_start_time: emp.shift_start_time || '',
        shift_end_time: emp.shift_end_time || '',
        gender: emp.gender || '',
      });
    }
  }, [emp]);

  const handleChange = (
    field: string,
    type: 'text' | 'alphabets' | 'digits' | 'phone' | 'alphanumeric' | 'decimal' = 'text'
  ) => (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (type === 'alphabets') {
      val = val.replace(/[^a-zA-Z\s.'-]/g, '');
    } else if (type === 'digits') {
      val = val.replace(/\D/g, '');
    } else if (type === 'phone') {
      val = val.replace(/[^\d+]/g, '').slice(0, 15);
    } else if (type === 'alphanumeric') {
      val = val.toUpperCase().replace(/[^A-Z0-9]/g, '');
    } else if (type === 'decimal') {
      val = val.replace(/[^0-9.]/g, '').replace(/(\..*?)\..*/g, '$1');
    }
    setForm((prev) => ({ ...prev, [field]: val }));
  };

  const normalizedEmail = form.email.trim().toLowerCase();
  const emailConflict = normalizedEmail
    ? existingEmployees.find(
        (e) => e.id !== Number(id) && e.email && e.email.trim().toLowerCase() === normalizedEmail
      )
    : null;

  const handleSubmit = () => {
    setError('');
    const trimmedFullName = form.full_name.trim();
    if (!trimmedFullName || !form.email || !form.date_of_joining) {
      setError('Full name, email, and Date of Joining are required.');
      return;
    }
    if (emailConflict) {
      setError(`This email is already assigned to employee ${emailConflict.employee_code} (${emailConflict.full_name}). Each employee must have a unique email address.`);
      return;
    }
    if (!/^[a-zA-Z\s.'-]+$/.test(trimmedFullName)) {
      setError('Full name must contain only letters and spaces (numbers are not allowed).');
      return;
    }
    if (form.phone && !/^\+?[0-9]{10,15}$/.test(form.phone)) {
      setError('Please enter a valid phone number (10-15 digits).');
      return;
    }
    if (form.bank_account_number && !/^\d{6,20}$/.test(form.bank_account_number)) {
      setError('Bank account number must contain only digits (6-20 digits).');
      return;
    }

    updateEmployee.mutate(
      {
        id: Number(id),
        data: {
          full_name: trimmedFullName,
          email: form.email,
          phone: form.phone || undefined,
          department: form.department || undefined,
          designation: form.designation || undefined,
          date_of_joining: form.date_of_joining,
          bank_name: form.bank_name || undefined,
          bank_account_number: form.bank_account_number || undefined,
          ifsc_code: form.ifsc_code || undefined,
          pan_number: form.pan_number || undefined,
          basic_salary: parseFloat(form.basic_salary) || 0,
          hra: parseFloat(form.hra) || 0,
          conveyance_allowance: parseFloat(form.conveyance_allowance) || 0,
          medical_allowance: parseFloat(form.medical_allowance) || 0,
          special_allowance: parseFloat(form.special_allowance) || 0,
          pf_deduction: parseFloat(form.pf_deduction) || 0,
          professional_tax: parseFloat(form.professional_tax) || 0,
          tds: parseFloat(form.tds) || 0,
          shift_start_time: shiftTimingEnabled ? (form.shift_start_time || null) : undefined,
          shift_end_time: shiftTimingEnabled ? (form.shift_end_time || null) : undefined,
          gender: form.gender || null,
        },
      },
      {
        onSuccess: () => navigate(`/employees/${id}`),
        onError: (err: unknown) => {
          const errData = (err as any)?.response?.data;
          let msg = errData?.detail;
          if (!msg && errData?.email) {
            msg = Array.isArray(errData.email) ? errData.email[0] : String(errData.email);
          }
          if (!msg && errData?.message) msg = errData.message;
          setError(msg || 'Failed to update employee.');
        },
      }
    );
  };

  if (isLoading) return <LoadingSpinner />;
  if (!emp) return <p className="text-center text-gray-500 mt-10">{t('employees.employeeNotFound', 'Employee not found.')}</p>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-6">
      <div className="flex min-w-0 items-center gap-3">
        <Link to={`/employees/${id}`} className="text-gray-500 hover:text-gray-700"><ArrowLeft className="h-5 w-5" /></Link>
        <h2 className="truncate text-xl font-bold text-gray-900 sm:text-2xl">{t('employees.editEmployee', 'Edit Employee')} — {emp.full_name}</h2>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">{error}</div>}

      <GlassCard>
        <h3 className="text-lg font-semibold mb-4">{t('employees.personalInfo', 'Personal Information')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatedInput label={`${t('employees.fullName', 'Full Name')} *`} value={form.full_name} onChange={handleChange('full_name', 'alphabets')} />
          <div>
            <AnimatedInput label={`${t('employees.email', 'Email')} *`} type="email" value={form.email} onChange={handleChange('email')} />
            {emailConflict && (
              <p className="mt-1 text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                <span>⚠️ This email is already assigned to {emailConflict.employee_code} ({emailConflict.full_name}). Each employee must have a unique email.</span>
              </p>
            )}
          </div>
          <AnimatedInput label={t('employees.phone', 'Phone')} value={form.phone} onChange={handleChange('phone', 'phone')} />
          <ThemedSelect
            label={t('employees.department', 'Department')}
            value={form.department}
            onChange={(val) => setForm((prev) => ({ ...prev, department: val }))}
            options={DEPARTMENT_OPTIONS}
            placeholder={t('employees.department', 'Select department')}
            customPlaceholder="Type custom department..."
          />
          <ThemedSelect
            label={t('employees.designation', 'Designation')}
            value={form.designation}
            onChange={(val) => setForm((prev) => ({ ...prev, designation: val }))}
            options={DESIGNATION_OPTIONS}
            placeholder={t('employees.designation', 'Select designation')}
            customPlaceholder="Type custom designation..."
          />
          <ThemedDatePicker
            label={`${t('employees.dateOfJoining', 'Date of Joining')} *`}
            value={form.date_of_joining}
            onChange={(date_of_joining) => setForm((prev) => ({ ...prev, date_of_joining }))}
            required
            placeholder="Select joining date..."
          />
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5">
              {t('employees.gender', 'Gender')}
            </label>
            <select
              value={form.gender}
              onChange={(e) => setForm((prev) => ({ ...prev, gender: e.target.value as '' | 'MALE' | 'FEMALE' }))}
              className="w-full px-4 py-2.5 rounded-xl border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white outline-none focus:border-black dark:focus:border-white transition-colors text-sm font-medium"
            >
              <option value="">{t('employees.genderNotSet', 'Not set')}</option>
              <option value="MALE">{t('employees.male', 'Male')}</option>
              <option value="FEMALE">{t('employees.female', 'Female')}</option>
            </select>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              {t('employees.genderHint', 'Optional - used to sanity-check the face captured during attendance registration.')}
            </p>
          </div>
        </div>
        {form.date_of_joining && form.date_of_joining !== emp.date_of_joining && (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            Changing the joining date updates attendance eligibility and monthly summaries. Earlier attendance stays stored but will be excluded. If affected salary slips already exist, delete those slips before saving this correction.
          </p>
        )}
      </GlassCard>

      {shiftTimingEnabled && (
        <GlassCard>
          <h3 className="text-lg font-semibold mb-1 text-neutral-900 dark:text-white">
            {t('employees.shiftTiming', 'Shift Timing')}
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
            {t('employees.shiftTimingDesc', "Optional. Leave blank to use the company's default office timing for this employee.")}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatedInput label={t('employees.shiftStartTime', 'Shift Start Time')} type="time" value={form.shift_start_time} onChange={handleChange('shift_start_time')} />
            <AnimatedInput label={t('employees.shiftEndTime', 'Shift End Time')} type="time" value={form.shift_end_time} onChange={handleChange('shift_end_time')} />
          </div>
        </GlassCard>
      )}

      <GlassCard>
        <h3 className="text-lg font-semibold mb-4">{t('employees.bankDetails', 'Bank Details')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <BankNamePicker value={form.bank_name} onChange={(bank_name) => setForm((prev) => ({ ...prev, bank_name }))} />
          <AnimatedInput label={t('employees.bankAccount', 'Account Number')} value={form.bank_account_number} onChange={handleChange('bank_account_number', 'digits')} />
          <IfscLookupField value={form.ifsc_code} bankName={form.bank_name} onChange={(ifsc_code) => setForm((prev) => ({ ...prev, ifsc_code }))} onBankSelect={(bank_name) => setForm((prev) => ({ ...prev, bank_name }))} />
          <AnimatedInput label={t('employees.pan', 'PAN Number')} value={form.pan_number} onChange={handleChange('pan_number', 'alphanumeric')} />
        </div>
      </GlassCard>

      <GlassCard>
        <h3 className="text-lg font-semibold mb-4">{t('employees.salaryDetails', 'Salary Details')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <AnimatedInput label={t('employees.basicSalary', 'Basic Salary')} type="number" value={form.basic_salary} onChange={handleChange('basic_salary', 'decimal')} />
          <AnimatedInput label={t('employees.hra', 'HRA')} type="number" value={form.hra} onChange={handleChange('hra', 'decimal')} />
          <AnimatedInput label={t('employees.conveyance', 'Conveyance Allowance')} type="number" value={form.conveyance_allowance} onChange={handleChange('conveyance_allowance', 'decimal')} />
          <AnimatedInput label={t('employees.medical', 'Medical Allowance')} type="number" value={form.medical_allowance} onChange={handleChange('medical_allowance', 'decimal')} />
          <AnimatedInput label={t('employees.specialAllowance', 'Special Allowance')} type="number" value={form.special_allowance} onChange={handleChange('special_allowance', 'decimal')} />
        </div>
        <h4 className="text-md font-medium mt-6 mb-3">{t('employees.deductions', 'Deductions')}</h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <AnimatedInput label={t('employees.pf', 'PF')} type="number" value={form.pf_deduction} onChange={handleChange('pf_deduction', 'decimal')} />
          <AnimatedInput label={t('employees.profTax', 'Professional Tax')} type="number" value={form.professional_tax} onChange={handleChange('professional_tax', 'decimal')} />
          <AnimatedInput label={t('employees.tds', 'TDS')} type="number" value={form.tds} onChange={handleChange('tds', 'decimal')} />
          <AnimatedInput label={t('employees.esi', 'ESI')} type="number" value={form.esi} onChange={handleChange('esi', 'decimal')} />
        </div>
      </GlassCard>

      {deleteError && (
        <div className="flex items-center justify-between gap-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 px-4 py-3 rounded-xl text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{deleteError}</span>
          </div>
          <button type="button" onClick={() => setDeleteError('')} className="text-rose-500 hover:text-rose-700 dark:text-rose-400 font-bold p-1 cursor-pointer">×</button>
        </div>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <GradientButton
          type="button"
          variant="danger"
          onClick={handleDeactivate}
          isLoading={deleteEmployee.isPending}
          className="w-full sm:w-auto gap-2"
        >
          <Trash2 className="h-4 w-4 shrink-0" />
          <span>{t('employees.deactivateEmployee', 'Deactivate Employee')}</span>
        </GradientButton>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:w-auto">
          <Link to={`/employees/${id}`} className="w-full sm:w-auto">
            <GradientButton variant="secondary" className="w-full sm:w-auto">{t('common.cancel', 'Cancel')}</GradientButton>
          </Link>
          <GradientButton onClick={handleSubmit} isLoading={updateEmployee.isPending} className="w-full sm:w-auto">
            {t('employees.updateEmployee', 'Update Employee')}
          </GradientButton>
        </div>
      </div>
    </motion.div>
  );
}
