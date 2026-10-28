import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext';
import { adminService, type AdminCompanyItem } from '../services/adminService';
import { setActiveCompanyUserId, getActiveCompanyUserId } from '../services/api';

interface AdminCompanyContextType {
  isAdmin: boolean;
  companies: AdminCompanyItem[];
  selectedCompanyUserId: number | null;
  selectedCompany: AdminCompanyItem | null;
  isLoadingCompanies: boolean;
  setSelectedCompanyUserId: (id: number | null) => void;
  refetchCompanies: () => Promise<void>;
}

const AdminCompanyContext = createContext<AdminCompanyContextType | undefined>(undefined);

export function AdminCompanyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = Boolean(user && (user.is_platform_admin || user.role === 'admin'));

  const [companies, setCompanies] = useState<AdminCompanyItem[]>([]);
  const [selectedCompanyUserId, setSelectedCompanyUserIdState] = useState<number | null>(() => getActiveCompanyUserId());
  const [isLoadingCompanies, setIsLoadingCompanies] = useState<boolean>(false);

  const fetchCompanies = useCallback(async () => {
    if (!isAdmin) {
      setCompanies([]);
      return;
    }
    setIsLoadingCompanies(true);
    try {
      const res = await adminService.listCompanies();
      const list = res.data?.companies || [];
      setCompanies(list);

      // Verify or default selectedCompanyUserId
      const currentId = getActiveCompanyUserId();
      const exists = list.some((c) => c.user_id === currentId);
      if (!exists && list.length > 0) {
        // Find first non-admin HR manager or first company
        const firstHr = list.find((c) => !c.is_platform_admin) || list[0];
        const newId = firstHr.user_id;
        setSelectedCompanyUserIdState(newId);
        setActiveCompanyUserId(newId);
        queryClient.invalidateQueries();
      }
    } catch (err) {
      console.warn('Failed to fetch admin companies list:', err);
    } finally {
      setIsLoadingCompanies(false);
    }
  }, [isAdmin, queryClient]);

  useEffect(() => {
    if (isAdmin) {
      fetchCompanies();
    } else {
      setSelectedCompanyUserIdState(null);
      setActiveCompanyUserId(null);
      setCompanies([]);
    }
  }, [isAdmin, fetchCompanies]);

  const setSelectedCompanyUserId = useCallback(
    (id: number | null) => {
      setSelectedCompanyUserIdState(id);
      setActiveCompanyUserId(id);
      // Immediately invalidate all queries so all tabs (employees, attendance, slips, dashboard)
      // re-fetch fresh data for the newly selected company without any stale state
      queryClient.invalidateQueries();
    },
    [queryClient]
  );

  const selectedCompany = companies.find((c) => c.user_id === selectedCompanyUserId) || null;

  return (
    <AdminCompanyContext.Provider
      value={{
        isAdmin,
        companies,
        selectedCompanyUserId,
        selectedCompany,
        isLoadingCompanies,
        setSelectedCompanyUserId,
        refetchCompanies: fetchCompanies,
      }}
    >
      {children}
    </AdminCompanyContext.Provider>
  );
}

export function useAdminCompany() {
  const context = useContext(AdminCompanyContext);
  if (!context) {
    throw new Error('useAdminCompany must be used within an AdminCompanyProvider');
  }
  return context;
}

