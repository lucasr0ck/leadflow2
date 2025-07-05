
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BarChart3, TrendingUp } from 'lucide-react';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { DailyClicksChart } from '@/components/analytics/DailyClicksChart';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CampaignData {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

interface ClickData {
  date: string;
  clicks: number;
}

export const CampaignAnalytics = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [campaign, setCampaign] = useState<CampaignData | null>(null);
  const [clickData, setClickData] = useState<ClickData[]>([]);
  const [totalClicks, setTotalClicks] = useState(0);
  const [averageDailyClicks, setAverageDailyClicks] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Default to last 7 days
  const [startDate, setStartDate] = useState(startOfDay(subDays(new Date(), 7)));
  const [endDate, setEndDate] = useState(endOfDay(new Date()));

  useEffect(() => {
    if (user && id) {
      fetchCampaignData();
    }
  }, [user, id, startDate, endDate]);

  const fetchCampaignData = async () => {
    if (!id) return;
    
    setLoading(true);
    
    try {
      // Fetch campaign details
      const { data: campaignData, error: campaignError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', id)
        .single();

      if (campaignError) {
        console.error('Error fetching campaign:', campaignError);
        return;
      }

      setCampaign(campaignData);

      // Fetch clicks data for the date range
      const { data: clicksData, error: clicksError } = await supabase
        .from('clicks')
        .select('created_at')
        .eq('campaign_id', id)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at');

      if (clicksError) {
        console.error('Error fetching clicks:', clicksError);
        return;
      }

      // Process clicks data for chart
      const clicksByDate: { [date: string]: number } = {};
      
      clicksData?.forEach(click => {
        const date = format(new Date(click.created_at), 'dd/MM', { locale: ptBR });
        clicksByDate[date] = (clicksByDate[date] || 0) + 1;
      });

      // Create array with all dates in range
      const chartData: ClickData[] = [];
      const currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        const dateKey = format(currentDate, 'dd/MM', { locale: ptBR });
        chartData.push({
          date: dateKey,
          clicks: clicksByDate[dateKey] || 0
        });
        currentDate.setDate(currentDate.getDate() + 1);
      }

      setClickData(chartData);
      setTotalClicks(clicksData?.length || 0);
      
      // Calculate average daily clicks
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      setAverageDailyClicks(daysDiff > 0 ? Math.round((clicksData?.length || 0) / daysDiff) : 0);

    } catch (error) {
      console.error('Error fetching campaign analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDateRangeChange = (newStartDate: Date, newEndDate: Date) => {
    setStartDate(newStartDate);
    setEndDate(newEndDate);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-600">Carregando analytics...</div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-600">Campanha não encontrada</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => navigate('/campaigns')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">{campaign.name}</h1>
              <p className="text-slate-600">Analytics detalhados da campanha</p>
            </div>
          </div>
        </div>

        {/* Date Range Filter */}
        <Card>
          <CardHeader>
            <CardTitle>Filtro de Período</CardTitle>
            <CardDescription>Selecione o período para visualizar os dados</CardDescription>
          </CardHeader>
          <CardContent>
            <DateRangeFilter
              onDateRangeChange={handleDateRangeChange}
              defaultRange="week"
            />
          </CardContent>
        </Card>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Cliques</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#2D9065]">{totalClicks}</div>
              <p className="text-xs text-muted-foreground">
                No período selecionado
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Média Diária</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{averageDailyClicks}</div>
              <p className="text-xs text-muted-foreground">
                Cliques por dia
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Daily Clicks Chart */}
        <DailyClicksChart data={clickData} />
      </div>
    </div>
  );
};
