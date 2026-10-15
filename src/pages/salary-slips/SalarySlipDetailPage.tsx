import { motion } from 'framer-motion';
import { ArrowLeft, Download, Mail, Trash2 } from 'lucide-react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { GlassCard } from '../../components/ui/GlassCard';
import { GradientButton } from '../../components/ui/GradientButton';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useSalarySlip, useDownloadPdf, useEmailSlip, useDeleteSlip } from '../../hooks/useSalarySlips';
import { useTranslation } from '../../context/LanguageContext';

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between gap-4 border-b border-gray-100 dark:border-neutral-800/80 py-2.5 last:border-0">
      <span className="min-w-0 break-words text-gray-500 dark:text-neutral-400">{label}</span>
      <span className="shrink-0 text-right font-medium text-black dark:text-white">{typeof value === 'number' ? `₹${value.toLocaleString()}` : value}</span>
    </div>
  );
}

export function SalarySlipDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, getMonthName } = useTranslation();
  const { data: slip, isLoading } = useSalarySlip(Number(id));
  const downloadPdf = useDownloadPdf();
  const emailSlip = useEmailSlip();
  const deleteSlip = useDeleteSlip();
  const [emailMsg, setEmailMsg] = useState('');

  const handleDelete = () => {
    if (window.confirm(t('salary.deleteSlipConfirm', 'Delete this salary slip? This cannot be undone.'))) {
      deleteSlip.mutate(Number(id), {
        onSuccess: () => navigate('/salary-slips'),
      });
    }
  };

  const handleEmail = () => {
    setEmailMsg('');
    emailSlip.mutate(Number(id), {
      onSuccess: (res) => {
        const data = res.data as { sent: boolean; message?: string };
        if (data.sent) {
          setEmailMsg(data.message || 'Email sent successfully!');
        } else {
          setEmailMsg(data.message || 'Failed to send email. Check SMTP settings.');
        }
      },
      onError: () => setEmailMsg('Failed to send email. Check SMTP settings.'),
    });
  };

  if (isLoading) return <LoadingSpinner />;
  if (!slip) return <p className="text-center text-gray-500 dark:text-neutral-400 mt-10">{t('salary.slipNotFound', 'Salary slip not found.')}</p>;

  const monthLabel = getMonthName(slip.month) || String(slip.month);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Link to="/salary-slips" className="text-gray-500 hover:text-black dark:text-neutral-400 dark:hover:text-white transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h2 className="truncate text-xl font-bold text-black dark:text-white sm:text-2xl">
            {t('salary.title', 'Salary Slip')} — {monthLabel} {slip.year}
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-3 sm:flex">
          <GradientButton onClick={() => downloadPdf.mutate(Number(id))} isLoading={downloadPdf.isPending}>
            <Download className="h-4 w-4 mr-2" />{t('salary.downloadPdf', 'Download PDF')}
          </GradientButton>
          <GradientButton variant="secondary" onClick={handleEmail} isLoading={emailSlip.isPending}>
            <Mail className="h-4 w-4 mr-2" />{t('salary.sendEmail', 'Email')}
          </GradientButton>
          <button
            onClick={handleDelete}
            className="flex items-center justify-center gap-2 rounded-xl border-2 border-gray-300 dark:border-neutral-700 px-4 py-2 font-medium text-black dark:text-neutral-200 transition-colors hover:bg-gray-100 dark:hover:bg-neutral-800"
          >
            <Trash2 className="h-4 w-4" />{t('salary.deleteSlip', 'Delete')}
          </button>
        </div>
      </div>

      {emailMsg && (
        <div className={`px-4 py-3 rounded-xl border ${emailMsg.includes('sent to') || emailMsg.includes('successfully') ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-800 dark:text-red-300'}`}>
          {emailMsg}
        </div>
      )}

      <GlassCard className="dark:bg-neutral-900/90 dark:border-neutral-800">
        <h3 className="text-lg font-semibold mb-3 text-black dark:text-white">{t('employees.employeeDetails', 'Employee')}</h3>
        <div className="grid grid-cols-1 gap-4 mb-6 sm:grid-cols-2 md:grid-cols-4 p-4 rounded-xl bg-gray-50/70 dark:bg-neutral-950/60 border border-gray-100 dark:border-neutral-800">
          <div><p className="text-xs uppercase tracking-wider font-semibold text-gray-500 dark:text-neutral-400">{t('employees.fullName', 'Name')}</p><p className="font-semibold text-black dark:text-white mt-0.5">{slip.employee?.full_name}</p></div>
          <div><p className="text-xs uppercase tracking-wider font-semibold text-gray-500 dark:text-neutral-400">{t('employees.employeeCode', 'Code')}</p><p className="font-semibold text-black dark:text-white mt-0.5">{slip.employee?.employee_code}</p></div>
          <div><p className="text-xs uppercase tracking-wider font-semibold text-gray-500 dark:text-neutral-400">{t('employees.department', 'Department')}</p><p className="font-semibold text-black dark:text-white mt-0.5">{slip.employee?.department || '—'}</p></div>
          <div><p className="text-xs uppercase tracking-wider font-semibold text-gray-500 dark:text-neutral-400">{t('employees.dateOfJoining', 'Date of Joining')}</p><p className="font-semibold text-black dark:text-white mt-0.5">{slip.employee?.date_of_joining || '—'}</p></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 rounded-xl bg-gray-50/40 dark:bg-neutral-950/30 border border-gray-100 dark:border-neutral-800">
            <h4 className="font-semibold text-black dark:text-white mb-2 pb-2 border-b-2 border-black dark:border-neutral-700">{t('salary.earnings', 'Earnings')}</h4>
            <Row label={t('salary.basicSalary', 'Basic Salary')} value={slip.basic_salary} />
            <Row label={t('salary.hra', 'HRA')} value={slip.hra} />
            <Row label={t('salary.conveyance', 'Conveyance Allowance')} value={slip.conveyance_allowance} />
            <Row label={t('salary.medical', 'Medical Allowance')} value={slip.medical_allowance} />
            <Row label={t('salary.specialAllowance', 'Special Allowance')} value={slip.special_allowance} />
            <div className="flex justify-between py-2.5 font-bold text-black dark:text-white border-t-2 border-black dark:border-neutral-700 mt-2">
              <span>{t('salary.grossSalary', 'Gross Salary')}</span>
              <span className="text-emerald-600 dark:text-emerald-400">₹{slip.gross_salary.toLocaleString()}</span>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-gray-50/40 dark:bg-neutral-950/30 border border-gray-100 dark:border-neutral-800">
            <h4 className="font-semibold text-black dark:text-white mb-2 pb-2 border-b-2 border-gray-400 dark:border-neutral-700">{t('salary.deductions', 'Deductions')}</h4>
            <Row label={t('salary.pf', 'PF')} value={slip.pf_deduction} />
            <Row label={t('salary.profTax', 'Professional Tax')} value={slip.professional_tax} />
            <Row label={t('salary.tds', 'TDS')} value={slip.tds} />
            <Row label={t('salary.esi', 'ESI')} value={slip.esi} />
            {slip.leave_days > 0 && (
              <Row label={`${t('salary.leaveDeduction', 'Leave Deduction')} (${slip.leave_days} days)`} value={slip.leave_deduction} />
            )}
            <div className="flex justify-between py-2.5 font-bold text-black dark:text-white border-t-2 border-gray-400 dark:border-neutral-700 mt-2">
              <span>{t('salary.totalDeductions', 'Total Deductions')}</span>
              <span className="text-rose-600 dark:text-rose-400">₹{(slip.total_deductions + (slip.leave_deduction || 0)).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-1 rounded-xl bg-black dark:bg-neutral-950 border border-transparent dark:border-neutral-800 p-4 sm:flex-row sm:items-center sm:justify-between shadow-sm">
          <span className="text-lg font-bold text-white">{t('salary.netPay', 'Net Pay')}</span>
          <span className="text-2xl font-bold text-white dark:text-emerald-400">₹{slip.net_pay.toLocaleString()}</span>
        </div>
      </GlassCard>
    </motion.div>
  );
}
