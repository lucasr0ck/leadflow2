
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays, startOfDay } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/PageHeader';

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
  const [stats, setStats] = useState<DashboardStats>({
    activeSellers: 0,
    activeCampaigns: 0,
    totalClicksToday: 0,
  });
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [recentCampaigns, setRecentCampaigns] = useState<any[]>([]);

  useEffect(() => {
    if (user && currentTeam) {
      fetchDashboardData();
    }
  }, [user, currentTeam]);

  const fetchDashboardData = async () => {
    if (!currentTeam) return;
    
    try {

      // Fetch stats
      const [sellersRes, campaignsRes, clicksRes] = await Promise.all([
        supabase.from('sellers').select('id').eq('team_id', currentTeam.team_id),
        supabase.from('campaigns').select('id').eq('team_id', currentTeam.team_id),
        supabase
          .from('clicks')
          .select('id, campaign_id, campaigns!inner(team_id)')
          .gte('created_at', startOfDay(new Date()).toISOString())
          .eq('campaigns.team_id', currentTeam.team_id),
      ]);

      setStats({
        activeSellers: sellersRes.data?.length || 0,
        activeCampaigns: campaignsRes.data?.length || 0,
        totalClicksToday: clicksRes.data?.length || 0,
      });

      // Fetch chart data for last 30 days
      const chartPromises = [];
      for (let i = 29; i >= 0; i--) {
        const date = subDays(new Date(), i);
        const dateStr = format(date, 'yyyy-MM-dd');
        
        chartPromises.push(
          supabase
            .from('clicks')
            .select('id, campaign_id, campaigns!inner(team_id)')
            .gte('created_at', startOfDay(date).toISOString())
            .lt('created_at', startOfDay(subDays(date, -1)).toISOString())
            .eq('campaigns.team_id', currentTeam.team_id)
            .then(res => ({
              date: format(date, 'MM/dd'),
              clicks: res.data?.length || 0,
            }))
        );
      }

      const chartResults = await Promise.all(chartPromises);
      setChartData(chartResults);

      // Fetch recent campaigns
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select(`
          id,
          name,
          slug,
          created_at,
          clicks(count)
        `)
        .eq('team_id', currentTeam.team_id)
        .order('created_at', { ascending: false })
        .limit(5);

      setRecentCampaigns(campaigns || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  // Se não tem team e não está carregando, mostrar mensagem
  if (!teamLoading && !currentTeam) {
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
