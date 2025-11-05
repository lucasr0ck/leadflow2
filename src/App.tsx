
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { TeamProvider } from '@/contexts/TeamContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { MainLayout } from '@/components/layout/MainLayout';
import { Login } from '@/pages/Login';
import { Dashboard } from '@/pages/Dashboard';
import { Sellers } from '@/pages/Sellers';
import { CreateSeller } from '@/pages/CreateSeller';
import { Campaigns } from '@/pages/Campaigns';
import { CreateCampaign } from '@/pages/CreateCampaign';
import { EditCampaign } from '@/pages/EditCampaign';
import { Analytics } from '@/pages/Analytics';
import { CampaignAnalytics } from '@/pages/CampaignAnalytics';
import { PublicRedirect } from '@/pages/PublicRedirect';
import { AuditLogs } from '@/pages/AuditLogs';
import { TeamManagement } from '@/pages/TeamManagement';
import NotFound from "./pages/NotFound";
import { RobustErrorBoundary } from '@/components/RobustErrorBoundary';
import { DebugPanel } from '@/components/DebugPanel';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Debug mode flag
const DEBUG_MODE = process.env.NODE_ENV === 'development' || localStorage.getItem('LEADFLOW_DEBUG') === 'true';

const AppRoutes = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-600">Carregando...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route 
        path="/" 
        element={user ? <Navigate to="/dashboard" replace /> : <Login />} 
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
      </Route>
      <Route
        path="/sellers"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Sellers />} />
      </Route>
      <Route
        path="/sellers/new"
        element={
          <ProtectedRoute>
            <CreateSeller />
          </ProtectedRoute>
        }
      />
      <Route
        path="/campaigns"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Campaigns />} />
      </Route>
      <Route
        path="/campaigns/new"
        element={
          <ProtectedRoute>
            <CreateCampaign />
          </ProtectedRoute>
        }
      />
      <Route
        path="/campaigns/edit/:id"
        element={
          <ProtectedRoute>
            <EditCampaign />
          </ProtectedRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Analytics />} />
      </Route>
      <Route
        path="/analytics/campaign/:id"
        element={
          <CampaignAnalytics />
        }
      />
      <Route
        path="/audit-logs"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AuditLogs />} />
      </Route>
      <Route
        path="/settings/teams"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<TeamManagement />} />
      </Route>
      {/* Public redirect route - no authentication required */}
      <Route path="/r/:slug" element={<PublicRedirect />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TeamProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <RobustErrorBoundary>
              <AppRoutes />
              {DEBUG_MODE && <DebugPanel />}
            </RobustErrorBoundary>
          </BrowserRouter>
        </TooltipProvider>
      </TeamProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
