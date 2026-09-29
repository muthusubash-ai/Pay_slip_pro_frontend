export function getPasswordStrength(password: string) {
  const checks = {
    minLength: password.length >= 12,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
  const passed = Object.values(checks).filter(Boolean).length;
  const isStrong = passed === Object.keys(checks).length;
  const label = isStrong ? 'Strong' : passed >= 3 ? 'Medium' : 'Weak';
  const color = isStrong ? 'bg-green-500' : passed >= 3 ? 'bg-yellow-500' : 'bg-red-500';

  return { checks, passed, isStrong, label, color };
}

export function getPasswordPolicyError(password: string): string | null {
  const { checks } = getPasswordStrength(password);
  const missing: string[] = [];
  if (!checks.minLength) missing.push('12+ characters');
  if (!checks.uppercase) missing.push('an uppercase letter');
  if (!checks.lowercase) missing.push('a lowercase letter');
  if (!checks.number) missing.push('a number');
  if (!checks.special) missing.push('a special character');

  return missing.length ? `Password requires ${missing.join(', ')}.` : null;
}
