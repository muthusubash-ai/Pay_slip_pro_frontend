import React, { useState, useEffect, useRef } from 'react';
import { attendanceFetch as fetch, hasAttendanceInvite, clearAttendanceInvite, getAttendanceInvite } from './attendanceApi';
import GoogleAttendanceButton from './GoogleAttendanceButton';
import { loadFaceApi } from './faceApiLoader';
import FaceScanModalCapture from './FaceScanModalCapture';

import { 
  Building2, 
  MapPin, 
  Camera, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  UserCheck, 
  ShieldCheck, 
  RefreshCw, 
  Compass, 
  UserPlus, 
  History,
  Lock,
  LogOut,
  User,
  Key,
  Calendar,
  Sparkles,
  Search,
  Check,
  Building,
  ExternalLink,
  Upload,
  Sparkle,
  Eye,
  EyeOff,
  ChevronDown,
  Edit3,
  FileText,
  Menu,
  X,
  Sun,
  Moon,
  Bell,
  Save,
  AlertCircle,
  ArrowLeft,
  MailCheck,
  KeyRound,
  Trash2,
  CalendarDays
} from 'lucide-react';

// DYNAMIC BACKEND API BASE URL (Native Pay Slip Pro Monorepo Routing)
const API_BASE_URL = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '299933614033-8hirtt0ghcikkk1cuq857v6vigsg3441.apps.googleusercontent.com';

// EXACT TESTING LOCATION CONSTANTS (Updated from user's specified office location: 8.7892563, 78.117146)
const DEFAULT_OFFICE_LAT = 8.7892563;
const DEFAULT_OFFICE_LNG = 78.117146;
const ALLOWED_RADIUS = 70; // 70 meters strict office geofence

const formatDisplayDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return dateStr || '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }
  return dateStr;
};

const getDisplayCheckoutTime = (time24) => {
  if (!time24) return '6:00 PM';
  const [hStr, mStr] = String(time24).split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  if (isNaN(h)) return time24;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return m === '00' ? `${h}:00 ${ampm}` : `${h}:${m} ${ampm}`;
};

const calculateHaversine = (lat1, lon1, lat2, lon2) => {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// "09:30" (24-hour) -> "09:30 AM"
const formatTime12 = (time24) => {
  if (!time24) return '';
  const [hStr, mStr] = time24.split(':');
  let h = parseInt(hStr, 10);
  const m = (mStr || '00').padStart(2, '0');
  if (Number.isNaN(h)) return time24;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
};

// Trailing 6 months ending at the current month (never includes future months)
const getMonthOptions = () => {
  const now = new Date();
  const options = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push({
      label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      value: `${d.getFullYear()}-${d.getMonth() + 1}`,
      year: d.getFullYear(),
      month: d.getMonth() + 1
    });
  }
  return options;
};

export default function AttendanceCheckIn({ initialTab = 'punch' }) {
  // --- 1. CORE COMPONENT STATE HOOKS (DECLARED FIRST TO PREVENT TDZ CRASHES) ---
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('attendance_current_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [authMode, setAuthMode] = useState('app');
  const [activeTab, setActiveTab] = useState(() => {
    // A fresh invite link always wins, even if a stale saved session from a
    // previous employee is still sitting in localStorage on this (often shared,
    // kiosk) browser - otherwise the page would briefly try to render the punch
    // tab for the old session before the invite effect corrects it.
    if (hasAttendanceInvite()) return 'onboard';
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('attendance_current_user');
      if (savedUser) return 'punch';
    }
    if (typeof window !== 'undefined') {
      const searchTab = new URLSearchParams(window.location.search).get('tab');
      if (searchTab && ['punch', 'history', 'leave', 'status'].includes(searchTab)) {
        return searchTab;
      }
    }
    return initialTab || 'punch';
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark';
    }
    return false;
  });
  const [notifMenuOpen, setNotifMenuOpen] = useState(false);

  // Custom Dropdown Menus States
  const [monthDropdownOpen, setMonthDropdownOpen] = useState(false);
  const [leaveTypeDropdownOpen, setLeaveTypeDropdownOpen] = useState(false);
  const [hoursDropdownOpen, setHoursDropdownOpen] = useState(false);

  // Leave & Permission states
  const [leaveDurationMode, setLeaveDurationMode] = useState('single'); // 'single' (One Day) | 'multiple' (Many Days)
  const [leaveForm, setLeaveForm] = useState({
    request_type: 'CASUAL',
    start_date: '',
    end_date: '',
    duration_hours: '2',
    reason: ''
  });
  const [myLeavesList, setMyLeavesList] = useState([]);
  const [loadingLeaves, setLoadingLeaves] = useState(false);
  const [dismissedNotifIds, setDismissedNotifIds] = useState(() => {
    try {
      const savedUser = localStorage.getItem('attendance_current_user');
      const u = savedUser ? JSON.parse(savedUser) : null;
      const userKey = u?.emp_id || 'guest';
      return JSON.parse(localStorage.getItem(`attendance_dismissed_notifs_${userKey}`) || '[]');
    } catch {
      return [];
    }
  });

  // Re-sync dismissed notifications when currentUser changes
  useEffect(() => {
    if (currentUser?.emp_id) {
      try {
        const stored = JSON.parse(localStorage.getItem(`attendance_dismissed_notifs_${currentUser.emp_id}`) || '[]');
        setDismissedNotifIds(stored);
      } catch {
        setDismissedNotifIds([]);
      }
    }
  }, [currentUser?.emp_id]);

  const activeNotifications = myLeavesList.filter((item) => !dismissedNotifIds.includes(item.id));

  const handleDeleteNotification = (e, id) => {
    e.stopPropagation();
    const updated = [...dismissedNotifIds, id];
    setDismissedNotifIds(updated);
    try {
      const userKey = currentUser?.emp_id || 'guest';
      localStorage.setItem(`attendance_dismissed_notifs_${userKey}`, JSON.stringify(updated));
    } catch {}
  };

  const handleClearAllNotifications = (e) => {
    if (e) e.stopPropagation();
    const allIds = myLeavesList.map((item) => item.id);
    setDismissedNotifIds(allIds);
    try {
      const userKey = currentUser?.emp_id || 'guest';
      localStorage.setItem(`attendance_dismissed_notifs_${userKey}`, JSON.stringify(allIds));
    } catch {}
  };

  // Centered Notifications & Activity Center Modal States
  const [notifModalOpen, setNotifModalOpen] = useState(false);
  const [notifSearchQuery, setNotifSearchQuery] = useState('');
  const [notifFilter, setNotifFilter] = useState('all'); // 'all' | 'permissions' | 'leaves'

  const filteredNotifications = activeNotifications.filter((item) => {
    if (notifFilter === 'permissions' && item.request_type !== 'PERMISSION') return false;
    if (notifFilter === 'leaves' && item.request_type === 'PERMISSION') return false;

    if (notifSearchQuery.trim()) {
      const q = notifSearchQuery.toLowerCase();
      const typeStr = getRequestTypeLabel(item.request_type).toLowerCase();
      const reasonStr = (item.reason || '').toLowerCase();
      const statusStr = (item.status || '').toLowerCase();
      const dateStr = (item.start_date || '').toLowerCase();
      const empName = (currentUser?.name || '').toLowerCase();
      const empId = (currentUser?.emp_id || '').toLowerCase();
      return (
        typeStr.includes(q) ||
        reasonStr.includes(q) ||
        statusStr.includes(q) ||
        dateStr.includes(q) ||
        empName.includes(q) ||
        empId.includes(q)
      );
    }
    return true;
  });

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && notifModalOpen) {
        setNotifModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [notifModalOpen]);

  // Geofence & Company Branding states - seeded from the last fetch (cached in
  // localStorage) so the real company logo shows immediately on refresh instead
  // of flashing the generic placeholder icon before the API call resolves.
  const [companyInfo, setCompanyInfo] = useState(() => {
    const defaults = {
      company_name: 'ZIGMAA TECH',
      company_logo: '',
      primary_color: '#e3010f',
      address: 'JP THANAM COMPLEX, 16H/7, Maharaja Nagar, Jeyalani Colony, Thoothukudi, Tamil Nadu 628008',
      office_lat: DEFAULT_OFFICE_LAT,
      office_lng: DEFAULT_OFFICE_LNG,
      allowed_radius_meters: 70,
      office_timing: '09:30 AM - 06:00 PM',
      office_start_time: '09:30',
      office_end_time: '18:00',
    };
    try {
      const cached = localStorage.getItem('attendance_company_branding');
      if (cached) return { ...defaults, ...JSON.parse(cached) };
    } catch (e) {}
    return defaults;
  });

  const cacheCompanyBranding = (info) => {
    try { localStorage.setItem('attendance_company_branding', JSON.stringify(info)); } catch (e) {}
  };

  const [officeLat, setOfficeLat] = useState(() => {
    const v = parseFloat(localStorage.getItem('OFFICE_LAT'));
    if (!isNaN(v)) return v;
    try {
      const c = JSON.parse(localStorage.getItem('attendance_company_branding') || '{}');
      if (c.office_lat !== undefined && !isNaN(parseFloat(c.office_lat))) return parseFloat(c.office_lat);
    } catch (e) {}
    return DEFAULT_OFFICE_LAT;
  });
  const [officeLng, setOfficeLng] = useState(() => {
    const v = parseFloat(localStorage.getItem('OFFICE_LNG'));
    if (!isNaN(v)) return v;
    try {
      const c = JSON.parse(localStorage.getItem('attendance_company_branding') || '{}');
      if (c.office_lng !== undefined && !isNaN(parseFloat(c.office_lng))) return parseFloat(c.office_lng);
    } catch (e) {}
    return DEFAULT_OFFICE_LNG;
  });
  const [allowedRadius, setAllowedRadius] = useState(() => {
    const v = parseInt(localStorage.getItem('ALLOWED_RADIUS'));
    if (!isNaN(v) && v > 0) return v;
    try {
      const c = JSON.parse(localStorage.getItem('attendance_company_branding') || '{}');
      if (c.allowed_radius_meters && !isNaN(parseInt(c.allowed_radius_meters))) return parseInt(c.allowed_radius_meters);
    } catch (e) {}
    return 70;
  });
  const [userCoords, setUserCoords] = useState(null);
  const [distanceMeters, setDistanceMeters] = useState(null);
  const [isWithinZone, setIsWithinZone] = useState(false);
  const [gpsError, setGpsError] = useState(null);
  const [locationLoading, setLocationLoading] = useState(true);

  // Time & Late evaluation - the cutoff that actually applies to THIS employee
  // (company default, or their own shift timing when the company has enabled
  // per-employee shift timing), fetched from the server rather than hardcoded.
  const [shiftTiming, setShiftTiming] = useState(() => {
    try {
      const saved = localStorage.getItem('attendance_current_user');
      if (saved) {
        const u = JSON.parse(saved);
        if (u.effective_start_time || u.effective_end_time || u.effective_timing) {
          return {
            start_time: u.effective_start_time || '09:30',
            end_time: u.effective_end_time || '18:00',
            timing_label: u.effective_timing || '09:30 AM - 06:00 PM',
          };
        }
      }
    } catch {}
    return { start_time: '09:30', end_time: '18:00', timing_label: '09:30 AM - 06:00 PM' };
  });
  const [isPastCutoff, setIsPastCutoff] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  // True between a PERMISSION_OUT punch (stepped out under an approved permission)
  // and the PERMISSION_IN punch (back from it) - the day's check-in/check-out stay
  // open the whole time, this just tracks the temporary break for the punch UI.
  const [onPermissionBreak, setOnPermissionBreak] = useState(false);
  const [permissionOutTime, setPermissionOutTime] = useState('');

  // Camera & Face capture
  const [punchCameraActive, setPunchCameraActive] = useState(false);
  const [onboardCameraActive, setOnboardCameraActive] = useState(false);
  const punchVideoRef = useRef(null);
  const punchCanvasRef = useRef(null);
  const onboardVideoRef = useRef(null);
  const onboardCanvasRef = useRef(null);
  const punchOverlayCanvasRef = useRef(null);
  const onboardOverlayCanvasRef = useRef(null);

  // Execution & Alert states
  const [isProcessing, setIsProcessing] = useState(false);
  const [modalData, setModalData] = useState(null);
  const [errorBanner, setErrorBanner] = useState(null);
  const [notificationModal, setNotificationModal] = useState(null); // Custom popup modal { title, message, type: 'success' | 'error' | 'warning' }

  // User Profile & Dropdown menu state
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ full_name: '', email: '', designation: '', phone_number: '', joining_date: '', new_password: '' });
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Google OAuth Modal state
  const [googleModalOpen, setGoogleModalOpen] = useState(false);
  const [googleSigningIn, setGoogleSigningIn] = useState(false);

  // Password visibility states
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [showForgotConfirmPassword, setShowForgotConfirmPassword] = useState(false);

  // Biometric Forgot Password state
  const [forgotStep, setForgotStep] = useState('identifier'); // 'identifier' | 'code' | 'done'
  const [forgotForm, setForgotForm] = useState({ identifier: '', code: '', new_password: '', confirm_password: '' });
  const [forgotTargetEmail, setForgotTargetEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');

  // Login form state (Empty defaults so placeholders show!)
  const [loginForm, setLoginForm] = useState({ identifier: '', password: '' });

  // Registration form state (Empty defaults so placeholders show!)
  const [regData, setRegData] = useState({
    full_name: '',
    emp_id: '',
    email: '',
    password: '',
    confirm_password: '',
    designation: '',
    joining_date: '',
    phone_number: ''
  });

  const [prefilledEmployee, setPrefilledEmployee] = useState(null);
  const [isLookingUpEmp, setIsLookingUpEmp] = useState(false);

  // Face Registration states
  const [regPhoto, setRegPhoto] = useState(null);
  const [regPhotoPreview, setRegPhotoPreview] = useState(null);
  const [regPhotoDescriptor, setRegPhotoDescriptor] = useState(null);
  const [allRegisteredDescriptors, setAllRegisteredDescriptors] = useState([]);
  const [faceValidating, setFaceValidating] = useState(false);
  const [faceValidError, setFaceValidError] = useState(null);

  // History & Monthly Payroll state
  const [historyList, setHistoryList] = useState([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [monthlySummary, setMonthlySummary] = useState(null);
  const [isSyncingPayslip, setIsSyncingPayslip] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Face status & Model loading
  const [punchFaceStatus, setPunchFaceStatus] = useState({ count: 0, text: 'Scanning for face...', isValid: false });
  const [onboardFaceStatus, setOnboardFaceStatus] = useState({ count: 0, text: 'Scanning for face...', isValid: false });
  const [isModelLoaded, setIsModelLoaded] = useState(false);

  // --- 2. CONFIG & SESSION HELPER FUNCTIONS ---
  const fetchGeofenceConfig = async (lookupQuery = '') => {
    try {
      const endpoint = lookupQuery
        ? `/api/attendance/config/?query=${encodeURIComponent(lookupQuery)}`
        : `/api/attendance/config/`;
      const url = `${API_BASE_URL}${endpoint}`;
      let res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        const aliasUrl = `${API_BASE_URL}/api/attendance/geofence-config/${lookupQuery ? `?query=${encodeURIComponent(lookupQuery)}` : ''}`;
        res = await fetch(aliasUrl, { credentials: 'include' });
      }
      if (!res.ok) return;
      const data = await res.json();
      if (data && (data.company_name || data.office_name)) {
        const cName = data.company_name || data.office_name || 'ZIGMAA TECH';
        const cLogo = data.company_logo || data.logo_data || '';
        const cLat = data.office_lat !== undefined && data.office_lat !== null ? parseFloat(data.office_lat) : DEFAULT_OFFICE_LAT;
        const cLng = data.office_lng !== undefined && data.office_lng !== null ? parseFloat(data.office_lng) : DEFAULT_OFFICE_LNG;
        const cRadius = data.allowed_radius_meters !== undefined && data.allowed_radius_meters !== null ? parseInt(data.allowed_radius_meters) : 70;

        const nextCompanyInfo = {
          company_name: cName,
          company_logo: cLogo,
          primary_color: data.primary_color || '#e3010f',
          address: data.address || '',
          office_lat: cLat,
          office_lng: cLng,
          allowed_radius_meters: cRadius,
        };
        setCompanyInfo((prev) => ({ ...prev, ...nextCompanyInfo }));
        cacheCompanyBranding(nextCompanyInfo);

        setOfficeLat(cLat);
        setOfficeLng(cLng);
        setAllowedRadius(cRadius);

        try {
          localStorage.setItem('OFFICE_LAT', String(cLat));
          localStorage.setItem('OFFICE_LNG', String(cLng));
          localStorage.setItem('ALLOWED_RADIUS', String(cRadius));
        } catch (e) {}
      }
    } catch (e) {
      console.warn("Geofence config load notice:", e);
    }
  };

  const saveUserSession = (data) => {
    const userObj = {
      emp_id: data.emp_id,
      name: data.name || data.full_name,
      email: data.email,
      designation: data.designation,
      phone_number: data.phone_number,
      joining_date: data.joining_date,
      company_name: data.company_name,
      company_logo: data.company_logo,
      face_descriptor: data.face_descriptor || data.face_encoding,
      shift_start_time: data.shift_start_time,
      shift_end_time: data.shift_end_time,
      effective_start_time: data.effective_start_time,
      effective_end_time: data.effective_end_time,
      effective_timing: data.effective_timing,
    };
    setCurrentUser(userObj);
    try {
      localStorage.setItem('attendance_current_user', JSON.stringify(userObj));
    } catch (e) {}

    if (data.company_name || data.company_logo || data.company_data) {
      const c = data.company_data || {};
      const cLat = c.office_lat !== undefined && c.office_lat !== null ? parseFloat(c.office_lat) : (data.office_lat !== undefined && data.office_lat !== null ? parseFloat(data.office_lat) : undefined);
      const cLng = c.office_lng !== undefined && c.office_lng !== null ? parseFloat(c.office_lng) : (data.office_lng !== undefined && data.office_lng !== null ? parseFloat(data.office_lng) : undefined);
      const cRadius = c.allowed_radius_meters !== undefined && c.allowed_radius_meters !== null ? parseInt(c.allowed_radius_meters) : (data.allowed_radius_meters !== undefined && data.allowed_radius_meters !== null ? parseInt(data.allowed_radius_meters) : undefined);

      setCompanyInfo((prev) => {
        const next = {
          ...prev,
          company_name: data.company_name || c.company_name || prev.company_name,
          company_logo: (data.company_logo !== undefined && data.company_logo !== '') ? data.company_logo : ((c.company_logo !== undefined && c.company_logo !== '') ? c.company_logo : prev.company_logo),
          primary_color: c.primary_color || prev.primary_color,
          address: c.address || prev.address,
          office_lat: cLat !== undefined ? cLat : prev.office_lat,
          office_lng: cLng !== undefined ? cLng : prev.office_lng,
          allowed_radius_meters: cRadius !== undefined ? cRadius : prev.allowed_radius_meters,
          office_timing: c.office_timing || data.office_timing || prev.office_timing,
          office_start_time: c.office_start_time || data.office_start_time || prev.office_start_time,
          office_end_time: c.office_end_time || data.office_end_time || prev.office_end_time,
        };
        cacheCompanyBranding(next);
        return next;
      });

      if (cLat !== undefined && !isNaN(cLat)) {
        setOfficeLat(cLat);
        try { localStorage.setItem('OFFICE_LAT', String(cLat)); } catch (e) {}
      }
      if (cLng !== undefined && !isNaN(cLng)) {
        setOfficeLng(cLng);
        try { localStorage.setItem('OFFICE_LNG', String(cLng)); } catch (e) {}
      }
      if (cRadius !== undefined && !isNaN(cRadius)) {
        setAllowedRadius(cRadius);
        try { localStorage.setItem('ALLOWED_RADIUS', String(cRadius)); } catch (e) {}
      }
    }

    // The cutoff/checkout time actually enforced for this employee - company default,
    // or their own shift timing when the company has enabled per-employee shift timing.
    if (data.effective_start_time || data.effective_end_time || data.effective_timing) {
      setShiftTiming((prev) => ({
        start_time: data.effective_start_time || prev.start_time,
        end_time: data.effective_end_time || prev.end_time,
        timing_label: data.effective_timing || prev.timing_label,
      }));
    }
  };

  const handleLogout = async () => {
    try { await fetch(`${API_BASE_URL}/api/attendance/logout/`, { method: 'POST', credentials: 'include' }); }
    finally {
      try { localStorage.removeItem('attendance_current_user'); } catch (e) {}
      setCurrentUser(null); setHistoryList([]); setActiveTab('punch'); setAuthMode('login');
    }
  };

  // Dynamic Biometric Portal Favicon & Title
  useEffect(() => {
    const originalTitle = document.title;
    const faviconLink = document.querySelector("link[rel*='icon']");
    const appleTouchLink = document.querySelector("link[rel='apple-touch-icon']");
    const originalFavicon = faviconLink ? faviconLink.getAttribute('href') : '/favicon.svg?v=2';
    const originalType = faviconLink ? faviconLink.getAttribute('type') : 'image/svg+xml';
    const originalApple = appleTouchLink ? appleTouchLink.getAttribute('href') : '/favicon.svg?v=2';

    document.title = 'Attendance & Biometric Portal - Check-In / Check-Out';
    if (faviconLink) {
      faviconLink.setAttribute('type', 'image/png');
      faviconLink.setAttribute('href', '/biometric-favicon.png');
    }
    if (appleTouchLink) {
      appleTouchLink.setAttribute('href', '/biometric-favicon.png');
    }

    return () => {
      document.title = originalTitle || 'Pay Slip Pro';
      if (faviconLink) {
        faviconLink.setAttribute('type', originalType || 'image/svg+xml');
        faviconLink.setAttribute('href', originalFavicon || '/favicon.svg?v=2');
      }
      if (appleTouchLink) {
        appleTouchLink.setAttribute('href', originalApple || '/favicon.svg?v=2');
      }
    };
  }, []);

  useEffect(() => {
    fetchGeofenceConfig();
    if (hasAttendanceInvite()) {
      setCurrentUser(null);
      const inviteToken = getAttendanceInvite();
      const lookupUrl = inviteToken
        ? `${API_BASE_URL}/api/attendance/lookup-employee/?invite=${encodeURIComponent(inviteToken)}`
        : `${API_BASE_URL}/api/attendance/lookup-employee/`;
      fetch(lookupUrl).then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          const err = new Error(data.error || data.detail || 'Your invitation has expired.');
          err.status = response.status;
          throw err;
        }
        if (data.already_registered) {
          setErrorBanner('This account is already registered. Please log in instead of using the invite link.');
          clearAttendanceInvite();
          setActiveTab('punch');
          return;
        }
        setActiveTab('onboard');
        setPrefilledEmployee(data);
        setRegData(prev => ({
          ...prev,
          full_name: data.full_name || prev.full_name,
          emp_id: data.emp_id || prev.emp_id,
          email: data.email || prev.email,
          designation: data.designation || prev.designation,
          joining_date: data.joining_date || prev.joining_date,
          phone_number: data.phone_number || prev.phone_number,
        }));
        if (data.company_name) {
          const cLat = data.office_lat !== undefined && data.office_lat !== null ? parseFloat(data.office_lat) : undefined;
          const cLng = data.office_lng !== undefined && data.office_lng !== null ? parseFloat(data.office_lng) : undefined;
          const cRadius = data.allowed_radius_meters !== undefined && data.allowed_radius_meters !== null ? parseInt(data.allowed_radius_meters) : undefined;

          setCompanyInfo((prev) => ({
            ...prev,
            company_name: data.company_name || prev.company_name,
            company_logo: data.company_logo || prev.company_logo,
            primary_color: data.primary_color || prev.primary_color,
            office_lat: cLat !== undefined ? cLat : prev.office_lat,
            office_lng: cLng !== undefined ? cLng : prev.office_lng,
            allowed_radius_meters: cRadius !== undefined ? cRadius : prev.allowed_radius_meters,
            address: data.office_address || data.address || prev.address
          }));

          if (cLat !== undefined && !isNaN(cLat)) {
            setOfficeLat(cLat);
            try { localStorage.setItem('OFFICE_LAT', String(cLat)); } catch (e) {}
          }
          if (cLng !== undefined && !isNaN(cLng)) {
            setOfficeLng(cLng);
            try { localStorage.setItem('OFFICE_LNG', String(cLng)); } catch (e) {}
          }
          if (cRadius !== undefined && !isNaN(cRadius)) {
            setAllowedRadius(cRadius);
            try { localStorage.setItem('ALLOWED_RADIUS', String(cRadius)); } catch (e) {}
          }
        }
      }).catch(error => {
        setErrorBanner(error.message);
        // Only a genuinely dead invite (403 - used, expired, or revoked by a newer
        // invite) should clear the token and send the employee back to the punch
        // screen. A transient problem (network blip, 401/429/5xx) must leave the
        // invite token intact so the employee can simply retry/reload the same link.
        if (error.status === 403) {
          clearAttendanceInvite();
          setActiveTab('punch');
        } else {
          setActiveTab('onboard');
        }
      });
      return;
    }

    fetch(`${API_BASE_URL}/api/attendance/me/`, { credentials: 'include' }).then(async response => {
      if (response.ok) {
        const u = await response.json();
        saveUserSession(u);
        return u;
      }
      return null;
    }).catch(() => {});
  }, []);

  // Guarantee that an authenticated user is never kept on the registration onboarding tab
  useEffect(() => {
    if (currentUser) {
      if (activeTab === 'onboard') {
        setActiveTab('punch');
      }
      return;
    }
    if (hasAttendanceInvite()) {
      setActiveTab('onboard');
      return;
    }
    const searchTab = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tab') : null;
    if (searchTab && ['punch', 'history', 'leave', 'status'].includes(searchTab)) {
      setActiveTab(searchTab);
      return;
    }
    if (initialTab && initialTab !== 'onboard') {
      setActiveTab(initialTab);
    }
  }, [initialTab, currentUser, activeTab]);

  // Synchronize theme with Pay Slip Pro global theme state
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const syncTheme = () => {
      const isDark = root.classList.contains('dark') || localStorage.getItem('theme') === 'dark';
      setIsDarkMode(isDark);
      if (isDark && !root.classList.contains('dark')) {
        root.classList.add('dark');
      }
    };
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('storage', syncTheme);
    return () => {
      observer.disconnect();
      window.removeEventListener('storage', syncTheme);
    };
  }, []);

  const toggleThemeMode = () => {
    const root = document.documentElement;
    const isCurrentlyDark = root.classList.contains('dark') || isDarkMode;
    if (isCurrentlyDark) {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDarkMode(false);
    } else {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDarkMode(true);
    }
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('[data-custom-dropdown]')) {
        setMonthDropdownOpen(false);
        setLeaveTypeDropdownOpen(false);
        setHoursDropdownOpen(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  // Helper function to format full request type label
  const getRequestTypeLabel = (type) => {
    switch (type) {
      case 'CASUAL': return 'Casual Leave';
      case 'SICK': return 'Sick Leave';
      case 'HALF_DAY': return 'Half Day Leave';
      case 'PERMISSION': return 'Permission Request';
      default: return type || 'Leave Request';
    }
  };

  // Pay Slip Pro unified design tokens with perfect contrast in light and dark modes
  const theme = {
    bg: isDarkMode ? '#0a0a0a' : '#f8fafc',
    headerBg: isDarkMode ? '#141416' : '#ffffff',
    cardBg: isDarkMode ? '#18181b' : '#ffffff',
    cardInnerBg: isDarkMode ? '#1f1f23' : '#f8fafc',
    border: isDarkMode ? '#27272a' : '#e2e8f0',
    inputBorder: isDarkMode ? '#3f3f46' : '#cbd5e1',
    inputBg: isDarkMode ? '#1f1f23' : '#ffffff',
    textPrimary: isDarkMode ? '#f4f4f5' : '#0f172a',
    textSecondary: isDarkMode ? '#a1a1aa' : '#475569',
    textMuted: isDarkMode ? '#71717a' : '#94a3b8',
    tableHeaderBg: isDarkMode ? '#1f1f23' : '#f1f5f9',
    tableRowBorder: isDarkMode ? '#27272a' : '#f1f5f9',
    mobileNavBg: isDarkMode ? 'rgba(18, 18, 22, 0.96)' : 'rgba(255, 255, 255, 0.96)',
  };

  const fetchMyLeaves = async () => {
    if (!currentUser || !currentUser.emp_id) return;
    setLoadingLeaves(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/attendance/my-leaves/?emp_id=${currentUser.emp_id}`);
      const data = await res.json();
      if (res.ok) {
        setMyLeavesList(data.leave_requests || []);
      }
    } catch (err) {
      console.warn("Error fetching leave requests:", err);
    } finally {
      setLoadingLeaves(false);
    }
  };

  const handleLeaveSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) {
      setNotificationModal({
        type: 'error',
        title: 'Authentication Required',
        message: 'Please login to submit leave or permission requests.'
      });
      return;
    }

    const isPermission = leaveForm.request_type === 'PERMISSION';
    const isHalfDay = leaveForm.request_type === 'HALF_DAY';
    const isSingleDate = isPermission || isHalfDay || leaveDurationMode === 'single';

    if (!isSingleDate && leaveForm.end_date && leaveForm.start_date && leaveForm.end_date < leaveForm.start_date) {
      setNotificationModal({
        type: 'error',
        title: 'Invalid Date Range',
        message: 'End date cannot be earlier than start date.'
      });
      return;
    }

    const effectiveEndDate = isSingleDate ? leaveForm.start_date : (leaveForm.end_date || leaveForm.start_date);

    setIsProcessing(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/attendance/leave-request/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emp_id: currentUser.emp_id,
          request_type: leaveForm.request_type,
          start_date: leaveForm.start_date,
          end_date: effectiveEndDate,
          duration_hours: isPermission ? leaveForm.duration_hours : null,
          reason: leaveForm.reason
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit request');

      const formattedStart = formatDisplayDate(leaveForm.start_date);
      const formattedEnd = formatDisplayDate(effectiveEndDate);

      setNotificationModal({
        type: 'success',
        title: 'Request Submitted! 📝',
        message: isPermission
          ? `Your ${leaveForm.duration_hours}-hour permission request for ${formattedStart} has been submitted for approval.`
          : isHalfDay
          ? `Your Half Day Leave request for ${formattedStart} has been submitted for approval.`
          : isSingleDate
          ? `Your 1-day ${getRequestTypeLabel(leaveForm.request_type)} request for ${formattedStart} has been submitted for approval.`
          : `Your ${getRequestTypeLabel(leaveForm.request_type)} request from ${formattedStart} to ${formattedEnd} has been submitted for approval.`
      });

      setLeaveForm({
        request_type: 'CASUAL',
        start_date: '',
        end_date: '',
        duration_hours: '2',
        reason: ''
      });
      setLeaveDurationMode('single');

      fetchMyLeaves();
    } catch (err) {
      setNotificationModal({
        type: 'error',
        title: 'Submission Failed',
        message: err.message
      });
    } finally {
      setIsProcessing(false);
    }
  };





  // Auto-fill from URL parameters (e.g. from onboarding invitation email: ?tab=onboard&emp_id=EMP001&email=...)
  useEffect(() => {
    if (currentUser) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      const empIdParam = params.get('emp_id') || params.get('employee_code');
      const emailParam = params.get('email');
      const nameParam = params.get('name') || params.get('full_name');
      const desigParam = params.get('designation');
      const phoneParam = params.get('phone') || params.get('phone_number');
      const joinParam = params.get('joining_date') || params.get('date_of_joining');

      if (tabParam === 'onboard' || empIdParam || emailParam) {
        setActiveTab('onboard');
      }

      if (empIdParam || emailParam || nameParam || desigParam || phoneParam || joinParam) {
        setRegData((prev) => ({
          ...prev,
          emp_id: empIdParam ? empIdParam.toUpperCase() : prev.emp_id,
          email: emailParam || prev.email,
          full_name: nameParam || prev.full_name,
          designation: desigParam || prev.designation,
          phone_number: phoneParam || prev.phone_number,
          joining_date: joinParam || prev.joining_date,
        }));

        const lookupQuery = empIdParam || emailParam || nameParam;
        if (lookupQuery) {
          setIsLookingUpEmp(true);
          fetchGeofenceConfig(lookupQuery);
          fetch(`${API_BASE_URL}/api/attendance/lookup-employee/?query=${encodeURIComponent(lookupQuery)}`)
            .then((res) => res.json())
            .then((data) => {
              if (data && data.found) {
                setPrefilledEmployee(data);
                setRegData((prev) => ({
                  ...prev,
                  full_name: data.full_name || prev.full_name,
                  emp_id: data.emp_id || prev.emp_id,
                  email: data.email || prev.email,
                  phone_number: data.phone_number || prev.phone_number,
                  designation: data.designation || prev.designation,
                  joining_date: data.joining_date || prev.joining_date,
                }));

                if (data.company_name) {
                  setCompanyInfo((prev) => ({
                    ...prev,
                    company_name: data.company_name || prev.company_name,
                    company_logo: data.company_logo || prev.company_logo,
                    primary_color: data.primary_color || prev.primary_color,
                    office_lat: data.office_lat !== undefined ? parseFloat(data.office_lat) : prev.office_lat,
                    office_lng: data.office_lng !== undefined ? parseFloat(data.office_lng) : prev.office_lng,
                    allowed_radius_meters: data.allowed_radius_meters !== undefined ? parseInt(data.allowed_radius_meters) : prev.allowed_radius_meters,
                    address: data.office_address || prev.address
                  }));
                  if (data.office_lat) setOfficeLat(parseFloat(data.office_lat));
                  if (data.office_lng) setOfficeLng(parseFloat(data.office_lng));
                  if (data.allowed_radius_meters) setAllowedRadius(parseInt(data.allowed_radius_meters));
                }
              }
            })
            .catch((err) => console.warn("Lookup error:", err))
            .finally(() => setIsLookingUpEmp(false));
        }
      }
    } catch (e) {
      console.warn("URL params error:", e);
    }
  }, []);

  const handleEmpIdLookup = async (queryVal) => {
    if (!queryVal || queryVal.trim().length < 2) return;
    setIsLookingUpEmp(true);
    fetchGeofenceConfig(queryVal.trim());
    try {
      const res = await fetch(`${API_BASE_URL}/api/attendance/lookup-employee/?query=${encodeURIComponent(queryVal.trim())}`);
      const data = await res.json();
      if (data && data.found) {
        setPrefilledEmployee(data);
        setRegData((prev) => ({
          ...prev,
          full_name: data.full_name || prev.full_name,
          emp_id: data.emp_id || prev.emp_id,
          email: data.email || prev.email,
          phone_number: data.phone_number || prev.phone_number,
          designation: data.designation || prev.designation,
          joining_date: data.joining_date || prev.joining_date,
        }));

        if (data.company_name) {
          setCompanyInfo((prev) => ({
            ...prev,
            company_name: data.company_name || prev.company_name,
            company_logo: data.company_logo || prev.company_logo,
            primary_color: data.primary_color || prev.primary_color,
            office_lat: data.office_lat !== undefined ? parseFloat(data.office_lat) : prev.office_lat,
            office_lng: data.office_lng !== undefined ? parseFloat(data.office_lng) : prev.office_lng,
            allowed_radius_meters: data.allowed_radius_meters !== undefined ? parseInt(data.allowed_radius_meters) : prev.allowed_radius_meters,
            address: data.office_address || prev.address
          }));
          if (data.office_lat) setOfficeLat(parseFloat(data.office_lat));
          if (data.office_lng) setOfficeLng(parseFloat(data.office_lng));
          if (data.allowed_radius_meters) setAllowedRadius(parseInt(data.allowed_radius_meters));
        }
      }
    } catch (err) {
      console.warn("Manual lookup error:", err);
    } finally {
      setIsLookingUpEmp(false);
    }
  };

  const fetchRegisteredDescriptors = async () => { setAllRegisteredDescriptors([]); };

  // Auto-generate Employee ID from Full Name
  const getAutoEmpId = (fullName) => {
    if (!fullName || !fullName.trim()) return '';
    const clean = fullName.trim().replace(/[^a-zA-Z]/g, '');
    const prefix = clean.length >= 3 ? clean.slice(0, 3).toUpperCase() : (clean.toUpperCase() + 'EMP').slice(0, 3);
    return `${prefix}_001`;
  };

  // Clock ticker & Late calculation, against THIS employee's own effective cutoff
  // (shiftTiming.start_time - company default, or their personal shift start time).
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      const [cutoffHour, cutoffMinute] = (shiftTiming.start_time || '09:30').split(':').map((n) => parseInt(n, 10) || 0);
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const seconds = now.getSeconds();
      const pastCutoff =
        hours > cutoffHour ||
        (hours === cutoffHour && minutes > cutoffMinute) ||
        (hours === cutoffHour && minutes === cutoffMinute && seconds > 0);
      setIsPastCutoff(pastCutoff);
    }, 1000);
    return () => clearInterval(timer);
  }, [shiftTiming.start_time]);






  // Real-time GPS Geolocation Tracker
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsError("Geolocation is not supported by your browser.");
      setLocationLoading(false);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setUserCoords({ lat, lng });

        const dist = calculateHaversine(lat, lng, officeLat, officeLng);
        setDistanceMeters(dist);
        setIsWithinZone(dist <= allowedRadius);
        setLocationLoading(false);
        setGpsError(null);
      },
      (error) => {
        setGpsError("Location access denied or unavailable.");
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [officeLat, officeLng, allowedRadius]);


  const startPunchCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } });
      if (punchVideoRef.current) {
        punchVideoRef.current.srcObject = stream;
        setPunchCameraActive(true);
      }
    } catch (err) {
      setPunchCameraActive(false);
    }
  };

  const startOnboardCamera = async () => {
    try {
      setOnboardCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } });
      setTimeout(() => {
        if (onboardVideoRef.current) {
          onboardVideoRef.current.srcObject = stream;
        }
      }, 50);
    } catch (err) {
      alert("Unable to access camera: " + err.message);
      setOnboardCameraActive(false);
    }
  };

  const capturePunchSnapshot = () => {
    if (!punchVideoRef.current || !punchCanvasRef.current) return null;
    const canvas = punchCanvasRef.current;
    const video = punchVideoRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.95);
    });
  };

  const captureOnboardSnapshot = () => {
    if (!onboardVideoRef.current || !onboardCanvasRef.current) return null;
    const canvas = onboardCanvasRef.current;
    const video = onboardVideoRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.95);
    });
  };

  useEffect(() => {
    if (activeTab === 'punch' && isWithinZone) {
      startPunchCamera();
    }
  }, [activeTab, isWithinZone]);

  useEffect(() => {
    if (activeTab !== 'punch' && activeTab !== 'onboard') return;
    const loadModels = async () => {
      try {
        const api = window.faceapi || await loadFaceApi();
        if (api && api.nets) {
          try {
            await api.nets.tinyFaceDetector.loadFromUri('/models/');
          } catch (eLocal) {
            await api.nets.tinyFaceDetector.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/');
          }
          setIsModelLoaded(true);
        }
      } catch (err) {
        console.warn("face-api CDN model load notice (using native FaceDetector fallback if available):", err);
      }
    };
    loadModels();
  }, [activeTab]);

  // Real-time canvas detection loop for webcam feeds
  useEffect(() => {
    let animId;
    let isDetectorSupported = 'FaceDetector' in window;
    let nativeFaceDetector = isDetectorSupported ? new window.FaceDetector({ fastMode: true, maxDetectedFaces: 5 }) : null;

    const detectFacesLoop = async () => {
      const api = window.faceapi;

      // 1. Process Punch Camera Stream Overlay
      if (activeTab === 'punch' && punchCameraActive && punchVideoRef.current && punchOverlayCanvasRef.current) {
        const video = punchVideoRef.current;
        const canvas = punchOverlayCanvasRef.current;
        if (video.readyState >= 2 && video.videoWidth > 0) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          let detectedBoxes = [];
          if (api && api.detectAllFaces && isModelLoaded) {
            try {
              const detections = await api.detectAllFaces(video, new api.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }));
              detectedBoxes = detections.map(d => d.box);
            } catch (e) {}
          } else if (nativeFaceDetector) {
            try {
              const faces = await nativeFaceDetector.detect(video);
              detectedBoxes = faces.map(f => f.boundingBox);
            } catch (e) {}
          }

          if (detectedBoxes.length === 1) {
            setPunchFaceStatus({ count: 1, text: '✓ Single Face Verified', isValid: true });
          } else if (detectedBoxes.length > 1) {
            setPunchFaceStatus({ count: detectedBoxes.length, text: '⚠️ Multiple faces detected! Only 1 face allowed.', isValid: false });
          } else {
            setPunchFaceStatus({ count: 0, text: 'Searching for face... Keep head straight', isValid: false });
          }
        }
      }

      // 2. Process Registration Camera Stream Overlay
      if (activeTab === 'onboard' && onboardCameraActive && onboardVideoRef.current && onboardOverlayCanvasRef.current) {
        const video = onboardVideoRef.current;
        const canvas = onboardOverlayCanvasRef.current;
        if (video.readyState >= 2 && video.videoWidth > 0) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height); // Keep canvas clean (no inner square boxes)

          let detectedBoxes = [];
          if (api && api.detectAllFaces && isModelLoaded) {
            try {
              const detections = await api.detectAllFaces(video, new api.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }));
              detectedBoxes = detections.map(d => d.box);
            } catch (e) {}
          } else if (nativeFaceDetector) {
            try {
              const faces = await nativeFaceDetector.detect(video);
              detectedBoxes = faces.map(f => f.boundingBox);
            } catch (e) {}
          }

          if (detectedBoxes.length === 1) {
            setOnboardFaceStatus({ count: 1, text: '✓ Single Face Verified', isValid: true });
          } else if (detectedBoxes.length > 1) {
            setOnboardFaceStatus({ count: detectedBoxes.length, text: '⚠️ Multiple faces detected! Only 1 face allowed.', isValid: false });
          } else {
            setOnboardFaceStatus({ count: 0, text: 'Searching for face... Keep head straight', isValid: false });
          }
        }
      }


      animId = requestAnimationFrame(detectFacesLoop);
    };

    animId = requestAnimationFrame(detectFacesLoop);
    return () => cancelAnimationFrame(animId);
  }, [activeTab, punchCameraActive, onboardCameraActive, currentUser, regData.full_name, isModelLoaded]);

  const verifyAndSetPhoto = async (fileOrBlob) => {
    setFaceValidating(true);
    setFaceValidError(null);
    setErrorBanner(null);

    try {
      const formData = new FormData();
      formData.append('face_image', fileOrBlob, 'face_check.jpg');

      const res = await fetch(`${API_BASE_URL}/api/attendance/verify-face/`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (!res.ok || !data.valid) {
        const msg = data.error || data.detail || "No human face detected. Only photos showing a human face are accepted.";
        setRegPhoto(null);
        setRegPhotoPreview(null);
        setFaceValidError(msg);
        return;
      }

      setRegPhoto(fileOrBlob);
      setRegPhotoPreview(URL.createObjectURL(fileOrBlob));
      setFaceValidError(null);
    } catch (err) {
      setRegPhoto(null);
      setRegPhotoPreview(null);
      setFaceValidError('Face validation error: ' + err.message);
    } finally {
      setFaceValidating(false);
    }
  };

  const handleCaptureRegPhoto = async () => {
    if (!onboardCameraActive) {
      await startOnboardCamera();
    }
    const blob = await captureOnboardSnapshot();
    if (blob) {
      verifyAndSetPhoto(blob);
    } else {
      alert("Unable to capture snapshot. Please ensure your camera permission is allowed.");
    }
  };

  const handlePunchAttendance = async (capturedBlob, liveDescriptor = null, isEarlyCheckout = false) => {
    if (!isWithinZone) {
      const distStr = distanceMeters ? (distanceMeters > 1000 ? `${(distanceMeters/1000).toFixed(1)} km` : `${Math.round(distanceMeters)} meters`) : '';
      setNotificationModal({
        type: 'error',
        title: 'Outside Office Area',
        message: `You are currently ${distStr ? distStr + ' ' : ''}away from the office. Please reach the office location to punch attendance.`
      });
      return;
    }



    if (!currentUser || !currentUser.emp_id) {
      setNotificationModal({
        type: 'error',
        title: 'Login Required',
        message: 'Please login or register first before punching attendance.'
      });
      return;
    }

    setIsProcessing(true);

    try {
      const photoBlob = capturedBlob || await capturePunchSnapshot();
      const formData = new FormData();
      formData.append('emp_id', currentUser.emp_id);
      formData.append('latitude', userCoords.lat);
      formData.append('longitude', userCoords.lng);
      if (isEarlyCheckout) {
        formData.append('is_early_checkout', 'true');
      }
      if (photoBlob) {
        formData.append('face_image', photoBlob, 'punch_selfie.jpg');
      }

      const response = await fetch(`${API_BASE_URL}/api/attendance/mark-attendance/`, {
        method: 'POST',
        body: formData,
      });

      let resData = {};
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        resData = await response.json();
      } else {
        const rawText = await response.text();
        throw new Error(response.ok ? 'Server returned invalid response.' : `Server Error (${response.status}): ${rawText.substring(0, 120)}`);
      }

      if (!response.ok) {
        throw new Error(resData.error || resData.detail || 'Attendance punch failed');
      }

      setModalData({
        type: resData.type || 'PUNCH',
        message: resData.message,
        employeeName: resData.employee_name || currentUser.name,
        empId: resData.emp_id || currentUser.emp_id,
        status: resData.status,
        checkIn: resData.check_in || resData.check_out,
        distance: resData.distance
      });

      if (resData.type === 'PERMISSION_OUT') {
        setOnPermissionBreak(true);
        setPermissionOutTime(resData.permission_out || '');
        // hasCheckedIn stays true - the day isn't checked out, just paused.
      } else if (resData.type === 'PERMISSION_IN') {
        setOnPermissionBreak(false);
        setPermissionOutTime('');
      } else {
        setOnPermissionBreak(false);
        setHasCheckedIn(!hasCheckedIn);
      }

    } catch (err) {
      const isFetchError = err.message === 'Failed to fetch' || err.name === 'TypeError';
      const isPunchRuleNotice = err.message && (
        err.message.includes('already recorded') || 
        err.message.includes('Check-Out') || 
        err.message.includes('Check-In') ||
        err.message.includes('6:00 PM') ||
        err.message.includes('5:30 PM')
      );
      
      setNotificationModal({
        type: 'error',
        title: isFetchError 
          ? 'Server Connection Error' 
          : isPunchRuleNotice 
          ? 'Attendance Punch Notice' 
          : 'Face Verification Failed',
        message: isFetchError 
          ? 'Unable to reach backend server. Please verify server status or connection.' 
          : (err.message || 'Captured face does not match the registered employee photo.')
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRegisterEmployee = async (e) => {
    e.preventDefault();
    setErrorBanner(null);
    if (!hasAttendanceInvite()) {
      setErrorBanner('Open the activation link sent by your company administrator to register.');
      return;
    }

    if (prefilledEmployee?.email_conflict) {
      setNotificationModal({
        type: 'error',
        title: 'Registration Error',
        message: prefilledEmployee.email_conflict_error || 'This email is already assigned to another attendance account. Contact your administrator.'
      });
      return;
    }

    if (regData.password && regData.confirm_password && regData.password !== regData.confirm_password) {
      setNotificationModal({
        type: 'error',
        title: 'Password Mismatch',
        message: 'Passwords do not match. Please re-enter your password correctly.'
      });
      return;
    }

    const hasMinLen = (regData.password || '').length >= 12;
    const hasUpper = /[A-Z]/.test(regData.password || '');
    const hasLower = /[a-z]/.test(regData.password || '');
    const hasDigit = /\d/.test(regData.password || '');
    const hasSpecial = /[^A-Za-z0-9]/.test(regData.password || '');

    if (!hasMinLen || !hasUpper || !hasLower || !hasDigit || !hasSpecial) {
      setNotificationModal({
        type: 'error',
        title: 'Weak Password Policy',
        message: 'Use at least 12 characters with uppercase, lowercase, a number and a special character.'
      });
      return;
    }

    if (!regPhoto) {
      setNotificationModal({
        type: 'error',
        title: 'Face Photo Required',
        message: 'Please capture a clear face photo using the camera before registering.'
      });
      return;
    }

    if (regData.phone_number && regData.phone_number.length !== 10) {
      setNotificationModal({
        type: 'error',
        title: 'Invalid Phone Number',
        message: 'Phone number must contain exactly 10 digits.'
      });
      return;
    }


    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append('full_name', regData.full_name);
      formData.append('emp_id', regData.emp_id);
      formData.append('email', regData.email);
      formData.append('password', regData.password);
      formData.append('designation', regData.designation || 'Full Stack Developer');
      if (regData.joining_date) formData.append('joining_date', regData.joining_date);
      if (regData.phone_number) formData.append('phone_number', regData.phone_number);
      formData.append('face_image', regPhoto, 'registered_face.jpg');


      const res = await fetch(`${API_BASE_URL}/api/attendance/register/`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.detail || 'Registration failed');
      
      clearAttendanceInvite();
      if (typeof window !== 'undefined') {
        try {
          const cleanUrl = (window.location.pathname && window.location.pathname.startsWith('/')) ? window.location.pathname : '/biometric';
          window.history.replaceState({}, document.title, cleanUrl);
        } catch (e) {}
      }

      setPrefilledEmployee(null);

      saveUserSession({
        emp_id: data.emp_id,
        name: data.full_name,
        email: data.email,
        face_descriptor: data.face_descriptor || regPhotoDescriptor,
        face_encoding: data.face_encoding || data.face_descriptor || regPhotoDescriptor,
        designation: data.designation,
        phone_number: data.phone_number,
        joining_date: data.joining_date,
        company_name: data.company_name,
        company_logo: data.company_logo,
        role: 'Employee'
      }, { access_token: data.access_token, refresh_token: data.refresh_token });

      setRegData({ full_name: '', email: '', password: '', confirm_password: '', designation: '', joining_date: '', phone_number: '' });
      setRegPhoto(null);
      setRegPhotoPreview(null);
      setRegPhotoDescriptor(null);
      setActiveTab('punch');

      setNotificationModal({
        type: 'success',
        title: 'Registration Successful!',
        message: `Welcome, ${data.full_name}!\nEmployee ID: ${data.emp_id}\nEmail: ${data.email}\n\nYour biometric profile has been created. You are now on the attendance punch page.`,
        onClose: () => {
          setActiveTab('punch');
          if (typeof window !== 'undefined') {
            try {
              const cleanUrl = (window.location.pathname && window.location.pathname.startsWith('/')) ? window.location.pathname : '/biometric';
              window.history.replaceState({}, document.title, cleanUrl);
            } catch (e) {}
          }
        }
      });
    } catch (err) {
      setNotificationModal({
        type: 'error',
        title: 'Registration Error',
        message: err.message
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorBanner(null);
    setIsProcessing(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/attendance/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: loginForm.identifier,
          password: loginForm.password
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.detail || 'Login failed');

      saveUserSession({
        emp_id: data.emp_id,
        name: data.full_name,
        email: data.email,
        face_descriptor: data.face_descriptor,
        role: 'Employee'
      }, { access_token: data.access_token, refresh_token: data.refresh_token });

      setAuthMode('app');
      
      setNotificationModal({
        type: 'success',
        title: 'Login Successful!',
        message: `Welcome back, ${data.full_name}!\n(Employee ID: ${data.emp_id})`
      });
    } catch (err) {
      setNotificationModal({
        type: 'error',
        title: 'Authentication Failed',
        message: err.message
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleForgotSendOtp = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const ident = forgotForm.identifier?.trim();
    if (!ident) {
      setForgotError('Please enter your registered Email or Employee ID.');
      return;
    }
    setForgotError('');
    setForgotMessage('');
    setForgotLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/attendance/forgot-password/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: ident })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.detail || 'Failed to send reset code.');
      }
      setForgotTargetEmail(data.email || ident);
      setForgotMessage(data.message || 'Reset code sent to your email. Check your inbox.');
      setForgotStep('code');
    } catch (err) {
      setForgotError(err.message || 'Failed to send reset code.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleForgotResetPassword = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setForgotError('');
    setForgotMessage('');

    if (!forgotForm.code?.trim()) {
      setForgotError('Please enter the 6-digit OTP code.');
      return;
    }
    if (!forgotForm.new_password) {
      setForgotError('Please enter your new password.');
      return;
    }
    if (forgotForm.new_password.length < 8) {
      setForgotError('Password must be at least 8 characters long.');
      return;
    }
    if (forgotForm.new_password !== forgotForm.confirm_password) {
      setForgotError('Passwords do not match.');
      return;
    }

    setForgotLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/attendance/reset-password/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: forgotForm.identifier.trim(),
          code: forgotForm.code.trim(),
          new_password: forgotForm.new_password
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.detail || 'Failed to reset password.');
      }
      setForgotStep('done');
      setForgotMessage(data.message || 'Password reset successful!');
    } catch (err) {
      setForgotError(err.message || 'Failed to reset password.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsProcessing(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/attendance/update-profile/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emp_id: currentUser.emp_id,
          full_name: profileForm.full_name,
          email: profileForm.email,
          designation: profileForm.designation,
          phone_number: profileForm.phone_number,
          joining_date: profileForm.joining_date,
          new_password: profileForm.new_password,
          current_password: profileForm.current_password || ''
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Profile update failed');

      saveUserSession({
        ...currentUser,
        name: data.full_name,
        email: data.email,
        designation: data.designation,
        phone_number: data.phone_number,
        joining_date: data.joining_date
      });

      setProfileModalOpen(false);
      setNotificationModal({
        type: 'success',
        title: 'Profile Updated!',
        message: 'Your profile details have been saved successfully.'
      });
    } catch (err) {
      setNotificationModal({
        type: 'error',
        title: 'Update Error',
        message: err.message
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const executeGoogleAuth = async (credential) => {
    setGoogleSigningIn(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/attendance/google/login/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Google sign-in failed.');
      saveUserSession(data);
      setGoogleModalOpen(false); setAuthMode('app');
    } catch (error) {
      setNotificationModal({ type: 'error', title: 'Google sign-in failed', message: error.message });
    } finally { setGoogleSigningIn(false); }
  };
  const handleGoogleLogin = () => setAuthMode('login');

  const generateClientMonthlySummary = (year, month, historyRecords = []) => {
    const numDays = new Date(year, month, 0).getDate();
    const today = new Date();
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    const dayWiseAudit = [];

    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;

    const historyByDate = {};
    (historyRecords || []).forEach(rec => {
      if (rec.date) historyByDate[rec.date] = rec;
    });

    for (let day = 1; day <= numDays; day++) {
      const d = new Date(year, month - 1, day);
      if (d > todayEnd) {
        // Skip future dates completely
        continue;
      }

      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayOfWeek = d.getDay(); // 0 = Sun, 6 = Sat

      const att = historyByDate[dateStr];

      if (att) {
        if (att.status === 'LATE') lateCount++;
        else presentCount++;

        dayWiseAudit.push({
          date: dateStr,
          day_name: d.toLocaleDateString('en-US', { weekday: 'short' }),
          check_in: att.check_in || '--:--',
          check_out: att.check_out || '--:--',
          status: att.status || 'PRESENT',
          duration_hours: att.duration_hours || 8,
          distance_m: att.distance_m || 0
        });
      } else {
        const isWeekend = dayOfWeek === 0; // Sunday only

        if (!isWeekend) absentCount++;

        dayWiseAudit.push({
          date: dateStr,
          day_name: d.toLocaleDateString('en-US', { weekday: 'short' }),
          check_in: '--:--',
          check_out: '--:--',
          status: isWeekend ? 'WEEKEND' : 'ABSENT',
          duration_hours: 0,
          distance_m: 0
        });
      }
    }


    return {
      emp_id: currentUser?.emp_id || 'EMP',
      employee_name: currentUser?.name || 'Employee',
      month,
      year,
      calendar_days: numDays,
      present_count: presentCount,
      late_count: lateCount,
      absent_count: absentCount,
      payable_days: Math.max(0, numDays - absentCount),
      day_wise_audit: dayWiseAudit
    };
  };

  const fetchHistory = async () => {
    if (!currentUser || !currentUser.emp_id) {
      setHistoryList([]);
      return [];
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/attendance/history/?emp_id=${currentUser.emp_id}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setHistoryList(list);

      // Automatically sync today's check-in / check-out status
      const todayStr = new Date().toISOString().split('T')[0];
      const todayRecord = list.find(r => r.date === todayStr);
      if (todayRecord && todayRecord.check_in) {
        setHasCheckedIn(!todayRecord.check_out);
        const stillOnBreak = Boolean(todayRecord.permission_out) && !todayRecord.permission_in && !todayRecord.check_out;
        setOnPermissionBreak(stillOnBreak);
        setPermissionOutTime(stillOnBreak ? todayRecord.permission_out : '');
      } else {
        setHasCheckedIn(false);
        setOnPermissionBreak(false);
        setPermissionOutTime('');
      }

      return list;
    } catch (err) {
      setHistoryList([]);
      return [];
    }
  };

  const fetchMonthlySummary = async (overrideHistory = null) => {
    if (!currentUser || !currentUser.emp_id) return;
    setLoadingSummary(true);
    const records = overrideHistory !== null ? overrideHistory : historyList;

    try {
      const res = await fetch(`${API_BASE_URL}/api/attendance/monthly-summary/?emp_id=${currentUser.emp_id}&month=${selectedMonth}&year=${selectedYear}`);
      const data = await res.json();
      if (res.ok && data && data.day_wise_audit && data.day_wise_audit.length > 0) {
        setMonthlySummary(data);
        setLoadingSummary(false);
        return;
      }
    } catch (err) {
      // Use fallback client audit matrix silently
    }

    const fallbackData = generateClientMonthlySummary(selectedYear, selectedMonth, records);
    setMonthlySummary(fallbackData);
    setLoadingSummary(false);
  };


  const handleSyncPayslipPro = () => {
    setNotificationModal({ type: 'info', title: 'Payroll administration', message: 'Your company administrator reviews attendance from the payroll dashboard.' });
  };

  useEffect(() => {
    fetchRegisteredDescriptors();
    if ((activeTab === 'leave' || activeTab === 'status') && currentUser) {
      fetchMyLeaves();
    } else if (activeTab === 'history' && currentUser) {
      fetchHistory().then((records) => {
        fetchMonthlySummary(records);
      });
    } else if (currentUser) {
      // Pre-fetch monthly summary
      fetchHistory().then((records) => {
        fetchMonthlySummary(records);
      });
    }
  }, [activeTab, currentUser, selectedMonth, selectedYear]);


  const filteredHistory = historyList.filter(item => 
    item.employee_name.toLowerCase().includes(searchFilter.toLowerCase()) ||
    item.emp_id.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div
      className={isDarkMode ? 'biometric-portal-root biometric-portal-dark' : 'biometric-portal-root biometric-portal-light'}
      style={{
        minHeight: '100vh',
        width: '100%',
        backgroundColor: theme.bg,
        color: theme.textPrimary,
        fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}
    >
      
      {/* TOP NAV BAR - PAY SLIP PRO STYLE */}
      <header className="sticky top-0 z-40 w-full flex h-14 sm:h-16 items-center justify-between border-b border-neutral-200/80 dark:border-neutral-800 bg-white/95 dark:bg-[#141416]/95 backdrop-blur-md px-3 sm:px-6 lg:px-8 shadow-sm transition-colors">
        <div className="w-full flex items-center justify-between gap-3">
          
          {/* BRAND LOGO & TITLE */}
          <div className="flex items-center gap-3 shrink-0">
            {companyInfo.company_logo ? (
              <img 
                src={companyInfo.company_logo} 
                alt={`${companyInfo.company_name || 'Company'} Logo`} 
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const fb = document.getElementById('company-header-fallback-logo');
                  if (fb) fb.style.display = 'flex';
                }}
                className="w-9 h-9 rounded-xl object-contain bg-white dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700/80 p-1 shadow-sm shrink-0"
              />
            ) : null}
            <div 
              id="company-header-fallback-logo"
              style={{ display: companyInfo.company_logo ? 'none' : 'flex' }}
              className="w-9 h-9 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700/80 items-center justify-center shadow-sm shrink-0 overflow-hidden p-0.5"
            >
              <img src="/biometric-favicon.png" alt="Portal Icon" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col min-w-0">
              <h1 className="m-0 text-sm sm:text-base font-bold tracking-tight text-neutral-900 dark:text-white leading-tight truncate">
                {companyInfo.company_name || 'Zigmaa Tech'}
              </h1>
              <p className="hidden sm:block m-0 text-[10px] font-semibold tracking-wider uppercase text-neutral-400 dark:text-neutral-500 truncate">
                Attendance & Biometric Portal
              </p>
            </div>
          </div>

          {/* DESKTOP NAVIGATION TABS */}
          <div className="hidden md:flex items-center p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200/60 dark:border-neutral-700/60">
            <button
              type="button"
              onClick={() => setActiveTab('punch')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'punch'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Punch Attendance</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Attendance Logs</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('leave')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'leave'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Leave / Permission</span>
            </button>
          </div>

          {/* RIGHT ACTIONS: THEME TOGGLE, NOTIFICATIONS, PROFILE */}
          <div className="flex items-center gap-2 shrink-0">
            {/* THEME TOGGLE */}
            <button
              type="button"
              onClick={toggleThemeMode}
              title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              className="p-2 rounded-xl text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800 border border-neutral-200/70 dark:border-neutral-800 shadow-sm transition-colors cursor-pointer"
              aria-label="Toggle theme"
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-neutral-600" />}
            </button>

            {/* NOTIFICATIONS */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifModalOpen(true)}
                title="Notifications & Activity Center"
                className="p-2 rounded-xl text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800 border border-neutral-200/70 dark:border-neutral-800 shadow-sm transition-colors relative cursor-pointer"
                aria-label="Notifications & Activity Center"
              >
                <Bell className="w-4 h-4" />
                {activeNotifications.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-neutral-900" />
                )}
              </button>
            </div>

            {/* USER LOGIN / PROFILE */}
            {currentUser ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 hover:border-neutral-300 dark:hover:border-neutral-700 shadow-sm text-xs font-semibold transition-all cursor-pointer"
                >
                  <User className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400 shrink-0" />
                  <span className="hidden sm:inline truncate max-w-[120px]">{currentUser.name}</span>
                  <span className="sm:hidden">{currentUser.name ? currentUser.name.split(' ')[0] : 'Profile'}</span>
                  <ChevronDown className="w-3 h-3 text-neutral-400 shrink-0" />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#18181b] rounded-2xl border border-neutral-200/80 dark:border-neutral-800 shadow-xl z-50 overflow-hidden p-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        setProfileForm({
                          full_name: currentUser.name || currentUser.full_name || '',
                          email: currentUser.email || '',
                          designation: currentUser.designation || '',
                          phone_number: currentUser.phone_number || '',
                          joining_date: currentUser.joining_date || '',
                          new_password: ''
                        });
                        setActiveTab('profile');
                      }}
                      className="w-full px-3 py-2 flex items-center gap-2 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer text-left"
                    >
                      <User className="w-3.5 h-3.5 text-neutral-500" />
                      <span>View & Edit Profile</span>
                    </button>

                    <div className="h-px bg-neutral-100 dark:bg-neutral-800 my-1" />

                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full px-3 py-2 flex items-center gap-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors cursor-pointer text-left"
                    >
                      <LogOut className="w-3.5 h-3.5 text-rose-500" />
                      <span>Logout</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAuthMode('login')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 font-semibold text-xs transition-colors shadow-sm cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
                  <span>Login</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('onboard')}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 font-semibold text-xs shadow-sm transition-colors cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Register New</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* TOP CLOCK & DATE BAR (SHOW ONLY IN PUNCH ATTENDANCE TAB) */}
      {activeTab === 'punch' && (
        <div className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 pt-4 pb-0 flex justify-end">
          <div className="inline-flex items-center gap-3 px-3.5 py-1.5 rounded-xl bg-white dark:bg-[#18181b] border border-neutral-200/80 dark:border-neutral-800 shadow-sm text-xs font-medium text-neutral-700 dark:text-neutral-300">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500" />
              <span>{`${currentTime.toLocaleDateString('en-US', { weekday: 'short' })}, ${String(currentTime.getDate()).padStart(2, '0')} ${currentTime.toLocaleDateString('en-US', { month: 'short' })} ${currentTime.getFullYear()}`}</span>
            </div>
            <span className="text-neutral-300 dark:text-neutral-700">|</span>
            <div className="flex items-center gap-1.5 font-mono text-xs">
              <Clock className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500" />
              <span>{currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</span>
            </div>
          </div>
        </div>
      )}

      {/* MAIN LAYOUT WRAPPER */}
      <div className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-6 box-border grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* LEFT COLUMN: GEOFENCE CARD */}
        {activeTab === 'punch' && (
          <div className="lg:col-span-4 flex flex-col gap-5">
            <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#18181b] p-5 sm:p-6 shadow-sm transition-colors">
              <div className="flex items-center gap-2.5 mb-3.5">
                {companyInfo.company_logo ? (
                  <img
                    src={companyInfo.company_logo}
                    alt={`${companyInfo.company_name || 'Company'} Logo`}
                    className="w-8 h-8 rounded-lg object-contain bg-neutral-50 dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700/80 p-0.5 shrink-0"
                  />
                ) : (
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isWithinZone ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isWithinZone ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {companyInfo.company_logo && (
                      <span className="relative flex h-2 w-2 shrink-0">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isWithinZone ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${isWithinZone ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      </span>
                    )}
                    <h3 className="text-sm font-bold text-neutral-900 dark:text-white tracking-tight truncate">
                      {companyInfo.company_name ? `${companyInfo.company_name} ` : 'Office Location Verification'}
                    </h3>
                  </div>
                  {companyInfo.address && (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5" title={companyInfo.address}>
                      📍 {companyInfo.address}
                    </p>
                  )}
                  {(currentUser ? shiftTiming.timing_label : companyInfo.office_timing) && (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5" title={`Office Timing: ${currentUser ? shiftTiming.timing_label : companyInfo.office_timing}`}>
                      🕒 {currentUser ? 'Your Shift' : 'Office Hours'}: {currentUser ? shiftTiming.timing_label : companyInfo.office_timing}
                    </p>
                  )}
                </div>
              </div>

              {/* Status badge */}
              <div className="space-y-3">
                {isWithinZone ? (
                  <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200/80 dark:bg-emerald-950/30 dark:border-emerald-800/50 text-emerald-900 dark:text-emerald-200 text-xs sm:text-sm font-medium flex flex-col gap-1 transition-all">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="font-semibold">Inside Office Geofence</span>
                    </div>
                    <p className="text-[11px] text-emerald-700/90 dark:text-emerald-300/80 pl-6 m-0">
                      You are at the office premises. Attendance punch is enabled.
                      {distanceMeters !== null && ` (${distanceMeters < 1000 ? `${distanceMeters.toFixed(1)}m` : `${(distanceMeters / 1000).toFixed(2)}km`} away)`}
                    </p>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200/80 dark:bg-amber-950/30 dark:border-amber-800/50 text-amber-900 dark:text-amber-200 text-xs sm:text-sm font-medium flex flex-col gap-1 transition-all">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span className="font-semibold">Outside Office Location ({allowedRadius}m limit)</span>
                    </div>
                    <p className="text-[11px] text-amber-700/90 dark:text-amber-300/80 pl-6 m-0">
                      {distanceMeters !== null
                        ? `Distance: ${distanceMeters < 1000 ? `${distanceMeters.toFixed(1)}m` : `${(distanceMeters / 1000).toFixed(2)}km`} away from office`
                        : 'Turn on location to detect your distance from office'}
                    </p>
                  </div>
                )}

                {/* Google maps direction button */}
                <a
                  href={userCoords 
                    ? `https://www.google.com/maps/dir/?api=1&origin=${userCoords.lat},${userCoords.lng}&destination=${officeLat},${officeLng}`
                    : `https://www.google.com/maps/dir/?api=1&destination=${officeLat},${officeLng}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-4 rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 font-semibold text-xs sm:text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer no-underline"
                >
                  <MapPin className="w-4 h-4 shrink-0" />
                  <span>View Distance in Google Maps</span>
                  <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-70" />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* RIGHT COLUMN: MAIN WORK AREA */}
        <div className={`${activeTab === 'punch' ? 'lg:col-span-8' : 'lg:col-span-12'} rounded-2xl p-5 sm:p-6 shadow-sm border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#18181b] text-neutral-900 dark:text-white transition-colors`}>

          {/* ERROR ALERT DISPLAY */}
          {errorBanner && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50/80 border border-rose-200/80 dark:bg-rose-950/30 dark:border-rose-800/60 text-rose-800 dark:text-rose-300 text-xs sm:text-sm font-medium flex items-center justify-between transition-all">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>{errorBanner}</span>
              </div>
              <button 
                type="button"
                onClick={() => setErrorBanner(null)} 
                className="text-rose-500 hover:text-rose-700 dark:text-rose-400 font-bold cursor-pointer text-lg p-0.5"
              >
                ×
              </button>
            </div>
          )}

          {/* PUNCH TAB WORKFLOW */}
          {activeTab === 'punch' && (
            <div className="flex flex-col gap-5">
              
              {/* LATE ARRIVAL WARNING */}
              {isPastCutoff && !hasCheckedIn && (
                <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200/80 dark:bg-amber-950/30 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs sm:text-sm font-medium flex items-center gap-3 transition-all">
                  <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Late arrival: Checking in now will be marked as <strong className="font-semibold underline">LATE</strong> (Cutoff: {formatTime12(shiftTiming.start_time)}).</span>
                </div>
              )}

              {/* ALREADY CHECKED IN TODAY BADGE */}
              {hasCheckedIn && !onPermissionBreak && (
                <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200/80 dark:bg-emerald-950/30 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm font-medium flex items-center justify-between gap-3 transition-all">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Check-In recorded for today! Next punch will be <strong className="font-semibold text-emerald-700 dark:text-emerald-300">Check-Out</strong> (available after {getDisplayCheckoutTime(shiftTiming.end_time || companyInfo.office_end_time)}).</span>
                  </div>
                </div>
              )}

              {/* ON PERMISSION BREAK BADGE */}
              {onPermissionBreak && (
                <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200/80 dark:bg-amber-950/30 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs sm:text-sm font-medium flex items-center justify-between gap-3 transition-all">
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>On permission since <strong className="font-semibold text-amber-700 dark:text-amber-300">{formatTime12(permissionOutTime)}</strong>. Punch in below when you're back.</span>
                  </div>
                </div>
              )}

              {/* PUNCH ATTENDANCE TRIGGER BUTTONS OR DISABLED BOX */}
              {isWithinZone ? (
                <div className="flex flex-col gap-3 w-full">
                  <FaceScanModalCapture
                    title="Biometric Punch Verification"
                    description={
                      onPermissionBreak
                        ? "Hold face steady in green oval to punch back in from your permission break."
                        : hasCheckedIn ? "Hold face steady in green oval for automatic check-out." : "Hold face steady in green oval for automatic check-in."
                    }
                    buttonText={
                      onPermissionBreak
                        ? "Punch In (Back from Permission) ↩️"
                        : hasCheckedIn ? `Check Out (Regular After ${getDisplayCheckoutTime(shiftTiming.end_time || companyInfo.office_end_time)})` : "Check In"
                    }
                    resetOnCapture={true}
                    autoCapture={true}
                    isDarkMode={isDarkMode}
                    currentUserDescriptor={
                      currentUser?.face_descriptor || 
                      currentUser?.face_encoding || 
                      allRegisteredDescriptors.find(e => 
                        (currentUser?.emp_id && String(e.emp_id).toLowerCase() === String(currentUser.emp_id).toLowerCase()) ||
                        (currentUser?.email && String(e.email).toLowerCase() === String(currentUser.email).toLowerCase())
                      )?.descriptor
                    }
                    currentUserName={currentUser?.name || currentUser?.full_name || 'Employee'}
                    onFaceCaptured={(blob, descriptorArray) => handlePunchAttendance(blob, descriptorArray, false)} 
                  />

                  {hasCheckedIn && !onPermissionBreak && (
                    <FaceScanModalCapture
                      title="Early Check-Out With Permission"
                      description={`Step out under an approved permission request (returns automatically if time remains before ${getDisplayCheckoutTime(shiftTiming.end_time || companyInfo.office_end_time)}) or an emergency leave.`}
                      buttonText="Step Out (With Permission) ⏱️"
                      resetOnCapture={true}
                      autoCapture={true}
                      isDarkMode={isDarkMode}
                      currentUserDescriptor={
                        currentUser?.face_descriptor || 
                        currentUser?.face_encoding || 
                        allRegisteredDescriptors.find(e => 
                          (currentUser?.emp_id && String(e.emp_id).toLowerCase() === String(currentUser.emp_id).toLowerCase()) ||
                          (currentUser?.email && String(e.email).toLowerCase() === String(currentUser.email).toLowerCase())
                        )?.descriptor
                      }
                      currentUserName={currentUser?.name || currentUser?.full_name || 'Employee'}
                      onFaceCaptured={(blob, descriptorArray) => handlePunchAttendance(blob, descriptorArray, true)} 
                    />
                  )}
                </div>
              ) : (
                <div className="w-full py-12 px-6 rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-700/80 bg-neutral-50/50 dark:bg-neutral-900/40 flex flex-col items-center justify-center text-center transition-all">
                  <div className="w-14 h-14 rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700 shadow-sm flex items-center justify-center mb-4">
                    <Lock className="w-6 h-6 text-neutral-400 dark:text-neutral-500 stroke-[1.75]" />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white tracking-tight">Camera & Punch Disabled</h3>
                  <p className="mt-1.5 text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto leading-relaxed">
                    You are outside the office area. Please reach the office location to access the camera and punch attendance.
                  </p>
                  <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200/70 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Geofence Verification Required ({allowedRadius}m)
                  </div>
                </div>
              )}

            </div>
          )}

          {/* REGISTRATION ONBOARDING */}
          {activeTab === 'onboard' && (
            <form onSubmit={handleRegisterEmployee} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ padding: '16px', borderRadius: '14px', backgroundColor: theme.cardInnerBg, border: `1px solid ${theme.border}` }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: theme.textPrimary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <UserPlus style={{ width: '20px', height: '20px', color: theme.textPrimary }} /> User Registration
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: theme.textSecondary }}>
                  Set up your employee biometric face profile and login credentials for attendance tracking.
                </p>
              </div>

              {/* EMAIL CONFLICT ALERT BANNER (Shown immediately at Step 1) */}
              {prefilledEmployee?.email_conflict && (
                <div style={{
                  padding: '16px 20px',
                  borderRadius: '14px',
                  background: isDarkMode ? '#450a0a' : '#fef2f2',
                  border: '1px solid #ef4444',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '14px'
                }}>
                  <AlertCircle style={{ width: '24px', height: '24px', color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#ef4444' }}>
                      ⚠️ Registration Blocked: Email Already in Use
                    </h4>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: isDarkMode ? '#fca5a5' : '#991b1b', lineHeight: 1.5 }}>
                      {prefilledEmployee.email_conflict_error || 'This email is already assigned to another attendance account. Contact your administrator.'}
                    </p>
                    <p style={{ margin: '6px 0 0 0', fontSize: '12px', fontWeight: '600', color: isDarkMode ? '#f87171' : '#b91c1c' }}>
                      Ask your company administrator to assign a unique email to your employee profile in Salary Slip before registering.
                    </p>
                  </div>
                </div>
              )}

              {/* PRE-FILLED PROFILE NOTICE BANNER */}
              {(prefilledEmployee || regData.full_name || regData.emp_id) && !prefilledEmployee?.email_conflict && (
                <div style={{
                  padding: '14px 18px',
                  borderRadius: '14px',
                  background: isDarkMode ? '#1f1f23' : '#f8fafc',
                  border: `1px solid ${theme.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <Sparkles style={{ width: '22px', height: '22px', color: theme.textPrimary, flexShrink: 0 }} />
                  <div>
                    <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: theme.textPrimary }}>
                      ✨ Profile Details Auto-Filled from Pay Slip Pro
                    </h4>
                    <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: theme.textSecondary }}>
                      {regData.full_name ? `Welcome ${regData.full_name} (${regData.emp_id || 'Employee'})! ` : ''}Your employee records have been loaded. 
                      <strong> You only need to set your password (Step 2) and capture your face photo (Step 3) to complete registration.</strong>
                    </p>
                  </div>
                </div>
              )}

              {/* STEP 1: EMPLOYEE DETAILS */}
              <div style={{
                backgroundColor: theme.cardBg,
                padding: '20px',
                borderRadius: '16px',
                border: `1px solid ${theme.border}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: theme.textPrimary, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: isDarkMode ? '#ffffff' : '#0f172a', color: isDarkMode ? '#0a0a0a' : '#ffffff', fontSize: '11px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800' }}>1</span>
                    Employee Information (Auto-Filled from Pay Slip Pro)
                  </h4>
                  {isLookingUpEmp ? (
                    <span style={{ fontSize: '11px', color: theme.textSecondary, display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}>
                      <RefreshCw style={{ width: '12px', height: '12px', animation: 'spin 1s linear infinite' }} /> Auto-fetching from Pay Slip Pro...
                    </span>
                  ) : (regData.full_name || regData.emp_id) ? (
                    <span style={{ fontSize: '11px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '700', backgroundColor: isDarkMode ? '#064e3b' : '#ECFDF5', padding: '2px 8px', borderRadius: '8px', border: '1px solid #10b981' }}>
                      <Check style={{ width: '12px', height: '12px' }} /> Details Ready
                    </span>
                  ) : null}
                </div>

                {/* FULL NAME AND EMPLOYEE ID */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ fontSize: '12px', fontWeight: '700', color: theme.textSecondary }}>Full Name *</label>
                      {regData.full_name && (
                        <span style={{ fontSize: '10px', fontWeight: '700', color: '#10b981' }}>✓ Auto-filled</span>
                      )}
                    </div>
                    <input 
                      type="text" 
                      required 
                      className="biometric-input"
                      placeholder="Enter your Full Name (e.g. John Doe)" 
                      value={regData.full_name} 
                      onChange={(e) => setRegData({ ...regData, full_name: e.target.value })} 
                      style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', backgroundColor: theme.inputBg, border: `1px solid ${theme.inputBorder}`, color: theme.textPrimary, fontSize: '13px', boxSizing: 'border-box' }} 
                    />
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ fontSize: '12px', fontWeight: '700', color: theme.textSecondary }}>Employee ID *</label>
                      {regData.emp_id && (
                        <span style={{ fontSize: '10px', fontWeight: '700', color: '#10b981' }}>✓ Auto-filled</span>
                      )}
                    </div>
                    <input 
                      type="text" 
                      required
                      className="biometric-input"
                      placeholder="Enter Employee ID (e.g. EMP001)" 
                      value={regData.emp_id} 
                      onChange={(e) => setRegData({ ...regData, emp_id: e.target.value.toUpperCase() })} 
                      onBlur={(e) => handleEmpIdLookup(e.target.value)}
                      style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', backgroundColor: theme.inputBg, border: `1px solid ${theme.inputBorder}`, fontSize: '13px', fontWeight: '700', color: theme.textPrimary, boxSizing: 'border-box' }} 
                    />
                  </div>
                </div>

                {/* EMAIL & DESIGNATION */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ fontSize: '12px', fontWeight: '700', color: theme.textSecondary }}>Email *</label>
                      {regData.email && (
                        <span style={{ fontSize: '10px', fontWeight: '700', color: '#10b981' }}>✓ Auto-filled</span>
                      )}
                    </div>
                    <input 
                      type="email" 
                      required 
                      className="biometric-input"
                      placeholder="Enter your email (e.g. john@company.com)" 
                      value={regData.email} 
                      onChange={(e) => setRegData({ ...regData, email: e.target.value })} 
                      onBlur={(e) => handleEmpIdLookup(e.target.value)}
                      style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', backgroundColor: theme.inputBg, border: `1px solid ${prefilledEmployee?.email_conflict ? '#ef4444' : theme.inputBorder}`, color: theme.textPrimary, fontSize: '13px', boxSizing: 'border-box' }} 
                    />
                    {prefilledEmployee?.email_conflict && (
                      <p style={{ margin: '6px 0 0 0', fontSize: '11px', fontWeight: '700', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>⚠️ {prefilledEmployee.email_conflict_error || 'This email is already assigned to another attendance account.'}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ fontSize: '12px', fontWeight: '700', color: theme.textSecondary }}>Designation *</label>
                      {regData.designation && (
                        <span style={{ fontSize: '10px', fontWeight: '700', color: '#10b981' }}>✓ Auto-filled</span>
                      )}
                    </div>
                    <input 
                      type="text" 
                      required
                      className="biometric-input"
                      placeholder="e.g. Full Stack Developer" 
                      value={regData.designation} 
                      onChange={(e) => setRegData({ ...regData, designation: e.target.value })} 
                      style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', backgroundColor: theme.inputBg, border: `1px solid ${theme.inputBorder}`, color: theme.textPrimary, fontSize: '13px', boxSizing: 'border-box' }} 
                    />
                  </div>
                </div>

                {/* DATE OF JOINING & PHONE NUMBER */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ fontSize: '12px', fontWeight: '700', color: theme.textSecondary }}>Date of Joining</label>
                      {regData.joining_date && (
                        <span style={{ fontSize: '10px', fontWeight: '700', color: '#10b981' }}>✓ Auto-filled</span>
                      )}
                    </div>
                    <input 
                      type="date" 
                      className="biometric-input"
                      value={regData.joining_date} 
                      onChange={(e) => setRegData({ ...regData, joining_date: e.target.value })} 
                      style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', backgroundColor: theme.inputBg, border: `1px solid ${theme.inputBorder}`, color: theme.textPrimary, colorScheme: isDarkMode ? 'dark' : 'light', fontSize: '13px', boxSizing: 'border-box' }} 
                    />
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ fontSize: '12px', fontWeight: '700', color: theme.textSecondary }}>Phone Number</label>
                      {regData.phone_number && (
                        <span style={{ fontSize: '10px', fontWeight: '700', color: '#10b981' }}>✓ Auto-filled</span>
                      )}
                    </div>
                    <input 
                      type="tel" 
                      maxLength={15}
                      className="biometric-input"
                      placeholder="e.g. 9876543210" 
                      value={regData.phone_number} 
                      onChange={(e) => {
                        setRegData({ ...regData, phone_number: e.target.value });
                      }} 
                      style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', backgroundColor: theme.inputBg, border: `1px solid ${theme.inputBorder}`, color: theme.textPrimary, fontSize: '13px', boxSizing: 'border-box' }} 
                    />
                  </div>
                </div>
              </div>

              {/* STEP 2: CREATE PASSWORD */}
              <div style={{
                backgroundColor: theme.cardBg,
                padding: '20px',
                borderRadius: '16px',
                border: `1px solid ${theme.border}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: theme.textPrimary, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: isDarkMode ? '#ffffff' : '#0f172a', color: isDarkMode ? '#0a0a0a' : '#ffffff', fontSize: '11px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800' }}>2</span>
                    Create Account Password (Required)
                  </h4>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: theme.textSecondary }}>
                    Enter a secure password for employee login & portal access.
                  </p>
                </div>

                {/* PASSWORD & CONFIRM PASSWORD WITH EYE TOGGLE */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: theme.textSecondary, marginBottom: '6px' }}>Password * (Min 12 chars, 1 Uppercase, 1 Symbol)</label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type={showRegPassword ? 'text' : 'password'} 
                        required 
                        className="biometric-input"
                        placeholder="Create a strong password" 
                        value={regData.password} 
                        onChange={(e) => setRegData({ ...regData, password: e.target.value })} 
                        onCopy={(e) => {
                          e.preventDefault();
                          setNotificationModal({ type: 'warning', title: 'Security Restriction', message: 'Copying password is disabled for security reasons.' });
                        }}
                        onCut={(e) => {
                          e.preventDefault();
                          setNotificationModal({ type: 'warning', title: 'Security Restriction', message: 'Cutting password is disabled for security reasons.' });
                        }}
                        onPaste={(e) => {
                          e.preventDefault();
                          setNotificationModal({ type: 'warning', title: 'Security Restriction', message: 'Pasting into password fields is disabled. Please type manually.' });
                        }}
                        onDrop={(e) => e.preventDefault()}
                        style={{ width: '100%', padding: '12px 40px 12px 14px', borderRadius: '10px', backgroundColor: theme.inputBg, border: `1px solid ${theme.inputBorder}`, color: theme.textPrimary, fontSize: '13px', boxSizing: 'border-box' }} 
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: theme.textSecondary }}
                      >
                        {showRegPassword ? <EyeOff style={{ width: '16px', height: '16px' }} /> : <Eye style={{ width: '16px', height: '16px' }} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: theme.textSecondary, marginBottom: '6px' }}>Confirm Password *</label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type={showConfirmPassword ? 'text' : 'password'} 
                        required 
                        className="biometric-input"
                        placeholder="Re-enter password" 
                        value={regData.confirm_password} 
                        onChange={(e) => setRegData({ ...regData, confirm_password: e.target.value })} 
                        onCopy={(e) => {
                          e.preventDefault();
                          setNotificationModal({ type: 'warning', title: 'Security Restriction', message: 'Copying password is disabled for security reasons.' });
                        }}
                        onCut={(e) => {
                          e.preventDefault();
                          setNotificationModal({ type: 'warning', title: 'Security Restriction', message: 'Cutting password is disabled for security reasons.' });
                        }}
                        onPaste={(e) => {
                          e.preventDefault();
                          setNotificationModal({ type: 'warning', title: 'Security Restriction', message: 'Pasting into confirm password is disabled. Please type manually to confirm.' });
                        }}
                        onDrop={(e) => e.preventDefault()}
                        style={{ width: '100%', padding: '12px 40px 12px 14px', borderRadius: '10px', backgroundColor: theme.inputBg, border: `1px solid ${theme.inputBorder}`, color: theme.textPrimary, fontSize: '13px', boxSizing: 'border-box' }} 
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: theme.textSecondary }}
                      >
                        {showConfirmPassword ? <EyeOff style={{ width: '16px', height: '16px' }} /> : <Eye style={{ width: '16px', height: '16px' }} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* STEP 3: BIOMETRIC FACE PHOTO */}
              <div style={{
                backgroundColor: theme.cardBg,
                padding: '20px',
                borderRadius: '16px',
                border: `1px solid ${theme.border}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: theme.textPrimary, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: isDarkMode ? '#ffffff' : '#0f172a', color: isDarkMode ? '#0a0a0a' : '#ffffff', fontSize: '11px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800' }}>3</span>
                    Biometric Face Capture (Required)
                  </h4>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: theme.textSecondary }}>
                    Capture your face photo to enable facial recognition attendance punching.
                  </p>
                </div>


              {/* FACE PHOTO CAPTURE SECTION - CENTERED MODAL CAPTURE */}
              <FaceScanModalCapture
                title="Biometric Face Scanner"
                description="Align face inside center oval for automatic photo capture."
                buttonText="Capture Profile Photo"
                autoCapture={true}
                mode="register"
                isDarkMode={isDarkMode}
                allRegisteredDescriptors={allRegisteredDescriptors}
                disabled={Boolean(prefilledEmployee?.email_conflict || !regData.password || !regData.confirm_password || regData.password !== regData.confirm_password)}
                disabledMessage={
                  prefilledEmployee?.email_conflict 
                    ? (prefilledEmployee?.email_conflict_error || 'This email is already assigned to another attendance account. Contact your administrator.')
                    : "Set and confirm your password in Step 2 first to unlock face capture."
                }
                expectedGender={prefilledEmployee?.gender || null}
                onFaceCaptured={(blobOrDataUrl, descriptorArray) => {
                  if (descriptorArray && Array.isArray(descriptorArray) && descriptorArray.length === 128) {
                    setRegPhotoDescriptor(descriptorArray);
                  }
                  if (typeof blobOrDataUrl === 'string' && blobOrDataUrl.startsWith('data:')) {
                    setRegPhotoPreview(blobOrDataUrl);
                    try {
                      const parts = blobOrDataUrl.split(';base64,');
                      const contentType = parts[0].split(':')[1];
                      const raw = window.atob(parts[1]);
                      const uInt8Array = new Uint8Array(raw.length);
                      for (let i = 0; i < raw.length; ++i) {
                        uInt8Array[i] = raw.charCodeAt(i);
                      }
                      const blob = new Blob([uInt8Array], { type: contentType });
                      setRegPhoto(blob);
                    } catch (e) {
                      setRegPhoto(new Blob(["dummy"], { type: 'image/jpeg' }));
                    }
                  } else {
                    setRegPhoto(blobOrDataUrl);
                    if (blobOrDataUrl instanceof Blob) {
                      setRegPhotoPreview(URL.createObjectURL(blobOrDataUrl));
                    } else {
                      setRegPhotoPreview(blobOrDataUrl);
                    }
                  }
                }} 
              />

              {faceValidating && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '10px', backgroundColor: isDarkMode ? '#172554' : '#EFF6FF', border: `1px solid ${isDarkMode ? '#1e40af' : '#BFDBFE'}`, color: isDarkMode ? '#93c5fd' : '#1D4ED8', fontSize: '13px', fontWeight: '700' }}>
                  <RefreshCw style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
                  Analyzing camera biometrics for human face...
                </div>
              )}

              </div>

              <button type="submit" disabled={isProcessing || faceValidating || !regPhoto || Boolean(prefilledEmployee?.email_conflict)} style={{ padding: '14px 0', borderRadius: '12px', backgroundColor: !regPhoto || faceValidating || prefilledEmployee?.email_conflict ? (isDarkMode ? '#27272a' : '#e2e8f0') : (isDarkMode ? '#ffffff' : '#0f172a'), color: !regPhoto || faceValidating || prefilledEmployee?.email_conflict ? (isDarkMode ? '#71717a' : '#94a3b8') : (isDarkMode ? '#0a0a0a' : '#ffffff'), fontWeight: '800', fontSize: '14px', border: 'none', cursor: !regPhoto || faceValidating || prefilledEmployee?.email_conflict ? 'not-allowed' : 'pointer', boxShadow: 'none' }}>
                {faceValidating ? 'Analyzing Face Biometrics...' : isProcessing ? 'Registering...' : 'Complete Registration'}
              </button>
            </form>
          )}

          {/* ATTENDANCE HISTORY LOGS */}
          {activeTab === 'history' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {!currentUser ? (
                <div className="w-full py-12 px-6 rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-700/80 bg-neutral-50/50 dark:bg-neutral-900/40 flex flex-col items-center justify-center text-center transition-all">
                  <div className="w-14 h-14 rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700 shadow-sm flex items-center justify-center mb-4">
                    <Lock className="w-6 h-6 text-neutral-400 dark:text-neutral-500 stroke-[1.75]" />
                  </div>
                  <h4 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white tracking-tight">Login Required to View Attendance Logs</h4>
                  <p className="mt-1.5 text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto leading-relaxed">
                    You must be logged into your employee account to view your personal attendance history.
                  </p>
                  <button
                    onClick={() => setAuthMode('login')}
                    className="mt-5 px-5 py-2.5 rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 font-semibold text-xs sm:text-sm shadow-sm transition-all cursor-pointer"
                  >
                    Login Now
                  </button>
                </div>
              ) : (
                <>
                  {/* Top Bar Controls: Month Selector & Sync to PayslipPro */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', backgroundColor: theme.cardBg, padding: '16px 20px', borderRadius: '18px', border: `1px solid ${theme.border}`, boxShadow: isDarkMode ? 'none' : '0 2px 6px rgba(15,23,42,0.03)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {/* CUSTOM SLEEK MONTH SELECTOR DROPDOWN */}
                      <div data-custom-dropdown style={{ position: 'relative' }}>
                        <button
                          type="button"
                          onClick={() => setMonthDropdownOpen(!monthDropdownOpen)}
                          style={{
                            padding: '9px 14px',
                            borderRadius: '12px',
                            backgroundColor: theme.inputBg,
                            border: `1px solid ${theme.inputBorder}`,
                            fontSize: '13px',
                            fontWeight: '700',
                            color: theme.textPrimary,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: isDarkMode ? 'none' : '0 1px 2px rgba(0,0,0,0.05)',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <span>
                            {(getMonthOptions().find((opt) => opt.year === selectedYear && opt.month === selectedMonth) || {}).label
                              || new Date(selectedYear, selectedMonth - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                          </span>
                          <ChevronDown style={{ width: '14px', height: '14px', color: theme.textSecondary, transition: 'transform 0.2s', transform: monthDropdownOpen ? 'rotate(180deg)' : 'none' }} />
                        </button>

                        {monthDropdownOpen && (
                          <div style={{
                            position: 'absolute',
                            top: 'calc(100% + 6px)',
                            left: 0,
                            minWidth: '160px',
                            backgroundColor: theme.cardBg,
                            borderRadius: '14px',
                            border: `1px solid ${theme.border}`,
                            boxShadow: isDarkMode ? '0 12px 30px rgba(0,0,0,0.6)' : '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
                            zIndex: 100,
                            padding: '6px',
                            overflow: 'hidden'
                          }}>
                            {getMonthOptions().map((opt) => {
                              const isSelected = selectedYear === opt.year && selectedMonth === opt.month;
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => {
                                    setSelectedYear(opt.year);
                                    setSelectedMonth(opt.month);
                                    setMonthDropdownOpen(false);
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    backgroundColor: isSelected ? (isDarkMode ? '#27272a' : '#f1f5f9') : 'transparent',
                                    color: isSelected ? (isDarkMode ? '#ffffff' : '#0f172a') : theme.textPrimary,
                                    fontSize: '13px',
                                    fontWeight: isSelected ? '800' : '600',
                                    textAlign: 'left',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    transition: 'background 0.15s ease'
                                  }}
                                >
                                  <span>{opt.label}</span>
                                  {isSelected && <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isDarkMode ? '#ffffff' : '#0f172a' }} />}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <button onClick={() => { fetchHistory(); fetchMonthlySummary(); }} style={{ padding: '10px 14px', borderRadius: '12px', backgroundColor: theme.cardInnerBg, border: `1px solid ${theme.border}`, color: theme.textPrimary, fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <RefreshCw style={{ width: '14px', height: '14px' }} /> Refresh
                      </button>
                    </div>
                  </div>

                  {/* Monthly Payroll Summary KPI Metrics Cards */}
                  {loadingSummary ? (
                    <div style={{ padding: '30px', textAlign: 'center', color: theme.textSecondary, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <RefreshCw style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite', color: theme.textSecondary }} />
                      Loading Monthly Payroll Aggregation...
                    </div>
                  ) : monthlySummary ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                      <div style={{ backgroundColor: theme.cardBg, padding: '16px', borderRadius: '16px', border: `1px solid ${theme.border}`, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: theme.textSecondary, fontSize: '12px', fontWeight: '700', marginBottom: '6px' }}>
                          🏢 Total Calendar Days
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: '900', color: theme.textPrimary }}>
                          {monthlySummary.calendar_days} <span style={{ fontSize: '12px', color: theme.textMuted, fontWeight: '500' }}>Days</span>
                        </div>
                      </div>

                      <div style={{ backgroundColor: theme.cardBg, padding: '16px', borderRadius: '16px', border: `1px solid ${theme.border}`, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontSize: '12px', fontWeight: '700', marginBottom: '6px' }}>
                          🟢 Present Days
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: '900', color: '#10b981' }}>
                          {monthlySummary.present_count} <span style={{ fontSize: '12px', color: theme.textMuted, fontWeight: '500' }}>Punches</span>
                        </div>
                      </div>

                      <div style={{ backgroundColor: theme.cardBg, padding: '16px', borderRadius: '16px', border: `1px solid ${theme.border}`, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b', fontSize: '12px', fontWeight: '700', marginBottom: '6px' }}>
                          ⏰ Late Punches
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: '900', color: '#f59e0b' }}>
                          {monthlySummary.late_count} <span style={{ fontSize: '12px', color: theme.textMuted, fontWeight: '500' }}>Punches</span>
                        </div>
                      </div>

                      <div style={{ backgroundColor: theme.cardBg, padding: '16px', borderRadius: '16px', border: `1px solid ${theme.border}`, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', fontSize: '12px', fontWeight: '700', marginBottom: '6px' }}>
                          🔴 Absent Days
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: '900', color: '#ef4444' }}>
                          {monthlySummary.absent_count} <span style={{ fontSize: '12px', color: theme.textMuted, fontWeight: '500' }}>Days</span>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* Day-Wise Audit Matrix Table */}
                  {monthlySummary && monthlySummary.day_wise_audit ? (
                    <div style={{ backgroundColor: theme.cardBg, borderRadius: '16px', border: `1px solid ${theme.border}`, overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                      <div style={{ padding: '14px 18px', borderBottom: `1px solid ${theme.border}`, backgroundColor: theme.cardInnerBg, fontWeight: '800', fontSize: '13px', color: theme.textPrimary }}>
                        📅 Day-Wise Monthly Attendance Matrix
                      </div>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                          <thead>
                            <tr style={{ backgroundColor: theme.tableHeaderBg, color: theme.textSecondary, borderBottom: `1px solid ${theme.border}`, fontSize: '12px' }}>
                              <th style={{ padding: '10px 16px' }}>Date</th>
                              <th style={{ padding: '10px 16px' }}>Check-In</th>
                              <th style={{ padding: '10px 16px' }}>Check-Out</th>
                              <th style={{ padding: '10px 16px' }}>Duration</th>
                              <th style={{ padding: '10px 16px', textAlign: 'right' }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {monthlySummary.day_wise_audit.map((item, idx) => (
                              <tr key={idx} style={{ borderBottom: `1px solid ${theme.tableRowBorder}` }}>
                                <td style={{ padding: '12px 16px', fontWeight: '700', color: theme.textPrimary }}>{formatDisplayDate(item.date)}</td>
                                <td style={{ padding: '12px 16px', color: theme.textSecondary }}>
                                  {item.check_in || '--:--'}
                                  {item.permission_out && (
                                    <div style={{ marginTop: '2px', fontSize: '10px', fontWeight: '700', color: '#d97706' }}>
                                      ⏱️ {item.permission_out} {item.permission_in ? `– ${item.permission_in}` : '(out)'}
                                    </div>
                                  )}
                                </td>
                                <td style={{ padding: '12px 16px', color: theme.textSecondary }}>{item.check_out || '--:--'}</td>
                                <td style={{ padding: '12px 16px', color: theme.textMuted }}>{item.duration_hours > 0 ? `${item.duration_hours} hrs` : '--'}</td>
                                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                  <span style={{
                                    padding: '4px 10px',
                                    borderRadius: '20px',
                                    fontSize: '11px',
                                    fontWeight: '800',
                                    backgroundColor: item.status === 'PRESENT' ? (isDarkMode ? '#064e3b' : '#ECFDF5') : item.status === 'LATE' ? (isDarkMode ? '#451a03' : '#FFFBEB') : (isDarkMode ? '#7f1d1d' : '#FEF2F2'),
                                    color: item.status === 'PRESENT' ? (isDarkMode ? '#a7f3d0' : '#047857') : item.status === 'LATE' ? (isDarkMode ? '#fde68a' : '#B45309') : (isDarkMode ? '#fca5a5' : '#DC2626'),
                                    border: item.status === 'PRESENT' ? '1px solid #10b981' : item.status === 'LATE' ? '1px solid #f59e0b' : '1px solid #ef4444'
                                  }}>
                                    {item.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          )}

          {/* LEAVE & PERMISSION TAB WORKFLOW */}
          {activeTab === 'leave' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ padding: '16px', borderRadius: '14px', backgroundColor: theme.cardInnerBg, border: `1px solid ${theme.border}` }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: theme.textPrimary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText style={{ width: '22px', height: '22px', color: theme.textPrimary }} /> Leave & Permission Requests
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: theme.textSecondary }}>
                  Submit leave or permission requests for admin approval and automatic sync with Pay Slip Pro.
                </p>
              </div>

              {/* REQUEST FORM & STATUS LIST GRID */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                
                {/* SUBMIT LEAVE REQUEST FORM */}
                <form onSubmit={handleLeaveSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: theme.cardBg, padding: '20px', borderRadius: '16px', border: `1px solid ${theme.border}`, boxShadow: isDarkMode ? 'none' : '0 2px 4px rgba(0,0,0,0.02)' }}>
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: theme.textPrimary }}>Submit New Request</h4>

                  {/* CUSTOM REQUEST TYPE DROPDOWN */}
                  <div data-custom-dropdown style={{ position: 'relative' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: theme.textSecondary, marginBottom: '6px' }}>Request Type *</label>
                    <button
                      type="button"
                      onClick={() => setLeaveTypeDropdownOpen(!leaveTypeDropdownOpen)}
                      style={{
                        width: '100%',
                        padding: '11px 14px',
                        borderRadius: '10px',
                        backgroundColor: theme.inputBg,
                        border: `1px solid ${theme.inputBorder}`,
                        fontSize: '13px',
                        fontWeight: '700',
                        color: theme.textPrimary,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        boxSizing: 'border-box'
                      }}
                    >
                      <span>
                        {leaveForm.request_type === 'CASUAL' ? 'Casual Leave' : leaveForm.request_type === 'SICK' ? 'Sick Leave' : leaveForm.request_type === 'HALF_DAY' ? 'Half Day Leave' : 'Permission Request'}
                      </span>
                      <ChevronDown style={{ width: '15px', height: '15px', color: theme.textSecondary, transition: 'transform 0.2s', transform: leaveTypeDropdownOpen ? 'rotate(180deg)' : 'none' }} />
                    </button>

                    {leaveTypeDropdownOpen && (
                      <div style={{
                        position: 'absolute',
                        top: 'calc(100% + 6px)',
                        left: 0,
                        right: 0,
                        backgroundColor: theme.cardBg,
                        borderRadius: '12px',
                        border: `1px solid ${theme.border}`,
                        boxShadow: isDarkMode ? '0 12px 30px rgba(0,0,0,0.6)' : '0 10px 25px -5px rgba(0,0,0,0.1)',
                        zIndex: 100,
                        padding: '6px',
                        overflow: 'hidden'
                      }}>
                        {[
                          { label: 'Casual Leave', value: 'CASUAL', desc: 'Planned / personal leave' },
                          { label: 'Sick Leave', value: 'SICK', desc: 'Medical / illness leave' },
                          { label: 'Half Day Leave', value: 'HALF_DAY', desc: '0.5 Day (Morning / Afternoon)' },
                          { label: 'Permission Request', value: 'PERMISSION', desc: 'Short permission (1-3 hours)' }
                        ].map((opt) => {
                          const isSelected = leaveForm.request_type === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                setLeaveForm({ ...leaveForm, request_type: opt.value });
                                setLeaveTypeDropdownOpen(false);
                              }}
                              style={{
                                width: '100%',
                                padding: '10px 12px',
                                borderRadius: '8px',
                                backgroundColor: isSelected ? (isDarkMode ? '#27272a' : '#f1f5f9') : 'transparent',
                                color: isSelected ? (isDarkMode ? '#ffffff' : '#0f172a') : theme.textPrimary,
                                fontSize: '13px',
                                fontWeight: isSelected ? '800' : '600',
                                textAlign: 'left',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                transition: 'background 0.15s ease'
                              }}
                            >
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span>{opt.label}</span>
                                <span style={{ fontSize: '11px', color: theme.textMuted, fontWeight: '500' }}>{opt.desc}</span>
                              </div>
                              {isSelected && <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isDarkMode ? '#ffffff' : '#0f172a' }} />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* DURATION MODE: ONE DAY vs MANY DAYS (FOR CASUAL & SICK LEAVE) */}
                  {(leaveForm.request_type === 'CASUAL' || leaveForm.request_type === 'SICK') && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: theme.textSecondary }}>
                        Leave Duration *
                      </label>
                      <div className="grid grid-cols-2 gap-2 p-1 rounded-xl" style={{ backgroundColor: theme.cardInnerBg, border: `1px solid ${theme.border}` }}>
                        <button
                          type="button"
                          onClick={() => {
                            setLeaveDurationMode('single');
                            setLeaveForm((prev) => ({ ...prev, end_date: prev.start_date }));
                          }}
                          style={{
                            padding: '9px 12px',
                            borderRadius: '8px',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: '700',
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            transition: 'all 0.15s ease',
                            backgroundColor: leaveDurationMode === 'single' ? (isDarkMode ? '#ffffff' : '#0f172a') : 'transparent',
                            color: leaveDurationMode === 'single' ? (isDarkMode ? '#0a0a0a' : '#ffffff') : theme.textSecondary,
                            boxShadow: 'none'
                          }}
                        >
                          <span>📅 One Day Leave</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setLeaveDurationMode('multiple')}
                          style={{
                            padding: '9px 12px',
                            borderRadius: '8px',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: '700',
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            transition: 'all 0.15s ease',
                            backgroundColor: leaveDurationMode === 'multiple' ? (isDarkMode ? '#ffffff' : '#0f172a') : 'transparent',
                            color: leaveDurationMode === 'multiple' ? (isDarkMode ? '#0a0a0a' : '#ffffff') : theme.textSecondary,
                            boxShadow: 'none'
                          }}
                        >
                          <span>🗓️ Many Days (Multiple)</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {leaveForm.request_type === 'PERMISSION' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                      <div className="w-full">
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: theme.textSecondary, marginBottom: '6px' }}>Date *</label>
                        <input
                          type="date"
                          required
                          className="biometric-input"
                          value={leaveForm.start_date}
                          onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value, end_date: e.target.value })}
                          style={{ width: '100%', minWidth: 0, padding: '12px 14px', borderRadius: '10px', backgroundColor: theme.inputBg, border: `1px solid ${theme.inputBorder}`, fontSize: '13px', color: theme.textPrimary, colorScheme: isDarkMode ? 'dark' : 'light', boxSizing: 'border-box' }}
                        />
                      </div>

                      {/* CUSTOM HOURS REQUIRED DROPDOWN */}
                      <div data-custom-dropdown className="w-full" style={{ position: 'relative' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: theme.textSecondary, marginBottom: '6px' }}>Hours Required *</label>
                        <button
                          type="button"
                          onClick={() => setHoursDropdownOpen(!hoursDropdownOpen)}
                          style={{
                            width: '100%',
                            minWidth: 0,
                            padding: '11px 14px',
                            borderRadius: '10px',
                            backgroundColor: theme.inputBg,
                            border: `1px solid ${theme.inputBorder}`,
                            fontSize: '13px',
                            fontWeight: '700',
                            color: theme.textPrimary,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            boxSizing: 'border-box'
                          }}
                        >
                          <span>{leaveForm.duration_hours} Hour{leaveForm.duration_hours > 1 ? 's' : ''}</span>
                          <ChevronDown style={{ width: '15px', height: '15px', color: theme.textSecondary, transition: 'transform 0.2s', transform: hoursDropdownOpen ? 'rotate(180deg)' : 'none' }} />
                        </button>

                        {hoursDropdownOpen && (
                          <div style={{
                            position: 'absolute',
                            top: 'calc(100% + 6px)',
                            left: 0,
                            right: 0,
                            backgroundColor: theme.cardBg,
                            borderRadius: '12px',
                            border: `1px solid ${theme.border}`,
                            boxShadow: isDarkMode ? '0 12px 30px rgba(0,0,0,0.6)' : '0 10px 25px -5px rgba(0,0,0,0.1)',
                            zIndex: 100,
                            padding: '6px',
                            overflow: 'hidden'
                          }}>
                            {['1', '2', '3'].map((hr) => {
                              const isSelected = String(leaveForm.duration_hours) === hr;
                              return (
                                <button
                                  key={hr}
                                  type="button"
                                  onClick={() => {
                                    setLeaveForm({ ...leaveForm, duration_hours: hr });
                                    setHoursDropdownOpen(false);
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '9px 12px',
                                    borderRadius: '8px',
                                    backgroundColor: isSelected ? (isDarkMode ? '#27272a' : '#f1f5f9') : 'transparent',
                                    color: isSelected ? (isDarkMode ? '#ffffff' : '#0f172a') : theme.textPrimary,
                                    fontSize: '13px',
                                    fontWeight: isSelected ? '800' : '600',
                                    textAlign: 'left',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between'
                                  }}
                                >
                                  <span>{hr} Hour{parseInt(hr) > 1 ? 's' : ''}</span>
                                  {isSelected && <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isDarkMode ? '#ffffff' : '#0f172a' }} />}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : leaveForm.request_type === 'HALF_DAY' ? (
                    <div className="w-full">
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: theme.textSecondary, marginBottom: '6px' }}>Half Day Leave Date *</label>
                      <input
                        type="date"
                        required
                        className="biometric-input"
                        value={leaveForm.start_date}
                        onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value, end_date: e.target.value })}
                        style={{ width: '100%', minWidth: 0, padding: '12px 14px', borderRadius: '10px', backgroundColor: theme.inputBg, border: `1px solid ${theme.inputBorder}`, fontSize: '13px', color: theme.textPrimary, colorScheme: isDarkMode ? 'dark' : 'light', boxSizing: 'border-box' }}
                      />
                      {leaveForm.start_date && (
                        <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: isDarkMode ? '#e4e4e7' : '#0f172a', fontWeight: '600' }}>
                          ✓ 0.5 Day Leave on {formatDisplayDate(leaveForm.start_date)}
                        </p>
                      )}
                    </div>
                  ) : leaveDurationMode === 'single' ? (
                    <div className="w-full">
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: theme.textSecondary, marginBottom: '6px' }}>Leave Date *</label>
                      <input
                        type="date"
                        required
                        className="biometric-input"
                        value={leaveForm.start_date}
                        onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value, end_date: e.target.value })}
                        style={{ width: '100%', minWidth: 0, padding: '12px 14px', borderRadius: '10px', backgroundColor: theme.inputBg, border: `1px solid ${theme.inputBorder}`, fontSize: '13px', color: theme.textPrimary, colorScheme: isDarkMode ? 'dark' : 'light', boxSizing: 'border-box' }}
                      />
                      {leaveForm.start_date && (
                        <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: isDarkMode ? '#e4e4e7' : '#0f172a', fontWeight: '600' }}>
                          ✓ 1-Day {leaveForm.request_type === 'SICK' ? 'Sick' : 'Casual'} Leave on {formatDisplayDate(leaveForm.start_date)}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 w-full">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                        <div className="w-full">
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: theme.textSecondary, marginBottom: '6px' }}>Start Date *</label>
                          <input
                            type="date"
                            required
                            className="biometric-input"
                            value={leaveForm.start_date}
                            onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })}
                            style={{ width: '100%', minWidth: 0, padding: '12px 14px', borderRadius: '10px', backgroundColor: theme.inputBg, border: `1px solid ${theme.inputBorder}`, fontSize: '13px', color: theme.textPrimary, colorScheme: isDarkMode ? 'dark' : 'light', boxSizing: 'border-box' }}
                          />
                        </div>

                        <div className="w-full">
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: theme.textSecondary, marginBottom: '6px' }}>End Date *</label>
                          <input
                            type="date"
                            required
                            className="biometric-input"
                            value={leaveForm.end_date}
                            min={leaveForm.start_date || undefined}
                            onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
                            style={{ width: '100%', minWidth: 0, padding: '12px 14px', borderRadius: '10px', backgroundColor: theme.inputBg, border: `1px solid ${theme.inputBorder}`, fontSize: '13px', color: theme.textPrimary, colorScheme: isDarkMode ? 'dark' : 'light', boxSizing: 'border-box' }}
                          />
                        </div>
                      </div>
                      {leaveForm.start_date && leaveForm.end_date && (
                        <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: isDarkMode ? '#e4e4e7' : '#0f172a', fontWeight: '600' }}>
                          {new Date(leaveForm.end_date) >= new Date(leaveForm.start_date)
                            ? `✓ Duration: ${Math.round((new Date(leaveForm.end_date) - new Date(leaveForm.start_date)) / (1000 * 60 * 60 * 24)) + 1} Days (${formatDisplayDate(leaveForm.start_date)} to ${formatDisplayDate(leaveForm.end_date)})`
                            : '⚠️ End date cannot be before start date'}
                        </p>
                      )}
                    </div>
                  )}

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: theme.textSecondary, marginBottom: '6px' }}>Reason *</label>
                    <textarea
                      required
                      rows={3}
                      className="biometric-input"
                      placeholder="Specify reason for request..."
                      value={leaveForm.reason}
                      onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                      style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', backgroundColor: theme.inputBg, border: `1px solid ${theme.inputBorder}`, color: theme.textPrimary, fontSize: '13px', boxSizing: 'border-box', fontFamily: 'inherit' }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isProcessing}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '10px',
                      backgroundColor: isDarkMode ? '#ffffff' : '#0f172a',
                      color: isDarkMode ? '#0a0a0a' : '#ffffff',
                      fontWeight: '800',
                      fontSize: '13px',
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    {isProcessing ? 'Submitting...' : 'Submit Request'}
                  </button>
                </form>

                {/* MY REQUESTS HISTORY LIST (RESTORED ON RIGHT SIDE FOR DESKTOP ONLY / HIDDEN ON MOBILE) */}
                <div className="hidden md:flex" style={{ flexDirection: 'column', gap: '14px', backgroundColor: theme.cardBg, padding: '20px', borderRadius: '16px', border: `1px solid ${theme.border}`, boxShadow: isDarkMode ? 'none' : '0 2px 4px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: theme.textPrimary }}>Recent Requests & Status</h4>
                    <button
                      onClick={fetchMyLeaves}
                      style={{ background: 'none', border: 'none', color: theme.textSecondary, fontWeight: '700', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <RefreshCw style={{ width: '12px', height: '12px' }} /> Refresh
                    </button>
                  </div>

                  {loadingLeaves ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: theme.textSecondary, fontSize: '13px' }}>Loading requests...</div>
                  ) : myLeavesList.length === 0 ? (
                    <div style={{ padding: '30px', textAlign: 'center', color: theme.textMuted, fontSize: '13px' }}>
                      No leave/permission requests submitted yet.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '420px', overflowY: 'auto' }}>
                      {myLeavesList.map((item) => (
                        <div key={item.id} style={{ padding: '14px', borderRadius: '12px', border: `1px solid ${theme.border}`, backgroundColor: theme.cardInnerBg, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '13px', fontWeight: '800', color: theme.textPrimary }}>{getRequestTypeLabel(item.request_type)}</span>
                            <span style={{
                              padding: '3px 8px',
                              borderRadius: '12px',
                              fontSize: '10px',
                              fontWeight: '800',
                              backgroundColor: item.status === 'APPROVED' ? (isDarkMode ? '#064e3b' : '#ECFDF5') : item.status === 'REJECTED' ? (isDarkMode ? '#7f1d1d' : '#FEF2F2') : (isDarkMode ? '#451a03' : '#FFFBEB'),
                              color: item.status === 'APPROVED' ? (isDarkMode ? '#a7f3d0' : '#047857') : item.status === 'REJECTED' ? (isDarkMode ? '#fca5a5' : '#DC2626') : (isDarkMode ? '#fde68a' : '#B45309'),
                              border: item.status === 'APPROVED' ? '1px solid #10b981' : item.status === 'REJECTED' ? '1px solid #ef4444' : '1px solid #f59e0b'
                            }}>
                              {item.status}
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: theme.textSecondary, fontWeight: '600' }}>
                            {item.request_type === 'PERMISSION' ? (
                              <>⏱️ Date: {formatDisplayDate(item.start_date)} | Duration: {item.duration_hours || 2} Hours</>
                            ) : item.request_type === 'HALF_DAY' ? (
                              <>🌗 Date: {formatDisplayDate(item.start_date)} (Half Day)</>
                            ) : item.start_date === item.end_date ? (
                              <>📅 Date: {formatDisplayDate(item.start_date)} (1 Day Leave)</>
                            ) : (
                              <>📅 {formatDisplayDate(item.start_date)} to {formatDisplayDate(item.end_date)}</>
                            )}
                          </div>
                          <div style={{ fontSize: '12px', color: theme.textMuted, fontStyle: 'italic' }}>
                            "{item.reason}"
                          </div>
                          {item.admin_remarks && (
                            <div style={{ fontSize: '11px', color: isDarkMode ? '#a1a1aa' : '#475569', fontWeight: '700', marginTop: '2px' }}>
                              Admin Note: {item.admin_remarks}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* STATUS TAB WORKFLOW (Dedicated tab for viewing Leave & Permission request status) */}
          {activeTab === 'status' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ padding: '16px', borderRadius: '14px', backgroundColor: theme.cardInnerBg, border: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: theme.textPrimary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle2 style={{ width: '22px', height: '22px', color: theme.textPrimary }} /> Leave & Permission Request Status
                  </h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: theme.textSecondary }}>
                    Real-time status of your submitted leave and permission requests.
                  </p>
                </div>
                <button
                  onClick={fetchMyLeaves}
                  style={{ padding: '8px 14px', borderRadius: '10px', backgroundColor: isDarkMode ? '#27272a' : '#f1f5f9', border: `1px solid ${theme.border}`, color: theme.textPrimary, fontWeight: '700', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <RefreshCw style={{ width: '14px', height: '14px' }} /> Refresh
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', backgroundColor: theme.cardBg, padding: '20px', borderRadius: '16px', border: `1px solid ${theme.border}`, boxShadow: isDarkMode ? 'none' : '0 2px 4px rgba(0,0,0,0.02)' }}>
                {loadingLeaves ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: theme.textSecondary, fontSize: '13px' }}>Loading requests...</div>
                ) : myLeavesList.length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: theme.textMuted, fontSize: '13px' }}>
                    No leave/permission requests submitted yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {myLeavesList.map((item) => (
                      <div key={item.id} style={{ padding: '16px', borderRadius: '14px', border: `1px solid ${theme.border}`, backgroundColor: theme.cardInnerBg, boxShadow: '0 2px 6px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '14px', fontWeight: '800', color: theme.textPrimary }}>{getRequestTypeLabel(item.request_type)}</span>
                          <span style={{
                            padding: '4px 12px',
                            borderRadius: '20px',
                            fontSize: '11px',
                            fontWeight: '800',
                            backgroundColor: item.status === 'APPROVED' ? (isDarkMode ? '#064e3b' : '#ECFDF5') : item.status === 'REJECTED' ? (isDarkMode ? '#7f1d1d' : '#FEF2F2') : (isDarkMode ? '#451a03' : '#FFFBEB'),
                            color: item.status === 'APPROVED' ? (isDarkMode ? '#a7f3d0' : '#047857') : item.status === 'REJECTED' ? (isDarkMode ? '#fca5a5' : '#DC2626') : (isDarkMode ? '#fde68a' : '#B45309'),
                            border: item.status === 'APPROVED' ? '1px solid #10b981' : item.status === 'REJECTED' ? '1px solid #ef4444' : '1px solid #f59e0b'
                          }}>
                            {item.status}
                          </span>
                        </div>
                        <div style={{ fontSize: '13px', color: theme.textSecondary, fontWeight: '600' }}>
                          {item.request_type === 'PERMISSION' ? (
                            <>⏱️ Date: {formatDisplayDate(item.start_date)} | Duration: {item.duration_hours || 2} Hours</>
                          ) : item.request_type === 'HALF_DAY' ? (
                            <>🌗 Date: {formatDisplayDate(item.start_date)} (Half Day)</>
                          ) : item.start_date === item.end_date ? (
                            <>📅 Date: {formatDisplayDate(item.start_date)} (1 Day Leave)</>
                          ) : (
                            <>📅 {formatDisplayDate(item.start_date)} to {formatDisplayDate(item.end_date)}</>
                          )}
                        </div>
                        <div style={{ fontSize: '13px', color: theme.textMuted, fontStyle: 'italic', backgroundColor: theme.cardBg, padding: '10px 12px', borderRadius: '10px', border: `1px solid ${theme.border}` }}>
                          Reason: "{item.reason}"
                        </div>
                        {item.admin_remarks && (
                          <div style={{ fontSize: '12px', color: isDarkMode ? '#a1a1aa' : '#475569', fontWeight: '700' }}>
                            Admin Remarks: {item.admin_remarks}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* DEDICATED PROFILE & ACCOUNT SETTINGS PAGE TAB */}
          {activeTab === 'profile' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ padding: '16px 20px', borderRadius: '16px', backgroundColor: theme.cardInnerBg, border: `1px solid ${theme.border}`, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: theme.textPrimary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <User style={{ width: '22px', height: '22px', color: theme.textPrimary }} /> User Profile & Account Settings
                  </h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: theme.textSecondary }}>
                    View and update your personal employee information and credentials.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('punch')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '10px',
                    backgroundColor: isDarkMode ? '#27272a' : '#f1f5f9',
                    border: `1px solid ${theme.border}`,
                    color: theme.textPrimary,
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  Back to Portal
                </button>
              </div>

              {/* PROFILE UPDATE FORM CARD */}
              <div style={{ width: '100%', maxWidth: '800px', margin: '0 auto' }}>
                <form
                  onSubmit={handleUpdateProfile}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px',
                    backgroundColor: theme.cardBg,
                    padding: '24px',
                    borderRadius: '20px',
                    border: `1px solid ${theme.border}`,
                    boxShadow: isDarkMode ? 'none' : '0 4px 12px rgba(15,23,42,0.04)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', paddingBottom: '16px', borderBottom: `1px solid ${theme.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        backgroundColor: isDarkMode ? '#27272a' : '#f1f5f9',
                        color: theme.textPrimary,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '800',
                        fontSize: '18px'
                      }}>
                        {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: theme.textPrimary }}>
                          {currentUser?.name || 'Employee Profile'}
                        </h4>
                        <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: theme.textMuted }}>
                          Employee ID: <span style={{ fontWeight: '800', color: theme.textPrimary }}>{currentUser?.emp_id}</span>
                          {companyInfo?.company_name && (
                            <span style={{ marginLeft: '8px', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', backgroundColor: isDarkMode ? '#27272a' : '#f1f5f9', color: theme.textSecondary }}>
                              {companyInfo.company_name}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    {companyInfo?.company_logo && (
                      <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-neutral-200/80 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/60">
                        <img 
                          src={companyInfo.company_logo} 
                          alt={`${companyInfo.company_name || 'Company'} Logo`} 
                          className="w-7 h-7 rounded-lg object-contain bg-white dark:bg-neutral-900 p-0.5 border border-neutral-200/60 dark:border-neutral-700 shrink-0" 
                        />
                        <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 max-w-[140px] truncate">
                          {companyInfo.company_name}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* FULL NAME & EMPLOYEE ID */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                    <div className="w-full">
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: theme.textSecondary, marginBottom: '6px' }}>Full Name *</label>
                      <input 
                        type="text" 
                        required 
                        placeholder="Enter Full Name" 
                        readOnly value={profileForm.full_name}
                        onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })} 
                        style={{ width: '100%', minWidth: 0, padding: '12px 14px', borderRadius: '10px', backgroundColor: theme.inputBg, border: `1px solid ${theme.inputBorder}`, fontSize: '13px', color: theme.textPrimary, boxSizing: 'border-box' }} 
                      />
                    </div>

                    <div className="w-full">
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: theme.textSecondary, marginBottom: '6px' }}>Employee ID (Read Only)</label>
                      <input 
                        type="text" 
                        disabled
                        value={currentUser ? currentUser.emp_id : ''} 
                        style={{ width: '100%', minWidth: 0, padding: '12px 14px', borderRadius: '10px', backgroundColor: isDarkMode ? '#1e1e24' : '#f1f5f9', border: `1px solid ${theme.border}`, fontSize: '13px', fontWeight: '800', color: theme.textSecondary, boxSizing: 'border-box' }} 
                      />
                    </div>
                  </div>

                  {/* EMAIL & DESIGNATION */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                    <div className="w-full">
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: theme.textSecondary, marginBottom: '6px' }}>Email Address *</label>
                      <input 
                        type="email" 
                        required 
                        placeholder="employee@company.com" 
                        readOnly value={profileForm.email}
                        onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} 
                        style={{ width: '100%', minWidth: 0, padding: '12px 14px', borderRadius: '10px', backgroundColor: theme.inputBg, border: `1px solid ${theme.inputBorder}`, fontSize: '13px', color: theme.textPrimary, boxSizing: 'border-box' }} 
                      />
                    </div>

                    <div className="w-full">
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: theme.textSecondary, marginBottom: '6px' }}>Designation</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Full Stack Developer" 
                        readOnly value={profileForm.designation}
                        onChange={(e) => setProfileForm({ ...profileForm, designation: e.target.value })} 
                        style={{ width: '100%', minWidth: 0, padding: '12px 14px', borderRadius: '10px', backgroundColor: theme.inputBg, border: `1px solid ${theme.inputBorder}`, fontSize: '13px', color: theme.textPrimary, boxSizing: 'border-box' }} 
                      />
                    </div>
                  </div>

                  {/* DATE OF JOINING & PHONE NUMBER */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                    <div className="w-full">
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: theme.textSecondary, marginBottom: '6px' }}>Date of Joining</label>
                      <input 
                        type="date" 
                        readOnly value={profileForm.joining_date}
                        onChange={(e) => setProfileForm({ ...profileForm, joining_date: e.target.value })} 
                        style={{ width: '100%', minWidth: 0, padding: '12px 14px', borderRadius: '10px', backgroundColor: theme.inputBg, border: `1px solid ${theme.inputBorder}`, fontSize: '13px', color: theme.textPrimary, boxSizing: 'border-box' }} 
                      />
                    </div>

                    <div className="w-full">
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: theme.textSecondary, marginBottom: '6px' }}>Phone Number</label>
                      <input 
                        type="tel" 
                        maxLength={10}
                        placeholder="e.g. 9876543210" 
                        value={profileForm.phone_number} 
                        onChange={(e) => {
                          const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
                          setProfileForm({ ...profileForm, phone_number: digitsOnly });
                        }} 
                        style={{ width: '100%', minWidth: 0, padding: '12px 14px', borderRadius: '10px', backgroundColor: theme.inputBg, border: `1px solid ${theme.inputBorder}`, fontSize: '13px', color: theme.textPrimary, boxSizing: 'border-box' }} 
                      />
                    </div>
                  </div>

                  {/* CHANGE PASSWORD */}
                  <p className="text-sm">Your company administrator manages your name, email, designation and joining date.</p>
                  <label className="block text-sm">Current password (required to change password)
                    <input 
                      type="password" 
                      autoComplete="current-password" 
                      value={profileForm.current_password || ''}
                      onChange={event => setProfileForm({ ...profileForm, current_password: event.target.value })}
                      onCopy={(e) => e.preventDefault()}
                      onCut={(e) => e.preventDefault()}
                      onPaste={(e) => e.preventDefault()}
                      onDrop={(e) => e.preventDefault()}
                      className="w-full p-3 rounded border text-neutral-900" 
                    />
                  </label>
                  <div className="w-full">
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: theme.textSecondary, marginBottom: '6px' }}>Change Password (Leave blank to keep existing)</label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type={showNewPassword ? 'text' : 'password'} 
                        placeholder="Enter new password" 
                        value={profileForm.new_password} 
                        onChange={(e) => setProfileForm({ ...profileForm, new_password: e.target.value })} 
                        onCopy={(e) => e.preventDefault()}
                        onCut={(e) => e.preventDefault()}
                        onPaste={(e) => e.preventDefault()}
                        onDrop={(e) => e.preventDefault()}
                        style={{ width: '100%', minWidth: 0, padding: '12px 42px 12px 14px', borderRadius: '10px', backgroundColor: theme.inputBg, border: `1px solid ${theme.inputBorder}`, fontSize: '13px', color: theme.textPrimary, boxSizing: 'border-box' }} 
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: theme.textSecondary }}
                      >
                        {showNewPassword ? <EyeOff style={{ width: '16px', height: '16px' }} /> : <Eye style={{ width: '16px', height: '16px' }} />}
                      </button>
                    </div>
                  </div>

                  {/* SUBMIT BUTTON */}
                  <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                    <button
                      type="submit"
                      disabled={isProcessing}
                      style={{
                        flex: 1,
                        padding: '12px 20px',
                        borderRadius: '10px',
                        backgroundColor: isDarkMode ? '#ffffff' : '#0f172a',
                        color: isDarkMode ? '#0a0a0a' : '#ffffff',
                        fontSize: '13px',
                        fontWeight: '800',
                        border: 'none',
                        cursor: 'pointer',
                        boxShadow: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                    >
                      <Save style={{ width: '16px', height: '16px' }} />
                      {isProcessing ? 'Updating Profile...' : 'Save Profile Changes'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* MOBILE BOTTOM NAVIGATION BAR (4 TABS for Mobile Screens) */}
      <div 
        className="md:hidden fixed bottom-0 left-0 right-0 backdrop-blur-md px-2 py-2.5 z-50 flex items-center justify-around shadow-lg"
        style={{
          backgroundColor: theme.mobileNavBg,
          borderTop: `1px solid ${theme.border}`
        }}
      >
        <button
          onClick={() => setActiveTab('punch')}
          className="flex flex-col items-center gap-1 text-[11px] font-bold transition-colors"
          style={{ color: activeTab === 'punch' ? (isDarkMode ? '#ffffff' : '#0f172a') : theme.textSecondary }}
        >
          <ShieldCheck style={{ width: '20px', height: '20px' }} />
          <span>Punch</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className="flex flex-col items-center gap-1 text-[11px] font-bold transition-colors"
          style={{ color: activeTab === 'history' ? (isDarkMode ? '#ffffff' : '#0f172a') : theme.textSecondary }}
        >
          <History style={{ width: '20px', height: '20px' }} />
          <span>Logs</span>
        </button>

        <button
          onClick={() => setActiveTab('leave')}
          className="flex flex-col items-center gap-1 text-[11px] font-bold transition-colors"
          style={{ color: activeTab === 'leave' ? (isDarkMode ? '#ffffff' : '#0f172a') : theme.textSecondary }}
        >
          <FileText style={{ width: '20px', height: '20px' }} />
          <span>Leave</span>
        </button>

        <button
          onClick={() => setActiveTab('status')}
          className="flex flex-col items-center gap-1 text-[11px] font-bold transition-colors"
          style={{ color: activeTab === 'status' ? (isDarkMode ? '#ffffff' : '#0f172a') : theme.textSecondary }}
        >
          <CheckCircle2 style={{ width: '20px', height: '20px' }} />
          <span>Status</span>
        </button>
      </div>

      {/* LOGIN MODAL */}
      {authMode === 'login' && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: 'min(400px, 92vw)',
            maxHeight: '90vh',
            overflowY: 'auto',
            backgroundColor: theme.cardBg,
            borderRadius: '24px',
            border: `1px solid ${theme.border}`,
            padding: '24px',
            boxShadow: isDarkMode ? '0 20px 40px rgba(0, 0, 0, 0.6)' : '0 20px 40px rgba(0, 0, 0, 0.12)',
            boxSizing: 'border-box'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: theme.textPrimary }}>Employee Login</h3>
              <button onClick={() => setAuthMode('app')} style={{ background: 'none', border: 'none', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', color: theme.textSecondary }}>×</button>
            </div>
            
            <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: theme.textSecondary, marginBottom: '6px' }}>Email or Employee ID</label>
                <input 
                  type="text" 
                  required 
                  className="biometric-input"
                  placeholder="Enter Email or Employee ID" 
                  value={loginForm.identifier} 
                  onChange={(e) => setLoginForm({ ...loginForm, identifier: e.target.value })} 
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', backgroundColor: theme.inputBg, border: `1px solid ${theme.inputBorder}`, color: theme.textPrimary, fontSize: '13px', boxSizing: 'border-box' }} 
                />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: theme.textSecondary }}>Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('forgot-password');
                      setForgotForm(prev => ({ ...prev, identifier: loginForm.identifier?.trim() || '' }));
                      setForgotStep('identifier');
                      setForgotError('');
                      setForgotMessage('');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      fontSize: '12px',
                      color: isDarkMode ? '#ffffff' : '#0f172a',
                      fontWeight: '700',
                      cursor: 'pointer',
                      textDecoration: 'none'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
                  >
                    Forgot Password?
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showLoginPassword ? 'text' : 'password'} 
                    required 
                    className="biometric-input"
                    placeholder="Enter password" 
                    value={loginForm.password} 
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} 
                    onCopy={(e) => e.preventDefault()}
                    onCut={(e) => e.preventDefault()}
                    onPaste={(e) => e.preventDefault()}
                    onDrop={(e) => e.preventDefault()}
                    style={{ width: '100%', padding: '12px 40px 12px 14px', borderRadius: '10px', backgroundColor: theme.inputBg, border: `1px solid ${theme.inputBorder}`, color: theme.textPrimary, fontSize: '13px', boxSizing: 'border-box' }} 
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: theme.textSecondary }}
                  >
                    {showLoginPassword ? <EyeOff style={{ width: '16px', height: '16px' }} /> : <Eye style={{ width: '16px', height: '16px' }} />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={isProcessing} style={{ padding: '14px 0', borderRadius: '12px', backgroundColor: isDarkMode ? '#ffffff' : '#0f172a', color: isDarkMode ? '#0a0a0a' : '#ffffff', fontWeight: '800', fontSize: '14px', border: 'none', cursor: 'pointer', marginTop: '4px', boxShadow: 'none' }}>
                {isProcessing ? 'Signing In...' : 'Sign In'}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '12px 0' }}>
                <div style={{ flex: 1, height: '1px', backgroundColor: isDarkMode ? '#334155' : '#e2e8f0' }} />
                <span style={{ fontSize: '11px', color: isDarkMode ? '#64748b' : '#94a3b8', fontWeight: '800', letterSpacing: '0.5px' }}>OR</span>
                <div style={{ flex: 1, height: '1px', backgroundColor: isDarkMode ? '#334155' : '#e2e8f0' }} />
              </div>

              <GoogleAttendanceButton onCredential={executeGoogleAuth} />

              {/* DONT HAVE AN ACCOUNT ? CREATE ONE */}
              <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: '#64748b' }}>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('app');
                    setActiveTab('onboard');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: isDarkMode ? '#ffffff' : '#0f172a',
                    fontWeight: '800',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  Create one
                </button>
              </div>



            </form>
          </div>
        </div>
      )}

      {/* FORGOT PASSWORD MODAL */}
      {authMode === 'forgot-password' && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: 'min(420px, 92vw)',
            maxHeight: '90vh',
            overflowY: 'auto',
            backgroundColor: theme.cardBg,
            borderRadius: '24px',
            border: `1px solid ${theme.border}`,
            padding: '26px',
            boxShadow: isDarkMode ? '0 20px 40px rgba(0, 0, 0, 0.6)' : '0 20px 40px rgba(0, 0, 0, 0.12)',
            boxSizing: 'border-box'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '12px',
                  backgroundColor: isDarkMode ? '#27272a' : '#f1f5f9',
                  color: theme.textPrimary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <KeyRound style={{ width: '20px', height: '20px' }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: theme.textPrimary }}>Reset Password</h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: theme.textSecondary }}>
                    {forgotStep === 'identifier' && 'Verify your attendance account'}
                    {forgotStep === 'code' && 'Enter verification code & new password'}
                    {forgotStep === 'done' && 'Password updated successfully'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setAuthMode('app');
                  setForgotStep('identifier');
                  setForgotError('');
                  setForgotMessage('');
                }} 
                style={{ background: 'none', border: 'none', fontSize: '20px', fontWeight: 'bold', cursor: 'pointer', color: theme.textSecondary }}
              >
                ×
              </button>
            </div>

            {/* Error Banner */}
            {forgotError && (
              <div style={{
                backgroundColor: isDarkMode ? '#450a0a' : '#fef2f2',
                border: `1px solid ${isDarkMode ? '#991b1b' : '#fecaca'}`,
                color: isDarkMode ? '#fca5a5' : '#b91c1c',
                padding: '10px 12px',
                borderRadius: '12px',
                marginBottom: '14px',
                fontSize: '12px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle style={{ width: '16px', height: '16px', flexShrink: 0 }} />
                <span>{forgotError}</span>
              </div>
            )}

            {/* Success / Message Banner */}
            {forgotMessage && !forgotError && forgotStep !== 'done' && (
              <div style={{
                backgroundColor: isDarkMode ? '#064e3b' : '#ecfdf5',
                border: `1px solid ${isDarkMode ? '#065f46' : '#a7f3d0'}`,
                color: isDarkMode ? '#6ee7b7' : '#047857',
                padding: '10px 12px',
                borderRadius: '12px',
                marginBottom: '14px',
                fontSize: '12px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <CheckCircle2 style={{ width: '16px', height: '16px', flexShrink: 0 }} />
                <span>{forgotMessage}</span>
              </div>
            )}

            {/* STEP 1: Enter Identifier */}
            {forgotStep === 'identifier' && (
              <form onSubmit={handleForgotSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: theme.textSecondary, marginBottom: '6px' }}>
                    Registered Email or Employee ID
                  </label>
                  <input
                    type="text"
                    required
                    className="biometric-input"
                    placeholder="e.g. employee@company.com or EMP001"
                    value={forgotForm.identifier}
                    onChange={(e) => setForgotForm({ ...forgotForm, identifier: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      backgroundColor: theme.inputBg,
                      border: `1px solid ${theme.inputBorder}`,
                      color: theme.textPrimary,
                      fontSize: '13px',
                      boxSizing: 'border-box'
                    }}
                  />
                  <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: theme.textSecondary }}>
                    We will send a 6-digit verification OTP code to your registered email.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  style={{
                    padding: '13px 0',
                    borderRadius: '12px',
                    backgroundColor: isDarkMode ? '#ffffff' : '#0f172a',
                    color: isDarkMode ? '#0a0a0a' : '#ffffff',
                    fontWeight: '800',
                    fontSize: '14px',
                    border: 'none',
                    cursor: 'pointer',
                    marginTop: '4px',
                    boxShadow: 'none',
                    opacity: forgotLoading ? 0.7 : 1
                  }}
                >
                  {forgotLoading ? 'Sending OTP...' : 'Send OTP'}
                </button>

                <div style={{ textAlign: 'center', marginTop: '10px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('login');
                      setForgotError('');
                      setForgotMessage('');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: theme.textSecondary,
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <ArrowLeft style={{ width: '14px', height: '14px' }} />
                    <span>Back to login</span>
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2: Code, New Password, Confirm Password */}
            {forgotStep === 'code' && (
              <form onSubmit={handleForgotResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Code Sent To Card */}
                <div style={{
                  backgroundColor: isDarkMode ? '#022c22' : '#f0fdf4',
                  border: `1px solid ${isDarkMode ? '#065f46' : '#bbf7d0'}`,
                  borderRadius: '14px',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '10px',
                      backgroundColor: '#16a34a',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <MailCheck style={{ width: '18px', height: '18px' }} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: '10px', fontWeight: '800', color: isDarkMode ? '#86efac' : '#15803d', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Code Sent To
                      </span>
                      <span style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: isDarkMode ? '#f0fdf4' : '#14532d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {forgotTargetEmail || forgotForm.identifier}
                      </span>
                    </div>
                  </div>
                  <span style={{
                    padding: '3px 8px',
                    borderRadius: '999px',
                    backgroundColor: '#16a34a',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: '700',
                    flexShrink: 0
                  }}>
                    OTP Sent
                  </span>
                </div>

                {/* 6-Digit Code */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: theme.textSecondary, marginBottom: '6px' }}>
                    6-Digit Code
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    className="biometric-input"
                    placeholder="123456"
                    value={forgotForm.code}
                    onChange={(e) => setForgotForm({ ...forgotForm, code: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      backgroundColor: theme.inputBg,
                      border: `1px solid ${theme.inputBorder}`,
                      color: theme.textPrimary,
                      fontSize: '15px',
                      fontWeight: '700',
                      letterSpacing: '2px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* New Password */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: theme.textSecondary, marginBottom: '6px' }}>
                    New Password (Min 8 chars, 1 Uppercase, 1 Symbol)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showForgotNewPassword ? 'text' : 'password'}
                      required
                      className="biometric-input"
                      placeholder="Enter new strong password"
                      value={forgotForm.new_password}
                      onChange={(e) => setForgotForm({ ...forgotForm, new_password: e.target.value })}
                      onCopy={(e) => {
                        e.preventDefault();
                        setForgotError('Copying password is disabled for security reasons.');
                      }}
                      onCut={(e) => {
                        e.preventDefault();
                        setForgotError('Cutting password is disabled for security reasons.');
                      }}
                      onPaste={(e) => {
                        e.preventDefault();
                        setForgotError('Pasting into password fields is disabled. Please type manually.');
                      }}
                      onDrop={(e) => e.preventDefault()}
                      style={{
                        width: '100%',
                        padding: '12px 40px 12px 14px',
                        borderRadius: '10px',
                        backgroundColor: theme.inputBg,
                        border: `1px solid ${theme.inputBorder}`,
                        color: theme.textPrimary,
                        fontSize: '13px',
                        boxSizing: 'border-box'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowForgotNewPassword(!showForgotNewPassword)}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: theme.textSecondary }}
                    >
                      {showForgotNewPassword ? <EyeOff style={{ width: '16px', height: '16px' }} /> : <Eye style={{ width: '16px', height: '16px' }} />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: theme.textSecondary, marginBottom: '6px' }}>
                    Confirm Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showForgotConfirmPassword ? 'text' : 'password'}
                      required
                      className="biometric-input"
                      placeholder="Re-enter password manually"
                      value={forgotForm.confirm_password}
                      onChange={(e) => setForgotForm({ ...forgotForm, confirm_password: e.target.value })}
                      onCopy={(e) => {
                        e.preventDefault();
                        setForgotError('Copying password is disabled for security reasons.');
                      }}
                      onCut={(e) => {
                        e.preventDefault();
                        setForgotError('Cutting password is disabled for security reasons.');
                      }}
                      onPaste={(e) => {
                        e.preventDefault();
                        setForgotError('Pasting into confirm password is disabled. Please type manually.');
                      }}
                      onDrop={(e) => e.preventDefault()}
                      style={{
                        width: '100%',
                        padding: '12px 40px 12px 14px',
                        borderRadius: '10px',
                        backgroundColor: theme.inputBg,
                        border: `1px solid ${theme.inputBorder}`,
                        color: theme.textPrimary,
                        fontSize: '13px',
                        boxSizing: 'border-box'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowForgotConfirmPassword(!showForgotConfirmPassword)}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: theme.textSecondary }}
                    >
                      {showForgotConfirmPassword ? <EyeOff style={{ width: '16px', height: '16px' }} /> : <Eye style={{ width: '16px', height: '16px' }} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  style={{
                    padding: '13px 0',
                    borderRadius: '12px',
                    backgroundColor: isDarkMode ? '#ffffff' : '#0f172a',
                    color: isDarkMode ? '#0a0a0a' : '#ffffff',
                    fontWeight: '800',
                    fontSize: '14px',
                    border: 'none',
                    cursor: 'pointer',
                    marginTop: '4px',
                    boxShadow: 'none',
                    opacity: forgotLoading ? 0.7 : 1
                  }}
                >
                  {forgotLoading ? 'Resetting...' : 'Reset Password'}
                </button>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', fontSize: '12px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('login');
                      setForgotStep('identifier');
                      setForgotError('');
                      setForgotMessage('');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: theme.textSecondary,
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <ArrowLeft style={{ width: '14px', height: '14px' }} />
                    <span>Back to login</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleForgotSendOtp}
                    disabled={forgotLoading}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: isDarkMode ? '#ffffff' : '#0f172a',
                      fontWeight: '700',
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                  >
                    Resend OTP
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3: Done */}
            {forgotStep === 'done' && (
              <div style={{ textAlign: 'center', padding: '16px 8px' }}>
                <div style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '50%',
                  backgroundColor: isDarkMode ? '#064e3b' : '#ecfdf5',
                  color: isDarkMode ? '#6ee7b7' : '#047857',
                  border: `2px solid ${isDarkMode ? '#065f46' : '#10b981'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px auto'
                }}>
                  <CheckCircle2 style={{ width: '32px', height: '32px' }} />
                </div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '800', color: theme.textPrimary }}>
                  Password Changed Successfully
                </h4>
                <p style={{ margin: '0 0 24px 0', fontSize: '13px', color: theme.textSecondary, lineHeight: '1.5' }}>
                  Your attendance portal password has been updated. You can now sign in using your new credentials.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setLoginForm(prev => ({ ...prev, identifier: forgotForm.identifier, password: '' }));
                    setAuthMode('login');
                    setForgotStep('identifier');
                    setForgotForm({ identifier: '', code: '', new_password: '', confirm_password: '' });
                    setForgotError('');
                    setForgotMessage('');
                  }}
                  style={{
                    width: '100%',
                    padding: '13px 0',
                    borderRadius: '12px',
                    backgroundColor: isDarkMode ? '#ffffff' : '#0f172a',
                    color: isDarkMode ? '#0a0a0a' : '#ffffff',
                    fontWeight: '800',
                    fontSize: '14px',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: 'none'
                  }}
                >
                  Proceed to Login
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* RESULT MODAL */}
      {modalData && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.75)' : 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(6px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '380px',
            backgroundColor: theme.cardBg,
            borderRadius: '24px',
            border: `1px solid ${theme.border}`,
            padding: '28px',
            textAlign: 'center',
            boxShadow: isDarkMode ? '0 25px 50px rgba(0, 0, 0, 0.7)' : '0 20px 40px rgba(0, 0, 0, 0.15)'
          }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              backgroundColor: modalData.status === 'PRESENT' ? (isDarkMode ? '#064e3b' : '#ECFDF5') : (isDarkMode ? '#451a03' : '#FFFBEB'),
              border: modalData.status === 'PRESENT' ? `1px solid ${isDarkMode ? '#065f46' : '#10b981'}` : `1px solid ${isDarkMode ? '#92400e' : '#f59e0b'}`,
              color: modalData.status === 'PRESENT' ? (isDarkMode ? '#6ee7b7' : '#047857') : (isDarkMode ? '#fde68a' : '#B45309'),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto'
            }}>
              <CheckCircle2 style={{ width: '36px', height: '36px' }} />
            </div>

            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: theme.textPrimary }}>{modalData.message}</h3>
            <p style={{ margin: '6px 0 18px 0', fontSize: '13px', color: theme.textSecondary }}>
              Verified for <strong style={{ color: theme.textPrimary }}>{modalData.employeeName}</strong> ({modalData.empId})
            </p>

            <div style={{
              padding: '14px',
              borderRadius: '14px',
              backgroundColor: theme.cardInnerBg,
              border: `1px solid ${theme.border}`,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              textAlign: 'left',
              marginBottom: '20px'
            }}>
              <div>
                <span style={{ fontSize: '10px', color: theme.textMuted, textTransform: 'uppercase', fontWeight: '800' }}>Punch Time</span>
                <p style={{ margin: '2px 0 0 0', fontSize: '13px', fontWeight: '800', color: theme.textPrimary }}>{modalData.checkIn}</p>
              </div>
              <div>
                <span style={{ fontSize: '10px', color: theme.textMuted, textTransform: 'uppercase', fontWeight: '800' }}>Status Badge</span>
                <p style={{ margin: '2px 0 0 0', fontSize: '13px', fontWeight: '800', color: modalData.status === 'PRESENT' ? (isDarkMode ? '#6ee7b7' : '#047857') : (isDarkMode ? '#fde68a' : '#B45309') }}>
                  {modalData.status}
                </p>
              </div>
            </div>

            <button
              onClick={() => setModalData(null)}
              style={{
                width: '100%',
                padding: '14px 0',
                borderRadius: '12px',
                backgroundColor: isDarkMode ? '#ffffff' : '#0f172a',
                color: isDarkMode ? '#0a0a0a' : '#ffffff',
                fontWeight: '800',
                fontSize: '14px',
                border: 'none',
                cursor: 'pointer',
                boxShadow: 'none'
              }}
            >
              Done & Close
            </button>
          </div>
        </div>
      )}

      {/* CUSTOM PROFESSIONAL POPUP MODAL (REPLACES BROWSER ALERT) */}
      {notificationModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.75)' : 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(6px)',
          zIndex: 150,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: 'min(400px, 92vw)',
            maxHeight: '90vh',
            overflowY: 'auto',
            backgroundColor: theme.cardBg,
            borderRadius: '24px',
            border: `1px solid ${theme.border}`,
            padding: '24px',
            textAlign: 'center',
            boxShadow: isDarkMode ? '0 25px 50px rgba(0, 0, 0, 0.7)' : '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            boxSizing: 'border-box',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: notificationModal.type === 'success' ? (isDarkMode ? '#064e3b' : '#ECFDF5') : (isDarkMode ? '#450a0a' : '#FEF2F2'),
              border: notificationModal.type === 'success' ? `1px solid ${isDarkMode ? '#065f46' : '#10b981'}` : `1px solid ${isDarkMode ? '#991b1b' : '#ef4444'}`,
              color: notificationModal.type === 'success' ? (isDarkMode ? '#6ee7b7' : '#047857') : (isDarkMode ? '#fca5a5' : '#b91c1c'),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto'
            }}>
              {notificationModal.type === 'success' ? (
                <CheckCircle2 style={{ width: '32px', height: '32px', color: '#10b981' }} />
              ) : (
                <AlertTriangle style={{ width: '32px', height: '32px', color: '#ef4444' }} />
              )}
            </div>

            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '800', color: theme.textPrimary }}>
              {notificationModal.title}
            </h3>
            
            <p style={{ margin: '0 0 24px 0', fontSize: '13px', color: theme.textSecondary, lineHeight: '1.5', whitespace: 'pre-line' }}>
              {notificationModal.message}
            </p>

            <button
              onClick={() => {
                if (notificationModal?.onClose) {
                  try { notificationModal.onClose(); } catch (e) {}
                }
                setNotificationModal(null);
              }}
              style={{
                width: '100%',
                padding: '14px 0',
                borderRadius: '12px',
                backgroundColor: notificationModal.type === 'success' ? '#10b981' : (isDarkMode ? '#ffffff' : '#0f172a'),
                color: notificationModal.type === 'success' ? '#ffffff' : (isDarkMode ? '#0a0a0a' : '#ffffff'),
                fontWeight: '800',
                fontSize: '14px',
                border: 'none',
                cursor: 'pointer',
                boxShadow: notificationModal.type === 'success' ? '0 4px 14px rgba(16, 185, 129, 0.3)' : 'none'
              }}
            >
              OK
            </button>
          </div>
        </div>
      )}



      {/* CENTERED NOTIFICATIONS & ACTIVITY CENTER MODAL (EXACT AS SCREENSHOT 2) */}
      {notifModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setNotifModalOpen(false)}
        >
          <div
            className="w-full max-w-2xl bg-white dark:bg-[#18181b] rounded-2xl border border-neutral-200/80 dark:border-neutral-800 shadow-2xl overflow-hidden flex flex-col max-h-[88vh] text-neutral-900 dark:text-white animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* MODAL HEADER */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-sm">
                  <Bell className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                      Notifications & Activity Center
                    </h3>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                      {activeNotifications.length}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    View all system events and manage notifications.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setNotifModalOpen(false)}
                className="p-2 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                title="Close (Esc)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* TOOLBAR: SEARCH & FILTER TABS */}
            <div className="px-5 py-3 border-b border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between shrink-0">
              {/* Search bar */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <input
                  type="text"
                  value={notifSearchQuery}
                  onChange={(e) => setNotifSearchQuery(e.target.value)}
                  placeholder="Search employees, slips, settings... (Ctrl+K)"
                  className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 transition-colors"
                />
                {notifSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setNotifSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 text-xs cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Filter Tabs */}
              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setNotifFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    notifFilter === 'all'
                      ? 'bg-neutral-900 text-white dark:bg-white dark:text-black shadow-sm'
                      : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  All ({activeNotifications.length})
                </button>
                <button
                  type="button"
                  onClick={() => setNotifFilter('permissions')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                    notifFilter === 'permissions'
                      ? 'bg-neutral-900 text-white dark:bg-white dark:text-black shadow-sm'
                      : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <Clock className="h-3 w-3" />
                  Permissions ({activeNotifications.filter((i) => i.request_type === 'PERMISSION').length})
                </button>
                <button
                  type="button"
                  onClick={() => setNotifFilter('leaves')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    notifFilter === 'leaves'
                      ? 'bg-neutral-900 text-white dark:bg-white dark:text-black shadow-sm'
                      : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <CalendarDays className="h-3 w-3" />
                  Leave Requests ({activeNotifications.filter((i) => i.request_type !== 'PERMISSION').length})
                </button>
              </div>
            </div>

            {/* NOTIFICATION CARDS LIST */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
              {filteredNotifications.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-3 text-neutral-400">
                    <Bell className="h-6 w-6" />
                  </div>
                  <h4 className="text-sm font-bold text-neutral-800 dark:text-neutral-200">No activities found</h4>
                  <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
                    {notifSearchQuery
                      ? `No notifications matched "${notifSearchQuery}". Try changing your search query.`
                      : 'There are no active notifications to display in this category.'}
                  </p>
                </div>
              ) : (
                filteredNotifications.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors p-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                          item.status === 'APPROVED'
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
                            : item.status === 'REJECTED'
                            ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400'
                            : 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
                        }`}>
                          <CalendarDays className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                              {item.request_type === 'PERMISSION'
                                ? (item.status === 'APPROVED' ? 'Permission request approved' : item.status === 'REJECTED' ? 'Permission request rejected' : 'Permission request pending')
                                : (item.status === 'APPROVED' ? 'Leave request approved' : item.status === 'REJECTED' ? 'Leave request rejected' : 'Leave request pending')}
                            </h4>
                          </div>

                          <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-0.5">
                            {(currentUser?.name || 'Employee')} ({currentUser?.emp_id || 'ID'}) · {item.request_type} · {item.start_date}{item.reason ? ` · ${item.reason}` : ''}
                          </p>

                          <div className="flex items-center gap-3 mt-2 text-[11px] text-neutral-400">
                            <span>{item.start_date}</span>
                            <span>•</span>
                            <span className="capitalize">
                              {item.request_type === 'PERMISSION' ? 'Permission Request' : 'Leave Request'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right Action Buttons */}
                      <div className="flex items-center gap-1.5 self-end sm:self-start shrink-0 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setNotifModalOpen(false);
                            setActiveTab('STATUS');
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-neutral-900 dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 transition-colors cursor-pointer"
                          title="View"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleDeleteNotification(e, item.id)}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* MODAL FOOTER */}
            <div className="px-5 py-3 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 text-xs text-neutral-400">
                <span>Click any item to view details</span>
                {activeNotifications.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAllNotifications}
                    className="text-xs text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 font-medium cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" /> Clear all notifications
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setNotifModalOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 text-xs font-semibold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OFFICIAL GOOGLE IDENTITY SERVICES ONE-TAP MODAL */}

    </div>
  );
}
