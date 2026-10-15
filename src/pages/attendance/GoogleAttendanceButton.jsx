import { useEffect, useRef, useState } from 'react';
import { attendanceFetch } from './attendanceApi';

export default function GoogleAttendanceButton({ onCredential }) {
  const container = useRef(null);
  const callback = useRef(onCredential);
  callback.current = onCredential;
  const [error, setError] = useState('');
  useEffect(() => {
    let disposed = false;
    async function initialize() {
      try {
        const base = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
        const response = await attendanceFetch(`${base}/api/attendance/google/nonce/`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Google sign-in is unavailable.');
        if (!window.google?.accounts?.id) {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }
        if (disposed || !container.current) return;
        window.google.accounts.id.initialize({
          client_id: data.client_id, nonce: data.nonce,
          callback: (result) => callback.current(result.credential),
        });
        window.google.accounts.id.renderButton(container.current, { theme: 'outline', size: 'large', text: 'continue_with', width: 280 });
      } catch (failure) {
        if (!disposed) setError(failure.message || 'Unable to load Google sign-in.');
      }
    }
    initialize();
    return () => { disposed = true; };
  }, []);
  return <div className="flex flex-col items-center gap-2"><div ref={container} />{error && <p role="status" className="text-sm text-red-600">{error}</p>}</div>;
}
