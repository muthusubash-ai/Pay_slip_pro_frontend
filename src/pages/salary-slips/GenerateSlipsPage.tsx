import { motion } from 'framer-motion';
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { GlassCard } from '../../components/ui/GlassCard';
import { GradientButton } from '../../components/ui/GradientButton';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useGenerateSlips } from '../../hooks/useSalarySlips';
import { useEmployees } from '../../hooks/useEmployees';
import { salarySlipService } from '../../services/salarySlipService';
import type { Employee } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { hasMinimumPlan } from '../../lib/plans';

export function GenerateSlipsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canGenerateBulk = hasMinimumPlan(user, 'professional');
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [generating, setGenerating] = useState(false);
  const generateSlips = useGenerateSlips();
  const { data: empData, isLoading: empLoading } = useEmployees(1, undefined, undefined);

  const employees: Employee[] = empData?.items || [];

  const handleGenerate = async () => {
    setError('');
    setSuccess('');

    if (!selectedEmployee && !canGenerateBulk) {
      setError('Select an employee to generate a salary slip. Bulk generation is available on the Professional plan or higher.');
      return;
    }

    if (selectedEmployee) {
      // Generate for single employee
      setGenerating(true);
      try {
        await salarySlipService.generateSingle(Number(selectedEmployee), month, year);
        const emp = employees.find(e => e.id === Number(selectedEmployee));
        setSuccess(`Generated salary slip for ${emp?.full_name || 'employee'} — ${new Date(2000, month - 1).toLocaleString('default', { month: 'long' })} ${year}.`);
        setTimeout(() => navigate('/salary-slips'), 1500);
      } catch (err: unknown) {
        const msg =
          err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
            : undefined;
        setError(msg || 'Failed to generate salary slip.');
      } finally {
        setGenerating(false);
      }
    } else {
      // Generate for all employees
      generateSlips.mutate(
        { month, year },
        {
          onSuccess: (res) => {
            const count = res.data?.generated ?? 0;
            if (count > 0) {
              setSuccess(`Generated ${count} salary slip${count !== 1 ? 's' : ''} for ${new Date(2000, month - 1).toLocaleString('default', { month: 'long' })} ${year}.`);
              setTimeout(() => navigate('/salary-slips'), 1500);
            } else {
              setSuccess('No new slips to generate. All employees already have slips for this period.');
            }
          },
          onError: (err: unknown) => {
            const msg =
              err && typeof err === 'object' && 'response' in err
                ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
                : undefined;
            setError(msg || 'Failed to generate salary slips.');
          },
        }
      );
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-6">
      <div className="flex min-w-0 items-center gap-3">
        <Link to="/salary-slips" className="text-gray-500 hover:text-gray-700"><ArrowLeft className="h-5 w-5" /></Link>
        <h2 className="truncate text-xl font-bold text-gray-900 sm:text-2xl">Generate Salary Slips</h2>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl">{success}</div>}

      <GlassCard>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
            {empLoading ? <LoadingSpinner /> : (
              <select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-black outline-none"
              >
                {canGenerateBulk && <option value="">All Employees</option>}
                {!canGenerateBulk && <option value="">Select an employee</option>}
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} ({emp.employee_code})
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-black outline-none"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString('default', { month: 'long' })}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-black outline-none"
            >
              {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
        {/* Show selected employee details including Date of Joining */}
        {selectedEmployee && (() => {
          const emp = employees.find(e => e.id === Number(selectedEmployee));
          return emp ? (
            <div className="mb-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
              <p className="font-medium text-black">{emp.full_name} ({emp.employee_code})</p>
              <p className="text-sm text-gray-700">
                {emp.department || 'No department'} · {emp.designation || 'No designation'}
              </p>
              <p className="text-sm text-gray-600">Date of Joining: {emp.date_of_joining || '—'}</p>
            </div>
          ) : null;
        })()}
        <p className="text-gray-500 mb-4">
          {selectedEmployee
            ? 'Generate salary slip for the selected employee (includes Date of Joining).'
            : canGenerateBulk
              ? 'Generate salary slips for all active employees (Date of Joining excluded).'
              : 'Select one employee to generate a monthly salary slip on the Starter plan.'}
        </p>
        <GradientButton className="w-full" onClick={handleGenerate} isLoading={generateSlips.isPending || generating}>
          {selectedEmployee ? 'Generate Salary Slip' : canGenerateBulk ? 'Generate All Salary Slips' : 'Select an Employee'}
        </GradientButton>
      </GlassCard>
    </motion.div>
  );
}
