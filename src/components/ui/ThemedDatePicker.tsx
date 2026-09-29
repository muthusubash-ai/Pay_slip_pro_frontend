import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ThemedDatePickerProps {
  label?: string;
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEK_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function ThemedDatePicker({
  label,
  value,
  onChange,
  error,
  required = false,
  className,
  placeholder = 'Select date...',
  disabled = false,
}: ThemedDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse initial date or default to today
  const selectedDate = value ? new Date(value + 'T00:00:00') : null;
  const initialYear = selectedDate && !isNaN(selectedDate.getTime()) ? selectedDate.getFullYear() : new Date().getFullYear();
  const initialMonth = selectedDate && !isNaN(selectedDate.getTime()) ? selectedDate.getMonth() : new Date().getMonth();

  const [viewYear, setViewYear] = useState(initialYear);
  const [viewMonth, setViewMonth] = useState(initialMonth);

  // Synchronize view when value changes from outside
  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T00:00:00');
      if (!isNaN(d.getTime())) {
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
      }
    }
  }, [value]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Calendar calculations
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0 is Sunday

  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const m = String(viewMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    const formatted = `${viewYear}-${m}-${d}`;
    onChange(formatted);
    setIsOpen(false);
  };

  const handleSetToday = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    onChange(`${y}-${m}-${d}`);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  // Format value for display (e.g. "15 Oct 2024")
  const displayFormatted = (() => {
    if (!value) return '';
    const d = new Date(value + 'T00:00:00');
    if (isNaN(d.getTime())) return value;
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  })();

  const today = new Date();
  const isToday = (day: number) =>
    today.getFullYear() === viewYear &&
    today.getMonth() === viewMonth &&
    today.getDate() === day;

  const isSelected = (day: number) => {
    if (!selectedDate || isNaN(selectedDate.getTime())) return false;
    return (
      selectedDate.getFullYear() === viewYear &&
      selectedDate.getMonth() === viewMonth &&
      selectedDate.getDate() === day
    );
  };

  // Year options list for fast switching
  const yearOptions: number[] = [];
  const currentYear = new Date().getFullYear();
  for (let y = currentYear + 5; y >= currentYear - 60; y--) {
    yearOptions.push(y);
  }

  return (
    <div className={cn("space-y-1 relative", className)} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300">
          {label}
        </label>
      )}

      {/* Styled Trigger Field */}
      <div
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={cn(
          "w-full rounded-xl border-2 px-4 py-3 cursor-pointer select-none transition-all duration-200 flex items-center justify-between gap-3 group",
          "bg-white dark:bg-neutral-900",
          error
            ? "border-red-400 dark:border-red-500"
            : isOpen
            ? "border-black dark:border-white ring-4 ring-black/5 dark:ring-white/5"
            : "border-gray-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600",
          disabled && "opacity-50 cursor-not-allowed pointer-events-none"
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0",
              isOpen || value
                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400 group-hover:bg-neutral-200 dark:group-hover:bg-neutral-700"
            )}
          >
            <CalendarIcon className="h-4 w-4" />
          </div>
          <span
            className={cn(
              "text-sm font-medium truncate",
              value ? "text-neutral-900 dark:text-white font-semibold" : "text-neutral-400 dark:text-neutral-500"
            )}
          >
            {value ? displayFormatted : placeholder}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {value && !required && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-md text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              title="Clear date"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <span className="text-[11px] px-2 py-0.5 rounded-md font-mono bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200/60 dark:border-neutral-700/60">
            {value ? 'Selected' : 'Pick Date'}
          </span>
        </div>
      </div>

      {/* Styled Date Picker Modal / Popover */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="absolute left-0 top-full mt-2 z-50 w-[310px] sm:w-[330px] rounded-2xl border-2 border-neutral-200/90 dark:border-neutral-700/90 bg-white/95 dark:bg-[#121216]/95 backdrop-blur-xl p-4 shadow-2xl shadow-black/15 text-neutral-900 dark:text-white"
          >
            {/* Calendar Header: Month, Year, and Nav Arrows */}
            <div className="flex items-center justify-between gap-1 mb-3">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors"
                title="Previous Month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-1.5">
                {/* Month Dropdown */}
                <select
                  value={viewMonth}
                  onChange={(e) => setViewMonth(Number(e.target.value))}
                  className="px-2 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-xs font-bold text-neutral-900 dark:text-white outline-none focus:border-black dark:focus:border-white cursor-pointer"
                >
                  {MONTH_NAMES.map((name, i) => (
                    <option key={name} value={i} className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white">
                      {name}
                    </option>
                  ))}
                </select>

                {/* Year Dropdown */}
                <select
                  value={viewYear}
                  onChange={(e) => setViewYear(Number(e.target.value))}
                  className="px-2 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-xs font-bold text-neutral-900 dark:text-white outline-none focus:border-black dark:focus:border-white cursor-pointer"
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y} className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white">
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors"
                title="Next Month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Day of Week Headers */}
            <div className="grid grid-cols-7 gap-1 mb-1 text-center">
              {WEEK_DAYS.map((wd) => (
                <div
                  key={wd}
                  className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 py-1"
                >
                  {wd}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1">
              {/* Previous month trailing days */}
              {Array.from({ length: firstDayOfWeek }, (_, i) => {
                const prevDay = prevMonthDays - firstDayOfWeek + i + 1;
                return (
                  <div
                    key={`prev-${i}`}
                    className="h-8 flex items-center justify-center text-xs text-neutral-300 dark:text-neutral-700 select-none pointer-events-none"
                  >
                    {prevDay}
                  </div>
                );
              })}

              {/* Current month days */}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const active = isSelected(day);
                const currentDay = isToday(day);

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleSelectDay(day)}
                    className={cn(
                      "h-8 rounded-xl text-xs font-semibold flex flex-col items-center justify-center transition-all duration-150 relative",
                      active
                        ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-bold shadow-md shadow-black/10 scale-105"
                        : currentDay
                        ? "border border-neutral-400 dark:border-neutral-500 text-neutral-900 dark:text-white font-bold hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        : "text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800/80"
                    )}
                  >
                    <span>{day}</span>
                    {currentDay && !active && (
                      <span className="w-1 h-1 rounded-full bg-emerald-500 absolute bottom-1" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Footer with Today Shortcut */}
            <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between">
              <button
                type="button"
                onClick={handleSetToday}
                className="text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-colors flex items-center gap-1.5"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                Select Today
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3 py-1 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-bold hover:opacity-90 transition-opacity"
              >
                Done
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  );
}
