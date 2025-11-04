
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AnalyticsData {
  totalClicks: number;
  previousPeriodClicks: number;
  growthPercentage: number;
  campaignStats: Array<{
    campaign_id: string;
    campaign_name: string;
    campaign_slug: string;
    clicks: number;
  }>;
  sellerStats: Array<{
    seller_id: string;
    seller_name: string;
    clicks: number;
    contacts: number;
    efficiency_score?: number;
    weight?: number;
  }>;
  dailyClicks: Array<{
    date: string;
    clicks: number;
  }>;
}

interface DateRange {
  start: Date;
  end: Date;
}

export const useAnalytics = (dateRange: DateRange) => {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalClicks: 0,
    previousPeriodClicks: 0,
    growthPercentage: 0,
    campaignStats: [],
    sellerStats: [],
    dailyClicks: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchAnalytics();
    }
  }, [user, dateRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Get user's team
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .select('id')
        .eq('owner_id', user!.id)
        .single();

      if (teamError || !team) {
        throw new Error('Time não encontrado');
      }

      // Use RPC functions for optimized queries (no 1000 row limit!)
      const startDate = dateRange.start.toISOString();
      const endDate = dateRange.end.toISOString();

      // Fetch all analytics data in parallel
      const [
        totalClicksResult,
        comparisonResult,
        campaignStatsResult,
        sellerPerformanceResult,
        dailyClicksResult
      ] = await Promise.all([
        // Total clicks (single number, very fast)
        supabase.rpc('get_total_clicks', {
          team_id_param: team.id,
          start_date: startDate,
          end_date: endDate
        }),
        
        // Comparison with previous period
        supabase.rpc('get_analytics_comparison', {
          team_id_param: team.id,
          start_date: startDate,
          end_date: endDate
        }),
        
        // Campaign statistics (aggregated)
        supabase.rpc('get_campaign_analytics', {
          team_id_param: team.id,
          start_date: startDate,
          end_date: endDate
        }),
        
        // Seller performance with efficiency scores
        supabase.rpc('get_seller_performance', {
          team_id_param: team.id,
          start_date: startDate,
          end_date: endDate
        }),
        
        // Daily clicks aggregation
        supabase.rpc('get_daily_clicks', {
          team_id_param: team.id,
          start_date: startDate,
          end_date: endDate
        })
      ]);

      // Check for errors
      if (totalClicksResult.error) throw totalClicksResult.error;
      if (comparisonResult.error) throw comparisonResult.error;
      if (campaignStatsResult.error) throw campaignStatsResult.error;
      if (sellerPerformanceResult.error) throw sellerPerformanceResult.error;
      if (dailyClicksResult.error) throw dailyClicksResult.error;

      // Process comparison data
      const comparison = Array.isArray(comparisonResult.data) 
        ? comparisonResult.data[0] 
        : comparisonResult.data;

      // Process campaign stats
      const campaignStats = (campaignStatsResult.data || []).map((stat: any) => ({
        campaign_id: stat.campaign_id,
        campaign_name: stat.campaign_name,
        campaign_slug: stat.campaign_slug,
        clicks: Number(stat.total_clicks)
      }));

      // Process seller stats with efficiency scores
      const sellerStats = (sellerPerformanceResult.data || []).map((stat: any) => ({
        seller_id: stat.seller_id,
        seller_name: stat.seller_name,
        clicks: Number(stat.total_clicks),
        contacts: Number(stat.contacts_count),
        efficiency_score: Number(stat.efficiency_score),
        weight: Number(stat.seller_weight)
      }));

      // Process daily clicks
      const dailyClicks = (dailyClicksResult.data || []).map((stat: any) => ({
        date: format(new Date(stat.click_date), 'dd/MM', { locale: ptBR }),
        clicks: Number(stat.total_clicks)
      }));

      setAnalytics({
        totalClicks: Number(totalClicksResult.data || 0),
        previousPeriodClicks: Number(comparison?.previous_period_clicks || 0),
        growthPercentage: Number(comparison?.growth_percentage || 0),
        campaignStats,
        sellerStats,
        dailyClicks
      });

    } catch (err: any) {
      console.error('Error fetching analytics:', err);
      setError(err.message || 'Erro ao carregar analytics');
    } finally {
      setLoading(false);
    }
  };

  return { analytics, loading, error, refetch: fetchAnalytics };
};
