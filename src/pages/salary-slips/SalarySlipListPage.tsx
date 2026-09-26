import { motion } from 'framer-motion';
import { useState } from 'react';
import { Plus, FileText, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { GlassCard } from '../../components/ui/GlassCard';
import { GradientButton } from '../../components/ui/GradientButton';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { AnimatedList } from '../../components/ui/AnimatedList';
import { useSalarySlips, useDeleteSlip } from '../../hooks/useSalarySlips';
import type { SalarySlip } from '../../types';

const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function SalarySlipListPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useSalarySlips(page);
  const deleteSlip = useDeleteSlip();

  const handleDelete = (e: React.MouseEvent, slipId: number, empName: string) => {
    e.preventDefault(); // Prevent navigating to detail page
    e.stopPropagation();
    if (window.confirm(`Delete salary slip for ${empName}? This cannot be undone.`)) {
      deleteSlip.mutate(slipId);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Salary Slips</h2>
        <Link to="/salary-slips/generate">
          <GradientButton><Plus className="h-4 w-4 mr-2" />Generate Slips</GradientButton>
        </Link>
      </div>
      <GlassCard>
        {isLoading ? (
          <LoadingSpinner />
        ) : !data?.items?.length ? (
          <EmptyState
            icon={<FileText className="h-12 w-12" />}
            title="No salary slips yet"
            description="Generate salary slips for your employees."
            action={<Link to="/salary-slips/generate"><GradientButton>Generate Slips</GradientButton></Link>}
          />
        ) : (
          <>
            <div className="max-h-[60vh] overflow-y-auto">
            <AnimatedList>
              {data.items.map((slip: SalarySlip) => (
                <Link
                  key={slip.id}
                  to={`/salary-slips/${slip.id}`}
                  className="block p-4 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{slip.employee?.full_name || `Employee #${slip.employee_id}`}</p>
                      <p className="text-sm text-gray-500">{monthNames[slip.month]} {slip.year} · {slip.employee?.employee_code || ''}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">₹{slip.net_pay.toLocaleString()}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          slip.status === 'sent' ? 'bg-green-100 text-green-700' :
                          slip.status === 'generated' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {slip.status}
                        </span>
                      </div>
                      <button
                        onClick={(e) => handleDelete(e, slip.id, slip.employee?.full_name || 'Unknown')}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete salary slip"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </Link>
              ))}
            </AnimatedList>
            </div>

            {data.pages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1 rounded-lg border border-gray-200 disabled:opacity-50">Previous</button>
                <span className="text-sm text-gray-600">Page {page} of {data.pages}</span>
                <button onClick={() => setPage((p) => Math.min(data.pages, p + 1))} disabled={page >= data.pages} className="px-3 py-1 rounded-lg border border-gray-200 disabled:opacity-50">Next</button>
              </div>
            )}
          </>
        )}
      </GlassCard>
    </motion.div>
  );
}
