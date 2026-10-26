import { motion } from 'framer-motion';
import { useState } from 'react';
import { ArrowLeft, Edit, Trash2, Mail, CheckCircle2, AlertCircle, Copy, Check, ExternalLink } from 'lucide-react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { GlassCard } from '../../components/ui/GlassCard';
import { GradientButton } from '../../components/ui/GradientButton';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useEmployee, useDeleteEmployee, useSendEmployeeInvite } from '../../hooks/useEmployees';
import { useTranslation } from '../../context/LanguageContext';

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="break-words font-medium text-gray-900">{value ?? '—'}</p>
    </div>
  );
}

export function EmployeeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { data: emp, isLoading } = useEmployee(Number(id));
  const deleteEmployee = useDeleteEmployee();
  const sendInvite = useSendEmployeeInvite();
  const [inviteMsg, setInviteMsg] = useState('');
  const [inviteUrl, setInviteUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const handleDeactivate = () => {
    setDeleteError('');
    if (!confirm(t('employees.deleteConfirm', 'Are you sure you want to deactivate and remove this employee?'))) return;
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

  const handleSendInvite = () => {
    setInviteMsg('');
    setInviteError('');
    sendInvite.mutate(Number(id), {
      onSuccess: (res) => {
        setInviteMsg(res.data.detail || 'Invitation processed successfully.');
        if (res.data.invite_url) {
          setInviteUrl(res.data.invite_url);
        }
      },
      onError: (err: unknown) => {
        const msg =
          err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
            : undefined;
        setInviteError(msg || 'Failed to send invitation.');
      },
    });
  };

  if (isLoading) return <LoadingSpinner />;
  if (!emp) return <p className="text-center text-gray-500 mt-10">{t('employees.employeeNotFound', 'Employee not found.')}</p>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Link to="/employees" className="text-gray-500 hover:text-gray-700"><ArrowLeft className="h-5 w-5" /></Link>
          <h2 className="truncate text-xl font-bold text-gray-900 sm:text-2xl">{emp.full_name}</h2>
        </div>
        <div className="flex w-full flex-wrap items-center justify-center gap-2 sm:w-auto sm:justify-end">
          <GradientButton
            variant="secondary"
            className="flex-1 gap-2 sm:flex-none"
            onClick={handleSendInvite}
            isLoading={sendInvite.isPending}
            title="Send Biometric & Attendance Portal registration link to employee's email"
          >
            <Mail className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
            <span>{t('employees.sendPortalInvite', 'Send Portal Invite')}</span>
          </GradientButton>
          <Link to={`/employees/${id}/edit`} className="flex-1 sm:flex-none">
            <GradientButton className="w-full gap-2 sm:w-auto"><Edit className="h-4 w-4 shrink-0" />{t('employees.editEmployee', 'Edit Employee')}</GradientButton>
          </Link>
          <GradientButton className="flex-1 gap-2 sm:flex-none" variant="danger" onClick={handleDeactivate} isLoading={deleteEmployee.isPending}>
            <Trash2 className="h-4 w-4 shrink-0" />{t('common.deactivate', 'Deactivate')}
          </GradientButton>
        </div>
      </div>

      {deleteError && (
        <div className="flex items-center justify-between gap-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 px-4 py-3 rounded-xl text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{deleteError}</span>
          </div>
          <button type="button" onClick={() => setDeleteError('')} className="text-rose-500 hover:text-rose-700 dark:text-rose-400 font-bold p-1 cursor-pointer">×</button>
        </div>
      )}

      {inviteMsg && (
        <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 px-4 py-3 rounded-xl text-sm">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{inviteMsg}</span>
        </div>
      )}

      {inviteUrl && (
        <div className="bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 p-4 rounded-2xl space-y-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
              <span>🔗</span> Direct Biometric Registration Link
            </span>
            <span className="text-xs bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-full font-medium">
              Valid for 72 hours
            </span>
          </div>
          <p className="text-xs text-indigo-700 dark:text-indigo-300">
            Share this link directly with {emp?.full_name} via WhatsApp or chat if they didn't receive the email:
          </p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              type="text"
              readOnly
              value={inviteUrl}
              className="flex-1 text-xs font-mono bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-700/60 rounded-xl px-3 py-2.5 text-gray-800 dark:text-gray-200 select-all"
            />
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(inviteUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2500);
              }}
              className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy Link'}</span>
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Hello ${emp?.full_name}, here is your Attendance & Biometric portal setup link: ${inviteUrl}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <span>WhatsApp</span>
            </a>
            <a
              href={inviteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2.5 bg-white dark:bg-zinc-800 border border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-zinc-700 text-xs font-semibold rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer"
              title="Open Registration Page"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      )}

      {inviteError && (
        <div className="flex items-center gap-2 bg-red-50 dark:bg-rose-950/40 border border-red-200 dark:border-rose-800 text-red-700 dark:text-rose-300 px-4 py-3 rounded-xl text-sm">
          <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
          <span>{inviteError}</span>
        </div>
      )}

      <GlassCard>
        <h3 className="text-lg font-semibold mb-4">{t('employees.personalInfo', 'Personal Information')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <Field label={t('employees.employeeCode', 'Employee Code')} value={emp.employee_code} />
          <Field label={t('employees.email', 'Email')} value={emp.email} />
          <Field label={t('employees.phone', 'Phone')} value={emp.phone} />
          <Field label={t('employees.department', 'Department')} value={emp.department} />
          <Field label={t('employees.designation', 'Designation')} value={emp.designation} />
          <Field label={t('employees.dateOfJoining', 'Date of Joining')} value={emp.date_of_joining} />
        </div>
      </GlassCard>

      <GlassCard>
        <h3 className="text-lg font-semibold mb-4">{t('employees.bankDetails', 'Bank Details')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <Field label={t('employees.bankName', 'Bank Name')} value={emp.bank_name} />
          <Field label={t('employees.bankAccount', 'Account Number')} value={emp.bank_account_number} />
          <Field label={t('employees.ifsc', 'IFSC Code')} value={emp.ifsc_code} />
          <Field label={t('employees.pan', 'PAN Number')} value={emp.pan_number} />
        </div>
      </GlassCard>

      <GlassCard>
        <h3 className="text-lg font-semibold mb-4">{t('employees.salaryDetails', 'Salary Details')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <Field label={t('employees.basicSalary', 'Basic Salary')} value={`₹${emp.basic_salary.toLocaleString()}`} />
          <Field label={t('employees.hra', 'HRA')} value={`₹${emp.hra.toLocaleString()}`} />
          <Field label={t('employees.conveyance', 'Conveyance')} value={`₹${emp.conveyance_allowance.toLocaleString()}`} />
          <Field label={t('employees.medical', 'Medical')} value={`₹${emp.medical_allowance.toLocaleString()}`} />
          <Field label={t('employees.specialAllowance', 'Special Allowance')} value={`₹${emp.special_allowance.toLocaleString()}`} />
        </div>
        <h4 className="text-md font-medium mt-6 mb-3">{t('employees.deductions', 'Deductions')}</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <Field label={t('employees.pf', 'PF')} value={`₹${emp.pf_deduction.toLocaleString()}`} />
          <Field label={t('employees.profTax', 'Professional Tax')} value={`₹${emp.professional_tax.toLocaleString()}`} />
          <Field label={t('employees.tds', 'TDS')} value={`₹${emp.tds.toLocaleString()}`} />
          <Field label={t('employees.esi', 'ESI')} value={`₹${emp.esi.toLocaleString()}`} />
        </div>
      </GlassCard>
    </motion.div>
  );
}
