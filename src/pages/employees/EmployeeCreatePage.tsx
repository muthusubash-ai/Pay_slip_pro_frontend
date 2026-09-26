import { motion } from 'framer-motion';
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GlassCard } from '../../components/ui/GlassCard';
import { AnimatedInput } from '../../components/ui/AnimatedInput';
import { GradientButton } from '../../components/ui/GradientButton';
import { ArrowLeft } from 'lucide-react';
import { useCreateEmployee } from '../../hooks/useEmployees';

export function EmployeeCreatePage() {
  const navigate = useNavigate();
  const createEmployee = useCreateEmployee();
  const [error, setError] = useState('');

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

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = () => {
    setError('');
    if (!form.employee_code || !form.full_name || !form.email || !form.date_of_joining) {
      setError('Please fill in all required fields.');
      return;
    }

    createEmployee.mutate(
      {
        employee_code: form.employee_code,
        full_name: form.full_name,
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
      <div className="flex items-center gap-3">
        <Link to="/employees" className="text-gray-500 hover:text-gray-700"><ArrowLeft className="h-5 w-5" /></Link>
        <h2 className="text-2xl font-bold text-gray-900">Add Employee</h2>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">{error}</div>
      )}

      <GlassCard>
        <h3 className="text-lg font-semibold mb-4">Personal Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatedInput label="Employee Code *" placeholder="EMP001" value={form.employee_code} onChange={handleChange('employee_code')} />
          <AnimatedInput label="Full Name *" placeholder="John Doe" value={form.full_name} onChange={handleChange('full_name')} />
          <AnimatedInput label="Email *" type="email" placeholder="john@company.com" value={form.email} onChange={handleChange('email')} />
          <AnimatedInput label="Phone" placeholder="+91 9876543210" value={form.phone} onChange={handleChange('phone')} />
          <AnimatedInput label="Department" placeholder="Engineering" value={form.department} onChange={handleChange('department')} />
          <AnimatedInput label="Designation" placeholder="Software Engineer" value={form.designation} onChange={handleChange('designation')} />
          <AnimatedInput label="Date of Joining *" type="date" value={form.date_of_joining} onChange={handleChange('date_of_joining')} />
        </div>
      </GlassCard>

      <GlassCard>
        <h3 className="text-lg font-semibold mb-4">Bank Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatedInput label="Bank Name" placeholder="State Bank of India" value={form.bank_name} onChange={handleChange('bank_name')} />
          <AnimatedInput label="Account Number" placeholder="1234567890" value={form.bank_account_number} onChange={handleChange('bank_account_number')} />
          <AnimatedInput label="IFSC Code" placeholder="SBIN0001234" value={form.ifsc_code} onChange={handleChange('ifsc_code')} />
          <AnimatedInput label="PAN Number" placeholder="ABCDE1234F" value={form.pan_number} onChange={handleChange('pan_number')} />
        </div>
      </GlassCard>

      <GlassCard>
        <h3 className="text-lg font-semibold mb-4">Salary Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <AnimatedInput label="Basic Salary *" type="number" placeholder="0.00" value={form.basic_salary} onChange={handleChange('basic_salary')} />
          <AnimatedInput label="HRA" type="number" placeholder="0.00" value={form.hra} onChange={handleChange('hra')} />
          <AnimatedInput label="Conveyance Allowance" type="number" placeholder="0.00" value={form.conveyance_allowance} onChange={handleChange('conveyance_allowance')} />
          <AnimatedInput label="Medical Allowance" type="number" placeholder="0.00" value={form.medical_allowance} onChange={handleChange('medical_allowance')} />
          <AnimatedInput label="Special Allowance" type="number" placeholder="0.00" value={form.special_allowance} onChange={handleChange('special_allowance')} />
        </div>
        <h4 className="text-md font-medium mt-6 mb-3">Deductions</h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <AnimatedInput label="PF" type="number" placeholder="0.00" value={form.pf_deduction} onChange={handleChange('pf_deduction')} />
          <AnimatedInput label="Professional Tax" type="number" placeholder="0.00" value={form.professional_tax} onChange={handleChange('professional_tax')} />
          <AnimatedInput label="TDS" type="number" placeholder="0.00" value={form.tds} onChange={handleChange('tds')} />
          <AnimatedInput label="ESI" type="number" placeholder="0.00" value={form.esi} onChange={handleChange('esi')} />
        </div>
      </GlassCard>

      <div className="flex justify-end gap-3">
        <Link to="/employees"><GradientButton variant="secondary">Cancel</GradientButton></Link>
        <GradientButton onClick={handleSubmit} isLoading={createEmployee.isPending}>
          Save Employee
        </GradientButton>
      </div>
    </motion.div>
  );
}
