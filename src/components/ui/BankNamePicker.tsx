import { useId, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { BANK_OPTIONS, BANK_SEARCH_ALIASES } from '../../lib/banks';

interface BankNamePickerProps {
  value: string;
  onChange: (value: string) => void;
}

export function BankNamePicker({ value, onChange }: BankNamePickerProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const normalizedQuery = value.trim().toLowerCase();
  const matches = BANK_OPTIONS.filter((bank) =>
    showAll || bank.toLowerCase().includes(normalizedQuery) ||
    BANK_SEARCH_ALIASES[bank]?.some((alias) => alias.includes(normalizedQuery))
  );
  const options = matches.length ? matches : value.trim() ? [value.trim()] : [];

  const choose = (bank: string) => {
    onChange(bank);
    setOpen(false);
    setShowAll(false);
    setActiveIndex(0);
  };

  return (
    <div className="relative min-w-0 space-y-1">
      <label htmlFor={listId} className="block text-sm font-medium text-gray-700 dark:text-neutral-300">Bank Name</label>
      <div className="relative">
        <input
          id={listId}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={`${listId}-options`}
          aria-activedescendant={open && options[activeIndex] ? `${listId}-option-${activeIndex}` : undefined}
          autoComplete="off"
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
            setShowAll(false);
            setActiveIndex(0);
          }}
          onFocus={() => { setOpen(true); setShowAll(true); }}
          onBlur={() => window.setTimeout(() => setOpen(false), 100)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((index) => options.length ? Math.min(index + 1, options.length - 1) : 0);
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveIndex((index) => Math.max(index - 1, 0));
            } else if (event.key === 'Enter' && open && options.length) {
              event.preventDefault();
              choose(options[activeIndex]);
            } else if (event.key === 'Escape') {
              setOpen(false);
            }
          }}
          placeholder="Search or select bank"
          className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 pr-11 text-neutral-900 outline-none transition-colors focus:border-black dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:focus:border-white"
        />
        <button type="button" aria-label="Show banks" onMouseDown={(event) => event.preventDefault()} onClick={() => { setOpen((current) => !current); setShowAll(true); setActiveIndex(0); }} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-gray-500">
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
      {open && (
        <div id={`${listId}-options`} role="listbox" className="absolute z-40 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          {options.length ? options.map((bank, index) => (
            <button
              id={`${listId}-option-${index}`}
              key={bank}
              type="button"
              role="option"
              aria-selected={value === bank}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(bank)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-neutral-800 dark:text-neutral-100 ${index === activeIndex ? 'bg-gray-100 dark:bg-neutral-800' : 'hover:bg-gray-50 dark:hover:bg-neutral-800'}`}
            >
              <span>{bank}</span>{value === bank && <Check className="h-4 w-4 shrink-0" />}
            </button>
          )) : <p className="px-3 py-2 text-sm text-gray-500">Type a bank name to search.</p>}
        </div>
      )}
    </div>
  );
}
