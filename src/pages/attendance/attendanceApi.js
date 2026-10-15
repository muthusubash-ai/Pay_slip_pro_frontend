const base = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const getInviteFromUrl = () => {
  if (typeof window === 'undefined') return '';
  const hashStr = window.location.hash ? window.location.hash.replace(/^#/, '') : '';
  const searchStr = window.location.search ? window.location.search.replace(/^\?/, '') : '';
  const hashParams = new URLSearchParams(hashStr);
  const searchParams = new URLSearchParams(searchStr);
  return (
    searchParams.get('invite') ||
    searchParams.get('amp;invite') ||
    searchParams.get('token') ||
    searchParams.get('amp;token') ||
    hashParams.get('invite') ||
    hashParams.get('amp;invite') ||
    hashParams.get('token') ||
    hashParams.get('amp;token') ||
    ''
  );
};

let invitation = getInviteFromUrl();
if (!invitation && typeof window !== 'undefined') {
  try { invitation = sessionStorage.getItem('attendance_invite_token') || ''; } catch {}
} else if (invitation && typeof window !== 'undefined') {
  try { sessionStorage.setItem('attendance_invite_token', invitation); } catch {}
}

export const getAttendanceInvite = () => {
  if (invitation) return invitation;
  const fromUrl = getInviteFromUrl();
  if (fromUrl) {
    invitation = fromUrl;
    try { sessionStorage.setItem('attendance_invite_token', fromUrl); } catch {}
    return invitation;
  }
  if (typeof window !== 'undefined') {
    try {
      const stored = sessionStorage.getItem('attendance_invite_token') || '';
      if (stored) {
        invitation = stored;
        return invitation;
      }
    } catch {}
  }
  return '';
};

let csrf;
export const hasAttendanceInvite = () => Boolean(getAttendanceInvite());
export const clearAttendanceInvite = () => {
  invitation = '';
  if (typeof window !== 'undefined') {
    try { sessionStorage.removeItem('attendance_invite_token'); } catch {}
    try {
      const cleanUrl = window.location.pathname || '/biometric';
      window.history.replaceState({}, document.title, cleanUrl);
    } catch {}
  }
};

export async function attendanceFetch(url, options = {}) {
  const headers = new Headers(options.headers);
  const token = getAttendanceInvite();
  if (token) headers.set('X-Attendance-Invite', token);
  if (!['GET', 'HEAD', 'OPTIONS'].includes((options.method || 'GET').toUpperCase())) {
    if (!csrf) {
      const response = await window.fetch(`${base}/api/v1/auth/csrf`, { credentials: 'include' });
      if (!response.ok) throw new Error('Unable to establish a secure session. Please retry.');
      csrf = (await response.json()).csrf_token;
    }
    headers.set('X-CSRFToken', csrf);
  }
  const response = await window.fetch(url, { ...options, headers, credentials: 'include' });
  if (!response.ok && response.headers.get('content-type')?.includes('application/json')) {
    const body = await response.clone().json();
    const detail = body.detail || (Array.isArray(body) ? body.join(' ') : null);
    if (detail) return new Response(JSON.stringify({ ...body, error: detail }), {
      status: response.status, headers: { 'Content-Type': 'application/json' },
    });
  }
  return response;
}
