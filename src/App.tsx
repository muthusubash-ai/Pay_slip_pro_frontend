import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';
import { PageLoader } from './components/layout/PageLoader';
import { PlanRoute } from './components/layout/PlanRoute';
import { useAuth } from './context/AuthContext';
import { getPlanHome } from './lib/plans';

// Route-level code splitting: each page ships as its own chunk and is fetched
// on demand, so the initial load no longer pulls every page (and heavy deps
// like recharts/framer-motion) up front.
const LoginPage = lazy(() => import('./pages/auth/LoginPage').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })));
const ProfilePage = lazy(() => import('./pages/auth/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const GoogleCallbackPage = lazy(() => import('./pages/auth/GoogleCallbackPage').then((m) => ({ default: m.GoogleCallbackPage })));
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const EmployeeListPage = lazy(() => import('./pages/employees/EmployeeListPage').then((m) => ({ default: m.EmployeeListPage })));
const EmployeeCreatePage = lazy(() => import('./pages/employees/EmployeeCreatePage').then((m) => ({ default: m.EmployeeCreatePage })));
const EmployeeDetailPage = lazy(() => import('./pages/employees/EmployeeDetailPage').then((m) => ({ default: m.EmployeeDetailPage })));
const EmployeeEditPage = lazy(() => import('./pages/employees/EmployeeEditPage').then((m) => ({ default: m.EmployeeEditPage })));
const AttendancePage = lazy(() => import('./pages/attendance/AttendancePage').then((m) => ({ default: m.AttendancePage })));
const SalarySlipListPage = lazy(() => import('./pages/salary-slips/SalarySlipListPage').then((m) => ({ default: m.SalarySlipListPage })));
const GenerateSlipsPage = lazy(() => import('./pages/salary-slips/GenerateSlipsPage').then((m) => ({ default: m.GenerateSlipsPage })));
const SalarySlipDetailPage = lazy(() => import('./pages/salary-slips/SalarySlipDetailPage').then((m) => ({ default: m.SalarySlipDetailPage })));
const CompanySettingsPage = lazy(() => import('./pages/settings/CompanySettingsPage').then((m) => ({ default: m.CompanySettingsPage })));
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage })));

function PlanHomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={getPlanHome(user)} replace />;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      // Serve cached data instantly on revisit instead of refetching on every
      // navigation. This removes the "data shows up late" lag between pages.
      staleTime: 60_000, // 1 min: data is treated as fresh, no refetch on mount
      gcTime: 5 * 60_000, // keep cache for 5 min after a page unmounts
    },
  },
});

export default function App() {
  return (
    <MotionConfig reducedMotion="never" transition={{ duration: 0.18 }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
              {/* Public routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />

              {/* Protected routes with layout */}
              <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route index element={<PlanHomeRedirect />} />
                <Route path="dashboard" element={<PlanRoute minimumPlan="starter"><DashboardPage /></PlanRoute>} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="employees" element={<EmployeeListPage />} />
                <Route path="employees/new" element={<EmployeeCreatePage />} />
                <Route path="employees/:id" element={<EmployeeDetailPage />} />
                <Route path="employees/:id/edit" element={<EmployeeEditPage />} />
                <Route path="attendance" element={<PlanRoute minimumPlan="professional"><AttendancePage /></PlanRoute>} />
                <Route path="salary-slips" element={<SalarySlipListPage />} />
                <Route path="salary-slips/generate" element={<GenerateSlipsPage />} />
                <Route path="salary-slips/:id" element={<SalarySlipDetailPage />} />
                <Route path="settings/company" element={<PlanRoute minimumPlan="professional"><CompanySettingsPage /></PlanRoute>} />
                <Route path="admin" element={<PlanRoute minimumPlan="enterprise" adminOnly><AdminDashboardPage /></PlanRoute>} />
                <Route path="admin/users" element={<PlanRoute minimumPlan="enterprise" adminOnly><AdminUsersPage /></PlanRoute>} />
              </Route>
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </MotionConfig>
  );
}
