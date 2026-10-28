import { useState, useRef, useEffect } from 'react';
import { Building2, ChevronDown, Check, Users, Search, Shield, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAdminCompany } from '../../context/AdminCompanyContext';
import { cn } from '../../lib/utils';

interface AdminCompanySwitcherProps {
  variant?: 'header' | 'banner';
  className?: string;
}

export function AdminCompanySwitcher({ variant = 'header', className }: AdminCompanySwitcherProps) {
  const {
    isAdmin,
    companies,
    selectedCompanyUserId,
    selectedCompany,
    isLoadingCompanies,
    setSelectedCompanyUserId,
    refetchCompanies,
  } = useAdminCompany();

  const [isOpen, setIsOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!isAdmin) return null;

  const filteredCompanies = companies.filter((c) => {
    const q = filterQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      c.company_name.toLowerCase().includes(q) ||
      c.user_name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q)
    );
  });

  const handleSelect = (userId: number) => {
    setSelectedCompanyUserId(userId);
    setIsOpen(false);
    setFilterQuery('');
  };

  // -------------------------------------------------------------
  // Compact Variant (Used inside Header)
  // -------------------------------------------------------------
  if (variant === 'header') {
    return (
      <div ref={dropdownRef} className={cn('relative inline-block text-left', className)}>
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all shadow-sm cursor-pointer select-none',
            isOpen
              ? 'border-indigo-400 bg-indigo-50/90 text-indigo-900 dark:bg-indigo-950/80 dark:border-indigo-600 dark:text-indigo-200 ring-2 ring-indigo-400/20'
              : 'border-neutral-200/90 bg-white dark:border-neutral-800 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 hover:border-neutral-300 dark:hover:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800/80'
          )}
          title="Switch active company scope (Admin Only)"
        >
          <div className="flex items-center justify-center w-5 h-5 rounded-md bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
            <Building2 className="w-3.5 h-3.5" />
          </div>

          <div className="flex flex-col items-start leading-tight max-w-[130px] sm:max-w-[180px] md:max-w-[220px]">
            <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-400 uppercase tracking-wider">
              Viewing Company
            </span>
            <span className="truncate font-bold text-neutral-900 dark:text-white">
              {selectedCompany ? selectedCompany.company_name : 'Select Company'}
            </span>
          </div>

          {selectedCompany && (
            <span className="hidden md:inline-flex px-1.5 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-[10px] text-neutral-500 dark:text-neutral-400 font-medium">
              {selectedCompany.user_name.split(' ')[0]}
            </span>
          )}

          <ChevronDown
            className={cn(
              'w-3.5 h-3.5 text-neutral-400 transition-transform duration-200 shrink-0',
              isOpen && 'rotate-180 text-indigo-600'
            )}
          />
        </button>

        {/* Dropdown Menu */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="absolute left-0 mt-2 w-80 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl shadow-2xl p-2 z-50 text-xs"
            >
              <div className="px-2.5 py-2 border-b border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-neutral-900 dark:text-white">
                  <Shield className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Select Company Portal</span>
                </div>
                <button
                  type="button"
                  onClick={() => refetchCompanies()}
                  className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  title="Refresh companies list"
                >
                  <RefreshCw className={cn('w-3 h-3', isLoadingCompanies && 'animate-spin')} />
                </button>
              </div>

              {/* Search Filter */}
              <div className="p-2">
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200/80 dark:border-neutral-700">
                  <Search className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <input
                    type="text"
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    placeholder="Search company or HR..."
                    className="w-full bg-transparent text-xs text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none"
                    autoFocus
                  />
                </div>
              </div>

              {/* List */}
              <div className="max-h-60 overflow-y-auto space-y-1 p-1">
                {filteredCompanies.length === 0 ? (
                  <div className="py-4 text-center text-neutral-400 text-xs">
                    No matching companies found
                  </div>
                ) : (
                  filteredCompanies.map((c) => {
                    const isSelected = c.user_id === selectedCompanyUserId;
                    return (
                      <button
                        key={c.user_id}
                        type="button"
                        onClick={() => handleSelect(c.user_id)}
                        className={cn(
                          'w-full text-left p-2.5 rounded-xl transition-all flex items-center justify-between gap-2.5 cursor-pointer',
                          isSelected
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-950 dark:text-indigo-100 font-semibold'
                            : 'hover:bg-neutral-100 dark:hover:bg-neutral-800/70 text-neutral-700 dark:text-neutral-300'
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate font-bold text-neutral-900 dark:text-white">
                              {c.company_name}
                            </span>
                            {c.is_platform_admin && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 font-bold uppercase">
                                Admin
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                            <span className="truncate font-medium">{c.user_name}</span>
                            <span>•</span>
                            <span className="inline-flex items-center gap-1">
                              <Users className="w-3 h-3 text-neutral-400" />
                              {c.employee_count}
                            </span>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // -------------------------------------------------------------
  // Banner / Toolbar Variant (Used at the top of Employees, Attendance, Slips)
  // -------------------------------------------------------------
  return (
    <div
      ref={dropdownRef}
      className={cn(
        'relative rounded-2xl border border-indigo-200/80 dark:border-indigo-900/60 bg-gradient-to-r from-indigo-50/70 via-white to-neutral-50/80 dark:from-indigo-950/30 dark:via-neutral-900 dark:to-neutral-900/60 p-3 sm:p-4 shadow-sm mb-5',
        className
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Active Company Scope Details */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-500/20">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/70 text-indigo-700 dark:text-indigo-300">
                Admin Company Scope
              </span>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                Viewing: <strong className="text-neutral-900 dark:text-white font-bold">{selectedCompany ? selectedCompany.company_name : 'No company selected'}</strong>
              </span>
            </div>
            <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-0.5 truncate">
              HR Manager: <span className="font-semibold text-neutral-900 dark:text-white">{selectedCompany?.user_name || '-'}</span> ({selectedCompany?.email || '-'}) · {selectedCompany?.employee_count ?? 0} active employees
            </p>
          </div>
        </div>

        {/* Right: Switcher Selector Button */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="w-full sm:w-auto inline-flex items-center justify-between sm:justify-start gap-2.5 px-4 py-2 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:border-indigo-400 dark:hover:border-indigo-500 shadow-sm text-xs font-semibold text-neutral-900 dark:text-white transition-all cursor-pointer"
          >
            <span className="truncate max-w-[190px]">
              {selectedCompany ? `${selectedCompany.user_name} (${selectedCompany.company_name})` : 'Select Company'}
            </span>
            <ChevronDown className={cn('w-4 h-4 text-neutral-400 transition-transform', isOpen && 'rotate-180 text-indigo-600')} />
          </button>

          {/* Dropdown Menu for Banner */}
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 sm:right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl shadow-2xl p-2 z-50 text-xs"
              >
                <div className="p-2 border-b border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between">
                  <span className="font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-indigo-500" />
                    Switch Company Portal
                  </span>
                  <span className="text-[11px] text-neutral-400 font-normal">
                    {companies.length} companies
                  </span>
                </div>

                <div className="p-2">
                  <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200/80 dark:border-neutral-700">
                    <Search className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    <input
                      type="text"
                      value={filterQuery}
                      onChange={(e) => setFilterQuery(e.target.value)}
                      placeholder="Search company or HR manager..."
                      className="w-full bg-transparent text-xs text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-1 p-1">
                  {filteredCompanies.map((c) => {
                    const isSelected = c.user_id === selectedCompanyUserId;
                    return (
                      <button
                        key={c.user_id}
                        type="button"
                        onClick={() => handleSelect(c.user_id)}
                        className={cn(
                          'w-full text-left p-2.5 rounded-xl transition-all flex items-center justify-between gap-3 cursor-pointer',
                          isSelected
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-950 dark:text-indigo-100 font-semibold'
                            : 'hover:bg-neutral-100 dark:hover:bg-neutral-800/70 text-neutral-700 dark:text-neutral-300'
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-neutral-900 dark:text-white truncate">
                              {c.company_name}
                            </span>
                            {c.is_platform_admin && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 font-bold uppercase">
                                Admin
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                            <span className="font-medium text-neutral-800 dark:text-neutral-200 truncate">{c.user_name}</span>
                            <span>•</span>
                            <span className="truncate">{c.email}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-medium">
                            <Users className="w-3 h-3" />
                            {c.employee_count}
                          </span>
                          {isSelected && (
                            <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                              <Check className="w-3 h-3" />
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

