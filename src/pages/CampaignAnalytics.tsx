
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Calendar, CalendarDays } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays, startOfDay, endOfDay, differenceInDays } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { BackButton } from '@/components/BackButton';

interface CampaignData {
  id: string;
  name: string;
  slug: string;
  totalClicks: number;
  averageDailyClicks: number;
  chartData: Array<{
    date: string;
    clicks: number;
  }>;
}

export const CampaignAnalytics = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [campaignData, setCampaignData] = useState<CampaignData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });

  useEffect(() => {
    if (user && id) {
      fetchCampaignData();
    }
  }, [user, id, dateRange]);

  const fetchCampaignData = async () => {
    if (!id || !dateRange?.from || !dateRange?.to) return;

    try {
      setLoading(true);

      // Get campaign basic info
      const { data: campaign } = await supabase
        .from('campaigns')
        .select('id, name, slug')
        .eq('id', id)
        .single();

      if (!campaign) return;

      // Get clicks in the selected date range
      const startDate = startOfDay(dateRange.from);
      const endDate = endOfDay(dateRange.to);

      const { data: clicksData } = await supabase
        .from('clicks')
        .select('created_at')
        .eq('campaign_id', id)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true });

      // Process data for chart
      const daysDiff = differenceInDays(endDate, startDate) + 1;
      const chartData = [];
      
      for (let i = 0; i < daysDiff; i++) {
        const currentDate = subDays(endDate, daysDiff - 1 - i);
        const dayStart = startOfDay(currentDate);
        const dayEnd = endOfDay(currentDate);
        
        const dayClicks = clicksData?.filter(click => {
          const clickDate = new Date(click.created_at);
          return clickDate >= dayStart && clickDate <= dayEnd;
        }).length || 0;

        chartData.push({
          date: format(currentDate, 'MM/dd'),
          clicks: dayClicks,
        });
      }

      const totalClicks = clicksData?.length || 0;
      const averageDailyClicks = daysDiff > 0 ? Math.round(totalClicks / daysDiff * 10) / 10 : 0;

      setCampaignData({
        id: campaign.id,
        name: campaign.name,
        slug: campaign.slug,
        totalClicks,
        averageDailyClicks,
        chartData,
      });
    } catch (error) {
      console.error('Error fetching campaign analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDateRangeSelect = (range: DateRange | undefined) => {
    setDateRange(range);
  };

  const setPresetRange = (days: number) => {
    setDateRange({
      from: subDays(new Date(), days - 1),
      to: new Date(),
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <BackButton />
          <div className="h-8 w-48 bg-slate-200 animate-pulse rounded" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-32 bg-slate-100 animate-pulse rounded-lg" />
          <div className="h-32 bg-slate-100 animate-pulse rounded-lg" />
        </div>
        <div className="h-80 bg-slate-100 animate-pulse rounded-lg" />
      </div>
    );
  }

  if (!campaignData) {
    return (
      <div className="space-y-6">
        <BackButton />
        <div className="text-center py-12">
          <p className="text-slate-500">Campanha não encontrada</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <BackButton />
        <div className="flex-1">
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">{campaignData.name}</h1>
          <p className="text-sm lg:text-base text-slate-600">Analytics detalhado da campanha</p>
        </div>
      </div>

      {/* Date Range Picker */}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="justify-start text-left font-normal">
              <CalendarDays className="mr-2 h-4 w-4" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, "dd/MM/y")} -{" "}
                    {format(dateRange.to, "dd/MM/y")}
                  </>
                ) : (
                  format(dateRange.from, "dd/MM/y")
                )
              ) : (
                <span>Selecionar período</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="p-3 border-b space-y-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setPresetRange(7)}
                className="w-full justify-start"
              >
                Últimos 7 dias
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setPresetRange(30)}
                className="w-full justify-start"
              >
                Últimos 30 dias
              </Button>
            </div>
            <CalendarComponent
              initialFocus
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={handleDateRangeSelect}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs lg:text-sm">Total de Cliques (período)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl lg:text-3xl font-bold text-slate-800">{campaignData.totalClicks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs lg:text-sm">Média Diária de Cliques</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl lg:text-3xl font-bold text-slate-800">{campaignData.averageDailyClicks}</div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg lg:text-xl">Cliques por Dia</CardTitle>
          <CardDescription>Evolução dos cliques no período selecionado</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 lg:h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={campaignData.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis 
                  dataKey="date" 
                  stroke="#64748b"
                  fontSize={12}
                  tick={{ fontSize: 10 }}
                />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={12}
                  tick={{ fontSize: 10 }}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '12px',
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
    </div>
  );
};
