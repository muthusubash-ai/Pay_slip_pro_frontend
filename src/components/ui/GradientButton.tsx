import { motion, type HTMLMotionProps } from 'framer-motion';
import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface GradientButtonProps extends HTMLMotionProps<'button'> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  isLoading?: boolean;
}

export function GradientButton({ children, variant = 'primary', isLoading, className, disabled, ...props }: GradientButtonProps) {
  const variants = {
    primary: 'bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-100 keep-white shadow-sm font-semibold',
    secondary: 'bg-gray-200 text-black hover:bg-gray-300 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700',
    danger: 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:text-white',
  };

  return (
    <motion.button
      className={cn(
        'inline-flex items-center justify-center px-4 py-2.5 sm:px-6 sm:py-3 rounded-xl font-semibold shadow-sm transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading...
        </span>
      ) : children}
    </motion.button>
  );
}
