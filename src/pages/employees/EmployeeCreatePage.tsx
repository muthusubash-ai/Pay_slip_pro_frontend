import { motion } from 'framer-motion';
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GlassCard } from '../../components/ui/GlassCard';
import { AnimatedInput } from '../../components/ui/AnimatedInput';
import { GradientButton } from '../../components/ui/GradientButton';
import { ArrowLeft, ChevronDown, Landmark } from 'lucide-react';
import { useCreateEmployee } from '../../hooks/useEmployees';
import { DEPARTMENT_OPTIONS, DESIGNATION_OPTIONS } from '../../lib/employeeOptions';
import { ThemedSelect } from '../../components/ui/ThemedSelect';
import { ThemedDatePicker } from '../../components/ui/ThemedDatePicker';
import { BankNamePicker } from '../../components/ui/BankNamePicker';
import { IfscLookupField } from '../../components/ui/IfscLookupField';

export function EmployeeCreatePage() {
  const navigate = useNavigate();
  const createEmployee = useCreateEmployee();
  const [error, setError] = useState('');
  const [showBankDetails, setShowBankDetails] = useState(false);

  const [form, setForm] = useState({
    employee_code: '',
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
  });

  const handleChange = (
    field: string,
    type: 'text' | 'alphabets' | 'digits' | 'phone' | 'alphanumeric' | 'decimal' = 'text'
  ) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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

  const handleSubmit = () => {
    setError('');
    const trimmedFullName = form.full_name.trim();
    if (!form.employee_code || !trimmedFullName || !form.email || !form.date_of_joining) {
      setError('Please fill in all required fields.');
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

    createEmployee.mutate(
      {
        employee_code: form.employee_code,
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
        esi: parseFloat(form.esi) || 0,
      },
      {
        onSuccess: () => navigate('/employees'),
        onError: (err: unknown) => {
          const msg =
            err && typeof err === 'object' && 'response' in err
              ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
              : undefined;
          setError(msg || 'Failed to create employee.');
        },
      }
    );
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-6">
      <div className="flex min-w-0 items-center gap-3">
        <Link to="/employees" className="text-gray-500 hover:text-gray-700 dark:text-neutral-400 dark:hover:text-white transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">Add Employee</h2>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-rose-950/40 border border-red-200 dark:border-rose-800 text-red-700 dark:text-rose-300 px-4 py-3 rounded-xl text-sm">{error}</div>
      )}

      <GlassCard>
        <h3 className="text-lg font-semibold mb-4 text-neutral-900 dark:text-white">Personal Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatedInput label="Employee Code *" placeholder="EMP001" value={form.employee_code} onChange={handleChange('employee_code', 'alphanumeric')} />
          <AnimatedInput label="Full Name *" placeholder="John Doe" value={form.full_name} onChange={handleChange('full_name', 'alphabets')} />
          <AnimatedInput label="Email *" type="email" placeholder="john@company.com" value={form.email} onChange={handleChange('email')} />
          <AnimatedInput label="Phone" placeholder="+91 9876543210" value={form.phone} onChange={handleChange('phone', 'phone')} />
          <ThemedSelect
            label="Department"
            value={form.department}
            onChange={(val) => setForm((prev) => ({ ...prev, department: val }))}
            options={DEPARTMENT_OPTIONS}
            placeholder="Select department"
            customPlaceholder="Type custom department (e.g. AI Research)..."
          />
          <ThemedSelect
            label="Designation"
            value={form.designation}
            onChange={(val) => setForm((prev) => ({ ...prev, designation: val }))}
            options={DESIGNATION_OPTIONS}
            placeholder="Select designation"
            customPlaceholder="Type custom designation (e.g. Lead Architect)..."
          />
          <ThemedDatePicker
            label="Date of Joining *"
            value={form.date_of_joining}
            onChange={(val) => setForm((prev) => ({ ...prev, date_of_joining: val }))}
            required
            placeholder="Select joining date..."
          />
        </div>
      </GlassCard>

      <GlassCard>
        <button type="button" onClick={() => setShowBankDetails((open) => !open)} className="flex w-full items-center justify-between gap-4 text-left" aria-expanded={showBankDetails}>
          <span className="flex items-center gap-3">
            <span className="rounded-lg bg-gray-100 dark:bg-neutral-800 p-2"><Landmark className="h-4 w-4 text-gray-600 dark:text-neutral-300" /></span>
            <span>
              <span className="block text-lg font-semibold text-neutral-900 dark:text-white">Bank Details</span>
              <span className="block text-xs font-normal text-gray-500 dark:text-neutral-400">Optional payment account information</span>
            </span>
          </span>
          <ChevronDown className={`h-5 w-5 shrink-0 text-gray-500 dark:text-neutral-400 transition-transform ${showBankDetails ? 'rotate-180' : ''}`} />
        </button>
        {showBankDetails && (
          <div className="mt-5 grid grid-cols-1 gap-4 border-t border-gray-100 dark:border-neutral-800 pt-5 md:grid-cols-2">
            <BankNamePicker value={form.bank_name} onChange={(bank_name) => setForm((prev) => ({ ...prev, bank_name }))} />
            <AnimatedInput label="Account Number" placeholder="1234567890" value={form.bank_account_number} onChange={handleChange('bank_account_number', 'digits')} />
            <IfscLookupField value={form.ifsc_code} bankName={form.bank_name} onChange={(ifsc_code) => setForm((prev) => ({ ...prev, ifsc_code }))} onBankSelect={(bank_name) => setForm((prev) => ({ ...prev, bank_name }))} />
            <AnimatedInput label="PAN Number" placeholder="ABCDE1234F" value={form.pan_number} onChange={handleChange('pan_number', 'alphanumeric')} />
          </div>
        )}
      </GlassCard>

      <GlassCard>
        <h3 className="text-lg font-semibold mb-4 text-neutral-900 dark:text-white">Salary Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <AnimatedInput label="Basic Salary *" type="number" placeholder="0.00" value={form.basic_salary} onChange={handleChange('basic_salary', 'decimal')} />
          <AnimatedInput label="HRA" type="number" placeholder="0.00" value={form.hra} onChange={handleChange('hra', 'decimal')} />
          <AnimatedInput label="Conveyance Allowance" type="number" placeholder="0.00" value={form.conveyance_allowance} onChange={handleChange('conveyance_allowance', 'decimal')} />
          <AnimatedInput label="Medical Allowance" type="number" placeholder="0.00" value={form.medical_allowance} onChange={handleChange('medical_allowance', 'decimal')} />
          <AnimatedInput label="Special Allowance" type="number" placeholder="0.00" value={form.special_allowance} onChange={handleChange('special_allowance', 'decimal')} />
        </div>
        <h4 className="text-md font-medium mt-6 mb-3 text-neutral-900 dark:text-white">Deductions</h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <AnimatedInput label="PF" type="number" placeholder="0.00" value={form.pf_deduction} onChange={handleChange('pf_deduction', 'decimal')} />
          <AnimatedInput label="Professional Tax" type="number" placeholder="0.00" value={form.professional_tax} onChange={handleChange('professional_tax', 'decimal')} />
          <AnimatedInput label="TDS" type="number" placeholder="0.00" value={form.tds} onChange={handleChange('tds', 'decimal')} />
          <AnimatedInput label="ESI" type="number" placeholder="0.00" value={form.esi} onChange={handleChange('esi', 'decimal')} />
        </div>
      </GlassCard>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link to="/employees" className="w-full sm:w-auto"><GradientButton variant="secondary" className="w-full sm:w-auto">Cancel</GradientButton></Link>
        <GradientButton onClick={handleSubmit} isLoading={createEmployee.isPending} className="w-full sm:w-auto">
          Save Employee
        </GradientButton>
      </div>
    </motion.div>
  );
}
