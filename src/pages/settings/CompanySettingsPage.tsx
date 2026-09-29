import { motion } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Trash2, Check } from 'lucide-react';
import { GlassCard } from '../../components/ui/GlassCard';
import { AnimatedInput } from '../../components/ui/AnimatedInput';
import { GradientButton } from '../../components/ui/GradientButton';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { companyService } from '../../services/companyService';
import { useAuth } from '../../context/AuthContext';

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
    },
  });

  const deleteLogo = useMutation({
    mutationFn: companyService.deleteLogo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company'] });
      setLogoSuccess('Logo removed.');
    },
  });

  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [logoSuccess, setLogoSuccess] = useState('');
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
      // If company has no name set, enable edit mode by default
      setIsEditing(!company.company_name);
    } else {
      setIsEditing(true);
    }
  }, [company]);

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = () => {
    setError('');
    setSuccess('');
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
          }, 3000);
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
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Logo must be a PNG, JPEG, or WebP image.');
      e.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Logo must be under 5MB.');
      e.target.value = '';
      return;
    }
    setLogoSuccess('');
    setError('');
    uploadLogo.mutate(file);
  };

  if (isLoading) return <LoadingSpinner />;

  const extractedColor = company?.primary_color || '#000000';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-6">
      <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">Company Settings</h2>

      {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl">{success}</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">{error}</div>}

      {/* Logo Section */}
      <GlassCard>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Upload className="h-5 w-5" /> Company Logo
        </h3>
        {logoSuccess && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl mb-4">{logoSuccess}</div>}
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
          {/* Logo preview */}
          <div className="flex h-28 w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-gray-300 bg-white p-2 sm:w-[200px] sm:shrink-0">
            {company?.logo_data ? (
              <img src={company.logo_data} alt="Logo" className="max-w-full max-h-full object-contain" />
            ) : (
              <span className="text-gray-400 text-xs text-center px-2">No logo</span>
            )}
          </div>
          <div className="w-full min-w-0 space-y-3 sm:w-auto">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
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
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-black transition-colors disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove logo
              </button>
            )}
            <p className="text-xs text-gray-400">PNG or JPG. Auto-cropped to 1080x1080. Max 5MB.</p>

            {/* Extracted color display */}
            {company?.logo_data && (
              <div className="flex items-center gap-2 mt-2">
                <div
                  className="w-6 h-6 rounded-full border border-gray-300"
                  style={{ backgroundColor: extractedColor }}
                />
                <span className="text-sm text-gray-600">
                  Slip theme color: <span className="font-mono font-semibold">{extractedColor}</span>
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
          <AnimatedInput label="Address" placeholder="123 Business Ave" value={form.address} onChange={handleChange('address')} disabled={!isEditing} />
          <AnimatedInput label="City" placeholder="Mumbai" value={form.city} onChange={handleChange('city')} disabled={!isEditing} />
          <AnimatedInput label="State" placeholder="Maharashtra" value={form.state} onChange={handleChange('state')} disabled={!isEditing} />
          <AnimatedInput label="ZIP Code" placeholder="400001" value={form.zip_code} onChange={handleChange('zip_code')} disabled={!isEditing} />
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
