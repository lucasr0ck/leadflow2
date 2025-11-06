
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays, startOfDay, addDays } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/PageHeader';
import { ensureSupabaseSession } from '@/utils/supabaseSession';
import { useAppReadiness } from '@/hooks/useAppReadiness';

interface DashboardStats {
  activeSellers: number;
  activeCampaigns: number;
  totalClicksToday: number;
}

interface ChartData {
  date: string;
  clicks: number;
}

export const Dashboard = () => {
  const { user } = useAuth();
  const { currentTeam, loading: teamLoading, availableTeams } = useTeam();
  const readiness = useAppReadiness();
  // Evitar problemas de inferência profunda do supabase types durante selects simples de contagem
  const sb: any = supabase as any;
  const [stats, setStats] = useState<DashboardStats>({
    activeSellers: 0,
    activeCampaigns: 0,
    totalClicksToday: 0,
  });
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [recentCampaigns, setRecentCampaigns] = useState<any[]>([]);

  useEffect(() => {
    console.log('[Dashboard] useEffect triggered:', { 
      hasUser: !!user, 
      hasTeam: !!currentTeam, 
      teamLoading,
      teamId: currentTeam?.team_id,
      teamName: currentTeam?.team_name,
      appReady: readiness.ready,
      reason: readiness.reason,
    });
    
    // ⚠️ CRITICAL FIX: Não renderizar se ainda está carregando teams
    if (!readiness.ready) {
      console.log('[Dashboard] Aguardando teams carregarem...');
      return;
    }
    
    if (user && currentTeam) {
      console.log('[Dashboard] Fetching dashboard data for team:', currentTeam.team_name);
      fetchDashboardData();
    } else {
      console.log('[Dashboard] Não vai buscar dados:', { hasUser: !!user, hasTeam: !!currentTeam });
    }
  }, [user, currentTeam?.team_id, teamLoading, readiness.ready]); // Dependência específica no team_id

  const fetchDashboardData = async () => {
    if (!currentTeam) return;

    try {
      // Garante sessão antes dos selects (evita RLS vazio em primeiro carregamento)
      await ensureSupabaseSession();

      // Contagens mais performáticas usando head + count
      // Usa colunas mínimas para reduzir inferência profunda de tipos do supabase-js
      // Workaround para limite de profundidade de tipos: fazer as contagens sequencialmente
      const sellersRes = await sb
        .from('sellers')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', currentTeam.team_id);

      const campaignsRes = await sb
        .from('campaigns')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', currentTeam.team_id);

      const clicksTodayRes = await sb
        .from('clicks')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', currentTeam.team_id)
        .gte('created_at', startOfDay(new Date()).toISOString());

      setStats({
        activeSellers: sellersRes.count || 0,
        activeCampaigns: campaignsRes.count || 0,
        totalClicksToday: clicksTodayRes.count || 0,
      });

      console.log('[Dashboard] Counters:', {
        sellers: sellersRes.count,
        campaigns: campaignsRes.count,
        clicksToday: clicksTodayRes.count,
      });

      // Série últimos 30 dias (client-side aggregation simples)
  const chartPromises: Array<Promise<ChartData>> = [];
      for (let i = 29; i >= 0; i--) {
        const dayStart = subDays(startOfDay(new Date()), i);
        const dayEnd = addDays(dayStart, 1);
        const p: Promise<ChartData> = (async () => {
          const res = await sb
            .from('clicks')
            .select('id', { count: 'exact', head: true })
            .eq('team_id', currentTeam.team_id)
            .gte('created_at', dayStart.toISOString())
            .lt('created_at', dayEnd.toISOString());
          return {
            date: format(dayStart, 'MM/dd'),
            clicks: res.count || 0,
          };
        })();
        chartPromises.push(p);
      }
      const chartResults = await Promise.all(chartPromises);
  setChartData(chartResults);

      // Campanhas recentes com contagem de clicks (usar relacionamento se definido ou fallback a segunda query)
      const { data: campaigns, error: campaignsError } = await supabase
        .from('campaigns')
        .select(`id,name,slug,created_at`)
        .eq('team_id', currentTeam.team_id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (campaignsError) {
        console.warn('[Dashboard] campaigns fetch error', campaignsError);
      }

      // Para cada campanha, contar clicks (pode virar RPC/EMBED depois)
        const enriched = await Promise.all(
          (campaigns || []).map(async (c) => {
            const res: any = await sb
              .from('clicks')
              .select('id', { count: 'exact', head: true })
              .eq('team_id', currentTeam.team_id)
              .eq('campaign_id', c.id);
            return { ...c, clicks: [{ count: res.count || 0 }] };
          })
        );

      setRecentCampaigns(enriched);

      // Re-fetch defensivo: se tudo 0 mas há time selecionado, tentar novamente em 1s
      const zeroed = (sellersRes.count ?? 0) === 0 && (campaignsRes.count ?? 0) === 0 && (clicksTodayRes.count ?? 0) === 0;
      if (zeroed) {
        console.log('[Dashboard] Zeroed metrics detected, scheduling defensive re-fetch...');
        setTimeout(() => {
          // evite recaptura se time mudou
          if (currentTeam?.team_id) {
            void fetchDashboardData();
          }
        }, 1000);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  // ⚠️ CRITICAL FIX: Mostrar loading enquanto teams estão carregando
  if (teamLoading) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Dashboard"
          description="Overview of your lead distribution performance"
        />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-lg text-muted-foreground text-center">
              Carregando operação...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Se não tem team e não está carregando, mostrar mensagem
  if (!currentTeam) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Dashboard"
          description="Overview of your lead distribution performance"
        />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-lg text-muted-foreground text-center mb-4">
              {availableTeams.length === 0 
                ? "Você ainda não faz parte de nenhuma operação. Crie uma operação em Configurações → Gerenciar Operações."
                : "Selecione uma operação para ver o dashboard."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Overview of your lead distribution performance"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs lg:text-sm">Active Sellers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl lg:text-3xl font-bold text-foreground">{stats.activeSellers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs lg:text-sm">Active Campaigns</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl lg:text-3xl font-bold text-foreground">{stats.activeCampaigns}</div>
          </CardContent>
        </Card>
        <Card className="sm:col-span-2 lg:col-span-1">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs lg:text-sm">Total Clicks (Today)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl lg:text-3xl font-bold text-foreground">{stats.totalClicksToday}</div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg lg:text-xl">Performance - Last 30 Days</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 lg:h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tick={{ fontSize: 10 }}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={12}
                  tick={{ fontSize: 10 }}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: 'hsl(var(--foreground))',
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="clicks" 
                  stroke="#2D9065" 
                  strokeWidth={2}
                  dot={{ fill: '#2D9065', strokeWidth: 2, r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Recent Campaigns */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg lg:text-xl">Recent Campaigns</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Campaign Name
                  </th>
                  <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Slug
                  </th>
                  <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Total Clicks
                  </th>
                  <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentCampaigns.map((campaign) => (
                  <tr key={campaign.id}>
                    <td className="px-4 lg:px-6 py-4 text-sm font-medium text-foreground">
                      {campaign.name}
                    </td>
                    <td className="px-4 lg:px-6 py-4 text-sm text-muted-foreground">
                      {campaign.slug}
                    </td>
                    <td className="px-4 lg:px-6 py-4 text-sm text-muted-foreground">
                      {campaign.clicks?.[0]?.count || 0}
                    </td>
                    <td className="px-4 lg:px-6 py-4 text-sm text-muted-foreground">
                      {format(new Date(campaign.created_at), 'MMM dd, yyyy')}
                    </td>
                  </tr>
                ))}
                {recentCampaigns.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 lg:px-6 py-8 text-center text-sm text-muted-foreground">
                      No campaigns created yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
