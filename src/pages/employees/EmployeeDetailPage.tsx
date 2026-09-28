import { motion } from 'framer-motion';
import { ArrowLeft, Edit, Trash2 } from 'lucide-react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { GlassCard } from '../../components/ui/GlassCard';
import { GradientButton } from '../../components/ui/GradientButton';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useEmployee, useDeleteEmployee } from '../../hooks/useEmployees';

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="font-medium text-gray-900">{value ?? '—'}</p>
    </div>
  );
}

export function EmployeeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: emp, isLoading } = useEmployee(Number(id));
  const deleteEmployee = useDeleteEmployee();

  const handleDeactivate = () => {
    if (!confirm('Are you sure you want to deactivate this employee?')) return;
    deleteEmployee.mutate(Number(id), {
      onSuccess: () => navigate('/employees'),
    });
  };

  if (isLoading) return <LoadingSpinner />;
  if (!emp) return <p className="text-center text-gray-500 mt-10">Employee not found.</p>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Link to="/employees" className="text-gray-500 hover:text-gray-700"><ArrowLeft className="h-5 w-5" /></Link>
          <h2 className="truncate text-xl font-bold text-gray-900 sm:text-2xl">{emp.full_name}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/employees/${id}/edit`}><GradientButton><Edit className="h-4 w-4 mr-2" />Edit</GradientButton></Link>
          <GradientButton variant="danger" onClick={handleDeactivate} isLoading={deleteEmployee.isPending}>
            <Trash2 className="h-4 w-4 mr-2" />Deactivate
          </GradientButton>
        </div>
      </div>

      <GlassCard>
        <h3 className="text-lg font-semibold mb-4">Personal Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="Employee Code" value={emp.employee_code} />
          <Field label="Email" value={emp.email} />
          <Field label="Phone" value={emp.phone} />
          <Field label="Department" value={emp.department} />
          <Field label="Designation" value={emp.designation} />
          <Field label="Date of Joining" value={emp.date_of_joining} />
        </div>
      </GlassCard>

      <GlassCard>
        <h3 className="text-lg font-semibold mb-4">Bank Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="Bank Name" value={emp.bank_name} />
          <Field label="Account Number" value={emp.bank_account_number} />
          <Field label="IFSC Code" value={emp.ifsc_code} />
          <Field label="PAN Number" value={emp.pan_number} />
        </div>
      </GlassCard>

      <GlassCard>
        <h3 className="text-lg font-semibold mb-4">Salary Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="Basic Salary" value={`₹${emp.basic_salary.toLocaleString()}`} />
          <Field label="HRA" value={`₹${emp.hra.toLocaleString()}`} />
          <Field label="Conveyance" value={`₹${emp.conveyance_allowance.toLocaleString()}`} />
          <Field label="Medical" value={`₹${emp.medical_allowance.toLocaleString()}`} />
          <Field label="Special Allowance" value={`₹${emp.special_allowance.toLocaleString()}`} />
        </div>
        <h4 className="text-md font-medium mt-6 mb-3">Deductions</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <Field label="PF" value={`₹${emp.pf_deduction.toLocaleString()}`} />
          <Field label="Professional Tax" value={`₹${emp.professional_tax.toLocaleString()}`} />
          <Field label="TDS" value={`₹${emp.tds.toLocaleString()}`} />
          <Field label="ESI" value={`₹${emp.esi.toLocaleString()}`} />
        </div>
      </GlassCard>
    </motion.div>
  );
}
