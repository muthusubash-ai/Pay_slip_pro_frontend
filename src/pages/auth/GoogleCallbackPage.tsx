import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { MeshBackground } from '../../components/layout/MeshBackground';
import { GlassCard } from '../../components/ui/GlassCard';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { getPlanHome } from '../../lib/plans';
import { paymentService } from '../../services/paymentService';

export function GoogleCallbackPage() {
  const navigate = useNavigate();
  const { googleLogin, updateUser } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    googleLogin()
        .then((signedInUser) => {
          const selectedPlan = sessionStorage.getItem('selected_plan');
          if (selectedPlan === 'professional' || selectedPlan === 'enterprise') {
            paymentService.startPaymentFlow(
              selectedPlan,
              { name: signedInUser.full_name, email: signedInUser.email, contact: signedInUser.phone || undefined },
              (newPlan) => {
                const upgradedUser = { ...signedInUser, plan: newPlan as 'professional' | 'enterprise' };
                updateUser(upgradedUser);
                sessionStorage.removeItem('selected_plan');
                navigate(getPlanHome(upgradedUser));
              },
              (message) => setError(message),
            );
          } else {
            navigate(getPlanHome(signedInUser));
          }
        })
        .catch(() => setError('Failed to complete Google sign-in.'));
  }, [googleLogin, navigate, updateUser]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-6">
      <MeshBackground />
      <GlassCard className="p-5 text-center sm:p-8">
        {error ? (
          <div>
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={() => navigate('/login')}
              className="text-black underline hover:text-gray-700"
            >
              Back to Login
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <LoadingSpinner />
            <p className="text-gray-600">Completing Google sign-in...</p>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
