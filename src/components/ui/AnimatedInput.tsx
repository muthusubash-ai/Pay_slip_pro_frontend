import { motion, type HTMLMotionProps } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';
import { forwardRef, useState } from 'react';
import { cn } from '../../lib/utils';

interface AnimatedInputProps extends HTMLMotionProps<'input'> {
  label?: string;
  error?: string;
  showPasswordToggle?: boolean;
}

export const AnimatedInput = forwardRef<HTMLInputElement, AnimatedInputProps>(
  ({ label, error, className, showPasswordToggle = false, type, ...props }, ref) => {
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const canTogglePassword = showPasswordToggle && type === 'password';

    return (
      <div className="space-y-1">
        {label && <label className="block text-sm font-medium text-gray-700">{label}</label>}
        <div className="relative">
          <motion.input
            ref={ref}
            type={canTogglePassword && isPasswordVisible ? 'text' : type}
            whileFocus={{ scale: 1.01 }}
            className={cn(
              'w-full rounded-xl border-2 bg-white px-4 py-3 outline-none transition-colors',
              canTogglePassword && 'pr-12',
              error ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-black',
              className
            )}
            {...props}
          />
          {canTogglePassword && (
            <button
              type="button"
              onClick={() => setIsPasswordVisible((visible) => !visible)}
              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-gray-400 transition-colors hover:text-black focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black"
              aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
              aria-pressed={isPasswordVisible}
            >
              {isPasswordVisible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          )}
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
      </div>
    );
  }
);

AnimatedInput.displayName = 'AnimatedInput';
