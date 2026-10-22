import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Upload, Trash2, Check, AlertTriangle, X, CheckCircle, Navigation, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { GlassCard } from '../../components/ui/GlassCard';
import { AnimatedInput } from '../../components/ui/AnimatedInput';
import { GradientButton } from '../../components/ui/GradientButton';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { companyService } from '../../services/companyService';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../context/LanguageContext';
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

export function CompanySettingsPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: company, isLoading } = useQuery({
    queryKey: ['company'],
    queryFn: () => companyService.get().then((r) => r.data),
    enabled: !!user,
  });

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
    office_timing: '09:30 AM - 06:00 PM',
    office_start_time: '09:30',
    office_end_time: '18:00',
  });
  const [weeklyOffDays, setWeeklyOffDays] = useState<number[]>([]);
  const [enableEmployeeShiftTiming, setEnableEmployeeShiftTiming] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);

  useEffect(() => {
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
        office_timing: company.office_timing || '09:30 AM - 06:00 PM',
        office_start_time: company.office_start_time || '09:30',
        office_end_time: company.office_end_time || '18:00',
      });
      setWeeklyOffDays(company.weekly_off_days || []);
      setEnableEmployeeShiftTiming(Boolean(company.enable_employee_shift_timing));

      // If company has no name or default "My Company" or no address/city filled,
      // enable edit mode by default so new user can immediately edit without searching for edit button
      const isNewOrIncomplete =
        !company.company_name ||
        company.company_name === 'My Company' ||
        (!company.address && !company.city);

      setIsEditing(isNewOrIncomplete);
    } else {
      setIsEditing(true);
    }
  }, [company]);

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

  const parseSingleTimeTo24Hour = (
    timeStr: string,
    isEndTime: boolean = false
  ): string | null => {
    if (!timeStr) return null;
    const cleaned = timeStr.trim().replace(/\./g, '').toLowerCase();

    // Match 12-hour with minutes: "09:30 am", "9:30am", "6:00 pm", "6:00pm", etc.
    const match12WithMin = cleaned.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
    if (match12WithMin) {
      let hour = parseInt(match12WithMin[1], 10);
      const minute = parseInt(match12WithMin[2], 10);
      const period = match12WithMin[3].toLowerCase();

      if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
      if (period === 'pm' && hour < 12) hour += 12;
      if (period === 'am' && hour === 12) hour = 0;
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }

    // Match 12-hour without minutes: "9 am", "9am", "6 pm", "6pm"
    const match12HourOnly = cleaned.match(/^(\d{1,2})\s*(am|pm)$/i);
    if (match12HourOnly) {
      let hour = parseInt(match12HourOnly[1], 10);
      const period = match12HourOnly[2].toLowerCase();

      if (hour < 1 || hour > 12) return null;
      if (period === 'pm' && hour < 12) hour += 12;
      if (period === 'am' && hour === 12) hour = 0;
      return `${String(hour).padStart(2, '0')}:00`;
    }

    // Match 24-hour or without AM/PM: "09:30", "18:00", "9:30", "6:00"
    const match24 = cleaned.match(/^(\d{1,2}):(\d{2})$/);
    if (match24) {
      let hour = parseInt(match24[1], 10);
      const minute = parseInt(match24[2], 10);
      if (minute < 0 || minute > 59) return null;

      // In office shift context, afternoon/evening hours like 1:00 to 7:59 for end time default to PM
      if (isEndTime && hour >= 1 && hour <= 7) {
        hour += 12;
      }
      if (hour < 0 || hour > 23) return null;
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }

    return null;
  };

  const parseOfficeTimingRange = (
    timingStr: string
  ): { startTime?: string; endTime?: string } => {
    if (!timingStr) return {};
    const parts = timingStr.split(/\s*(?:-|–|—|\bto\b|\btill\b|\buntil\b)\s*/i);
    if (parts.length < 2) {
      const single = parseSingleTimeTo24Hour(parts[0], false);
      return single ? { startTime: single } : {};
    }

    const startParsed = parseSingleTimeTo24Hour(parts[0], false);
    const endParsed = parseSingleTimeTo24Hour(parts[1], true);

    const res: { startTime?: string; endTime?: string } = {};
    if (startParsed) res.startTime = startParsed;
    if (endParsed) res.endTime = endParsed;
    return res;
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

  const handleOfficeTimingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const parsed = parseOfficeTimingRange(val);
    setForm((prev) => ({
      ...prev,
      office_timing: val,
      office_start_time: parsed.startTime !== undefined ? parsed.startTime : prev.office_start_time,
      office_end_time: parsed.endTime !== undefined ? parsed.endTime : prev.office_end_time,
    }));
  };

  const toggleWeeklyOffDay = (day: number) => {
    setWeeklyOffDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const handleDetectLocation = () => {
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
        office_timing: form.office_timing || undefined,
        office_start_time: form.office_start_time || undefined,
        office_end_time: form.office_end_time || undefined,
        enable_employee_shift_timing: enableEmployeeShiftTiming,
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
      {/* Header with Top Edit Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-2">
          <Link to="/settings" className="mt-0.5 rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white" aria-label="Back to settings" title="Back to settings">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-white sm:text-2xl">{t('company.title', 'Company Settings')}</h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              {t('company.subtitle', 'Configure your company profile, branding logo, and statutory details for salary slips')}
            </p>
          </div>
        </div>
        {!isEditing && (
          <GradientButton
            variant="secondary"
            onClick={() => setIsEditing(true)}
            className="w-full sm:w-auto"
          >
            {t('company.editSettings', 'Edit Settings')}
          </GradientButton>
        )}
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
        <h3 className="text-lg font-semibold mb-4 text-neutral-900 dark:text-white">
          {t('company.companyLogo', 'Company Logo')}
        </h3>

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
              onClick={() => fileInputRef.current?.click()}
              isLoading={uploadLogo.isPending}
              disabled={!isEditing}
            >
              <Upload className="h-4 w-4 mr-2" />
              {company?.logo_data ? t('company.uploadLogo', 'Change Logo') : t('company.uploadLogo', 'Upload Logo')}
            </GradientButton>
            {company?.logo_data && (
              <button
                onClick={() => { setLogoSuccess(''); deleteLogo.mutate(); }}
                disabled={!isEditing}
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

        {form.office_lat && form.office_lng && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-500 dark:text-neutral-400">
            <span>
              Target Coordinates: <strong className="font-mono text-neutral-800 dark:text-neutral-200">{form.office_lat}, {form.office_lng}</strong> (within {form.allowed_radius_meters}m)
            </span>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${form.office_lat},${form.office_lng}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-neutral-700 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white font-medium underline"
            >
              <span>View Location in Google Maps</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        )}

        {/* Office Timings & Working Hours */}
        <div className="mt-5 pt-4 border-t border-gray-100 dark:border-neutral-800">
          <div className="mb-3">
            <h4 className="text-sm font-semibold text-neutral-900 dark:text-white">
              {t('company.officeTiming', 'Office Timing & Working Hours')}
            </h4>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              {t('company.officeTimingDesc', 'Set standard daily office working hours for employee attendance check-ins, late cutoff, and check-out tracking.')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <AnimatedInput
              label={t('company.officeTiming', 'Office Timing')}
              placeholder="09:30 AM - 06:00 PM"
              value={form.office_timing}
              onChange={handleOfficeTimingChange}
              disabled={!isEditing}
            />
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

          {form.office_timing && (
            <div className="mt-3 flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700 font-medium">
                {t('company.activeShift', 'Active Shift Timing')}: {form.office_timing}
              </span>
            </div>
          )}

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
        <h3 className="text-lg font-semibold mb-1 text-neutral-900 dark:text-white">
          {t('company.leaveRules', 'Leave & Attendance Rules')}
        </h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
          {t('company.leaveRulesDesc', 'Select the day(s) that are a standing weekly off for your company (e.g. every Sunday).')}
        </p>
        <div className="flex flex-wrap gap-2">
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
                    ? 'bg-neutral-900 border-neutral-900 text-white dark:bg-white dark:border-white dark:text-neutral-900'
                    : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-neutral-400 dark:hover:border-neutral-500'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <div className="mt-5 pt-4 border-t border-neutral-100 dark:border-neutral-800 max-w-xs">
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
            Any permission beyond this count deducts 1 full day's pay each.
          </p>
        </div>
      </GlassCard>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
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
                  office_timing: company.office_timing || '09:30 AM - 06:00 PM',
                  office_start_time: company.office_start_time || '09:30',
                  office_end_time: company.office_end_time || '18:00',
                });
                setWeeklyOffDays(company.weekly_off_days || []);
                setEnableEmployeeShiftTiming(Boolean(company.enable_employee_shift_timing));
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
      </div>
    </motion.div>
  );
}
