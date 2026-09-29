import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { GlassCard } from '../../components/ui/GlassCard';
import { AnimatedInput } from '../../components/ui/AnimatedInput';
import { GradientButton } from '../../components/ui/GradientButton';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useEmployee, useUpdateEmployee } from '../../hooks/useEmployees';

export function EmployeeEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: emp, isLoading } = useEmployee(Number(id));
  const updateEmployee = useUpdateEmployee();
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    department: '',
    designation: '',
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

  useEffect(() => {
    if (emp) {
      setForm({
        full_name: emp.full_name,
        email: emp.email,
        phone: emp.phone || '',
        department: emp.department || '',
        designation: emp.designation || '',
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

  const handleSubmit = () => {
    setError('');
    const trimmedFullName = form.full_name.trim();
    if (!trimmedFullName || !form.email) {
      setError('Full name and email are required.');
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
      },
      {
        onSuccess: () => navigate(`/employees/${id}`),
        onError: (err: unknown) => {
          const msg =
            err && typeof err === 'object' && 'response' in err
              ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
              : undefined;
          setError(msg || 'Failed to update employee.');
        },
      }
    );
  };

  if (isLoading) return <LoadingSpinner />;
  if (!emp) return <p className="text-center text-gray-500 mt-10">Employee not found.</p>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-6">
      <div className="flex min-w-0 items-center gap-3">
        <Link to={`/employees/${id}`} className="text-gray-500 hover:text-gray-700"><ArrowLeft className="h-5 w-5" /></Link>
        <h2 className="truncate text-xl font-bold text-gray-900 sm:text-2xl">Edit {emp.full_name}</h2>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">{error}</div>}

      <GlassCard>
        <h3 className="text-lg font-semibold mb-4">Personal Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatedInput label="Full Name *" value={form.full_name} onChange={handleChange('full_name', 'alphabets')} />
          <AnimatedInput label="Email *" type="email" value={form.email} onChange={handleChange('email')} />
          <AnimatedInput label="Phone" value={form.phone} onChange={handleChange('phone', 'phone')} />
          <AnimatedInput label="Department" value={form.department} onChange={handleChange('department')} />
          <AnimatedInput label="Designation" value={form.designation} onChange={handleChange('designation')} />
        </div>
      </GlassCard>

      <GlassCard>
        <h3 className="text-lg font-semibold mb-4">Bank Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatedInput label="Bank Name" value={form.bank_name} onChange={handleChange('bank_name', 'alphabets')} />
          <AnimatedInput label="Account Number" value={form.bank_account_number} onChange={handleChange('bank_account_number', 'digits')} />
          <AnimatedInput label="IFSC Code" value={form.ifsc_code} onChange={handleChange('ifsc_code', 'alphanumeric')} />
          <AnimatedInput label="PAN Number" value={form.pan_number} onChange={handleChange('pan_number', 'alphanumeric')} />
        </div>
      </GlassCard>

      <GlassCard>
        <h3 className="text-lg font-semibold mb-4">Salary Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <AnimatedInput label="Basic Salary" type="number" value={form.basic_salary} onChange={handleChange('basic_salary', 'decimal')} />
          <AnimatedInput label="HRA" type="number" value={form.hra} onChange={handleChange('hra', 'decimal')} />
          <AnimatedInput label="Conveyance Allowance" type="number" value={form.conveyance_allowance} onChange={handleChange('conveyance_allowance', 'decimal')} />
          <AnimatedInput label="Medical Allowance" type="number" value={form.medical_allowance} onChange={handleChange('medical_allowance', 'decimal')} />
          <AnimatedInput label="Special Allowance" type="number" value={form.special_allowance} onChange={handleChange('special_allowance', 'decimal')} />
        </div>
        <h4 className="text-md font-medium mt-6 mb-3">Deductions</h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <AnimatedInput label="PF" type="number" value={form.pf_deduction} onChange={handleChange('pf_deduction', 'decimal')} />
          <AnimatedInput label="Professional Tax" type="number" value={form.professional_tax} onChange={handleChange('professional_tax', 'decimal')} />
          <AnimatedInput label="TDS" type="number" value={form.tds} onChange={handleChange('tds', 'decimal')} />
          <AnimatedInput label="ESI" type="number" value={form.esi} onChange={handleChange('esi', 'decimal')} />
        </div>
      </GlassCard>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link to={`/employees/${id}`} className="w-full sm:w-auto"><GradientButton variant="secondary" className="w-full sm:w-auto">Cancel</GradientButton></Link>
        <GradientButton onClick={handleSubmit} isLoading={updateEmployee.isPending} className="w-full sm:w-auto">Update Employee</GradientButton>
      </div>
    </motion.div>
  );
}
