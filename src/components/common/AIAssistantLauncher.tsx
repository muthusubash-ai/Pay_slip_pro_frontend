import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';
import { useTranslation } from '../../context/LanguageContext';
import { AIAssistantDrawer } from './AIAssistantDrawer';

interface AIAssistantLauncherProps {
  onOpen?: () => void;
  className?: string;
}

export function AIAssistantLauncher({ onOpen, className = '' }: AIAssistantLauncherProps) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const isDark = theme === 'dark';
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleClick = () => {
    if (onOpen) {
      onOpen();
    } else {
      setIsDrawerOpen((prev) => !prev);
    }
  };

  return (
    <>
      {/* Floating Action Button (FAB) Trigger */}
      <aside
        aria-label={t('ai.title')}
        className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex items-center justify-end ${className}`}
      >
        <div className="relative group">
          {/* Subtle Ambient Ring */}
          <span
            className="absolute -inset-0.5 rounded-xl sm:rounded-2xl bg-neutral-900/5 dark:bg-white/10 blur-sm opacity-50 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
            aria-hidden="true"
          />

          {/* Tooltip on Hover */}
          {!isDrawerOpen && (
            <div
              role="tooltip"
              className="hidden sm:flex absolute right-full mr-3 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl bg-neutral-900/95 text-white dark:bg-white/95 dark:text-neutral-900 text-xs font-semibold shadow-xl border border-neutral-800/80 dark:border-neutral-200/80 pointer-events-none whitespace-nowrap opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all duration-200 translate-x-1 group-hover:translate-x-0 items-center gap-2 backdrop-blur-sm"
            >
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>{t('ai.title')}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/10 dark:bg-black/10 text-neutral-300 dark:text-neutral-600 font-mono">
                {t('ai.online')}
              </span>
            </div>
          )}

          {/* Main Launcher Button */}
          <motion.button
            type="button"
            onClick={handleClick}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            className="relative flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/90 dark:border-neutral-700/80 shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.6)] hover:border-neutral-300 dark:hover:border-neutral-600 transition-all duration-200 cursor-pointer overflow-hidden focus:outline-none focus:ring-2 focus:ring-neutral-400/50 dark:focus:ring-neutral-600/50"
            title={t('ai.title')}
            aria-label={t('ai.title')}
          >
            {/* Wolf Logo Image - Perfectly adapted for Light & Dark mode */}
            <img
              src="/ai-assistant-logo.png"
              alt="Zigmaa AI"
              style={{
                filter: isDark
                  ? 'brightness(1) drop-shadow(0 0 6px rgba(255, 255, 255, 0.45))'
                  : 'brightness(0)',
              }}
              className="relative w-7 h-7 sm:w-8.5 sm:h-8.5 object-contain transition-all duration-300 group-hover:scale-110"
            />
          </motion.button>
        </div>
      </aside>

      {/* Slide-over Right Sidebar Drawer Chat Panel */}
      <AIAssistantDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </>
  );
}

export default AIAssistantLauncher;
