import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ArrowLeft, 
  Upload, 
  Trash2, 
  Check, 
  AlertTriangle, 
  X, 
  CheckCircle, 
  Navigation, 
  ExternalLink, 
  Info,
  Lock,
  Send,
  Eye,
  EyeOff,
  HelpCircle,
  ShieldCheck,
  ChevronDown,
  Loader2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { GlassCard } from '../../components/ui/GlassCard';
import { AnimatedInput } from '../../components/ui/AnimatedInput';
import { GradientButton } from '../../components/ui/GradientButton';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { PlanUpgradeModal } from '../../components/ui/PlanUpgradeModal';
import { companyService } from '../../services/companyService';
import { paymentService } from '../../services/paymentService';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../context/LanguageContext';
import { hasMinimumPlan } from '../../lib/plans';
import { AddressSuggestionField } from '../../components/ui/AddressSuggestionField';
import { PinCodeLookupField } from '../../components/ui/PinCodeLookupField';
import { CityPicker } from '../../components/ui/CityPicker';
import { CITIES_BY_STATE, INDIAN_STATES, normalizeIndianState } from '../../lib/indianLocations';

// Monday=0 ... Sunday=6, matching the backend's Company.weekly_off_days convention.
const WEEKDAY_OPTIONS = [
  { value: 0, label: 'Mon' },
  { value: 1, label: 'Tue' },
  { value: 2, label: 'Wed' },
  { value: 3, label: 'Thu' },
  { value: 4, label: 'Fri' },
  { value: 5, label: 'Sat' },
  { value: 6, label: 'Sun' },
];

const ALL_CATEGORIES = [
  {
    id: 'salary_slips',
    label: 'Salary Slips & Reports',
    description: 'Monthly employee salary slip PDFs and payroll disbursement notices.',
  },
  {
    id: 'attendance',
    label: 'Attendance & Punch Alerts',
    description: 'Missed punch-out alerts, checkout reminders, and daily attendance notices.',
  },
  {
    id: 'leaves',
    label: 'Leave Requests & Approvals',
    description: 'Employee leave applications, permission requests, and HR approval updates.',
  },
  {
    id: 'onboarding',
    label: 'Employee Onboarding',
    description: 'Welcome emails, employee account setup, and biometric face registration invites.',
  },
  {
    id: 'security',
    label: 'Password Reset & OTPs',
    description: 'Account verification OTPs, login security alerts, and password reset codes.',
  },
  {
    id: 'system',
    label: 'System & Plan Notices',
    description: 'Subscription status, renewal alerts, and critical workspace announcements.',
  },
];

export function CompanySettingsPage() {
  const { user, updateUser, refetchUser } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasInitializedRef = useRef(false);

  const { data: company, isLoading } = useQuery({
    queryKey: ['company'],
    queryFn: () => companyService.get().then((r) => r.data),
    enabled: !!user,
  });

  const isLocked = !hasMinimumPlan(user, 'professional') || Boolean(company?.is_locked);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [celebrationPlan, setCelebrationPlan] = useState<'professional' | 'enterprise' | null>(null);

  const handleInitiateUpgrade = (plan: 'professional' | 'enterprise' = 'professional') => {
    if (!user) return;
    setError('');
    setIsUpgrading(true);
    paymentService.startPaymentFlow(
      plan,
      { name: user.full_name, email: user.email, contact: user.phone || undefined },
      async (newPlan, updatedUserData) => {
        setIsUpgrading(false);
        const upgraded = updatedUserData || { ...user, plan: newPlan as 'professional' | 'enterprise' };
        updateUser(upgraded);
        await refetchUser();
        queryClient.invalidateQueries({ queryKey: ['company'] });
        setCelebrationPlan(newPlan as 'professional' | 'enterprise');
        setSuccess('🎉 Plan upgraded successfully! Company Settings are now unlocked.');
      },
      (err) => {
        setIsUpgrading(false);
        setError(err || 'Payment was cancelled or failed.');
      }
    );
  };

  const updateCompany = useMutation({
    mutationFn: companyService.update,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company'] }),
  });

  const uploadLogo = useMutation({
    mutationFn: companyService.uploadLogo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company'] });
      setLogoSuccess('Logo uploaded & color extracted!');
      setLogoError('');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || 'Failed to upload logo. Please upload a valid PNG or JPG under 5MB.';
      setLogoError(msg);
    },
  });

  const deleteLogo = useMutation({
    mutationFn: companyService.deleteLogo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company'] });
      setLogoSuccess('Logo removed.');
      setLogoError('');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || 'Failed to remove logo.';
      setLogoError(msg);
    },
  });

  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [logoSuccess, setLogoSuccess] = useState('');
  const [logoError, setLogoError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [form, setForm] = useState({
    company_name: '',
    pay_day: '1',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    pf_number: '',
    tan_number: '',
    financial_year_start: '4',
    office_lat: '8.7892563',
    office_lng: '78.117146',
    allowed_radius_meters: '70',
    permission_days_per_month: '3',
    weekoff_days_per_month: '1',
    office_timing: '09:30 AM - 06:00 PM',
    office_start_time: '09:30',
    office_end_time: '18:00',
  });
  const [weeklyOffDays, setWeeklyOffDays] = useState<number[]>([]);
  const [enableEmployeeShiftTiming, setEnableEmployeeShiftTiming] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);

  // Custom SMTP State (White-labeling)
  const [smtpEnabled, setSmtpEnabled] = useState(false);
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpFromName, setSmtpFromName] = useState('');
  const [smtpEncryption, setSmtpEncryption] = useState<'tls' | 'ssl' | 'none'>('tls');
  const [smtpCategories, setSmtpCategories] = useState<string[]>([
    'salary_slips',
    'attendance',
    'leaves',
    'onboarding',
    'security',
    'system',
  ]);
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [showGmailHelp, setShowGmailHelp] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [isCategoriesExpanded, setIsCategoriesExpanded] = useState(false);
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [testSmtpResult, setTestSmtpResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (!company) {
      if (!isLocked) setIsEditing(true);
      return;
    }

    // If settings are locked (e.g. plan downgraded), immediately exit edit mode
    if (isLocked) {
      setIsEditing(false);
      return;
    }

    // While the user is actively editing, background queries/refetches MUST NOT
    // overwrite active form values or turn off isEditing!
    if (isEditing) {
      return;
    }

    setForm({
      company_name: company.company_name || '',
      pay_day: String(company.pay_day || 1),
      address: company.address || '',
      city: company.city || '',
      state: company.state || '',
      zip_code: company.zip_code || '',
      pf_number: company.pf_number || '',
      tan_number: company.tan_number || '',
      financial_year_start: String(company.financial_year_start || 4),
      office_lat: String(company.office_lat ?? 8.7892563),
      office_lng: String(company.office_lng ?? 78.117146),
      allowed_radius_meters: String(company.allowed_radius_meters ?? 70),
      permission_days_per_month: String(company.permission_days_per_month ?? 3),
      weekoff_days_per_month: String(company.weekoff_days_per_month ?? 1),
      office_timing: company.office_timing || '09:30 AM - 06:00 PM',
      office_start_time: company.office_start_time || '09:30',
      office_end_time: company.office_end_time || '18:00',
    });
    setWeeklyOffDays(company.weekly_off_days || []);
    setEnableEmployeeShiftTiming(Boolean(company.enable_employee_shift_timing));

    // Populate SMTP settings from company
    setSmtpEnabled(Boolean(company.smtp_enabled));
    setSmtpHost(company.smtp_host || 'smtp.gmail.com');
    setSmtpPort(String(company.smtp_port || 587));
    setSmtpUser(company.smtp_user || '');
    setSmtpPassword('');
    setSmtpFromName(company.smtp_from_name || '');
    setSmtpEncryption(company.smtp_use_ssl ? 'ssl' : (company.smtp_use_tls !== false ? 'tls' : 'none'));
    if (company.smtp_categories && Array.isArray(company.smtp_categories) && company.smtp_categories.length > 0) {
      setSmtpCategories(company.smtp_categories);
    } else {
      setSmtpCategories(['salary_slips', 'attendance', 'leaves', 'onboarding', 'security', 'system']);
    }
    setTestEmail(user?.email || company.smtp_user || '');

    // Only auto-determine edit mode ONCE on initial company load
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      const isNewOrIncomplete =
        !company.company_name ||
        company.company_name === 'My Company' ||
        (!company.address && !company.city);

      setIsEditing(isNewOrIncomplete);
    }
  }, [company, isLocked, user, isEditing]);

  const toggleCategory = (categoryId: string) => {
    if (!isEditing) return;
    setSmtpCategories((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]
    );
  };

  const selectAllCategories = () => {
    if (!isEditing) return;
    setSmtpCategories(['salary_slips', 'attendance', 'leaves', 'onboarding', 'security', 'system']);
  };

  const clearAllCategories = () => {
    if (!isEditing) return;
    setSmtpCategories([]);
  };

  const handleEncryptionChange = (enc: 'tls' | 'ssl' | 'none') => {
    if (!isEditing) return;
    setSmtpEncryption(enc);
    if (enc === 'tls') setSmtpPort('587');
    else if (enc === 'ssl') setSmtpPort('465');
    else if (enc === 'none') setSmtpPort('25');
  };

  const handlePortChange = (val: string) => {
    if (!isEditing) return;
    setSmtpPort(val);
    const p = parseInt(val, 10);
    if (p === 465) setSmtpEncryption('ssl');
    else if (p === 587) setSmtpEncryption('tls');
    else if (p === 25) setSmtpEncryption('none');
  };

  const handleTestSmtp = async () => {
    if (!smtpUser) {
      setTestSmtpResult({ success: false, message: 'Please enter a Sender Email Address to test.' });
      return;
    }
    if (!smtpPassword && !company?.smtp_password_configured) {
      setTestSmtpResult({ success: false, message: 'Please enter an SMTP / App Password to test.' });
      return;
    }
    const targetEmail = testEmail.trim() || user?.email || smtpUser;
    setIsTestingSmtp(true);
    setTestSmtpResult(null);
    try {
      const res = await companyService.testSmtp({
        smtp_host: smtpHost || 'smtp.gmail.com',
        smtp_port: parseInt(smtpPort, 10) || 587,
        smtp_user: smtpUser,
        smtp_password: smtpPassword || undefined,
        smtp_from_name: smtpFromName || form.company_name,
        smtp_use_tls: smtpEncryption === 'tls',
        smtp_use_ssl: smtpEncryption === 'ssl',
        test_email: targetEmail,
      });
      setTestSmtpResult({
        success: Boolean(res.data?.success),
        message: res.data?.message || 'Verification email sent successfully!',
      });
      queryClient.invalidateQueries({ queryKey: ['company'] });
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.detail || err.message || 'SMTP connection test failed.';
      setTestSmtpResult({ success: false, message: String(msg) });
    } finally {
      setIsTestingSmtp(false);
    }
  };

  const handleAskZigmaaAi = () => {
    window.dispatchEvent(
      new CustomEvent('open-zigmaa-ai', {
        detail: {
          prompt:
            'How do I generate a 16-digit Google App Password for Custom Email Delivery in PaySlipPro? Please explain the step-by-step process in simple terms.',
        },
      })
    );
  };

  // Auto-dismiss success notification after 2 seconds
  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => {
      setSuccess('');
    }, 2000);
    return () => clearTimeout(timer);
  }, [success]);

  // Auto-dismiss logo success notification after 2 seconds
  useEffect(() => {
    if (!logoSuccess) return;
    const timer = setTimeout(() => {
      setLogoSuccess('');
    }, 2000);
    return () => clearTimeout(timer);
  }, [logoSuccess]);

  // Auto-dismiss logo error notification after 4 seconds
  useEffect(() => {
    if (!logoError) return;
    const timer = setTimeout(() => {
      setLogoError('');
    }, 4000);
    return () => clearTimeout(timer);
  }, [logoError]);

  // Auto-dismiss general error notification after 4 seconds
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => {
      setError('');
    }, 4000);
    return () => clearTimeout(timer);
  }, [error]);

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const format12Hour = (time24: string) => {
    if (!time24) return '';
    const [hStr, mStr] = time24.split(':');
    let h = parseInt(hStr, 10);
    const m = mStr || '00';
    if (isNaN(h)) return time24;
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
  };

  const handleStartTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setForm((prev) => {
      const start = format12Hour(val);
      const end = format12Hour(prev.office_end_time);
      return {
        ...prev,
        office_start_time: val,
        office_timing: start && end ? `${start} - ${end}` : prev.office_timing,
      };
    });
  };

  const handleEndTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setForm((prev) => {
      const start = format12Hour(prev.office_start_time);
      const end = format12Hour(val);
      return {
        ...prev,
        office_end_time: val,
        office_timing: start && end ? `${start} - ${end}` : prev.office_timing,
      };
    });
  };

  const toggleWeeklyOffDay = (day: number) => {
    if (isLocked || !isEditing) return;
    setWeeklyOffDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const handleDetectLocation = () => {
    if (isLocked) {
      handleInitiateUpgrade('professional');
      return;
    }
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    setIsDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsDetectingLocation(false);
        setForm((prev) => ({
          ...prev,
          office_lat: pos.coords.latitude.toFixed(7),
          office_lng: pos.coords.longitude.toFixed(7),
        }));
        setSuccess('Current office location detected!');
      },
      (_err) => {
        setIsDetectingLocation(false);
        setError('Could not detect location. Please allow GPS location permissions.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = () => {
    if (isLocked) {
      handleInitiateUpgrade('professional');
      return;
    }
    setError('');
    setSuccess('');
    if (form.zip_code && !/^\d{6}$/.test(form.zip_code)) {
      setError('Enter a valid 6-digit Indian PIN code.');
      return;
    }
    const payDay = parseInt(form.pay_day, 10);
    if (form.pay_day && (!Number.isFinite(payDay) || payDay < 1 || payDay > 31)) {
      setError('Pay Day of Month must be a number between 1 and 31.');
      return;
    }
    const fyStart = parseInt(form.financial_year_start, 10);
    if (form.financial_year_start && (!Number.isFinite(fyStart) || fyStart < 1 || fyStart > 12)) {
      setError('Financial Year Start must be a month number between 1 and 12.');
      return;
    }
    const lat = parseFloat(form.office_lat);
    if (form.office_lat && (!Number.isFinite(lat) || lat < -90 || lat > 90)) {
      setError('Office Latitude must be a valid number between -90 and 90.');
      return;
    }
    const lng = parseFloat(form.office_lng);
    if (form.office_lng && (!Number.isFinite(lng) || lng < -180 || lng > 180)) {
      setError('Office Longitude must be a valid number between -180 and 180.');
      return;
    }
    const radius = parseInt(form.allowed_radius_meters, 10);
    if (form.allowed_radius_meters && (!Number.isFinite(radius) || radius < 1 || radius > 50000)) {
      setError('Allowed Radius must be a number between 1 and 50000 meters.');
      return;
    }
    updateCompany.mutate(
      {
        company_name: form.company_name || undefined,
        pay_day: parseInt(form.pay_day) || 1,
        address: form.address || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        zip_code: form.zip_code || undefined,
        pf_number: form.pf_number || undefined,
        tan_number: form.tan_number || undefined,
        financial_year_start: parseInt(form.financial_year_start) || 4,
        office_lat: form.office_lat ? parseFloat(form.office_lat) : undefined,
        office_lng: form.office_lng ? parseFloat(form.office_lng) : undefined,
        allowed_radius_meters: form.allowed_radius_meters ? parseInt(form.allowed_radius_meters) : undefined,
        weekly_off_days: weeklyOffDays,
        permission_days_per_month: form.permission_days_per_month ? parseInt(form.permission_days_per_month) : undefined,
        weekoff_days_per_month: form.weekoff_days_per_month ? parseInt(form.weekoff_days_per_month) : 1,
        office_timing: (form.office_start_time && form.office_end_time)
          ? `${format12Hour(form.office_start_time)} - ${format12Hour(form.office_end_time)}`
          : (form.office_timing || undefined),
        office_start_time: form.office_start_time || undefined,
        office_end_time: form.office_end_time || undefined,
        enable_employee_shift_timing: enableEmployeeShiftTiming,
        // Custom Outgoing SMTP & Email Delivery
        smtp_enabled: smtpEnabled,
        smtp_host: smtpHost.trim() || 'smtp.gmail.com',
        smtp_port: parseInt(smtpPort, 10) || 587,
        smtp_user: smtpUser.trim() || undefined,
        smtp_password: smtpPassword ? smtpPassword.trim() : undefined,
        smtp_from_name: smtpFromName.trim() || undefined,
        smtp_use_tls: smtpEncryption === 'tls',
        smtp_use_ssl: smtpEncryption === 'ssl',
        smtp_categories: smtpCategories,
      },
      {
        onSuccess: () => {
          setSuccess('Settings saved successfully!');
          setIsSaved(true);
          setIsEditing(false);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          setTimeout(() => {
            setIsSaved(false);
          }, 2000);
        },
        onError: () => {
          setError('Failed to save settings.');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        },
      }
    );
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isLocked) {
      handleInitiateUpgrade('professional');
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoError('');
    setLogoSuccess('');

    // Check file format strictly: PNG or JPG/JPEG only
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const validExtensions = ['png', 'jpg', 'jpeg'];
    const validMimes = ['image/png', 'image/jpeg', 'image/pjpeg'];

    const isValidType = validExtensions.includes(ext) || validMimes.includes(file.type.toLowerCase());

    if (!isValidType) {
      const errMsg = 'Invalid format! Please upload only PNG or JPG image. (Max 5MB)';
      setLogoError(errMsg);
      e.target.value = '';
      return;
    }

    // Check file size: Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      const errMsg = 'File size exceeds 5MB! Please upload an image under 5MB.';
      setLogoError(errMsg);
      e.target.value = '';
      return;
    }

    uploadLogo.mutate(file);
    e.target.value = '';
  };

  if (isLoading) return <LoadingSpinner />;

  const extractedColor = company?.primary_color || '#000000';
  const stateOptions: string[] = [...INDIAN_STATES];
  if (form.state && !stateOptions.includes(form.state)) stateOptions.push(form.state);
  const cityOptions = [...(CITIES_BY_STATE[form.state] || [])];
  if (form.city && !cityOptions.includes(form.city)) cityOptions.unshift(form.city);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header with Top Edit/Upgrade Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-2">
          <Link to="/settings" className="mt-0.5 rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white" aria-label="Back to settings" title="Back to settings">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-bold text-neutral-900 dark:text-white sm:text-2xl">{t('company.title', 'Company Settings')}</h2>
              {isLocked && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  <Lock className="w-3 h-3" />
                  Locked (Pro)
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              {t('company.subtitle', 'Configure your company profile, branding logo, and statutory details for salary slips')}
            </p>
          </div>
        </div>
        {isLocked ? (
          <GradientButton
            onClick={() => handleInitiateUpgrade('professional')}
            isLoading={isUpgrading}
            className="w-full sm:w-auto shadow-sm"
          >
            <Lock className="w-3.5 h-3.5 mr-1.5" />
            Upgrade to Edit Settings
          </GradientButton>
        ) : !isEditing ? (
          <GradientButton
            variant="secondary"
            onClick={() => setIsEditing(true)}
            className="w-full sm:w-auto"
          >
            {t('company.editSettings', 'Edit Settings')}
          </GradientButton>
        ) : null}
      </div>

      {/* Top Status Alerts with Auto-Dismiss and Animations */}
      <AnimatePresence mode="wait">
        {success && (
          <motion.div
            key="success-banner"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="flex items-center justify-between gap-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 px-4 py-3 rounded-xl text-sm shadow-sm"
          >
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{success}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccess('')}
              className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-200 p-0.5 rounded-lg transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
        {error && (
          <motion.div
            key="error-banner"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="flex items-center justify-between gap-3 bg-red-50 dark:bg-rose-950/40 border border-red-200 dark:border-rose-800 text-red-700 dark:text-rose-300 px-4 py-3 rounded-xl text-sm shadow-sm"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500 dark:text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError('')}
              className="text-red-500 hover:text-red-700 dark:text-rose-400 dark:hover:text-rose-200 p-0.5 rounded-lg transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Logo Section */}
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
            {t('company.companyLogo', 'Company Logo')}
          </h3>
          {isLocked && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
              <Lock className="w-3 h-3" /> Locked (Pro)
            </span>
          )}
        </div>

        {/* In-Card Logo Notifications */}
        <AnimatePresence mode="wait">
          {logoSuccess && (
            <motion.div
              key="logo-success-banner"
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="flex items-center justify-between gap-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 px-4 py-3 rounded-xl mb-4 text-sm shadow-sm"
            >
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{logoSuccess}</span>
              </div>
              <button
                type="button"
                onClick={() => setLogoSuccess('')}
                className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-200 p-0.5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          )}
          {logoError && (
            <motion.div
              key="logo-error-banner"
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="flex items-center justify-between gap-3 bg-red-50 dark:bg-rose-950/40 border border-red-200 dark:border-rose-800 text-red-700 dark:text-rose-300 px-4 py-3 rounded-xl mb-4 text-sm shadow-sm"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500 dark:text-rose-400 shrink-0" />
                <span>{logoError}</span>
              </div>
              <button
                type="button"
                onClick={() => setLogoError('')}
                className="text-red-500 hover:text-red-700 dark:text-rose-400 dark:hover:text-rose-200 p-0.5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
          {/* Logo preview */}
          <div className="flex h-28 w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800/80 p-2 sm:w-[200px] sm:shrink-0">
            {company?.logo_data ? (
              <img src={company.logo_data} alt="Logo" className="max-w-full max-h-full object-contain" />
            ) : (
              <span className="text-neutral-400 dark:text-neutral-500 text-xs text-center px-2">No logo</span>
            )}
          </div>
          <div className="w-full min-w-0 space-y-3 sm:w-auto">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,.png,.jpg,.jpeg"
              onChange={handleLogoUpload}
              className="hidden"
            />
            <GradientButton
              onClick={() => {
                if (isLocked) {
                  handleInitiateUpgrade('professional');
                } else {
                  fileInputRef.current?.click();
                }
              }}
              isLoading={uploadLogo.isPending}
              disabled={!isLocked && !isEditing}
            >
              {isLocked ? <Lock className="h-4 w-4 mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
              {isLocked
                ? 'Upgrade to Upload Logo'
                : company?.logo_data
                ? t('company.uploadLogo', 'Change Logo')
                : t('company.uploadLogo', 'Upload Logo')}
            </GradientButton>
            {company?.logo_data && (
              <button
                onClick={() => {
                  if (isLocked) {
                    handleInitiateUpgrade('professional');
                    return;
                  }
                  setLogoSuccess('');
                  deleteLogo.mutate();
                }}
                disabled={!isEditing && !isLocked}
                className="flex items-center gap-1 text-sm text-neutral-500 hover:text-black dark:text-neutral-400 dark:hover:text-white transition-colors disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> {t('company.deleteLogo', 'Delete Logo')}
              </button>
            )}
            <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
              PNG or JPG. Auto-cropped to 1080x1080. Max 5MB.
            </p>

            {/* Extracted color display */}
            {company?.logo_data && (
              <div className="flex items-center gap-2 mt-2">
                <div
                  className="w-6 h-6 rounded-full border border-neutral-300 dark:border-neutral-600 shadow-sm"
                  style={{ backgroundColor: extractedColor }}
                />
                <span className="text-sm text-neutral-600 dark:text-neutral-300">
                  Slip theme color: <span className="font-mono font-semibold text-neutral-900 dark:text-white">{extractedColor}</span>
                </span>
              </div>
            )}
          </div>
        </div>
      </GlassCard>

      {/* Company Info */}
      <GlassCard>
        <h3 className="text-lg font-semibold mb-4">{t('company.companyDetails', 'Company Information')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatedInput label={t('company.companyName', 'Company Name')} placeholder="Acme Corp" value={form.company_name} onChange={handleChange('company_name')} disabled={!isEditing} />
          <AnimatedInput label={t('company.payDay', 'Pay Day of Month')} type="number" placeholder="1" value={form.pay_day} onChange={handleChange('pay_day')} disabled={!isEditing} />
          <AddressSuggestionField
            value={form.address}
            disabled={!isEditing}
            onChange={(address) => setForm((prev) => ({ ...prev, address }))}
            onSelect={(suggestion) => setForm((prev) => ({
              ...prev,
              address: suggestion.address,
              city: suggestion.city || prev.city,
              state: suggestion.state ? normalizeIndianState(suggestion.state) : prev.state,
              zip_code: /^\d{6}$/.test(suggestion.zip_code) ? suggestion.zip_code : prev.zip_code,
            }))}
          />
          <div className="min-w-0 space-y-1">
            <label htmlFor="company-state" className="block text-sm font-medium text-gray-700 dark:text-neutral-300">{t('company.state', 'State')}</label>
            <select
              id="company-state"
              value={form.state}
              disabled={!isEditing}
              onChange={(event) => setForm((prev) => ({ ...prev, state: event.target.value, city: '', zip_code: '' }))}
              className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-neutral-900 outline-none focus:border-black disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:focus:border-white"
            >
              <option value="">{t('company.state', 'Select state')}</option>
              {stateOptions.map((state) => <option key={state} value={state}>{state}</option>)}
            </select>
          </div>
          <CityPicker value={form.city} state={form.state} options={cityOptions} disabled={!isEditing || !form.state} onChange={(city) => setForm((prev) => ({ ...prev, city }))} />
          <PinCodeLookupField
            value={form.zip_code}
            disabled={!isEditing}
            onChange={(zip_code) => setForm((prev) => ({ ...prev, zip_code }))}
            onSelectArea={(city, state) => setForm((prev) => ({ ...prev, city, state: normalizeIndianState(state) }))}
          />
        </div>
      </GlassCard>

      {/* Statutory */}
      <GlassCard>
        <h3 className="text-lg font-semibold mb-4 text-neutral-900 dark:text-white">{t('employees.statutoryDetails', 'Statutory Details')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <AnimatedInput label="PF Number" placeholder="MH/BOM/12345" value={form.pf_number} onChange={handleChange('pf_number')} disabled={!isEditing} />
          <AnimatedInput label="TAN Number" placeholder="MUMB12345E" value={form.tan_number} onChange={handleChange('tan_number')} disabled={!isEditing} />
          <AnimatedInput label="Financial Year Start (Month)" type="number" placeholder="4" value={form.financial_year_start} onChange={handleChange('financial_year_start')} disabled={!isEditing} />
        </div>
      </GlassCard>

      {/* Biometric Attendance & Office Geofence Coordinates */}
      {/* Biometric Attendance & Office Geofence Coordinates */}
      <GlassCard>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
              {t('company.geoFencing', 'Biometric Location & Geofencing')}
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              {t('company.geoFencingDesc', 'Configure office GPS coordinates and maximum allowed distance (meters) for employee biometric face scan check-ins.')}
            </p>
          </div>
          {isEditing && (
            <button
              type="button"
              onClick={handleDetectLocation}
              disabled={isDetectingLocation}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700 transition-colors cursor-pointer self-start sm:self-auto"
            >
              <Navigation className={`h-3.5 w-3.5 ${isDetectingLocation ? 'animate-spin' : ''}`} />
              <span>{isDetectingLocation ? t('company.detectingLocation', 'Detecting GPS...') : t('company.detectLocation', 'Detect Current Location')}</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <AnimatedInput
            label={t('company.latitude', 'Office Latitude')}
            placeholder="8.7892563"
            value={form.office_lat}
            onChange={handleChange('office_lat')}
            disabled={!isEditing}
          />
          <AnimatedInput
            label={t('company.longitude', 'Office Longitude')}
            placeholder="78.117146"
            value={form.office_lng}
            onChange={handleChange('office_lng')}
            disabled={!isEditing}
          />
          <AnimatedInput
            label={t('company.allowedRadius', 'Allowed Radius (Meters)')}
            type="number"
            placeholder="70"
            value={form.allowed_radius_meters}
            onChange={handleChange('allowed_radius_meters')}
            disabled={!isEditing}
          />
        </div>

        {/* GPS Coordinates Lookup Hint & Browser Permission Note */}
        <div className="mt-4 p-3.5 rounded-xl bg-neutral-50/80 dark:bg-neutral-900/50 border border-neutral-200/80 dark:border-neutral-800 text-xs text-neutral-700 dark:text-neutral-300">
          <div className="flex items-start gap-2.5">
            <div className="p-1.5 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400 shrink-0 mt-0.5">
              <Info className="h-4 w-4" />
            </div>
            <div className="space-y-2 leading-relaxed min-w-0 flex-1">
              <p className="text-xs text-neutral-700 dark:text-neutral-300">
                <span className="font-semibold text-neutral-900 dark:text-white">
                  {t('company.geoFencingHintTitle', "Don't know your Office Latitude & Longitude?")}{' '}
                </span>
                <span>
                  {t('company.geoFencingHintDesc', 'You can check your exact office location coordinates using')}{' '}
                </span>
                <a
                  href="https://www.gps-coordinates.net/my-location"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline inline-flex items-center gap-1"
                >
                  <span>gps-coordinates.net/my-location</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </p>
              <div className="p-2 rounded-lg bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/40 text-[11px] text-amber-900 dark:text-amber-200 flex items-start gap-2">
                <span className="font-bold text-amber-700 dark:text-amber-400 shrink-0">Note:</span>
                <span>
                  {t('company.geoFencingNote', 'When visiting the website, please allow / turn on Location permission in your browser to accurately detect your current office coordinates.')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {form.office_lat && form.office_lng && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-neutral-800 text-xs text-neutral-500 dark:text-neutral-400">
            <span>
              Target Coordinates: <strong className="font-mono text-neutral-800 dark:text-neutral-200">{form.office_lat}, {form.office_lng}</strong> (within {form.allowed_radius_meters}m)
            </span>
          </div>
        )}

        {/* Office Working Hours */}
        <div className="mt-5 pt-4 border-t border-gray-100 dark:border-neutral-800">
          <div className="mb-3">
            <h4 className="text-sm font-semibold text-neutral-900 dark:text-white">
              {t('company.officeWorkingHours', 'Office Working Hours')}
            </h4>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              {t('company.officeTimingDesc', 'Set standard daily office working hours for employee attendance check-ins, late cutoff, and check-out tracking.')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatedInput
              label={t('company.startTime', 'Office Start Time (Check-In Cutoff)')}
              type="time"
              placeholder="09:30"
              value={form.office_start_time}
              onChange={handleStartTimeChange}
              disabled={!isEditing}
            />
            <AnimatedInput
              label={t('company.endTime', 'Office End Time (Check-Out Time)')}
              type="time"
              placeholder="18:00"
              value={form.office_end_time}
              onChange={handleEndTimeChange}
              disabled={!isEditing}
            />
          </div>

          <div className="mt-5 pt-4 border-t border-gray-100 dark:border-neutral-800 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-neutral-900 dark:text-white">Per-Employee Office Timing</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Optional. When enabled, HR can set a custom shift start/end time for individual employees while
                adding or editing them (e.g. one employee works 9:30 AM–5:00 PM, another 10:00 AM–5:30 PM). Employees
                left blank keep using the company's default timing above.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enableEmployeeShiftTiming}
              disabled={!isEditing}
              onClick={() => setEnableEmployeeShiftTiming((prev) => !prev)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                enableEmployeeShiftTiming ? 'bg-neutral-900 dark:bg-white' : 'bg-neutral-300 dark:bg-neutral-700'
              }`}
            >
              <span
                className={`inline-block h-4.5 w-4.5 transform rounded-full transition-transform ${
                  enableEmployeeShiftTiming
                    ? 'translate-x-5.5 bg-white dark:bg-neutral-900 shadow-sm'
                    : 'translate-x-1 bg-white dark:bg-neutral-300 shadow-sm'
                }`}
              />
            </button>
          </div>
        </div>
      </GlassCard>

      {/* Leave & Attendance Rules */}
      <GlassCard>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
          <div>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
              {t('company.leaveRules', 'Leave & Attendance Rules')}
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {t('company.leaveRulesDesc', 'Configure company-wide weekly off day(s). Supports single-day (e.g. Sunday) or 2-day weekend policies (e.g. Saturday & Sunday).')}
            </p>
          </div>
          <div className="shrink-0">
            {weeklyOffDays.length === 0 ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-xs font-semibold border border-amber-200 dark:border-amber-800">
                7 Days Working (No Weekly Off)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-xs font-semibold border border-neutral-200 dark:border-neutral-700">
                {weeklyOffDays.length} {weeklyOffDays.length === 1 ? 'Day' : 'Days'} Off / Week
              </span>
            )}
          </div>
        </div>

        {isEditing && (
          <div className="flex flex-wrap items-center gap-2 mb-3 pt-2">
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">Quick Presets:</span>
            <button
              type="button"
              onClick={() => setWeeklyOffDays([6])}
              className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                weeklyOffDays.length === 1 && weeklyOffDays[0] === 6
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-transparent shadow-sm'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}
            >
              Sunday Only (1 Day)
            </button>
            <button
              type="button"
              onClick={() => setWeeklyOffDays([5, 6])}
              className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                weeklyOffDays.length === 2 && weeklyOffDays.includes(5) && weeklyOffDays.includes(6)
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-transparent shadow-sm'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}
            >
              Saturday & Sunday (2 Days)
            </button>
            <button
              type="button"
              onClick={() => setWeeklyOffDays([4, 5])}
              className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                weeklyOffDays.length === 2 && weeklyOffDays.includes(4) && weeklyOffDays.includes(5)
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-transparent shadow-sm'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}
            >
              Friday & Saturday (2 Days)
            </button>
            <button
              type="button"
              onClick={() => setWeeklyOffDays([])}
              className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                weeklyOffDays.length === 0
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-transparent shadow-sm'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}
            >
              Clear All (7 Days)
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mt-2">
          {WEEKDAY_OPTIONS.map((opt) => {
            const checked = weeklyOffDays.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                disabled={!isEditing}
                onClick={() => toggleWeeklyOffDay(opt.value)}
                aria-pressed={checked}
                className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                  checked
                    ? 'bg-neutral-900 border-neutral-900 text-white dark:bg-white dark:border-white dark:text-neutral-900 shadow-sm'
                    : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-neutral-400 dark:hover:border-neutral-500'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Multi-Module Synchronization Info Callout */}
        <div className="mt-4 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-600 dark:text-neutral-400 space-y-1">
          <p className="font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
            <span>✓</span> Automated Multi-Module Synchronization:
          </p>
          <ul className="list-disc list-inside space-y-0.5 ml-1">
            <li><strong>Attendance:</strong> Configured weekly offs are locked as paid &ldquo;Company Off&rdquo; without salary deduction.</li>
            <li><strong>Biometric Kiosk:</strong> Weekend punches and monthly audit reports recognize these days and do not mark employees absent.</li>
            <li><strong>Leave Requests:</strong> Approved leave spanning weekly off days does not deduct from the employee&apos;s leave allowance or salary.</li>
          </ul>
        </div>

        <div className="mt-5 pt-4 border-t border-neutral-100 dark:border-neutral-800 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
          <div>
            <AnimatedInput
              label={t('company.freeWeekoffs', 'Monthly Paid Weekoffs (Days / Month)')}
              type="number"
              placeholder="1"
              value={form.weekoff_days_per_month}
              onChange={handleChange('weekoff_days_per_month')}
              disabled={!isEditing}
            />
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5">
              Flexible paid weekoff days an employee can claim per month with 0 salary deduction (e.g. 1 day = 1 full day or 2 half-days; 2 days = 2 full days or 4 half-days). Approved leaves within this quota are automatically marked as paid Weekoffs.
            </p>
          </div>
          <div>
            <AnimatedInput
              label={t('company.freePermissions', 'Free Permissions per Month')}
              type="number"
              placeholder="3"
              value={form.permission_days_per_month}
              onChange={handleChange('permission_days_per_month')}
              disabled={!isEditing}
            />
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5">
              Number of permission requests an employee can take per month with 0 salary deduction.
              Any permission beyond this count deducts 1 full day&apos;s pay each.
            </p>
          </div>
        </div>
      </GlassCard>

      {/* Custom Email & SMTP Delivery (White-labeling) */}
      <GlassCard>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
                Custom Email Delivery (White-labeling)
              </h3>
              {company?.smtp_enabled && (
                company?.smtp_verified ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    <ShieldCheck className="h-3 w-3" />
                    Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    <AlertTriangle className="h-3 w-3" />
                    Unverified
                  </span>
                )
              )}
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Dispatch salary slips, punch alerts, and HR notices directly from your corporate domain or email.
            </p>
          </div>

          {/* Master Enable/Disable Switch */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              {smtpEnabled ? 'Custom Email Active' : 'Default Platform Email'}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={smtpEnabled}
              disabled={!isEditing}
              onClick={() => {
                if (isEditing) setSmtpEnabled((prev) => !prev);
              }}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                smtpEnabled ? 'bg-neutral-900 dark:bg-white' : 'bg-neutral-300 dark:bg-neutral-700'
              }`}
            >
              <span
                className={`inline-block h-4.5 w-4.5 transform rounded-full transition-transform ${
                  smtpEnabled
                    ? 'translate-x-5.5 bg-white dark:bg-neutral-900 shadow-sm'
                    : 'translate-x-1 bg-white dark:bg-neutral-300 shadow-sm'
                }`}
              />
            </button>
          </div>
        </div>

        {/* When Disabled Notice */}
        {!smtpEnabled && (
          <div className="p-3.5 rounded-xl bg-neutral-100/70 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/60 text-xs text-neutral-600 dark:text-neutral-300 flex items-start gap-2.5">
            <Info className="h-4 w-4 shrink-0 text-neutral-500 mt-0.5" />
            <div>
              <p className="font-semibold text-neutral-800 dark:text-neutral-200">
                Using PaySlipPro Default Outgoing Engine
              </p>
              <p className="mt-0.5 text-neutral-500 dark:text-neutral-400">
                All outgoing notifications and salary slips are sent seamlessly from the default platform server with your company name shown as the sender. Enable the switch above if you want emails delivered directly from your own email server.
              </p>
            </div>
          </div>
        )}

        {/* Configuration Details (Visible when enabled) */}
        {smtpEnabled && (
          <div className="space-y-6 mt-4">
            {/* SMTP Server Credentials Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AnimatedInput
                label="Sender Display Name"
                placeholder="e.g. Acme Corp HR"
                value={smtpFromName}
                onChange={(e) => isEditing && setSmtpFromName(e.target.value)}
                disabled={!isEditing}
              />
              <AnimatedInput
                label="Sender Email Address (Username)"
                type="email"
                placeholder="hr@yourcompany.com"
                value={smtpUser}
                onChange={(e) => isEditing && setSmtpUser(e.target.value)}
                disabled={!isEditing}
              />
              <AnimatedInput
                label="SMTP Host"
                placeholder="smtp.gmail.com"
                value={smtpHost}
                onChange={(e) => isEditing && setSmtpHost(e.target.value)}
                disabled={!isEditing}
              />
              <div className="grid grid-cols-2 gap-2">
                <AnimatedInput
                  label="SMTP Port"
                  type="number"
                  placeholder="587"
                  value={smtpPort}
                  onChange={(e) => handlePortChange(e.target.value)}
                  disabled={!isEditing}
                />
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5">
                    Encryption
                  </label>
                  <select
                    disabled={!isEditing}
                    value={smtpEncryption}
                    onChange={(e) => handleEncryptionChange(e.target.value as any)}
                    className="w-full h-11 px-3 text-sm rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option value="tls">TLS / STARTTLS (587)</option>
                    <option value="ssl">SSL (465)</option>
                    <option value="none">Plain (25)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Password Field with masked support & toggle */}
            <div className="relative">
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5 flex items-center justify-between">
                <span>SMTP Password / Google App Password</span>
                {company?.smtp_password_configured && (
                  <span className="text-[11px] font-normal normal-case text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" /> Password securely saved
                  </span>
                )}
              </label>
              <div className="relative flex items-center">
                <input
                  type={showSmtpPassword ? 'text' : 'password'}
                  disabled={!isEditing}
                  value={smtpPassword}
                  autoComplete="new-password"
                  data-lpignore="true"
                  onChange={(e) => isEditing && setSmtpPassword(e.target.value)}
                  placeholder={
                    company?.smtp_password_configured
                      ? '•••••••• (Enter new password only if changing)'
                      : 'Enter 16-digit Google App Password or SMTP password'
                  }
                  className="w-full h-11 px-3.5 pr-10 text-sm rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                  className="absolute right-3 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer focus:outline-none"
                  title={showSmtpPassword ? 'Hide password' : 'Show password'}
                >
                  {showSmtpPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Gmail Guide Helper Button */}
              <button
                type="button"
                onClick={() => setShowGmailHelp((prev) => !prev)}
                className="mt-2 text-xs text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white flex items-center gap-1.5 cursor-pointer font-medium focus:outline-none focus:ring-0 active:outline-none select-none transition-colors"
              >
                <HelpCircle className="h-3.5 w-3.5 shrink-0" />
                <span>Using Gmail? Click here to learn how to generate an App Password</span>
              </button>

              {/* Gmail App Password Accordion Guide */}
              {showGmailHelp && (
                <div className="no-yellow-highlight mt-3 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/60 text-xs space-y-3">
                  <p className="font-bold text-neutral-900 dark:text-white">
                    Step-by-Step Gmail App Password Guide:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-neutral-600 dark:text-neutral-300">
                    <div className="p-2.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-700/60 flex items-start gap-2 shadow-xs">
                      <span className="font-bold text-neutral-900 dark:text-white shrink-0">1.</span>
                      <span>Open your Google Account at <a href="https://myaccount.google.com/security" target="_blank" rel="noreferrer" className="text-neutral-900 dark:text-white underline font-semibold hover:text-neutral-700 dark:hover:text-neutral-200 focus:outline-none">myaccount.google.com/security</a>.</span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-700/60 flex items-start gap-2 shadow-xs">
                      <span className="font-bold text-neutral-900 dark:text-white shrink-0">2.</span>
                      <span>Under <strong>Signing in to Google</strong>, ensure <strong>2-Step Verification</strong> is ON.</span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-700/60 flex items-start gap-2 shadow-xs">
                      <span className="font-bold text-neutral-900 dark:text-white shrink-0">3.</span>
                      <span>In the search box, search for <strong>"App passwords"</strong> (or visit <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="text-neutral-900 dark:text-white underline font-semibold hover:text-neutral-700 dark:hover:text-neutral-200 focus:outline-none">myaccount.google.com/apppasswords</a>).</span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-700/60 flex items-start gap-2 shadow-xs">
                      <span className="font-bold text-neutral-900 dark:text-white shrink-0">4.</span>
                      <span>Give it a name like <strong>"PaySlipPro"</strong> and click <strong>Create</strong>.</span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-700/60 flex items-start gap-2 shadow-xs">
                      <span className="font-bold text-neutral-900 dark:text-white shrink-0">5.</span>
                      <span>Google will display a <strong>16-letter code</strong> (e.g. <code className="bg-neutral-100 dark:bg-neutral-800 px-1 py-0.5 rounded font-mono text-[11px] text-neutral-800 dark:text-neutral-200">abcd efgh ijkl mnop</code>).</span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-700/60 flex items-start gap-2 shadow-xs">
                      <span className="font-bold text-neutral-900 dark:text-white shrink-0">6.</span>
                      <span>Copy and paste that 16-character code into the <strong>SMTP Password</strong> field above.</span>
                    </div>
                  </div>

                  {/* Ask with Zigmaa AI Option - 100% English, NO unwanted icons */}
                  <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-700/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-neutral-900 dark:text-white">
                        Need help with these steps?
                      </p>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                        Ask Zigmaa AI for quick step-by-step guidance.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAskZigmaaAi}
                      className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-neutral-900 text-xs font-semibold shadow-sm transition-all cursor-pointer whitespace-nowrap focus:outline-none focus:ring-0 active:scale-95 self-start sm:self-auto"
                    >
                      Ask with Zigmaa AI
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Granular Categories Selection - Collapsible Dropdown */}
            <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800">
              <div
                onClick={() => setIsCategoriesExpanded((prev) => !prev)}
                className="w-full flex items-center justify-between text-left cursor-pointer select-none p-2.5 -mx-2.5 rounded-xl hover:bg-neutral-100/70 dark:hover:bg-neutral-800/60 transition-colors"
              >
                <div>
                  <h4 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                    <span>Select Email Categories for Custom Delivery</span>
                    <span className="text-xs font-normal text-neutral-500 dark:text-neutral-400">
                      ({smtpCategories.length} of 6 active)
                    </span>
                  </h4>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    Click to {isCategoriesExpanded ? 'hide' : 'view and customize'} email category routing (unchecked categories use platform default).
                  </p>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    {isCategoriesExpanded ? 'Hide' : 'Show'}
                  </span>
                  <div className="p-1 rounded-lg bg-neutral-200/70 dark:bg-neutral-700/60 text-neutral-700 dark:text-neutral-200">
                    <ChevronDown
                      className={`h-4 w-4 transition-transform duration-200 ${
                        isCategoriesExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </div>
              </div>

              {isCategoriesExpanded && (
                <div className="mt-3 space-y-3">
                  {isEditing && (
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={selectAllCategories}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 cursor-pointer transition-colors shadow-xs"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={clearAllCategories}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 cursor-pointer transition-colors border border-neutral-200 dark:border-neutral-700"
                      >
                        Clear All
                      </button>
                    </div>
                  )}

                  {/* 6 Category Tiles with Black & White styling */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {ALL_CATEGORIES.map((cat) => {
                      const isChecked = smtpCategories.includes(cat.id);
                      return (
                        <div
                          key={cat.id}
                          onClick={() => toggleCategory(cat.id)}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer select-none flex items-start gap-3 ${
                            isChecked
                              ? 'border-neutral-900 bg-neutral-900/5 dark:border-neutral-200 dark:bg-white/10 shadow-xs'
                              : 'border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-neutral-900/40 opacity-70 hover:opacity-100 hover:border-neutral-300'
                          } ${!isEditing ? 'cursor-not-allowed opacity-60' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleCategory(cat.id)}
                            disabled={!isEditing}
                            className="mt-0.5 h-4 w-4 rounded accent-neutral-900 dark:accent-neutral-100 border-neutral-300 dark:border-neutral-600 cursor-pointer"
                          />
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-bold text-neutral-900 dark:text-white block">
                              {cat.label}
                            </span>
                            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 leading-snug">
                              {cat.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Test Connection Box */}
            <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-900/60 p-4 rounded-xl border border-neutral-200/80 dark:border-neutral-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 mb-1 flex items-center gap-1.5">
                <Send className="h-3.5 w-3.5 text-neutral-900 dark:text-white" />
                Test SMTP Connection
              </h4>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
                Send a real test email using the credentials above to verify that connections and credentials work before saving.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <input
                  type="email"
                  placeholder="Enter email to receive test message"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="w-full sm:flex-1 h-10 px-3.5 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white"
                />
                <button
                  type="button"
                  onClick={handleTestSmtp}
                  disabled={isTestingSmtp}
                  className="w-full sm:w-auto h-10 px-5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-neutral-900 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shadow-sm shrink-0 whitespace-nowrap"
                >
                  {isTestingSmtp ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin shrink-0 text-white dark:text-neutral-900" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      <span>Send Test Email</span>
                    </>
                  )}
                </button>
              </div>

              {/* Test Result Message Banner */}
              {testSmtpResult && (
                <div
                  className={`mt-3 p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                    testSmtpResult.success
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                      : 'bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                  }`}
                >
                  {testSmtpResult.success ? (
                    <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="font-semibold">{testSmtpResult.message}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTestSmtpResult(null)}
                    className="text-neutral-400 hover:text-neutral-600 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </GlassCard>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {isLocked ? (
          <GradientButton
            onClick={() => handleInitiateUpgrade('professional')}
            isLoading={isUpgrading}
            className="w-full sm:w-auto shadow-md shadow-amber-500/15"
          >
            Upgrade to Professional Plan to Edit Settings
          </GradientButton>
        ) : (
          <>
            {!isEditing && (
              <GradientButton
                variant="secondary"
                onClick={() => setIsEditing(true)}
              >
                {t('common.edit', 'Edit')}
              </GradientButton>
            )}
            {isEditing && (
              <GradientButton
                variant="secondary"
                onClick={() => {
                  setIsEditing(false);
                  if (company) {
                    setForm({
                      company_name: company.company_name || '',
                      pay_day: String(company.pay_day || 1),
                      address: company.address || '',
                      city: company.city || '',
                      state: company.state || '',
                      zip_code: company.zip_code || '',
                      pf_number: company.pf_number || '',
                      tan_number: company.tan_number || '',
                      financial_year_start: String(company.financial_year_start || 4),
                      office_lat: String(company.office_lat ?? 8.7892563),
                      office_lng: String(company.office_lng ?? 78.117146),
                      allowed_radius_meters: String(company.allowed_radius_meters ?? 70),
                      permission_days_per_month: String(company.permission_days_per_month ?? 3),
      weekoff_days_per_month: String(company.weekoff_days_per_month ?? 1),
                      office_timing: company.office_timing || '09:30 AM - 06:00 PM',
                      office_start_time: company.office_start_time || '09:30',
                      office_end_time: company.office_end_time || '18:00',
                    });
                    setWeeklyOffDays(company.weekly_off_days || []);
                    setEnableEmployeeShiftTiming(Boolean(company.enable_employee_shift_timing));
                    setSmtpEnabled(Boolean(company.smtp_enabled));
                    setSmtpHost(company.smtp_host || 'smtp.gmail.com');
                    setSmtpPort(String(company.smtp_port || 587));
                    setSmtpUser(company.smtp_user || '');
                    setSmtpPassword('');
                    setSmtpFromName(company.smtp_from_name || '');
                    setSmtpEncryption(company.smtp_use_ssl ? 'ssl' : (company.smtp_use_tls !== false ? 'tls' : 'none'));
                    if (company.smtp_categories && Array.isArray(company.smtp_categories) && company.smtp_categories.length > 0) {
                      setSmtpCategories(company.smtp_categories);
                    } else {
                      setSmtpCategories(['salary_slips', 'attendance', 'leaves', 'onboarding', 'security', 'system']);
                    }
                    setTestEmail(user?.email || company.smtp_user || '');
                  }
                }}
              >
                {t('common.cancel', 'Cancel')}
              </GradientButton>
            )}
            <GradientButton
              onClick={handleSubmit}
              isLoading={updateCompany.isPending}
              disabled={!isEditing || isSaved}
            >
              {isSaved ? (
                <span className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-400" /> {t('common.saveComplete', 'Save Complete')}
                </span>
              ) : (
                t('company.saveSettings', 'Save Settings')
              )}
            </GradientButton>
          </>
        )}
      </div>

      {celebrationPlan && (
        <PlanUpgradeModal
          isOpen={Boolean(celebrationPlan)}
          plan={celebrationPlan}
          onConfirm={() => setCelebrationPlan(null)}
          onClose={() => setCelebrationPlan(null)}
        />
      )}
    </motion.div>
  );
}
