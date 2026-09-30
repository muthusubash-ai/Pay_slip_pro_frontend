import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Trash2, Check, AlertTriangle, X, CheckCircle } from 'lucide-react';
import { GlassCard } from '../../components/ui/GlassCard';
import { AnimatedInput } from '../../components/ui/AnimatedInput';
import { GradientButton } from '../../components/ui/GradientButton';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { companyService } from '../../services/companyService';
import { useAuth } from '../../context/AuthContext';
import { AddressSuggestionField } from '../../components/ui/AddressSuggestionField';
import { PinCodeLookupField } from '../../components/ui/PinCodeLookupField';
import { CityPicker } from '../../components/ui/CityPicker';
import { CITIES_BY_STATE, INDIAN_STATES, normalizeIndianState } from '../../lib/indianLocations';

export function CompanySettingsPage() {
  const { user } = useAuth();
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
  });

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
      });

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

  const handleSubmit = () => {
    setError('');
    setSuccess('');
    if (form.zip_code && !/^\d{6}$/.test(form.zip_code)) {
      setError('Enter a valid 6-digit Indian PIN code.');
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
        <div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white sm:text-2xl">Company Settings</h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Configure your company profile, branding logo, and statutory details for salary slips
          </p>
        </div>
        {!isEditing && (
          <GradientButton
            variant="secondary"
            onClick={() => setIsEditing(true)}
            className="w-full sm:w-auto"
          >
            Edit Settings
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
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-neutral-900 dark:text-white">
          <Upload className="h-5 w-5" /> Company Logo
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
              {company?.logo_data ? 'Change Logo' : 'Upload Logo'}
            </GradientButton>
            {company?.logo_data && (
              <button
                onClick={() => { setLogoSuccess(''); deleteLogo.mutate(); }}
                disabled={!isEditing}
                className="flex items-center gap-1 text-sm text-neutral-500 hover:text-black dark:text-neutral-400 dark:hover:text-white transition-colors disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove logo
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
        <h3 className="text-lg font-semibold mb-4">Company Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatedInput label="Company Name" placeholder="Acme Corp" value={form.company_name} onChange={handleChange('company_name')} disabled={!isEditing} />
          <AnimatedInput label="Pay Day (1-28)" type="number" placeholder="1" value={form.pay_day} onChange={handleChange('pay_day')} disabled={!isEditing} />
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
            <label htmlFor="company-state" className="block text-sm font-medium text-gray-700 dark:text-neutral-300">State / Union Territory</label>
            <select
              id="company-state"
              value={form.state}
              disabled={!isEditing}
              onChange={(event) => setForm((prev) => ({ ...prev, state: event.target.value, city: '', zip_code: '' }))}
              className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-neutral-900 outline-none focus:border-black disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:focus:border-white"
            >
              <option value="">Select state</option>
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
        <h3 className="text-lg font-semibold mb-4">Statutory Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatedInput label="PF Number" placeholder="MH/BOM/12345" value={form.pf_number} onChange={handleChange('pf_number')} disabled={!isEditing} />
          <AnimatedInput label="TAN Number" placeholder="MUMB12345E" value={form.tan_number} onChange={handleChange('tan_number')} disabled={!isEditing} />
          <AnimatedInput label="Financial Year Start (Month)" type="number" placeholder="4" value={form.financial_year_start} onChange={handleChange('financial_year_start')} disabled={!isEditing} />
        </div>
      </GlassCard>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {!isEditing && (
          <GradientButton
            variant="secondary"
            onClick={() => setIsEditing(true)}
          >
            Edit
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
                });
              }
            }}
          >
            Cancel
          </GradientButton>
        )}
        <GradientButton
          onClick={handleSubmit}
          isLoading={updateCompany.isPending}
          disabled={!isEditing || isSaved}
        >
          {isSaved ? (
            <span className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-400" /> Save Complete
            </span>
          ) : (
            'Save Settings'
          )}
        </GradientButton>
      </div>
    </motion.div>
  );
}
