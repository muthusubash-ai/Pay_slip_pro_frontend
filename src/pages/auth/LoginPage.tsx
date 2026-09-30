import { useState, useEffect, useRef, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import {
  Eye, EyeOff, Check, X, FileText, Shield, Clock, Send, ArrowRight,
  Users, CreditCard, Zap, BarChart3, Mail, CheckCircle2, ChevronRight,
  Star, Globe, Lock, Sparkles, Landmark,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { paymentService } from '../../services/paymentService';
import { getPlanHome, PLAN_CATALOG } from '../../lib/plans';
import { PlanUpgradeModal } from '../../components/ui/PlanUpgradeModal';
import type { User } from '../../types';

const ENABLE_DECORATIVE_MOTION = false;

/* ════════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════════ */

/* ─── typewriter ─── */
function TypewriterText({ words }: { words: string[] }) {
  return <>{words[0]}</>;
}

/* ─── animated counter ─── */
function Counter({ value, suffix = '' }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    let frame: number;
    const dur = 1500;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min((now - start) / dur, 1);
      setCount(Math.floor((1 - Math.pow(1 - t, 3)) * value));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [isInView, value]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

/* ─── section fade-in wrapper ─── */
function Section({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : {}}
      transition={{ duration: 0.2, delay: Math.min(delay, 0.08) }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─── 3D tilt card ─── */
function Tilt3DCard({ children, className = '' }: { children: React.ReactNode; className?: string; intensity?: number }) {
  return <div className={className}>{children}</div>;
}

/* ─── interactive dot grid (hero black sections) ─── */
function InteractiveDotGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: -1000, y: -1000 });
  const animFrame = useRef(0);

  useEffect(() => {
    if (!ENABLE_DECORATIVE_MOTION) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const GAP = 20;
    const DOT_BASE = 0.6;
    const INFLUENCE = 120;
    const MAX_SIZE = 2.5;
    const LINE_DIST = 55;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.offsetWidth;
      canvas.height = parent.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Listen on the parent section so mouse works even over content
    const section = canvas.closest('section');
    const target = section || canvas;

    const handleMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const handleLeave = () => { mouse.current = { x: -1000, y: -1000 }; };

    target.addEventListener('mousemove', handleMove as EventListener);
    target.addEventListener('mouseleave', handleLeave);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const mx = mouse.current.x;
      const my = mouse.current.y;
      const cols = Math.ceil(canvas.width / GAP) + 1;
      const rows = Math.ceil(canvas.height / GAP) + 1;

      // Collect active dots near mouse for line drawing
      const activeDots: { x: number; y: number; alpha: number }[] = [];

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const baseX = col * GAP;
          const baseY = row * GAP;
          const dx = mx - baseX;
          const dy = my - baseY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const t = Math.max(0, 1 - dist / INFLUENCE);

          // Push dots away from mouse
          const pushStrength = t * 4;
          const dotX = baseX - (dist > 0 ? (dx / dist) * pushStrength : 0);
          const dotY = baseY - (dist > 0 ? (dy / dist) * pushStrength : 0);

          const size = DOT_BASE + t * (MAX_SIZE - DOT_BASE);
          const alpha = 0.04 + t * 0.35;

          ctx.beginPath();
          ctx.arc(dotX, dotY, size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
          ctx.fill();

          // Glow for dots near mouse
          if (t > 0.25) {
            ctx.beginPath();
            ctx.arc(dotX, dotY, size + 2, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${t * 0.08})`;
            ctx.fill();
            activeDots.push({ x: dotX, y: dotY, alpha: t });
          }
        }
      }

      // Draw connecting lines between nearby active dots
      for (let i = 0; i < activeDots.length; i++) {
        for (let j = i + 1; j < activeDots.length; j++) {
          const a = activeDots[i];
          const b = activeDots[j];
          const d = Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
          if (d < LINE_DIST) {
            const lineAlpha = (1 - d / LINE_DIST) * Math.min(a.alpha, b.alpha) * 0.2;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(255, 255, 255, ${lineAlpha})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      animFrame.current = requestAnimationFrame(draw);
    };

    animFrame.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animFrame.current);
      window.removeEventListener('resize', resize);
      target.removeEventListener('mousemove', handleMove as EventListener);
      target.removeEventListener('mouseleave', handleLeave);
    };
  }, []);

  if (!ENABLE_DECORATIVE_MOTION) {
    return (
      <div
        className="absolute inset-0 z-[1] pointer-events-none opacity-30"
        style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.16) 1px, transparent 1px)', backgroundSize: '24px 24px' }}
      />
    );
  }

  return <canvas ref={canvasRef} className="absolute inset-0 z-[1] pointer-events-none" />;
}

/* ─── morphing blob ─── */
function MorphBlob({ className = '' }: { className?: string; delay?: number }) {
  return <div className={`absolute rounded-full pointer-events-none ${className}`} />;
}

/* ─── stagger text reveal (plays once on mount) ─── */
function StaggerText({ text, className = '' }: { text: string; className?: string; delay?: number }) {
  return <span className={className}>{text}</span>;
}

/* ─── glitch text effect ─── */
function GlitchText({ children, className = '' }: { children: string; className?: string }) {
  return <span className={className}>{children}</span>;
}

/* ─── animated grid background ─── */
function AnimatedGrid() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Perspective grid floor */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          perspective: '500px',
          transform: 'rotateX(60deg)',
          transformOrigin: 'center 120%',
        }} />
    </div>
  );
}

/* ─── floating particles (enhanced) ─── */
function FloatingParticles() {
  return null;
}

/* ════════════════════════════════════════════
   UPGRADE AUTH MODAL
   ════════════════════════════════════════════ */

function UpgradeAuthModal({
  plan,
  onClose,
  onSignIn,
  onSignUp,
}: {
  plan: 'professional' | 'enterprise';
  onClose: () => void;
  onSignIn: () => void;
  onSignUp: () => void;
}) {
  const price = plan === 'professional' ? '₹499/month' : '₹999/month';
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div
          className="relative w-full max-w-[440px] rounded-2xl bg-white p-6 sm:p-7 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900">
                {plan === 'professional' ? 'Professional Plan' : 'Enterprise Plan'} ({price})
              </h3>
              <p className="text-xs text-neutral-500">Choose how you would like to proceed:</p>
            </div>
          </div>

          <div className="space-y-3 mt-6">
            {/* Option 1: Existing User Sign In */}
            <button
              onClick={onSignIn}
              className="w-full p-4 rounded-xl border-2 border-neutral-900 bg-neutral-950 text-white text-left hover:bg-neutral-900 transition-all flex items-center justify-between group shadow-sm"
            >
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-0.5">Existing User</p>
                <p className="text-sm font-bold">Sign In to Upgrade Account</p>
                <p className="text-xs text-neutral-400 mt-0.5">Keep all your existing employees & salary slips</p>
              </div>
              <ArrowRight className="h-5 w-5 text-neutral-400 group-hover:translate-x-1 group-hover:text-white transition-all shrink-0 ml-2" />
            </button>

            {/* Option 2: New User Sign Up */}
            <button
              onClick={onSignUp}
              className="w-full p-4 rounded-xl border-2 border-neutral-200 bg-neutral-50 hover:bg-white hover:border-neutral-300 text-neutral-900 text-left transition-all flex items-center justify-between group"
            >
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-0.5">New to PaySlip Pro</p>
                <p className="text-sm font-bold">Create a New Account</p>
                <p className="text-xs text-neutral-500 mt-0.5">Register fresh and setup your company</p>
              </div>
              <ArrowRight className="h-5 w-5 text-neutral-400 group-hover:translate-x-1 group-hover:text-black transition-all shrink-0 ml-2" />
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

/* ════════════════════════════════════════════
   LOGIN MODAL
   ════════════════════════════════════════════ */

function LoginModal({ 
  onClose, 
  onSignedIn,
  selectedPlan,
}: { 
  onClose: () => void; 
  onSignedIn?: (user: User) => void;
  selectedPlan?: 'professional' | 'enterprise' | null;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handler);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', handler); };
  }, [onClose]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const signedInUser = await login(email, password);
      if (onSignedIn) onSignedIn(signedInUser);
      else navigate(getPlanHome(signedInUser));
    }
    catch { setError('Invalid email or password'); }
    finally { setIsLoading(false); }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 30, rotateX: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 30, rotateX: -10 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4"
        style={{ perspective: '1000px' }}
      >
        <motion.div className="relative max-h-[calc(100dvh-2rem)] w-full max-w-[420px] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-8"
          onClick={(e) => e.stopPropagation()}
          style={{ transformStyle: 'preserve-3d' }}
          whileHover={{ boxShadow: '0 30px 80px rgba(0,0,0,0.15)' }}>
          {/* Close */}
          <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition-colors">
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-9 h-9 rounded-xl bg-black flex items-center justify-center">
              <FileText className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900 tracking-tight">
                {selectedPlan ? `Upgrade to ${selectedPlan.toUpperCase()}` : 'Welcome back'}
              </h2>
              <p className="text-[11px] text-neutral-400">
                {selectedPlan ? 'Sign in to upgrade your existing account' : 'Sign in to your account'}
              </p>
            </div>
          </div>

          {selectedPlan && (
            <div className="mb-4 p-3 rounded-xl bg-neutral-950 text-white text-xs flex items-center gap-2.5 border border-neutral-800">
              <CreditCard className="h-4 w-4 text-emerald-400 shrink-0" />
              <div>
                <span className="font-bold uppercase tracking-wider text-emerald-400">Upgrade Flow: </span>
                <span>Signing in will immediately initiate <strong>{selectedPlan.toUpperCase()}</strong> plan checkout.</span>
              </div>
            </div>
          )}

          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="mb-4 p-3 rounded-xl bg-neutral-950 text-white text-sm flex items-center gap-2 overflow-hidden">
                <X className="h-3.5 w-3.5 shrink-0" />{error}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-neutral-500 uppercase tracking-widest mb-1.5">Email</label>
              <motion.div animate={{ boxShadow: focusedField === 'email' ? '0 0 0 3px rgba(0,0,0,0.06)' : '0 0 0 0px rgba(0,0,0,0)' }} className="rounded-xl">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocusedField('email')} onBlur={() => setFocusedField(null)} required placeholder="you@company.com"
                  className="w-full px-4 py-3 rounded-xl border-2 border-neutral-200 bg-neutral-50/50 outline-none transition-all focus:border-black focus:bg-white text-sm placeholder:text-neutral-300" />
              </motion.div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-semibold text-neutral-500 uppercase tracking-widest">Password</label>
                <Link to="/forgot-password" onClick={onClose} className="text-[11px] text-neutral-400 hover:text-black transition-colors">Forgot?</Link>
              </div>
              <motion.div animate={{ boxShadow: focusedField === 'password' ? '0 0 0 3px rgba(0,0,0,0.06)' : '0 0 0 0px rgba(0,0,0,0)' }} className="rounded-xl relative">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField('password')} onBlur={() => setFocusedField(null)} required placeholder="Enter your password"
                  className="w-full px-4 py-3 rounded-xl border-2 border-neutral-200 bg-neutral-50/50 outline-none transition-all focus:border-black focus:bg-white text-sm pr-12 placeholder:text-neutral-300" />
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-300 hover:text-black transition-colors">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </motion.div>
            </div>

            <motion.button type="submit" disabled={isLoading} whileHover={isLoading ? {} : { scale: 1.01 }} whileTap={isLoading ? {} : { scale: 0.98 }}
              className="group w-full py-3 rounded-xl bg-black text-white font-semibold text-sm hover:bg-neutral-900 transition-all disabled:opacity-50 shadow-lg shadow-black/10 flex items-center justify-center gap-2">
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (<>Sign In<ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" /></>)}
            </motion.button>
          </form>

          <div className="flex items-center gap-4 my-5">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-neutral-200 to-transparent" />
            <span className="text-[10px] text-neutral-300 uppercase tracking-widest font-medium">or</span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-neutral-200 to-transparent" />
          </div>

          <motion.a href={`${import.meta.env.VITE_API_URL || ''}/api/v1/auth/google/login`} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
            className="flex items-center justify-center gap-3 w-full px-4 py-3 rounded-xl border-2 border-neutral-200 bg-white hover:border-neutral-300 transition-all font-medium text-neutral-600 text-sm">
            <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </motion.a>

          <p className="mt-5 text-center text-sm text-neutral-400">
            Don&apos;t have an account?{' '}
            <Link
              to="/register"
              onClick={() => {
                sessionStorage.removeItem('selected_plan');
                onClose();
              }}
              className="text-black font-semibold hover:underline underline-offset-4"
            >
              Create one
            </Link>
          </p>
        </motion.div>
      </motion.div>
    </>
  );
}

/* ════════════════════════════════════════════
   LANDING PAGE (exported as LoginPage)
   ════════════════════════════════════════════ */

export function LoginPage() {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'professional' | 'enterprise' | null>(null);
  const [showUpgradeAuthModal, setShowUpgradeAuthModal] = useState<'professional' | 'enterprise' | null>(null);
  const [celebrationPlan, setCelebrationPlan] = useState<'professional' | 'enterprise' | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [paymentNotice, setPaymentNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const planParam = params.get('plan') as 'professional' | 'enterprise' | null;
    if (planParam && (planParam === 'professional' || planParam === 'enterprise')) {
      setSelectedPlan(planParam);
      setShowLogin(true);
    }
  }, []);

  const startPaidPlan = (targetPlan: 'professional' | 'enterprise', account: User) => {
    paymentService.startPaymentFlow(
      targetPlan,
      { name: account.full_name, email: account.email, contact: account.phone || undefined },
      (newPlan, updatedUserData) => {
        const upgradedUser = updatedUserData || { ...account, plan: newPlan as 'professional' | 'enterprise' };
        updateUser(upgradedUser);
        setSelectedPlan(null);
        sessionStorage.removeItem('selected_plan');
        setCelebrationPlan(newPlan as 'professional' | 'enterprise');
      },
      (err) => {
        setPaymentNotice({
          type: 'error',
          message: err,
        });
      }
    );
  };

  const handleSignUpFree = () => {
    setSelectedPlan(null);
    sessionStorage.removeItem('selected_plan');
    navigate('/register');
  };

  const handlePlanClick = (planName: string) => {
    setPaymentNotice(null);
    if (planName.toLowerCase() === 'starter') {
      setSelectedPlan(null);
      sessionStorage.removeItem('selected_plan');
      if (!user) navigate('/register');
      else navigate(getPlanHome(user));
      return;
    }

    const targetPlan = planName.toLowerCase() as 'professional' | 'enterprise';
    if (!user) {
      setShowUpgradeAuthModal(targetPlan);
      return;
    }

    startPaidPlan(targetPlan, user);
  };

  useEffect(() => {
    const el = document.getElementById('landing-scroll');
    if (!el) return;
    const handler = () => setScrolled(el.scrollTop > 20);
    el.addEventListener('scroll', handler);
    return () => el.removeEventListener('scroll', handler);
  }, []);

  const processSteps = [
    { num: '01', icon: Users, title: 'Add Employees', desc: 'Import or manually add your team with salary breakdowns and bank details.' },
    { num: '02', icon: FileText, title: 'Generate Slips', desc: 'Auto-calculate earnings, deductions, and net pay for any month with one click.' },
    { num: '03', icon: Mail, title: 'Distribute', desc: 'Email professional PDF salary slips directly to employees on payday.' },
    { num: '04', icon: BarChart3, title: 'Track & Analyze', desc: 'Monitor payroll trends, department costs, and compliance from the dashboard.' },
  ];

  const features = [
    { icon: Zap, title: 'One-Click Generation', desc: 'Generate all salary slips for the month in a single click. No spreadsheets needed.' },
    { icon: Shield, title: 'Bank-Grade Security', desc: 'All sensitive data encrypted at rest. Role-based access keeps information safe.' },
    { icon: Clock, title: 'Scheduled Payroll', desc: 'Set your pay date once. Automated reminders ensure you never miss a cycle.' },
    { icon: Mail, title: 'Email Distribution', desc: 'Professional PDF slips emailed directly to employees with your company branding.' },
    { icon: Globe, title: 'Multi-Company', desc: 'Manage payroll for multiple companies with role-based access. Analyze projects, track department costs, and control permissions per role.' },
    { icon: Lock, title: 'Compliance Ready', desc: 'PF, ESI, TDS, and professional tax calculations built in. Stay compliant effortlessly.' },
  ];

  const plans = PLAN_CATALOG;

  return (
    <div id="landing-scroll" className="h-dvh overflow-y-auto bg-white scroll-smooth">
      <AnimatePresence>
        {showUpgradeAuthModal && (
          <UpgradeAuthModal
            plan={showUpgradeAuthModal}
            onClose={() => setShowUpgradeAuthModal(null)}
            onSignIn={() => {
              const target = showUpgradeAuthModal;
              setShowUpgradeAuthModal(null);
              setSelectedPlan(target);
              setShowLogin(true);
            }}
            onSignUp={() => {
              const target = showUpgradeAuthModal;
              setShowUpgradeAuthModal(null);
              setSelectedPlan(target);
              sessionStorage.setItem('selected_plan', target);
              navigate('/register');
            }}
          />
        )}
        {showLogin && (
          <LoginModal
            selectedPlan={selectedPlan}
            onClose={() => { setShowLogin(false); setSelectedPlan(null); }}
            onSignedIn={(signedInUser) => {
              setShowLogin(false);
              if (selectedPlan) startPaidPlan(selectedPlan, signedInUser);
              else navigate(getPlanHome(signedInUser));
            }}
          />
        )}
        {celebrationPlan && (
          <PlanUpgradeModal
            isOpen={!!celebrationPlan}
            plan={celebrationPlan}
            onConfirm={() => {
              const target = celebrationPlan;
              setCelebrationPlan(null);
              const upgradedUser = user ? { ...user, plan: target } : undefined;
              navigate(getPlanHome(upgradedUser));
            }}
            onClose={() => setCelebrationPlan(null)}
          />
        )}
      </AnimatePresence>

      {/* ═══ NAVBAR ═══ */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${scrolled ? 'bg-white/90 backdrop-blur-md border-b border-neutral-100 shadow-sm' : 'bg-transparent'}`}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between">
          <motion.div className="flex min-w-0 items-center gap-2.5"
            whileHover={{ scale: 1.03 }} transition={{ type: 'spring', stiffness: 300 }}>
            <motion.div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${scrolled ? 'bg-black' : 'bg-white'}`}
              whileHover={{ rotate: [0, -10, 10, 0] }} transition={{ duration: 0.5 }}>
              <FileText className={`h-4 w-4 ${scrolled ? 'text-white' : 'text-black'}`} />
            </motion.div>
            <span className={`hidden text-lg font-bold tracking-tight transition-colors min-[430px]:inline sm:inline ${scrolled ? 'text-neutral-900' : 'text-white'}`}>
              <GlitchText>{scrolled ? 'PaySlip Pro' : 'PaySlip Pro'}</GlitchText>
            </span>
          </motion.div>

          <div className="hidden md:flex items-center gap-8">
            {['Features', 'Process', 'Pricing'].map((item, i) => (
              <motion.a key={item} href={`#${item.toLowerCase()}`}
                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                whileHover={{ y: -2 }}
                className={`text-[13px] font-medium transition-colors hover:opacity-80 relative ${scrolled ? 'text-neutral-600' : 'text-white/70'}`}>
                {item}
                <motion.div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-current rounded-full origin-left"
                  initial={{ scaleX: 0 }} whileHover={{ scaleX: 1 }}
                  transition={{ duration: 0.2 }} />
              </motion.a>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <motion.button
              type="button"
              aria-label="Log in to your account"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowLogin(true)}
              className={`shrink-0 whitespace-nowrap rounded-lg border px-3 py-2 text-[12px] font-semibold transition-all sm:border-transparent sm:px-4 sm:text-[13px] ${scrolled ? 'border-neutral-300 text-neutral-700 hover:bg-neutral-100' : 'border-white/30 text-white hover:border-white/60 hover:bg-white/10'}`}>
              Log In
            </motion.button>
            <motion.button whileHover={{ scale: 1.03, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }} whileTap={{ scale: 0.97 }}
              onClick={handleSignUpFree}
              className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-[12px] font-semibold transition-all sm:px-5 sm:text-[13px] ${scrolled ? 'bg-black text-white hover:bg-neutral-800' : 'bg-white text-black hover:bg-neutral-100'}`}>
              Sign Up Free
            </motion.button>
          </div>
        </div>
      </motion.nav>

      {/* ═══ HERO ═══ */}
      <section className="relative bg-black text-white overflow-hidden">
        <InteractiveDotGrid />
        <FloatingParticles />
        <AnimatedGrid />

        {/* Morphing blobs */}
        <MorphBlob className="w-[500px] h-[500px] -top-20 -right-20 bg-white/[0.02] blur-3xl" />
        <MorphBlob className="w-[400px] h-[400px] -bottom-32 -left-32 bg-white/[0.03] blur-3xl" delay={3} />
        <MorphBlob className="w-[300px] h-[300px] top-1/3 left-1/4 bg-white/[0.015] blur-2xl" delay={6} />

        {/* Animated radial gradient pulse */}
        <motion.div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.02) 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.2, 0.5] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }} />

        <div className="relative z-10 max-w-7xl mx-auto px-4 pt-28 pb-40 sm:px-6 sm:pt-32 sm:pb-44 lg:pb-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left text */}
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
              {/* Animated badge */}
              <motion.div initial={{ opacity: 0, scale: 0.9, x: -20 }} animate={{ opacity: 1, scale: 1, x: 0 }} transition={{ delay: 0.2, type: 'spring' }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/[0.04] text-xs text-white/60 mb-6 relative overflow-hidden">
                <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}>
                  <Sparkles className="h-3 w-3" />
                </motion.div>
                <span>Trusted by 500+ companies</span>
                {/* Badge shimmer */}
                <motion.div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent"
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }} />
              </motion.div>

              <h1 className="mb-5 text-3xl font-bold leading-[1.1] tracking-tight min-[380px]:text-4xl md:mb-6 md:text-5xl xl:text-6xl">
                <StaggerText text="Payroll," delay={0.3} />
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-neutral-300 to-neutral-500">
                  <TypewriterText words={['Simplified.', 'Automated.', 'Delivered.', 'Secured.']} />
                </span>
              </h1>

              <motion.p className="mb-7 max-w-lg text-base leading-relaxed text-neutral-400 sm:text-lg md:mb-8"
                initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.6 }}>
                Generate, manage, and distribute professional salary slips in minutes. Built for modern teams that value precision, speed, and security.
              </motion.p>

              <div className="flex flex-col items-start gap-4 mb-10 sm:flex-row sm:items-center">
                <motion.button
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
                  whileHover={{ scale: 1.04, boxShadow: '0 8px 35px rgba(255,255,255,0.15)', y: -2 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={handleSignUpFree}
                  className="px-7 py-3.5 bg-white text-black rounded-xl font-semibold text-sm hover:bg-neutral-100 transition-colors flex items-center gap-2 shadow-lg shadow-white/5 relative overflow-hidden group">
                  <span className="relative z-10 flex items-center gap-2">
                    Get Started Free
                    <motion.span animate={{ x: [0, 4, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
                      <ArrowRight className="h-4 w-4" />
                    </motion.span>
                  </span>
                  {/* Button shine */}
                  <motion.div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/[0.05] to-transparent"
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 3 }} />
                </motion.button>
                <motion.a href="#process"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
                  className="text-sm text-white/50 hover:text-white/80 transition-colors flex items-center gap-1.5 font-medium group">
                  See how it works
                  <motion.span className="group-hover:translate-x-1 transition-transform">
                    <ChevronRight className="h-3.5 w-3.5" />
                  </motion.span>
                </motion.a>
              </div>

              {/* 3D Stats */}
              <div className="relative z-10 grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:items-center sm:gap-10" style={{ perspective: '500px' }}>
                {[{ v: 10000, s: '+', l: 'Slips Generated' }, { v: 500, s: '+', l: 'Companies' }, { v: 99, s: '.9%', l: 'Uptime' }].map((stat, i) => (
                  <motion.div key={stat.l}
                    initial={{ opacity: 0, rotateX: 40, y: 20 }}
                    animate={{ opacity: 1, rotateX: 0, y: 0 }}
                    transition={{ delay: 0.8 + i * 0.15, duration: 0.6, type: 'spring' }}
                    whileHover={{ scale: 1.08, rotateY: 5 }}
                    className="min-w-0 text-center sm:text-left"
                    style={{ transformStyle: 'preserve-3d' }}>
                    <div className="whitespace-nowrap text-xl font-bold sm:text-2xl"><Counter value={stat.v} suffix={stat.s} /></div>
                    <div className="mt-1 text-[10px] leading-tight text-neutral-400 sm:text-[11px] sm:text-neutral-500">{stat.l}</div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Right — 3D Animated payslip visual */}
            <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.3 }}
              className="hidden lg:block relative" style={{ perspective: '1200px' }}>

              {/* 3D Pulse rings */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ perspective: '600px' }}>
                {[0, 1, 2, 3].map((ring) => (
                  <motion.div key={ring} className="absolute rounded-full border border-white/[0.05]"
                    style={{ width: 250 + ring * 70, height: 250 + ring * 70, transformStyle: 'preserve-3d' }}
                    animate={{ scale: [1, 1.12, 1], opacity: [0.3, 0.06, 0.3], rotateX: [0, 15, 0], rotateZ: [0, ring % 2 ? 5 : -5, 0] }}
                    transition={{ duration: 5, delay: ring * 0.6, repeat: Infinity, ease: 'easeInOut' }} />
                ))}
              </div>

              <div className="relative flex flex-col items-center">
                {/* 3D Orbiting elements */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ perspective: '500px' }}>
                  {[
                    { icon: FileText, radius: 165, speed: 18, delay: 0, color: 'bg-white/10' },
                    { icon: Send, radius: 145, speed: 22, delay: 0.5, color: 'bg-white/[0.08]' },
                    { icon: Shield, radius: 185, speed: 16, delay: 1, color: 'bg-white/[0.06]' },
                    { icon: CreditCard, radius: 130, speed: 20, delay: 1.5, color: 'bg-white/[0.07]' },
                  ].map((orb, i) => (
                    <motion.div key={i} className="absolute"
                      style={{ transformStyle: 'preserve-3d' }}
                      animate={{ rotate: 360 }}
                      transition={{ duration: orb.speed, repeat: Infinity, ease: 'linear', delay: orb.delay }}>
                      <motion.div
                        className={`w-9 h-9 rounded-xl ${orb.color} backdrop-blur-sm border border-white/10 flex items-center justify-center shadow-lg shadow-black/20`}
                        style={{ transform: `translateX(${orb.radius}px)`, transformStyle: 'preserve-3d' }}
                        animate={{ rotate: -360, rotateY: [0, 180, 360] }}
                        transition={{ rotate: { duration: orb.speed, repeat: Infinity, ease: 'linear', delay: orb.delay }, rotateY: { duration: 3, repeat: Infinity, ease: 'easeInOut' } }}>
                        <orb.icon className="h-4 w-4 text-white/60" />
                      </motion.div>
                    </motion.div>
                  ))}
                </div>

                {/* Central 3D card with mouse tilt */}
                <Tilt3DCard className="z-10" intensity={12}>
                  <motion.div className="relative w-[300px] rounded-2xl border border-white/15 bg-gradient-to-br from-white/[0.08] to-white/[0.02] backdrop-blur-xl p-6 overflow-hidden shadow-2xl shadow-black/30"
                    animate={{ y: [0, -6, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                    style={{ transformStyle: 'preserve-3d' }}>

                    {/* Shimmer sweep 3D */}
                    <motion.div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent"
                      style={{ transform: 'skewX(-12deg)' }}
                      animate={{ x: ['-150%', '250%'] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', repeatDelay: 2 }} />

                    {/* Holographic edge glow */}
                    <motion.div className="absolute inset-0 rounded-2xl"
                      style={{ background: 'linear-gradient(135deg, transparent 40%, rgba(255,255,255,0.05) 50%, transparent 60%)' }}
                      animate={{ opacity: [0, 0.8, 0] }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} />

                    {/* Card header with 3D flip icon */}
                    <div className="flex items-center gap-3 mb-5" style={{ transform: 'translateZ(20px)' }}>
                      <motion.div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center border border-white/10"
                        animate={{ rotateY: [0, 180, 360], scale: [1, 1.05, 1] }}
                        transition={{ rotateY: { duration: 4, repeat: Infinity, ease: 'easeInOut', repeatDelay: 2 }, scale: { duration: 2, repeat: Infinity, ease: 'easeInOut' } }}
                        style={{ transformStyle: 'preserve-3d' }}>
                        <FileText className="h-5 w-5 text-white/80" />
                      </motion.div>
                      <div>
                        <p className="text-sm font-bold text-white">PaySlip Pro</p>
                        <p className="text-[10px] text-white/40">March 2026 · Arun Kumar</p>
                      </div>
                    </div>

                    {/* 3D layered content rows */}
                    <div className="space-y-2 mb-5" style={{ transform: 'translateZ(10px)' }}>
                      {[
                        { label: 'Basic Salary', value: '₹45,000', w: 90 },
                        { label: 'HRA', value: '₹18,000', w: 70 },
                        { label: 'Allowances', value: '₹11,700', w: 55 },
                        { label: 'Deductions', value: '-₹15,100', w: 45 },
                      ].map((row, i) => (
                        <motion.div key={row.label}
                          className="flex justify-between items-center py-2 border-b border-white/[0.05]"
                          initial={{ opacity: 0, x: -30, rotateY: -20 }}
                          animate={{ opacity: 1, x: 0, rotateY: 0 }}
                          transition={{ delay: 0.6 + i * 0.2, duration: 0.5, ease: 'easeOut' }}>
                          <div className="flex items-center gap-2">
                            <motion.div className="h-1.5 rounded-full bg-white/20"
                              initial={{ width: 0 }} animate={{ width: `${row.w * 0.4}px` }}
                              transition={{ delay: 0.8 + i * 0.2, duration: 0.6 }} />
                            <span className="text-[11px] text-white/40">{row.label}</span>
                          </div>
                          <motion.span className="text-[12px] font-mono font-medium text-white/70"
                            initial={{ opacity: 0, filter: 'blur(8px)', scale: 0.8 }}
                            animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
                            transition={{ delay: 0.9 + i * 0.2, duration: 0.4 }}>
                            {row.value}
                          </motion.span>
                        </motion.div>
                      ))}
                    </div>

                    {/* Net pay — 3D pop out */}
                    <motion.div className="border-t border-white/10 pt-4"
                      style={{ transform: 'translateZ(30px)' }}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.0 }}>
                      <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Net Pay</p>
                      <motion.p className="text-3xl font-black font-mono text-white tracking-tight"
                        initial={{ opacity: 0, scale: 0.3, rotateX: 90 }}
                        animate={{ opacity: 1, scale: 1, rotateX: 0 }}
                        transition={{ delay: 2.3, duration: 0.8, type: 'spring', stiffness: 120 }}>
                        ₹64,600
                      </motion.p>
                    </motion.div>

                    {/* Corner glows */}
                    <div className="absolute -top-12 -right-12 w-28 h-28 bg-white/[0.04] rounded-full blur-2xl" />
                    <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-white/[0.03] rounded-full blur-2xl" />

                    {/* Scan line */}
                    <motion.div className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
                      animate={{ top: ['0%', '100%'] }} transition={{ duration: 4, repeat: Infinity, ease: 'linear', repeatDelay: 2 }} />
                  </motion.div>
                </Tilt3DCard>

                {/* 3D floating notification chips */}
                {[
                  { text: 'PDF Generated', icon: Check, pos: '-left-8 top-6', delay: 1.5, xDir: -30 },
                  { text: 'Emailed to employee', icon: Send, pos: '-right-10 top-28', delay: 3.0, xDir: 30 },
                  { text: 'Encrypted & Secured', icon: Shield, pos: '-left-6 bottom-20', delay: 4.5, xDir: -30 },
                  { text: 'Compliance Verified', icon: CheckCircle2, pos: '-right-8 bottom-4', delay: 6.0, xDir: 30 },
                ].map((chip, i) => (
                  <motion.div key={i} className={`absolute ${chip.pos} z-20`}
                    style={{ perspective: '400px' }}
                    initial={{ opacity: 0, x: chip.xDir, rotateY: chip.xDir > 0 ? -20 : 20 }}
                    animate={{ opacity: [0, 1, 1, 0], x: [chip.xDir, 0, 0, chip.xDir], rotateY: [chip.xDir > 0 ? -20 : 20, 0, 0, chip.xDir > 0 ? -20 : 20] }}
                    transition={{ delay: chip.delay, duration: 2.8, times: [0, 0.15, 0.8, 1], repeat: Infinity, repeatDelay: 5 }}>
                    <motion.div className="px-3 py-2 rounded-xl border border-white/10 bg-neutral-900/90 backdrop-blur-md shadow-xl shadow-black/30"
                      whileHover={{ scale: 1.05 }}>
                      <div className="flex items-center gap-2">
                        <motion.div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center"
                          animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
                          <chip.icon className="h-3 w-3 text-white/70" />
                        </motion.div>
                        <p className="text-[10px] text-white/60 font-medium">{chip.text}</p>
                      </div>
                    </motion.div>
                  </motion.div>
                ))}

                {/* Bottom 3D mini stat cards */}
                <motion.div className="mt-5 w-full max-w-sm z-10"
                  style={{ perspective: '600px' }}
                  initial={{ opacity: 0, y: 30, rotateX: 20 }} animate={{ opacity: 1, y: 0, rotateX: 0 }}
                  transition={{ delay: 1.0, duration: 0.7, ease: 'easeOut' }}>
                  <div className="grid grid-cols-3 gap-2.5">
                    {[
                      { label: 'Generated', value: '48', bar: 100 },
                      { label: 'Emailed', value: '45', bar: 94 },
                      { label: 'Pending', value: '3', bar: 6 },
                    ].map((stat, i) => (
                      <Tilt3DCard key={stat.label} intensity={8}>
                        <motion.div className="rounded-xl border border-white/10 bg-white/[0.05] backdrop-blur-md p-3 text-center"
                          initial={{ opacity: 0, scale: 0.7, rotateY: -30 }}
                          animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                          transition={{ delay: 1.3 + i * 0.15, type: 'spring', stiffness: 150 }}>
                          <motion.p className="text-base font-bold text-white/90 font-mono"
                            animate={{ scale: [1, 1.05, 1] }}
                            transition={{ duration: 2, delay: 2 + i * 0.5, repeat: Infinity, ease: 'easeInOut' }}>
                            {stat.value}
                          </motion.p>
                          <div className="h-1 rounded-full bg-white/[0.06] mt-2 mb-1.5 overflow-hidden">
                            <motion.div className="h-full rounded-full bg-gradient-to-r from-white/20 via-white/40 to-white/20"
                              initial={{ width: '0%' }} animate={{ width: `${stat.bar}%` }}
                              transition={{ delay: 1.6 + i * 0.15, duration: 1, ease: 'easeOut' }} />
                          </div>
                          <p className="text-[9px] text-white/40 font-medium">{stat.label}</p>
                        </motion.div>
                      </Tilt3DCard>
                    ))}
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Multi-layer animated wave divider */}
        <div className="absolute bottom-0 left-0 right-0 h-28 pointer-events-none sm:h-40">
          {/* Wave layer 3 — deepest, slowest */}
          <motion.svg viewBox="0 0 1440 150" fill="none" className="absolute bottom-0 w-full" preserveAspectRatio="none"
            style={{ height: '100%' }}
            initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.6, duration: 1 }}>
            <path
              fill="rgba(255,255,255,0.15)"
              d="M0 150V90C120 60 240 80 360 70C480 60 600 90 720 80C840 70 960 50 1080 60C1200 70 1320 90 1440 80V150H0Z"
            />
          </motion.svg>

          {/* Wave layer 2 — mid, medium speed */}
          <motion.svg viewBox="0 0 1440 150" fill="none" className="absolute bottom-0 w-full" preserveAspectRatio="none"
            style={{ height: '100%' }}
            initial={{ y: 25, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.8, duration: 1 }}>
            <path
              fill="rgba(255,255,255,0.35)"
              d="M0 150V100C160 70 320 90 480 80C640 70 800 100 960 90C1120 80 1280 60 1440 70V150H0Z"
            />
          </motion.svg>

          {/* Wave layer 1 — front, fastest */}
          <motion.svg viewBox="0 0 1440 150" fill="none" className="absolute bottom-0 w-full" preserveAspectRatio="none"
            style={{ height: '100%' }}
            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 1, duration: 0.8 }}>
            <path
              fill="white"
              d="M0 150V110C180 75 360 95 540 85C720 75 900 105 1080 95C1260 85 1380 70 1440 80V150H0Z"
            />
          </motion.svg>

          {/* Foam particles on wave crests */}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <motion.div key={i}
              className="absolute w-1 h-1 rounded-full bg-white/40"
              style={{ left: `${10 + i * 16}%`, bottom: '35%' }}
              animate={{
                y: [0, -8, 2, -5, 0],
                x: [0, 6, -4, 8, 0],
                opacity: [0, 0.6, 0.3, 0.5, 0],
                scale: [0.5, 1.2, 0.8, 1, 0.5],
              }}
              transition={{ duration: 3 + i * 0.5, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }} />
          ))}
        </div>
      </section>

      {/* ═══ SALARY SLIP SHOWCASE ═══ */}
      <section className="overflow-hidden bg-neutral-50 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <Section className="mb-10 text-center sm:mb-16">
            <motion.p className="text-[11px] font-bold text-neutral-400 uppercase tracking-[0.2em] mb-3"
              initial={{ opacity: 0, letterSpacing: '0.5em' }} whileInView={{ opacity: 1, letterSpacing: '0.2em' }}
              viewport={{ once: true }} transition={{ duration: 0.8 }}>Live Preview</motion.p>
            <h2 className="mb-4 text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl md:text-4xl">Professional salary slips, auto-generated</h2>
            <p className="text-neutral-500 max-w-xl mx-auto">See exactly what your employees receive — clean, detailed, and fully compliant.</p>
          </Section>

          <div className="grid lg:grid-cols-2 gap-10 items-start">
            {/* Left — 3D Animated salary slip card */}
            <Section delay={0.1}>
              <Tilt3DCard intensity={6}>
              <motion.div whileHover={{ y: -6, boxShadow: '0 25px 60px rgba(0,0,0,0.08)' }}
                className="rounded-2xl border border-neutral-200 bg-white shadow-xl shadow-black/[0.04] p-7 relative overflow-hidden transition-shadow"
                style={{ transformStyle: 'preserve-3d' }}>
                {/* Header with stamp effect */}
                <div className="flex items-center justify-between mb-6 pb-5 border-b border-neutral-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-neutral-900 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-base font-bold text-neutral-900">Salary Slip</p>
                      <p className="text-[11px] text-neutral-400">March 2026 · EMP-001</p>
                    </div>
                  </div>
                  <Section delay={0.8}>
                    <motion.div className="px-3 py-1.5 rounded-full border-2 border-neutral-900 relative"
                      animate={{ rotate: [-3, 3, -3] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-neutral-900">Generated</span>
                    </motion.div>
                  </Section>
                </div>

                {/* Employee info */}
                <Section delay={0.3}>
                  <div className="grid grid-cols-2 gap-4 mb-6 pb-5 border-b border-neutral-100">
                    {[
                      { label: 'Employee', value: 'Arun Kumar' },
                      { label: 'Department', value: 'Engineering' },
                      { label: 'Designation', value: 'Senior Developer' },
                      { label: 'Pay Date', value: '28 Mar 2026' },
                    ].map((info) => (
                      <div key={info.label}>
                        <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">{info.label}</p>
                        <p className="text-[13px] font-medium text-neutral-800">{info.value}</p>
                      </div>
                    ))}
                  </div>
                </Section>

                {/* Earnings */}
                <Section delay={0.4}>
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-3">Earnings</p>
                  <div className="space-y-0">
                    {[{ l: 'Basic Salary', v: '₹45,000' }, { l: 'HRA', v: '₹18,000' }, { l: 'Conveyance', v: '₹3,200' }, { l: 'Medical', v: '₹5,000' }, { l: 'Special Allowance', v: '₹8,500' }].map((r, i) => (
                      <motion.div key={r.l} className="flex justify-between py-2.5 border-b border-neutral-50"
                        initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }} transition={{ delay: 0.5 + i * 0.08, duration: 0.4 }}>
                        <span className="text-[13px] text-neutral-500">{r.l}</span>
                        <motion.span className="text-[13px] font-mono font-medium text-neutral-800"
                          initial={{ opacity: 0, filter: 'blur(4px)' }} whileInView={{ opacity: 1, filter: 'blur(0px)' }}
                          viewport={{ once: true }} transition={{ delay: 0.7 + i * 0.08 }}>
                          {r.v}
                        </motion.span>
                      </motion.div>
                    ))}
                  </div>
                  <div className="flex justify-between py-3 mt-1">
                    <span className="text-[13px] font-bold text-neutral-700">Gross Salary</span>
                    <span className="text-[13px] font-mono font-bold text-neutral-900">₹79,700</span>
                  </div>
                </Section>

                {/* Deductions */}
                <Section delay={0.6}>
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-3 mt-2">Deductions</p>
                  <div className="space-y-0">
                    {[{ l: 'Provident Fund', v: '₹5,400' }, { l: 'Professional Tax', v: '₹200' }, { l: 'TDS', v: '₹4,500' }, { l: 'ESI', v: '₹5,000' }].map((r, i) => (
                      <motion.div key={r.l} className="flex justify-between py-2.5 border-b border-neutral-50"
                        initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }} transition={{ delay: 0.7 + i * 0.08, duration: 0.4 }}>
                        <span className="text-[13px] text-neutral-500">{r.l}</span>
                        <motion.span className="text-[13px] font-mono font-medium text-neutral-600"
                          initial={{ opacity: 0, filter: 'blur(4px)' }} whileInView={{ opacity: 1, filter: 'blur(0px)' }}
                          viewport={{ once: true }} transition={{ delay: 0.9 + i * 0.08 }}>
                          {r.v}
                        </motion.span>
                      </motion.div>
                    ))}
                  </div>
                  <div className="flex justify-between py-3 mt-1">
                    <span className="text-[13px] font-bold text-neutral-700">Total Deductions</span>
                    <span className="text-[13px] font-mono font-bold text-neutral-900">₹15,100</span>
                  </div>
                </Section>

                {/* Net Pay */}
                <Section delay={0.9}>
                  <motion.div className="mt-3 pt-5 border-t-2 border-neutral-900 flex justify-between items-center"
                    initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }} transition={{ delay: 1.0, type: 'spring' }}>
                    <div>
                      <p className="text-[10px] text-neutral-400 uppercase tracking-widest">Net Pay</p>
                      <p className="text-2xl font-bold font-mono text-neutral-900">₹64,600</p>
                    </div>
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      className="px-4 py-2 rounded-xl bg-neutral-900 text-white text-[12px] font-semibold flex items-center gap-2 cursor-pointer">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      Download PDF
                    </motion.div>
                  </motion.div>
                </Section>

                {/* Diagonal watermark */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-45 pointer-events-none select-none">
                  <p className="text-[60px] font-black text-neutral-100/50 tracking-widest uppercase whitespace-nowrap">PaySlip Pro</p>
                </div>

                {/* 3D Shimmer on hover */}
                <motion.div className="absolute inset-0 bg-gradient-to-tr from-transparent via-neutral-100/30 to-transparent pointer-events-none rounded-2xl"
                  initial={{ opacity: 0, x: '-100%' }}
                  whileInView={{ opacity: [0, 0.5, 0], x: ['100%'] }}
                  viewport={{ once: true }}
                  transition={{ delay: 1.5, duration: 1.2 }} />
              </motion.div>
              </Tilt3DCard>
            </Section>

            {/* Right — Batch processing animation */}
            <div className="space-y-5">
              <Section delay={0.2}>
                <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-5">
                    <motion.div className="w-9 h-9 rounded-xl bg-neutral-900 flex items-center justify-center"
                      animate={{ rotate: [0, 360] }} transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}>
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    </motion.div>
                    <div>
                      <p className="text-sm font-bold text-neutral-900">Batch Generation</p>
                      <p className="text-[11px] text-neutral-400">Processing 48 employees</p>
                    </div>
                  </div>

                  {/* Animated employee list */}
                  {[
                    { name: 'Arun Kumar', dept: 'Engineering', amount: '₹64,600', status: 'sent' },
                    { name: 'Priya Sharma', dept: 'Design', amount: '₹52,400', status: 'sent' },
                    { name: 'Rahul Verma', dept: 'Engineering', amount: '₹71,200', status: 'sent' },
                    { name: 'Sneha Patel', dept: 'Marketing', amount: '₹48,900', status: 'generating' },
                    { name: 'Vikram Singh', dept: 'Sales', amount: '₹55,300', status: 'pending' },
                  ].map((emp, i) => (
                    <motion.div key={emp.name}
                      className="flex items-center justify-between py-3 border-b border-neutral-50 last:border-0"
                      initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }} transition={{ delay: 0.3 + i * 0.12 }}>
                      <div className="flex items-center gap-3">
                        <motion.div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-[11px] font-bold text-neutral-600"
                          whileHover={{ scale: 1.15, backgroundColor: '#171717', color: '#fff' }}>
                          {emp.name.split(' ').map(n => n[0]).join('')}
                        </motion.div>
                        <div>
                          <p className="text-[13px] font-medium text-neutral-800">{emp.name}</p>
                          <p className="text-[10px] text-neutral-400">{emp.dept}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[12px] font-mono text-neutral-600">{emp.amount}</span>
                        {emp.status === 'sent' && (
                          <motion.div initial={{ scale: 0 }} whileInView={{ scale: 1 }}
                            viewport={{ once: true }} transition={{ delay: 0.6 + i * 0.12, type: 'spring', stiffness: 300 }}
                            className="w-5 h-5 rounded-full bg-neutral-900 flex items-center justify-center">
                            <Check className="h-3 w-3 text-white" />
                          </motion.div>
                        )}
                        {emp.status === 'generating' && (
                          <motion.div className="w-5 h-5 rounded-full border-2 border-neutral-300 border-t-neutral-900"
                            animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
                        )}
                        {emp.status === 'pending' && (
                          <div className="w-5 h-5 rounded-full border-2 border-neutral-200" />
                        )}
                      </div>
                    </motion.div>
                  ))}

                  {/* Progress bar */}
                  <div className="mt-4 pt-4 border-t border-neutral-100">
                    <div className="flex justify-between mb-2">
                      <span className="text-[11px] font-medium text-neutral-500">Overall Progress</span>
                      <motion.span className="text-[11px] font-bold text-neutral-900 font-mono"
                        initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
                        45/48
                      </motion.span>
                    </div>
                    <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
                      <motion.div className="h-full rounded-full bg-neutral-900"
                        initial={{ width: '0%' }} whileInView={{ width: '94%' }}
                        viewport={{ once: true }} transition={{ duration: 1.5, ease: 'easeOut', delay: 0.5 }} />
                    </div>
                  </div>
                </div>
              </Section>

              {/* Stat tiles */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Total Payroll', value: '₹31.2L', trend: '+2.1%' },
                  { label: 'Avg. Net Pay', value: '₹65,000', trend: '+1.4%' },
                  { label: 'Compliance', value: '100%', trend: 'All clear' },
                ].map((stat, i) => (
                  <Section key={stat.label} delay={0.4 + i * 0.1}>
                    <motion.div whileHover={{ y: -3, boxShadow: '0 8px 30px rgba(0,0,0,0.06)' }}
                      className="rounded-xl border border-neutral-200 bg-white p-4 text-center shadow-sm">
                      <p className="text-lg font-bold font-mono text-neutral-900">{stat.value}</p>
                      <p className="text-[10px] text-neutral-400 mt-0.5">{stat.label}</p>
                      <motion.p className="text-[10px] font-semibold text-neutral-600 mt-1.5 px-2 py-0.5 rounded-full bg-neutral-50 inline-block"
                        initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }} transition={{ delay: 0.8 + i * 0.1, type: 'spring' }}>
                        {stat.trend}
                      </motion.p>
                    </motion.div>
                  </Section>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FEATURES ═══ */}
      <section id="features" className="overflow-hidden bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <Section className="mb-10 text-center sm:mb-16">
            <motion.p className="text-[11px] font-bold text-neutral-400 uppercase tracking-[0.2em] mb-3"
              initial={{ opacity: 0, letterSpacing: '0.5em' }} whileInView={{ opacity: 1, letterSpacing: '0.2em' }}
              viewport={{ once: true }} transition={{ duration: 0.8 }}>Features</motion.p>
            <h2 className="mb-4 text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl md:text-4xl">Everything you need for payroll</h2>
            <p className="text-neutral-500 max-w-xl mx-auto">From employee management to compliance — all the tools your HR team needs in one platform.</p>
          </Section>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6" style={{ perspective: '1000px' }}>
            {features.map((feat, i) => (
              <Section key={feat.title} delay={i * 0.08}>
                <Tilt3DCard intensity={10}>
                  <motion.div
                    whileHover={{ y: -8, boxShadow: '0 20px 50px rgba(0,0,0,0.08)', rotateY: 2 }}
                    className="p-7 rounded-2xl border border-neutral-100 bg-white hover:bg-neutral-50/30 transition-all group cursor-default relative overflow-hidden"
                    style={{ transformStyle: 'preserve-3d' }}>
                    {/* 3D floating icon */}
                    <motion.div className="p-3 rounded-xl bg-neutral-100 w-fit mb-5 group-hover:bg-neutral-900 transition-colors"
                      style={{ transform: 'translateZ(20px)' }}
                      whileHover={{ rotateY: 180, scale: 1.1 }}
                      transition={{ type: 'spring', stiffness: 200 }}>
                      <feat.icon className="h-5 w-5 text-neutral-600 group-hover:text-white transition-colors" />
                    </motion.div>
                    <h3 className="text-[15px] font-bold text-neutral-900 mb-2" style={{ transform: 'translateZ(10px)' }}>{feat.title}</h3>
                    <p className="text-[13px] text-neutral-500 leading-relaxed" style={{ transform: 'translateZ(5px)' }}>{feat.desc}</p>

                    {/* Shine sweep on hover */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none -translate-x-full group-hover:translate-x-full duration-700" />
                  </motion.div>
                </Tilt3DCard>
              </Section>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PROCESS FLOW ═══ */}
      <section id="process" className="overflow-hidden bg-neutral-50 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <Section className="mb-10 text-center sm:mb-16">
            <motion.p className="text-[11px] font-bold text-neutral-400 uppercase tracking-[0.2em] mb-3"
              initial={{ opacity: 0, letterSpacing: '0.5em' }} whileInView={{ opacity: 1, letterSpacing: '0.2em' }}
              viewport={{ once: true }} transition={{ duration: 0.8 }}>How It Works</motion.p>
            <h2 className="mb-4 text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl md:text-4xl">Four simple steps to payroll bliss</h2>
            <p className="text-neutral-500 max-w-xl mx-auto">Get up and running in under 10 minutes. No training required.</p>
          </Section>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 relative" style={{ perspective: '800px' }}>
            {/* Connecting line with animated glow */}
            <div className="hidden lg:block absolute top-16 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-neutral-200 via-neutral-300 to-neutral-200">
              <motion.div className="absolute top-0 left-0 h-full w-20 bg-gradient-to-r from-transparent via-neutral-400 to-transparent"
                animate={{ x: ['0%', '2000%'] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'linear' }} />
            </div>

            {processSteps.map((step, i) => (
              <Section key={step.num} delay={i * 0.12}>
                <motion.div className="text-center relative"
                  whileHover={{ z: 30 }}
                  style={{ transformStyle: 'preserve-3d' }}>
                  <motion.div
                    whileHover={{ scale: 1.12, rotateY: 10, rotateX: -5, boxShadow: '0 15px 40px rgba(0,0,0,0.1)' }}
                    className="w-16 h-16 rounded-2xl bg-white border-2 border-neutral-200 flex items-center justify-center mx-auto mb-5 relative z-10 shadow-sm"
                    style={{ transformStyle: 'preserve-3d' }}
                    transition={{ type: 'spring', stiffness: 200 }}>
                    <motion.div style={{ transform: 'translateZ(8px)' }}>
                      <step.icon className="h-6 w-6 text-neutral-700" />
                    </motion.div>
                  </motion.div>
                  <motion.span className="text-[10px] font-bold text-neutral-300 uppercase tracking-widest"
                    initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }} transition={{ delay: 0.3 + i * 0.1 }}>
                    {step.num}
                  </motion.span>
                  <h3 className="text-[15px] font-bold text-neutral-900 mt-1.5 mb-2">{step.title}</h3>
                  <p className="text-[13px] text-neutral-500 leading-relaxed">{step.desc}</p>
                </motion.div>
              </Section>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PRICING ═══ */}
      <section id="pricing" className="py-16 bg-white overflow-hidden sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <Section className="mb-10 text-center sm:mb-16">
            <motion.p className="text-[11px] font-bold text-neutral-400 uppercase tracking-[0.2em] mb-3"
              initial={{ opacity: 0, letterSpacing: '0.5em' }} whileInView={{ opacity: 1, letterSpacing: '0.2em' }}
              viewport={{ once: true }} transition={{ duration: 0.8 }}>Pricing</motion.p>
            <h2 className="mb-4 text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl md:text-4xl">Simple, transparent pricing</h2>
            <p className="text-neutral-500 max-w-xl mx-auto">Choose the plan that fits your team today, with room to grow as your payroll needs evolve.</p>
          </Section>

          {paymentNotice && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`max-w-xl mx-auto mb-8 p-4 rounded-xl border text-sm font-medium flex items-center justify-between gap-3 ${
                paymentNotice.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              <span>{paymentNotice.message}</span>
              <button onClick={() => setPaymentNotice(null)} className="opacity-60 hover:opacity-100">✕</button>
            </motion.div>
          )}

          <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-3 md:gap-6" style={{ perspective: '1200px' }}>
            {plans.map((plan, i) => (
              <Section key={plan.name} delay={i * 0.1} className="h-full">
                <Tilt3DCard intensity={plan.popular ? 8 : 10} className="h-full">
                  <motion.div
                    whileHover={{ y: -10, boxShadow: plan.popular ? '0 30px 80px rgba(0,0,0,0.2)' : '0 20px 50px rgba(0,0,0,0.08)', rotateY: i === 0 ? 3 : i === 2 ? -3 : 0 }}
                    className={`relative flex h-full flex-col overflow-hidden rounded-2xl border-2 p-5 transition-all sm:p-7 ${
                      plan.popular ? 'border-neutral-900 bg-neutral-950 text-white md:scale-105' : 'border-neutral-100 bg-white'
                    }`}
                    style={{ transformStyle: 'preserve-3d' }}>
                    {plan.popular && (
                      <div className="mb-3 flex justify-start md:absolute md:right-4 md:top-4 md:mb-0" style={{ transform: 'translateZ(15px)' }}>
                        <motion.span className="text-[10px] font-bold uppercase tracking-wider bg-white text-black px-2.5 py-1 rounded-full flex items-center gap-1"
                          animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 2, repeat: Infinity }}>
                          <Star className="h-3 w-3" /> Most Popular
                        </motion.span>
                      </div>
                    )}

                    {/* Holographic sheen for popular */}
                    {plan.popular && (
                      <motion.div className="absolute inset-0 pointer-events-none"
                        style={{ background: 'linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.03) 50%, transparent 70%)' }}
                        animate={{ backgroundPosition: ['200% 200%', '-200% -200%'] }}
                        transition={{ duration: 5, repeat: Infinity, ease: 'linear' }} />
                    )}

                    <p className={`text-sm font-bold mb-1 ${plan.popular ? 'text-white' : 'text-neutral-900'}`} style={{ transform: 'translateZ(8px)' }}>{plan.name}</p>
                    <p className={`text-[12px] mb-4 ${plan.popular ? 'text-neutral-400' : 'text-neutral-500'}`}>{plan.desc}</p>

                    <motion.div className="flex items-baseline gap-1 mb-6" style={{ transform: 'translateZ(12px)' }}
                      initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }} transition={{ delay: 0.3 + i * 0.1, type: 'spring' }}>
                      <span className="text-3xl font-bold">{plan.price}</span>
                      {plan.period && <span className={`text-sm ${plan.popular ? 'text-neutral-400' : 'text-neutral-500'}`}>{plan.period}</span>}
                    </motion.div>

                    <ul className="mb-7 flex-1 space-y-2.5" style={{ transform: 'translateZ(5px)' }}>
                      {plan.features.map((feat, fi) => (
                        <motion.li key={feat} className="flex items-center gap-2.5 text-[13px]"
                          initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true }} transition={{ delay: 0.4 + fi * 0.06 }}>
                          <CheckCircle2 className={`h-4 w-4 shrink-0 ${plan.popular ? 'text-white/50' : 'text-neutral-400'}`} />
                          <span className={plan.popular ? 'text-neutral-300' : 'text-neutral-600'}>{feat}</span>
                        </motion.li>
                      ))}
                    </ul>

                    <motion.button whileHover={{ scale: 1.03, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} whileTap={{ scale: 0.97 }}
                      onClick={() => handlePlanClick(plan.name)}
                      style={{ transform: 'translateZ(15px)' }}
                      className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all ${
                        plan.popular
                          ? 'bg-white text-black hover:bg-neutral-100'
                          : 'bg-neutral-900 text-white hover:bg-neutral-800'
                      }`}>
                      {user && user.plan === plan.id
                        ? <Check className="h-4 w-4" />
                        : plan.name === 'Starter'
                          ? <ArrowRight className="h-4 w-4" />
                          : <CreditCard className="h-4 w-4" />}
                      {user && user.plan === plan.id ? 'Current Plan' : plan.cta}
                    </motion.button>
                  </motion.div>
                </Tilt3DCard>
              </Section>
            ))}
          </div>

          {/* Payment methods */}
          <Section delay={0.3}>
            <div className="mt-14 text-center">
              <motion.p className="text-[11px] text-neutral-400 font-medium uppercase tracking-[0.15em] mb-5"
                initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
                Accepted Payment Methods
              </motion.p>
              <div className="flex items-center justify-center gap-3.5 flex-wrap">
                {[
                  {
                    name: 'Visa',
                    icon: (
                      <svg className="h-3.5 w-auto shrink-0" viewBox="0 0 36 12" fill="none">
                        <path d="M13.6 0.3L9.0 11.7H6.1L3.7 2.5C3.5 1.7 3.3 1.4 2.7 1.1C1.8 0.6 0.8 0.2 0 0L0.1 0.3H4.9C5.5 0.3 6.0 0.7 6.1 1.4L7.3 7.8L10.3 0.3H13.6ZM24.7 8.0C24.7 5.0 20.6 4.8 20.6 3.4C20.6 3.0 21.0 2.5 22.0 2.4C22.5 2.3 23.9 2.3 25.4 3.0L26.0 0.6C25.2 0.3 24.1 0 22.7 0C19.9 0 17.9 1.5 17.9 3.6C17.9 5.2 19.3 6.1 20.4 6.6C21.5 7.2 21.9 7.5 21.9 8.0C21.9 8.8 20.9 9.1 19.9 9.1C18.5 9.1 17.3 8.7 16.7 8.4L16.0 10.9C16.8 11.3 18.2 11.6 19.7 11.6C22.7 11.6 24.7 10.1 24.7 8.0ZM32.0 11.7H34.8L32.4 0.3H29.8C29.2 0.3 28.7 0.6 28.5 1.1L24.3 11.7H27.4L28.0 10.0H31.6L32.0 11.7ZM28.9 7.6L30.4 3.4L31.3 7.6H28.9ZM17.2 0.3L14.7 11.7H12.0L14.5 0.3H17.2Z" fill="#1434CB"/>
                      </svg>
                    )
                  },
                  {
                    name: 'Mastercard',
                    icon: (
                      <svg className="h-4 w-5 shrink-0" viewBox="0 0 24 16" fill="none">
                        <circle cx="7" cy="8" r="7" fill="#EB001B"/>
                        <circle cx="17" cy="8" r="7" fill="#F79E1B"/>
                        <path d="M12 2.3A6.97 6.97 0 0 0 9.5 8 6.97 6.97 0 0 0 12 13.7 6.97 6.97 0 0 0 14.5 8 6.97 6.97 0 0 0 12 2.3Z" fill="#FF5F00"/>
                      </svg>
                    )
                  },
                  {
                    name: 'UPI',
                    icon: (
                      <div className="flex items-center justify-center px-1.5 py-0.5 rounded bg-emerald-600 text-white font-extrabold text-[9px] tracking-tighter shrink-0 leading-none shadow-sm">
                        UPI
                      </div>
                    )
                  },
                  {
                    name: 'Net Banking',
                    icon: <Landmark className="h-4 w-4 text-blue-600 shrink-0" />
                  },
                  {
                    name: 'Razorpay',
                    icon: (
                      <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
                        <path d="M15.2 2L6 14h6l-1.2 8L20 10h-6l1.2-8z" fill="#02042B"/>
                        <path d="M14.5 3.5L7 13.5h5l-1 6.5 7-8.5h-5l1.5-8z" fill="#008BFF"/>
                      </svg>
                    )
                  },
                ].map((m, i) => (
                  <motion.div key={m.name}
                    initial={{ opacity: 0, y: 15, rotateX: -20 }}
                    whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.4 + i * 0.08, type: 'spring' }}
                    whileHover={{ y: -3, boxShadow: '0 8px 25px rgba(0,0,0,0.06)', scale: 1.03 }}
                    className="px-4 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50/80 backdrop-blur-sm text-[12px] font-semibold text-neutral-700 flex items-center gap-2.5 cursor-default shadow-sm hover:border-neutral-300 transition-all">
                    {m.icon}
                    <span>{m.name}</span>
                  </motion.div>
                ))}
              </div>
              <motion.p className="text-[11px] text-neutral-400 mt-5 flex items-center justify-center gap-1.5"
                initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.8 }}>
                <motion.span animate={{ rotate: [0, 360] }} transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}>
                  <Lock className="h-3 w-3" />
                </motion.span>
                Payments secured with 256-bit SSL encryption
              </motion.p>
            </div>
          </Section>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="relative overflow-hidden bg-black py-16 text-white sm:py-24">
        <InteractiveDotGrid />
        <AnimatedGrid />
        <MorphBlob className="w-[400px] h-[400px] -top-20 -right-20 bg-white/[0.02] blur-3xl" delay={2} />
        <MorphBlob className="w-[350px] h-[350px] -bottom-20 -left-20 bg-white/[0.025] blur-3xl" delay={5} />

        {/* Floating icons background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[FileText, Users, Mail, Shield, CreditCard, Zap].map((Icon, i) => (
            <motion.div key={i} className="absolute text-white/[0.03]"
              style={{ left: `${10 + i * 15}%`, top: `${20 + (i % 3) * 25}%` }}
              animate={{ y: [0, -20, 0], rotate: [0, i % 2 ? 10 : -10, 0], opacity: [0.03, 0.06, 0.03] }}
              transition={{ duration: 5 + i, repeat: Infinity, ease: 'easeInOut', delay: i * 0.5 }}>
              <Icon className="w-12 h-12" />
            </motion.div>
          ))}
        </div>

        <Section className="relative z-10 mx-auto max-w-2xl px-4 text-center sm:px-6">
          <motion.div initial={{ scale: 0 }} whileInView={{ scale: 1 }}
            viewport={{ once: true }} transition={{ type: 'spring', stiffness: 200 }}
            className="w-16 h-16 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center mx-auto mb-6">
            <motion.div animate={{ rotateY: [0, 360] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}>
              <Zap className="h-7 w-7 text-white/70" />
            </motion.div>
          </motion.div>
          <h2 className="mb-4 text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
            <StaggerText text="Ready to simplify your payroll?" delay={0.2} />
          </h2>
          <motion.p className="text-neutral-400 mb-8 text-lg"
            initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
            viewport={{ once: true }} transition={{ delay: 0.5 }}>
            Join 500+ companies already using PaySlip Pro. Free to start, no credit card required.
          </motion.p>
          <motion.button
            whileHover={{ scale: 1.05, boxShadow: '0 10px 40px rgba(255,255,255,0.15)', y: -3 }}
            whileTap={{ scale: 0.96 }}
            onClick={handleSignUpFree}
            className="px-8 py-4 bg-white text-black rounded-xl font-bold text-sm hover:bg-neutral-100 transition-colors inline-flex items-center gap-2 shadow-lg shadow-white/5 relative overflow-hidden group">
            <span className="relative z-10 flex items-center gap-2">
              Get Started Free
              <motion.span animate={{ x: [0, 5, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
                <ArrowRight className="h-4 w-4" />
              </motion.span>
            </span>
            <motion.div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/[0.04] to-transparent"
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 3 }} />
          </motion.button>

          {/* Trust indicators */}
          <motion.div className="mt-10 flex items-center justify-center gap-6"
            initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ delay: 0.8 }}>
            {[
              { icon: Shield, text: 'Enterprise Security' },
              { icon: Clock, text: '99.9% Uptime' },
              { icon: Users, text: '10K+ Users' },
            ].map((item) => (
              <motion.div key={item.text} className="flex items-center gap-1.5"
                whileHover={{ scale: 1.05 }}>
                <item.icon className="h-3.5 w-3.5 text-white/30" />
                <span className="text-[11px] text-white/30 font-medium">{item.text}</span>
              </motion.div>
            ))}
          </motion.div>
        </Section>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="relative overflow-hidden border-t border-white/[0.05] bg-neutral-950 py-10 text-white sm:py-14">
        {/* Subtle gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <motion.div className="flex items-center gap-2.5"
              whileHover={{ scale: 1.04 }} transition={{ type: 'spring', stiffness: 300 }}>
              <motion.div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center"
                whileHover={{ rotate: [0, -10, 10, 0] }}>
                <FileText className="h-4 w-4 text-black" />
              </motion.div>
              <span className="text-sm font-bold">PaySlip Pro</span>
            </motion.div>
            <div className="flex items-center gap-8">
              {['Features', 'Pricing', 'Privacy', 'Terms'].map((l) => (
                <motion.a key={l} href="#"
                  className="text-[12px] text-neutral-500 hover:text-white transition-colors relative"
                  whileHover={{ y: -1 }}>
                  {l}
                  <motion.div className="absolute -bottom-0.5 left-0 right-0 h-px bg-white origin-left"
                    initial={{ scaleX: 0 }} whileHover={{ scaleX: 1 }}
                    transition={{ duration: 0.2 }} />
                </motion.a>
              ))}
            </div>
            <div className="flex flex-col items-center text-center gap-1">
              <p className="text-[11px] text-neutral-500">&copy; {new Date().getFullYear()} PaySlip Pro. All rights reserved.</p>
              <p className="text-[11px] text-neutral-500">
                Developed by{' '}
                <a
                  href="https://www.zigmaatech.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="zigmaa-tech-brand inline-block ml-0.5 hover:underline"
                >
                  Zigmaa Tech
                </a>
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
