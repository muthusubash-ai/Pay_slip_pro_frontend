import axios, { type InternalAxiosRequestConfig } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';
let csrfToken: string | null = null;
let refreshRequest: Promise<void> | null = null;
let activeCompanyUserId: number | null = null;

try {
  const saved = typeof window !== 'undefined' ? localStorage.getItem('payslip_admin_selected_company_user_id') : null;
  if (saved) {
    const parsed = parseInt(saved, 10);
    if (!isNaN(parsed) && parsed > 0) {
      activeCompanyUserId = parsed;
    }
  }
} catch {
  // Ignore localStorage read errors
}

export function setActiveCompanyUserId(id: number | null) {
  activeCompanyUserId = id;
  try {
    if (typeof window !== 'undefined') {
      if (id) {
        localStorage.setItem('payslip_admin_selected_company_user_id', String(id));
      } else {
        localStorage.removeItem('payslip_admin_selected_company_user_id');
      }
    }
  } catch {
    // Ignore localStorage write errors
  }
}

export function getActiveCompanyUserId(): number | null {
  return activeCompanyUserId;
}

interface RetryableRequest extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  withCredentials: true,
});

api.interceptors.request.use(async (config) => {
  const url = config.url || '';
  const isExcluded = url.includes('/auth/') || url.includes('/admin/');
  if (activeCompanyUserId && !isExcluded) {
    config.headers['X-Company-User-Id'] = String(activeCompanyUserId);
    config.params = config.params || {};
    if (config.params.company_user_id === undefined) {
      config.params.company_user_id = activeCompanyUserId;
    }
  }

  const method = config.method?.toUpperCase();
  if (method && !['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(method)) {
    if (!csrfToken) {
      try {
        const response = await axios.get<{ csrf_token: string }>(`${API_URL}/api/v1/auth/csrf`, {
          withCredentials: true,
        });
        csrfToken = response.data.csrf_token;
      } catch {
        // Fallback silently if CSRF endpoint cannot be reached
      }
    }
    if (csrfToken) {
      config.headers['X-CSRFToken'] = csrfToken;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const request = error.config as RetryableRequest | undefined;
    const url = request?.url || '';

    // Handle 403 CSRF token expiration/failure with automatic refresh & retry
    const isCsrfError =
      error.response?.status === 403 &&
      request &&
      !request._retry &&
      String(error.response?.data?.detail || '').toLowerCase().includes('csrf');

    if (isCsrfError) {
      request._retry = true;
      try {
        const csrfRes = await axios.get<{ csrf_token: string }>(`${API_URL}/api/v1/auth/csrf`, {
          withCredentials: true,
        });
        csrfToken = csrfRes.data.csrf_token;
        if (csrfToken) {
          request.headers['X-CSRFToken'] = csrfToken;
        }
        return api(request);
      } catch {
        throw error;
      }
    }

    const canRefresh =
      error.response?.status === 401 &&
      request &&
      !request._retry &&
      !url.includes('/auth/login') &&
      !url.includes('/auth/refresh') &&
      !url.includes('/auth/register');

    if (!canRefresh) throw error;

    request._retry = true;
    if (!refreshRequest) {
      refreshRequest = api.post('/auth/refresh', {}).then(() => undefined).finally(() => {
        refreshRequest = null;
      });
    }

    await refreshRequest;
    return api(request);
  },
);

export async function initializeCsrf(): Promise<void> {
  const response = await api.get<{ csrf_token: string }>('/auth/csrf');
  csrfToken = response.data.csrf_token;
}

export default api;
