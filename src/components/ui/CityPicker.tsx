import { useEffect, useId, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown } from 'lucide-react';
import { CITY_SEARCH_ALIASES } from '../../lib/indianLocations';
import { companyService } from '../../services/companyService';

interface CityPickerProps {
  value: string;
  state: string;
  options: string[];
  disabled: boolean;
  onChange: (value: string) => void;
}

export function CityPicker({ value, state, options, disabled, onChange }: CityPickerProps) {
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const search = value.trim().toLowerCase();
  const matches = options.filter((city) => showAll || city.toLowerCase().includes(search) || CITY_SEARCH_ALIASES[city]?.some((alias) => alias.includes(search)));
  const { data: remoteCities, isFetching, isError } = useQuery({
    queryKey: ['city-suggestions', state, searchTerm],
    queryFn: () => companyService.suggestCities(searchTerm, state).then((response) => response.data.items),
    enabled: !disabled && !showAll && searchTerm.length >= 2,
    retry: false,
    staleTime: 12 * 60 * 60 * 1000,
  });
  const choices = [...matches];
  if (!showAll) {
    for (const city of remoteCities || []) {
      if (!choices.some((choice) => choice.toLowerCase() === city.toLowerCase())) choices.push(city);
    }
    if (!choices.length && value.trim() && !isFetching) choices.push(value.trim());
  }

  const choose = (city: string) => {
    onChange(city);
    setOpen(false);
    setShowAll(false);
    setActiveIndex(0);
    setSearchTerm('');
  };

  return (
    <div className="relative min-w-0 space-y-1">
      <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 dark:text-neutral-300">City</label>
      <div className="relative">
        <input
          id={inputId}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={`${inputId}-options`}
          aria-activedescendant={open && choices[activeIndex] ? `${inputId}-option-${activeIndex}` : undefined}
          autoComplete="off"
          value={value}
          disabled={disabled}
          placeholder={disabled ? 'Select a state first' : 'Search or select city'}
          onChange={(event) => {
            const next = event.target.value;
            onChange(next);
            setOpen(true);
            setShowAll(false);
            setActiveIndex(0);
            setSearchTerm('');
            window.clearTimeout(timer.current);
            if (next.trim().length >= 2) timer.current = window.setTimeout(() => setSearchTerm(next.trim()), 400);
          }}
          onFocus={() => { if (!disabled) { setOpen(true); setShowAll(true); } }}
          onBlur={() => window.setTimeout(() => setOpen(false), 100)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((index) => choices.length ? Math.min(index + 1, choices.length - 1) : 0);
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveIndex((index) => Math.max(index - 1, 0));
            } else if (event.key === 'Enter' && open && choices.length) {
              event.preventDefault();
              choose(choices[activeIndex]);
            } else if (event.key === 'Escape') {
              setOpen(false);
            }
          }}
          className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 pr-11 text-neutral-900 outline-none focus:border-black disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:focus:border-white"
        />
        <button type="button" aria-label="Show cities" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => { setOpen((current) => !current); setShowAll(true); setActiveIndex(0); }} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-gray-500 disabled:opacity-50">
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
      {open && !disabled && (
        <div id={`${inputId}-options`} role="listbox" className="absolute z-40 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          {!showAll && isFetching && <p className="px-3 py-2 text-xs text-gray-500">Searching more cities...</p>}
          {!showAll && isError && <p className="px-3 py-2 text-xs text-amber-700 dark:text-amber-300">Live city search unavailable. You can still type a city.</p>}
          {choices.length ? choices.map((city, index) => (
            <button
              key={city}
              id={`${inputId}-option-${index}`}
              type="button"
              role="option"
              aria-selected={city === value}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(city)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-neutral-800 dark:text-neutral-100 ${index === activeIndex ? 'bg-gray-100 dark:bg-neutral-800' : 'hover:bg-gray-50 dark:hover:bg-neutral-800'}`}
            >
              <span>{city}</span>{city === value && <Check className="h-4 w-4 shrink-0" />}
            </button>
          )) : <p className="px-3 py-2 text-sm text-gray-500">Type a city name to search.</p>}
        </div>
      )}
      {!disabled && <p className="text-xs text-neutral-500 dark:text-neutral-400">Choose a city or type another city.</p>}
    </div>
  );
}
