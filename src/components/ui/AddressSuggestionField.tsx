import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapPin } from 'lucide-react';
import { companyService, type AddressSuggestion } from '../../services/companyService';

interface AddressSuggestionFieldProps {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onSelect: (suggestion: AddressSuggestion) => void;
}

export function AddressSuggestionField({ value, disabled, onChange, onSelect }: AddressSuggestionFieldProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [open, setOpen] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const { data, isFetching, isError } = useQuery({
    queryKey: ['address-suggestions', searchTerm],
    queryFn: () => companyService.suggestAddresses(searchTerm).then((response) => response.data.items),
    enabled: !disabled && searchTerm.trim().length >= 4,
    retry: false,
    staleTime: 60 * 60 * 1000,
  });

  return (
    <div className="relative min-w-0 space-y-1 md:col-span-2">
      <label htmlFor="company-address" className="block text-sm font-medium text-gray-700 dark:text-neutral-300">Address</label>
      <input
        id="company-address"
        value={value}
        disabled={disabled}
        autoComplete="off"
        placeholder="Start typing street, building or area"
        onChange={(event) => {
          const next = event.target.value;
          onChange(next);
          setOpen(true);
          setSearchTerm('');
          window.clearTimeout(timer.current);
          if (next.trim().length >= 4) {
            timer.current = window.setTimeout(() => setSearchTerm(next.trim()), 450);
          }
        }}
        onFocus={() => {
          if (!disabled && value.trim().length >= 4) {
            setSearchTerm(value.trim());
            setOpen(true);
          }
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-neutral-900 outline-none transition-colors focus:border-black disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:focus:border-white"
      />
      {open && !disabled && searchTerm.length >= 4 && (
        <div role="listbox" aria-label="Address suggestions" className="absolute z-40 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          {isFetching && <p className="px-3 py-2 text-xs text-gray-500">Finding addresses...</p>}
          {isError && <p className="px-3 py-2 text-xs text-amber-700 dark:text-amber-300">Suggestions unavailable. You can enter the address manually.</p>}
          {!isFetching && !isError && !data?.length && <p className="px-3 py-2 text-xs text-gray-500">No match found. You can enter the address manually.</p>}
          {!isFetching && data?.map((suggestion) => (
            <button
              key={suggestion.label}
              type="button"
              role="option"
              aria-selected={false}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => { onSelect(suggestion); setOpen(false); setSearchTerm(''); }}
              className="flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm text-neutral-800 hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-800"
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
              <span className="break-words">{suggestion.label}</span>
            </button>
          ))}
        </div>
      )}
      <p className="text-xs text-neutral-500 dark:text-neutral-400">Suggestions are optional; you can enter your full street address.</p>
    </div>
  );
}
