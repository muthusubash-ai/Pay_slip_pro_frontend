import axios, { type InternalAxiosRequestConfig } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';
let csrfToken: string | null = null;
let refreshRequest: Promise<void> | null = null;

interface RetryableRequest extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const method = config.method?.toUpperCase();
  if (csrfToken && method && !['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(method)) {
    config.headers['X-CSRFToken'] = csrfToken;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const request = error.config as RetryableRequest | undefined;
    const url = request?.url || '';
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
