import { motion } from 'framer-motion';
import { ArrowLeft, Download, Mail, Trash2 } from 'lucide-react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { GlassCard } from '../../components/ui/GlassCard';
import { GradientButton } from '../../components/ui/GradientButton';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useSalarySlip, useDownloadPdf, useEmailSlip, useDeleteSlip } from '../../hooks/useSalarySlips';

const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-black">{typeof value === 'number' ? `₹${value.toLocaleString()}` : value}</span>
    </div>
  );
}

export function SalarySlipDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: slip, isLoading } = useSalarySlip(Number(id));
  const downloadPdf = useDownloadPdf();
  const emailSlip = useEmailSlip();
  const deleteSlip = useDeleteSlip();
  const [emailMsg, setEmailMsg] = useState('');

  const handleDelete = () => {
    if (window.confirm('Delete this salary slip? This cannot be undone.')) {
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
  if (!slip) return <p className="text-center text-gray-500 mt-10">Salary slip not found.</p>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Link to="/salary-slips" className="text-gray-500 hover:text-black"><ArrowLeft className="h-5 w-5" /></Link>
          <h2 className="truncate text-xl font-bold text-black sm:text-2xl">
            Salary Slip — {monthNames[slip.month]} {slip.year}
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-2 xs:grid-cols-3 sm:flex">
          <GradientButton onClick={() => downloadPdf.mutate(Number(id))} isLoading={downloadPdf.isPending}>
            <Download className="h-4 w-4 mr-2" />Download PDF
          </GradientButton>
          <GradientButton variant="secondary" onClick={handleEmail} isLoading={emailSlip.isPending}>
            <Mail className="h-4 w-4 mr-2" />Email
          </GradientButton>
          <button
            onClick={handleDelete}
            className="px-4 py-2 rounded-xl border-2 border-gray-300 text-black hover:bg-gray-100 transition-colors flex items-center gap-2 font-medium"
          >
            <Trash2 className="h-4 w-4" />Delete
          </button>
        </div>
      </div>

      {emailMsg && (
        <div className={`px-4 py-3 rounded-xl border ${emailMsg.includes('sent to') ? 'bg-gray-50 border-gray-300 text-black' : 'bg-gray-50 border-gray-300 text-black'}`}>
          {emailMsg}
        </div>
      )}

      <GlassCard>
        <h3 className="text-lg font-semibold mb-2">Employee</h3>
        <div className="grid grid-cols-1 gap-4 mb-6 sm:grid-cols-2 md:grid-cols-4">
          <div><p className="text-sm text-gray-500">Name</p><p className="font-medium text-black">{slip.employee?.full_name}</p></div>
          <div><p className="text-sm text-gray-500">Code</p><p className="font-medium text-black">{slip.employee?.employee_code}</p></div>
          <div><p className="text-sm text-gray-500">Department</p><p className="font-medium text-black">{slip.employee?.department || '—'}</p></div>
          <div><p className="text-sm text-gray-500">Date of Joining</p><p className="font-medium text-black">{slip.employee?.date_of_joining || '—'}</p></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold text-black mb-2 pb-2 border-b-2 border-black">Earnings</h4>
            <Row label="Basic Salary" value={slip.basic_salary} />
            <Row label="HRA" value={slip.hra} />
            <Row label="Conveyance Allowance" value={slip.conveyance_allowance} />
            <Row label="Medical Allowance" value={slip.medical_allowance} />
            <Row label="Special Allowance" value={slip.special_allowance} />
            <div className="flex justify-between py-2 font-bold text-black border-t-2 border-black mt-1">
              <span>Gross Salary</span>
              <span>₹{slip.gross_salary.toLocaleString()}</span>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-black mb-2 pb-2 border-b-2 border-gray-400">Deductions</h4>
            <Row label="PF" value={slip.pf_deduction} />
            <Row label="Professional Tax" value={slip.professional_tax} />
            <Row label="TDS" value={slip.tds} />
            <Row label="ESI" value={slip.esi} />
            {slip.leave_days > 0 && (
              <Row label={`Leave Deduction (${slip.leave_days} days)`} value={slip.leave_deduction} />
            )}
            <div className="flex justify-between py-2 font-bold text-black border-t-2 border-gray-400 mt-1">
              <span>Total Deductions</span>
              <span>₹{(slip.total_deductions + (slip.leave_deduction || 0)).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-1 rounded-xl bg-black p-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-lg font-bold text-white">Net Pay</span>
          <span className="text-2xl font-bold text-white">₹{slip.net_pay.toLocaleString()}</span>
        </div>
      </GlassCard>
    </motion.div>
  );
}
