
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Navigate, createBrowserRouter, RouterProvider } from "react-router-dom";
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
import { DiagnosticPanel } from '@/components/DiagnosticPanel';
import { GlobalSpinner } from '@/components/GlobalSpinner';

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

// Diagnostic panel - sempre ativo em dev, ou com flag LEADFLOW_DIAGNOSTIC
const SHOW_DIAGNOSTIC = process.env.NODE_ENV === 'development' || localStorage.getItem('LEADFLOW_DIAGNOSTIC') === 'true';

// Componente raiz que decide entre Login ou Dashboard
const RootIndex: React.FC = () => {
  const { user, isAuthLoading } = useAuth();
  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-600">Carregando...</div>
      </div>
    );
  }
  return user ? <Navigate to="/dashboard" replace /> : <Login />;
};

// Rotas usando Data Router para habilitar future flag v7_startTransition
const router = createBrowserRouter([
  { path: '/', element: <RootIndex /> },
  // Rota explícita de login para suportar redirecionamentos diretos (ex.: signOut)
  { path: '/login', element: <RootIndex /> },
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Dashboard /> },
    ],
  },
  {
    path: '/sellers',
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Sellers /> },
    ],
  },
  {
    path: '/sellers/new',
    element: (
      <ProtectedRoute>
        <CreateSeller />
      </ProtectedRoute>
    ),
  },
  {
    path: '/campaigns',
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Campaigns /> },
    ],
  },
  {
    path: '/campaigns/new',
    element: (
      <ProtectedRoute>
        <CreateCampaign />
      </ProtectedRoute>
    ),
  },
  {
    path: '/campaigns/edit/:id',
    element: (
      <ProtectedRoute>
        <EditCampaign />
      </ProtectedRoute>
    ),
  },
  {
    path: '/analytics',
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Analytics /> },
    ],
  },
  {
    path: '/analytics/campaign/:id',
    element: <CampaignAnalytics />,
  },
  {
    path: '/audit-logs',
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <AuditLogs /> },
    ],
  },
  {
    path: '/settings/teams',
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <TeamManagement /> },
    ],
  },
  { path: '/r/:slug', element: <PublicRedirect /> },
  { path: '*', element: <NotFound /> },
]);

const AppInner: React.FC = () => {
  const { isVerifyingAuth } = useAuth();
  if (isVerifyingAuth) {
    // Bloqueio total: nada da árvore de rotas ou layout é montado ainda
    return <GlobalSpinner />;
  }
  return <RouterProvider router={router} future={{ v7_startTransition: true }} />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TeamProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <RobustErrorBoundary>
            <AppInner />
            {DEBUG_MODE && <DebugPanel />}
            {SHOW_DIAGNOSTIC && <DiagnosticPanel />}
          </RobustErrorBoundary>
        </TooltipProvider>
      </TeamProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
