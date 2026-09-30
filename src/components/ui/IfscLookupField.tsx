import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { AnimatedInput } from './AnimatedInput';
import { employeeService } from '../../services/employeeService';

interface IfscLookupFieldProps {
  value: string;
  bankName: string;
  onChange: (value: string) => void;
  onBankSelect: (value: string) => void;
}

const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export function IfscLookupField({ value, bankName, onChange, onBankSelect }: IfscLookupFieldProps) {
  const code = value.trim().toUpperCase();
  const validFormat = IFSC_PATTERN.test(code);
  const { data, isPending, isFetching, error } = useQuery({
    queryKey: ['ifsc', code],
    queryFn: () => employeeService.lookupIfsc(code).then((response) => response.data),
    enabled: validFormat,
    retry: false,
    staleTime: 60 * 60 * 1000,
  });
  const bankMatches = data?.bank.trim().toLowerCase() === bankName.trim().toLowerCase();

  return (
    <div className="min-w-0 space-y-2">
      <AnimatedInput
        label="IFSC Code"
        placeholder="SBIN0001234"
        value={value}
        maxLength={11}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11))}
      />
      {code.length === 11 && !validFormat && <p className="text-xs text-amber-700 dark:text-amber-300">IFSC format: 4 letters, 0, then 6 letters or digits.</p>}
      {validFormat && (isPending || isFetching) && <p role="status" className="text-xs text-gray-500">Finding branch details...</p>}
      {validFormat && error && (
        <p role="status" className="text-xs text-amber-700 dark:text-amber-300">
          {isAxiosError(error) && error.response?.status === 404
            ? 'No branch found for this IFSC. Please check the code.'
            : 'Branch lookup is unavailable right now. You can try again shortly.'}
        </p>
      )}
      {validFormat && data && !isFetching && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-neutral-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-white">
          <p className="font-semibold">{data.branch || 'Branch name unavailable'}</p>
          <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">{[data.bank, data.city, data.state].filter(Boolean).join(' · ')}</p>
          {data.address && <p className="mt-1 break-words text-xs text-neutral-500 dark:text-neutral-400">{data.address}</p>}
          {data.bank && !bankMatches && (
            <button type="button" onClick={() => onBankSelect(data.bank)} className="mt-2 text-xs font-semibold text-emerald-800 underline underline-offset-2 dark:text-emerald-300">
              Use {data.bank} as bank name
            </button>
          )}
        </div>
      )}
    </div>
  );
}
