import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { salarySlipService } from '../services/salarySlipService';
import { useAuth } from '../context/AuthContext';

export function useSalarySlips(page = 1, month?: number, year?: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['salary-slips', page, month, year],
    queryFn: () => salarySlipService.list({ page, month, year }).then((r) => r.data),
    enabled: !!user,
  });
}

export function useSalarySlip(id: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['salary-slip', id],
    queryFn: () => salarySlipService.get(id).then((r) => r.data),
    enabled: !!user && !!id,
  });
}

export function useGenerateSlips() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ month, year }: { month: number; year: number }) =>
      salarySlipService.generateBulk(month, year),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['salary-slips'] }),
  });
}

export function useDownloadPdf() {
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await salarySlipService.downloadPdf(id);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      // Extract filename from Content-Disposition or X-Filename header
      const disposition = response.headers['content-disposition'] || '';
      const xFilename = response.headers['x-filename'] || '';
      let filename = `salary_slip_${id}.pdf`;
      if (xFilename) {
        filename = xFilename;
      } else {
        const match = disposition.match(/filename="?([^";\n]+)"?/);
        if (match) filename = match[1];
      }

      // Always trigger a download so the PDF is saved locally
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Also open in browser for viewing
      window.open(url, '_blank');
    },
  });
}

export function useEmailSlip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: salarySlipService.emailSlip,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['salary-slips'] }),
  });
}

export function useDeleteSlip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: salarySlipService.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['salary-slips'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}
