import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, RotateCcw, Bot, User, Sparkles } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useTranslation } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { sendChatMessage, type ChatMessage } from '../../services/aiAssistantService';

interface AIAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const MOBILE_BREAKPOINT_PX = 640;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT_PX
  );
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

export function AIAssistantDrawer({ isOpen, onClose }: AIAssistantDrawerProps) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const isDark = theme === 'dark';
  const isMobile = useIsMobile();

  // Same name shown on the Dashboard greeting ("Welcome back, {name}"), kept in sync here.
  const dashboardName = user?.full_name || 'Admin';

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem('zigmaa_ai_chat');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return [
      {
        id: 'init-1',
        sender: 'assistant',
        text: `${t('ai.greeting')}, ${dashboardName}?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ];
  });

  const suggestedQuestions = [
    t('ai.suggestedQ1'),
    t('ai.suggestedQ2'),
    t('ai.suggestedQ3'),
    t('ai.suggestedQ4'),
    t('ai.suggestedQ5'),
  ];

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 250);
    }
  }, [isOpen, messages]);

  // Persist chat to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem('zigmaa_ai_chat', JSON.stringify(messages));
    } catch {
      // ignore
    }
  }, [messages]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend ?? input).trim();
    if (!text || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!textToSend) setInput('');
    setIsLoading(true);

    try {
      const reply = await sendChatMessage(text, messages);
      const aiMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'assistant',
        text: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch {
      const errorMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'assistant',
        text: 'Sorry, I encountered an issue processing your request. Please try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearChat = () => {
    const fresh: ChatMessage[] = [
      {
        id: `init-${Date.now()}`,
        sender: 'assistant',
        text: t('ai.cleared'),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ];
    setMessages(fresh);
    sessionStorage.removeItem('zigmaa_ai_chat');
  };

  // Helper to render basic markdown formatting (bold, bullets)
  const renderFormattedText = (text: string) => {
    return text.split('\n').map((line, idx) => {
      // Bold tags regex: **bold text**
      const parts = line.split(/(\*\*.*?\*\*)/g);
      const formattedParts = parts.map((part, pIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={pIdx} className="font-semibold text-neutral-900 dark:text-white">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return part;
      });

      return (
        <span key={idx} className="block min-h-[1.25rem]">
          {formattedParts}
        </span>
      );
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop Overlay - plain opacity fade, no blur filter (blur is expensive to animate and was the main source of lag) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/40"
            aria-hidden="true"
          />

          {/* Desktop/tablet: right slide-over drawer. Mobile: compact bottom-anchored card. */}
          <motion.aside
            role="dialog"
            aria-label="AI Assistant"
            initial={isMobile ? { y: '100%', opacity: 0 } : { x: '100%' }}
            animate={isMobile ? { y: 0, opacity: 1 } : { x: 0 }}
            exit={isMobile ? { y: '100%', opacity: 0 } : { x: '100%' }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className={
              isMobile
                ? 'fixed left-3 right-3 bottom-3 z-50 max-h-[72vh] rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200/90 dark:border-neutral-800 shadow-2xl flex flex-col select-none overflow-hidden'
                : 'fixed top-0 right-0 bottom-0 z-50 w-[400px] md:w-[440px] max-w-[100vw] h-dvh bg-white dark:bg-neutral-900 border-l border-neutral-200/90 dark:border-neutral-800 shadow-2xl flex flex-col select-none overflow-hidden'
            }
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3.5 sm:px-5 py-2.5 sm:py-3.5 border-b border-neutral-200/80 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md shrink-0">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                {/* Wolf Logo Avatar Badge */}
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-neutral-100 dark:bg-neutral-800/90 border border-neutral-200/80 dark:border-neutral-700/80 flex items-center justify-center p-1.5 sm:p-2 shadow-sm shrink-0">
                  <img
                    src="/ai-assistant-logo.png"
                    alt="Zigmaa AI"
                    style={{
                      filter: isDark
                        ? 'brightness(1) drop-shadow(0 0 6px rgba(255, 255, 255, 0.45))'
                        : 'brightness(0)',
                    }}
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <h3 className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-white tracking-tight truncate">
                      {t('ai.title')}
                    </h3>
                    <span className="flex items-center gap-1 text-[9px] sm:text-[10px] font-semibold px-1.5 sm:px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      {t('ai.live')}
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                    {t('ai.subtitle')}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handleClearChat}
                  title={t('ai.clearChat')}
                  aria-label={t('ai.clearChat')}
                  className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  title={t('common.close')}
                  aria-label={t('common.close')}
                  className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  <X className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </button>
              </div>
            </div>

            {/* Messages Body */}
            <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 sm:py-4 space-y-3 sm:space-y-3.5 select-text">
              {messages.map((msg) => {
                const isUser = msg.sender === 'user';

                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className={`flex items-start gap-2 sm:gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    {/* Avatar Icon */}
                    <div
                      className={`w-6 h-6 sm:w-7 sm:h-7 rounded-md sm:rounded-lg flex items-center justify-center shrink-0 mt-0.5 p-0.5 sm:p-1 ${
                        isUser
                          ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-sm'
                          : 'bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-sm'
                      }`}
                    >
                      {isUser ? (
                        <User className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      ) : (
                        <img
                          src="/ai-assistant-logo.png"
                          alt="AI"
                          style={{
                            filter: isDark
                              ? 'brightness(1) drop-shadow(0 0 4px rgba(255, 255, 255, 0.45))'
                              : 'brightness(0)',
                          }}
                          className="w-full h-full object-contain"
                        />
                      )}
                    </div>

                    {/* Chat Bubble */}
                    <div className={`max-w-[85%] sm:max-w-[80%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                      <div
                        className={`rounded-2xl px-3 py-2 sm:px-3.5 sm:py-2.5 text-[11.5px] sm:text-[13px] leading-relaxed shadow-xs ${
                          isUser
                            ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded-tr-xs font-normal'
                            : 'bg-neutral-100 dark:bg-neutral-800/90 text-neutral-800 dark:text-neutral-200 border border-neutral-200/70 dark:border-neutral-700/70 rounded-tl-xs'
                        }`}
                      >
                        {renderFormattedText(msg.text)}
                      </div>
                      <span className="text-[9px] sm:text-[10px] text-neutral-400 mt-0.5 sm:mt-1 px-1">
                        {msg.timestamp}
                      </span>
                    </div>
                  </motion.div>
                );
              })}

              {/* Typing indicator */}
              {isLoading && (
                <div className="flex items-start gap-2 sm:gap-2.5">
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-md sm:rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center p-0.5 sm:p-1 shrink-0">
                    <Bot className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-neutral-600 dark:text-neutral-300 animate-pulse" />
                  </div>
                  <div className="rounded-2xl rounded-tl-xs px-3 py-2 sm:px-3.5 sm:py-2.5 bg-neutral-100 dark:bg-neutral-800/90 border border-neutral-200/70 dark:border-neutral-700/70 text-[11px] sm:text-xs text-neutral-500 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 dark:bg-neutral-500 animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 dark:bg-neutral-500 animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 dark:bg-neutral-500 animate-bounce" />
                    <span className="ml-1 text-[10px] sm:text-[11px] text-neutral-400">{t('ai.thinking')}</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Suggestions Chips */}
            {messages.length <= 3 && (
              <div className="px-3 sm:px-4 py-1.5 sm:py-2 border-t border-neutral-100 dark:border-neutral-800/70 bg-neutral-50/50 dark:bg-neutral-900/50 shrink-0">
                <p className="text-[9px] sm:text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-indigo-500" /> {t('ai.suggestedQuestions')}
                </p>
                <div className="flex flex-wrap gap-1 sm:gap-1.5 max-h-20 sm:max-h-24 overflow-y-auto">
                  {suggestedQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      disabled={isLoading}
                      onClick={() => handleSend(q)}
                      className="text-[10px] sm:text-[11px] px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-neutral-400 dark:hover:border-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-750 transition-all text-left cursor-pointer"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input Bar */}
            <div className="p-2.5 sm:p-3.5 border-t border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex items-center gap-1.5 sm:gap-2 rounded-xl sm:rounded-2xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/60 p-1 sm:p-1.5 focus-within:border-neutral-900 dark:focus-within:border-white focus-within:ring-2 focus-within:ring-neutral-900/10 dark:focus-within:ring-white/10 transition-all"
              >
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t('ai.askPlaceholder')}
                  rows={1}
                  disabled={isLoading}
                  className="flex-1 resize-none bg-transparent px-2.5 py-1 text-xs sm:text-[13px] text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none max-h-24 leading-normal"
                />

                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  aria-label="Send message"
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 flex items-center justify-center shrink-0 transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer shadow-sm"
                >
                  <Send className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                </button>
              </form>

              <p className="hidden sm:block text-[9px] text-center text-neutral-400 mt-1.5">
                Press <kbd className="px-1 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 text-[9px] font-mono">Enter</kbd> to send, <kbd className="px-1 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 text-[9px] font-mono">Shift+Enter</kbd> for newline
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

export default AIAssistantDrawer;
