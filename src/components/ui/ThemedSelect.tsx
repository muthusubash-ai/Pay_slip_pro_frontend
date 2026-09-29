import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Sparkles, RotateCcw } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ThemedSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[] | string[];
  placeholder?: string;
  customPlaceholder?: string;
  error?: string;
  className?: string;
}

export function ThemedSelect({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  customPlaceholder = 'Type custom name...',
  error,
  className,
}: ThemedSelectProps) {
  // Determine if current value is custom (not in standard options, but has a value)
  const isPreset = options.includes(value);
  const [isCustomMode, setIsCustomMode] = useState<boolean>(!isPreset && value !== '');
  const [customText, setCustomText] = useState<string>(!isPreset ? value : '');

  // Synchronize when value changes externally
  useEffect(() => {
    if (!options.includes(value) && value !== '') {
      setIsCustomMode(true);
      setCustomText(value);
    } else if (options.includes(value)) {
      setIsCustomMode(false);
      setCustomText('');
    }
  }, [value, options]);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    if (selected === '__custom__') {
      setIsCustomMode(true);
      setCustomText('');
      onChange('');
    } else {
      setIsCustomMode(false);
      onChange(selected);
    }
  };

  const handleCustomTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setCustomText(text);
    onChange(text);
  };

  const handleSwitchToList = () => {
    setIsCustomMode(false);
    setCustomText('');
    onChange('');
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between">
        {label && (
          <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300">
            {label}
          </label>
        )}
        {isCustomMode && (
          <button
            type="button"
            onClick={handleSwitchToList}
            className="text-xs font-semibold text-neutral-500 hover:text-black dark:text-neutral-400 dark:hover:text-white flex items-center gap-1 transition-colors"
          >
            <RotateCcw className="h-3 w-3" /> Select from list
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {!isCustomMode ? (
          <motion.div
            key="select-mode"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="relative"
          >
            <select
              value={value}
              onChange={handleSelectChange}
              className={cn(
                "w-full appearance-none rounded-xl border-2 px-4 py-3 pr-10 outline-none transition-all duration-200 text-sm font-medium cursor-pointer",
                "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white",
                error
                  ? "border-red-400 dark:border-red-500"
                  : "border-gray-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 focus:border-black dark:focus:border-white focus:ring-4 focus:ring-black/5 dark:focus:ring-white/5"
              )}
            >
              <option value="" className="bg-white dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400">
                {placeholder}
              </option>
              {options.map((opt) => (
                <option key={opt} value={opt} className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white">
                  {opt}
                </option>
              ))}
              <option
                value="__custom__"
                className="bg-neutral-100 dark:bg-neutral-800 font-bold text-neutral-900 dark:text-white"
              >
                ✨ + Custom (Add manually)...
              </option>
            </select>

            <ChevronDown className="h-4 w-4 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" />
          </motion.div>
        ) : (
          <motion.div
            key="custom-mode"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="space-y-1.5"
          >
            <div className="relative flex items-center">
              <input
                type="text"
                autoFocus
                value={customText}
                onChange={handleCustomTextChange}
                placeholder={customPlaceholder}
                className={cn(
                  "w-full rounded-xl border-2 px-4 py-3 pr-24 outline-none transition-all duration-200 text-sm font-semibold",
                  "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white",
                  error
                    ? "border-red-400 dark:border-red-500"
                    : "border-black dark:border-white ring-4 ring-black/5 dark:ring-white/5"
                )}
              />
              <div className="absolute right-2.5 flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200/80 dark:border-neutral-700/80">
                  <Sparkles className="h-3 w-3 text-amber-500" /> Custom
                </span>
              </div>
            </div>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              Type your custom title above or click &ldquo;Select from list&rdquo; to pick a standard option.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {error && <p className="text-red-500 text-sm">{error}</p>}
    </div>
  );
}
