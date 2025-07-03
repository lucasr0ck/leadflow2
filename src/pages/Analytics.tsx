
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { BackButton } from '@/components/BackButton';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { BarChart3, Users, MousePointer, TrendingUp } from 'lucide-react';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AnalyticsData {
  totalClicks: number;
  campaignStats: Array<{
    campaign_name: string;
    clicks: number;
    slug: string;
  }>;
  sellerStats: Array<{
    seller_name: string;
    clicks: number;
    contacts: number;
  }>;
  dailyClicks: Array<{
    date: string;
    clicks: number;
  }>;
}

export const Analytics = () => {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalClicks: 0,
    campaignStats: [],
    sellerStats: [],
    dailyClicks: []
  });
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: startOfDay(subDays(new Date(), 7)),
    end: endOfDay(new Date())
  });

  useEffect(() => {
    if (user) {
      fetchAnalytics();
    }
  }, [user, dateRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const { data: team } = await supabase
        .from('teams')
        .select('id')
        .eq('owner_id', user!.id)
        .single();

      if (!team) return;

      // Buscar cliques no período
      const { data: clicksData } = await supabase
        .from('clicks')
        .select(`
          id,
          created_at,
          campaign_id,
          campaigns!inner (
            name,
            slug,
            team_id
          ),
          campaign_links!inner (
            seller_contacts!inner (
              sellers (
                name
              )
            )
          )
        `)
        .eq('campaigns.team_id', team.id)
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString())
        .order('created_at', { ascending: false });

      const clicks = clicksData || [];

      // Processar dados para analytics
      const totalClicks = clicks.length;

      // Stats por campanha
      const campaignMap = new Map<string, { name: string; slug: string; clicks: number }>();
      clicks.forEach(click => {
        const campaignId = click.campaign_id;
        const campaignName = click.campaigns.name;
        const campaignSlug = click.campaigns.slug;
        
        if (campaignMap.has(campaignId)) {
          campaignMap.get(campaignId)!.clicks++;
        } else {
          campaignMap.set(campaignId, {
            name: campaignName,
            slug: campaignSlug,
            clicks: 1
          });
        }
      });

      const campaignStats = Array.from(campaignMap.values()).map(c => ({
        campaign_name: c.name,
        clicks: c.clicks,
        slug: c.slug
      })).sort((a, b) => b.clicks - a.clicks);

      // Stats por vendedor
      const sellerMap = new Map<string, { name: string; clicks: number; contacts: Set<string> }>();
      clicks.forEach(click => {
        const sellerName = click.campaign_links.seller_contacts.sellers.name;
        const contactId = click.campaign_links.seller_contacts.id;
        
        if (sellerMap.has(sellerName)) {
          sellerMap.get(sellerName)!.clicks++;
          sellerMap.get(sellerName)!.contacts.add(contactId);
        } else {
          sellerMap.set(sellerName, {
            name: sellerName,
            clicks: 1,
            contacts: new Set([contactId])
          });
        }
      });

      const sellerStats = Array.from(sellerMap.values()).map(s => ({
        seller_name: s.name,
        clicks: s.clicks,
        contacts: s.contacts.size
      })).sort((a, b) => b.clicks - a.clicks);

      // Cliques diários
      const dailyMap = new Map<string, number>();
      clicks.forEach(click => {
        const date = format(new Date(click.created_at), 'yyyy-MM-dd');
        dailyMap.set(date, (dailyMap.get(date) || 0) + 1);
      });

      const dailyClicks = Array.from(dailyMap.entries())
        .map(([date, clicks]) => ({
          date: format(new Date(date), 'dd/MM', { locale: ptBR }),
          clicks
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      setAnalytics({
        totalClicks,
        campaignStats,
        sellerStats,
        dailyClicks
      });

    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDateRangeChange = (startDate: Date, endDate: Date) => {
    setDateRange({ start: startDate, end: endDate });
  };

  const COLORS = ['#2D9065', '#059669', '#10B981', '#34D399', '#6EE7B7', '#A7F3D0'];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-600">Carregando analytics...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackButton />
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Analytics</h1>
          <p className="text-slate-600">Acompanhe o desempenho das suas campanhas</p>
        </div>
      </div>

      <DateRangeFilter onDateRangeChange={handleDateRangeChange} />

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Cliques</CardTitle>
            <MousePointer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#2D9065]">{analytics.totalClicks}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Campanhas Ativas</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.campaignStats.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendedores</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.sellerStats.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Média por Dia</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.dailyClicks.length > 0 
                ? Math.round(analytics.totalClicks / analytics.dailyClicks.length)
                : 0
              }
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cliques por campanha */}
        <Card>
          <CardHeader>
            <CardTitle>Desempenho por Campanha</CardTitle>
            <CardDescription>Número de cliques por campanha no período selecionado</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.campaignStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="campaign_name" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis />
                <Tooltip />
                <Bar dataKey="clicks" fill="#2D9065" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Cliques por vendedor (Pizza) */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Vendedor</CardTitle>
            <CardDescription>Percentual de cliques por vendedor</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analytics.sellerStats}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ seller_name, percent }) => `${seller_name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="clicks"
                >
                  {analytics.sellerStats.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de cliques por dia */}
      {analytics.dailyClicks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Evolução Diária</CardTitle>
            <CardDescription>Número de cliques por dia no período selecionado</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.dailyClicks}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="clicks" fill="#2D9065" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Tabelas detalhadas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ranking de campanhas */}
        <Card>
          <CardHeader>
            <CardTitle>Ranking de Campanhas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.campaignStats.map((campaign, index) => (
                <div key={campaign.slug} className="flex justify-between items-center p-2 rounded hover:bg-slate-50">
                  <div>
                    <span className="font-medium">#{index + 1} {campaign.campaign_name}</span>
                    <span className="text-sm text-slate-500 ml-2">({campaign.slug})</span>
                  </div>
                  <span className="font-bold text-[#2D9065]">{campaign.clicks}</span>
                </div>
              ))}
              {analytics.campaignStats.length === 0 && (
                <p className="text-slate-500 text-center py-4">Nenhum dado encontrado para o período</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Ranking de vendedores */}
        <Card>
          <CardHeader>
            <CardTitle>Ranking de Vendedores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.sellerStats.map((seller, index) => (
                <div key={seller.seller_name} className="flex justify-between items-center p-2 rounded hover:bg-slate-50">
                  <div>
                    <span className="font-medium">#{index + 1} {seller.seller_name}</span>
                    <span className="text-sm text-slate-500 ml-2">
                      ({seller.contacts} contato{seller.contacts !== 1 ? 's' : ''})
                    </span>
                  </div>
                  <span className="font-bold text-[#2D9065]">{seller.clicks}</span>
                </div>
              ))}
              {analytics.sellerStats.length === 0 && (
                <p className="text-slate-500 text-center py-4">Nenhum dado encontrado para o período</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
