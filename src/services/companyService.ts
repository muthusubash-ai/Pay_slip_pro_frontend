import api from './api';
import type { Company } from '../types';

interface CompanyUpdateData {
  company_name?: string;
  primary_color?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  pay_day?: number;
  financial_year_start?: number;
  pf_number?: string;
  tan_number?: string;
  office_lat?: number;
  office_lng?: number;
  allowed_radius_meters?: number;
  weekly_off_days?: number[];
  permission_days_per_month?: number;
  office_timing?: string;
  office_start_time?: string;
  office_end_time?: string;
  enable_employee_shift_timing?: boolean;
}

export interface AddressSuggestion {
  label: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
}

export interface PinLookupResult {
  pin_code: string;
  places: { area: string; state: string }[];
}

export const companyService = {
  get: () => api.get<Company>('/company/'),

  update: (data: CompanyUpdateData) =>
    api.put<Company>('/company/', data),

  uploadLogo: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<Company>('/company/logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  deleteLogo: () => api.delete<Company>('/company/logo'),

  suggestAddresses: (query: string) =>
    api.get<{ items: AddressSuggestion[] }>('/locations/address-suggestions', { params: { q: query } }),

  suggestCities: (query: string, state: string) =>
    api.get<{ items: string[] }>('/locations/city-suggestions', { params: { q: query, state } }),

  lookupPin: (code: string) =>
    api.get<PinLookupResult>('/locations/pin', { params: { code } }),
};
