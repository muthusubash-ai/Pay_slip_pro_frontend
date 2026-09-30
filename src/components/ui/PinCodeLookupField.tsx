import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { MapPin } from 'lucide-react';
import { AnimatedInput } from './AnimatedInput';
import { companyService } from '../../services/companyService';

interface PinCodeLookupFieldProps {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onSelectArea: (area: string, state: string) => void;
}

export function PinCodeLookupField({ value, disabled, onChange, onSelectArea }: PinCodeLookupFieldProps) {
  const validPin = /^\d{6}$/.test(value);
  const { data, isPending, isFetching, error } = useQuery({
    queryKey: ['pin-lookup', value],
    queryFn: () => companyService.lookupPin(value).then((response) => response.data),
    enabled: !disabled && validPin,
    retry: false,
    staleTime: 24 * 60 * 60 * 1000,
  });

  return (
    <div className="min-w-0 space-y-2">
      <AnimatedInput
        label="PIN Code"
        placeholder="600001"
        inputMode="numeric"
        maxLength={6}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
      />
      {!disabled && validPin && (isPending || isFetching) && <p role="status" className="text-xs text-gray-500">Finding PIN area...</p>}
      {!disabled && validPin && error && (
        <p role="status" className="text-xs text-amber-700 dark:text-amber-300">
          {isAxiosError(error) && error.response?.status === 404
            ? 'No area found for this PIN code. Check the number.'
            : 'PIN area lookup is unavailable right now. You can still save the address.'}
        </p>
      )}
      {!disabled && validPin && data && !isFetching && (
        <div role="status" className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-neutral-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-white">
          <p className="mb-2 font-semibold">Areas for PIN {value}</p>
          {data.places.length ? (
            <div className="flex flex-wrap gap-2">
              {data.places.map((place) => (
                <button
                  key={`${place.area}-${place.state}`}
                  type="button"
                  onClick={() => onSelectArea(place.area, place.state)}
                  className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-left text-xs hover:border-blue-500 dark:border-blue-800 dark:bg-neutral-900"
                  title="Use this area as city and state"
                >
                  <MapPin className="h-3.5 w-3.5 shrink-0" /> {place.area}, {place.state}
                </button>
              ))}
            </div>
          ) : <p className="text-xs text-neutral-600 dark:text-neutral-300">No named area was returned for this PIN.</p>}
          {data.places.length > 0 && <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">Select an area to fill City and State.</p>}
        </div>
      )}
    </div>
  );
}
