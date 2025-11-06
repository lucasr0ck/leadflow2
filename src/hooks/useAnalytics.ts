
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ensureSupabaseSession } from '@/utils/supabaseSession';

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
  const { currentTeam } = useTeam();
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
    console.log('[useAnalytics] Effect triggered:', { 
      hasUser: !!user, 
      hasTeam: !!currentTeam, 
      teamId: currentTeam?.team_id 
    });
    
    if (user && currentTeam) {
      console.log('[useAnalytics] Fetching analytics for team:', currentTeam.team_name);
      fetchAnalytics();
    } else if (!currentTeam) {
      console.warn('[useAnalytics] No team selected');
      setError('Selecione uma operação para ver os analytics');
      setLoading(false);
    }
  }, [user, currentTeam?.team_id, dateRange]);

  const fetchAnalytics = async () => {
    // ✅ CRITICAL FIX: Validate currentTeam exists
    if (!currentTeam) {
      console.error('[useAnalytics] fetchAnalytics called without currentTeam!');
      setError('Nenhuma operação selecionada');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      console.log('[useAnalytics] fetchAnalytics: Using team from context:', {
        teamId: currentTeam.team_id,
        teamName: currentTeam.team_name
      });

      await ensureSupabaseSession();

      // Use RPC functions for optimized queries (no 1000 row limit!)
      const startDate = dateRange.start.toISOString();
      const endDate = dateRange.end.toISOString();
      const teamId = currentTeam.team_id;

      // Fetch all analytics data in parallel
      console.log('[useAnalytics] Fetching data for period:', { startDate, endDate, teamId });
      
      const [
        totalClicksResult,
        comparisonResult,
        campaignStatsResult,
        sellerPerformanceResult,
        dailyClicksResult
      ] = await Promise.all([
        // Total clicks (single number, very fast)
        supabase.rpc('get_total_clicks', {
          team_id_param: teamId,
          start_date: startDate,
          end_date: endDate
        }),
        
        // Comparison with previous period
        supabase.rpc('get_analytics_comparison', {
          team_id_param: teamId,
          start_date: startDate,
          end_date: endDate
        }),
        
        // Campaign statistics (aggregated)
        supabase.rpc('get_campaign_analytics', {
          team_id_param: teamId,
          start_date: startDate,
          end_date: endDate
        }),
        
        // Seller performance with efficiency scores
        supabase.rpc('get_seller_performance', {
          team_id_param: teamId,
          start_date: startDate,
          end_date: endDate
        }),
        
        // Daily clicks aggregation
        supabase.rpc('get_daily_clicks', {
          team_id_param: teamId,
          start_date: startDate,
          end_date: endDate
        })
      ]);

      // Check for errors (gracefully)
      if (totalClicksResult.error) {
        console.error('[useAnalytics] Error fetching total clicks:', totalClicksResult.error);
        throw new Error(`Erro ao buscar total de clicks: ${totalClicksResult.error.message}`);
      }
      if (comparisonResult.error) {
        console.error('[useAnalytics] Error fetching comparison:', comparisonResult.error);
        // Non-critical, continue
      }
      if (campaignStatsResult.error) {
        console.error('[useAnalytics] Error fetching campaign stats:', campaignStatsResult.error);
        throw new Error(`Erro ao buscar estatísticas de campanhas: ${campaignStatsResult.error.message}`);
      }
      if (sellerPerformanceResult.error) {
        console.error('[useAnalytics] Error fetching seller performance:', sellerPerformanceResult.error);
        throw new Error(`Erro ao buscar performance de vendedores: ${sellerPerformanceResult.error.message}`);
      }
      if (dailyClicksResult.error) {
        console.error('[useAnalytics] Error fetching daily clicks:', dailyClicksResult.error);
        throw new Error(`Erro ao buscar clicks diários: ${dailyClicksResult.error.message}`);
      }
      
      console.log('[useAnalytics] Data fetched successfully:', {
        totalClicks: totalClicksResult.data,
        campaigns: campaignStatsResult.data?.length,
        sellers: sellerPerformanceResult.data?.length,
        days: dailyClicksResult.data?.length
      });

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
      console.error('[useAnalytics] ERROR:', err);
      // ✅ CRITICAL FIX: Set error but DON'T corrupt global state
      const errorMessage = err.message || 'Erro desconhecido ao carregar analytics';
      setError(errorMessage);
      
      // Set empty analytics to prevent UI crash
      setAnalytics({
        totalClicks: 0,
        previousPeriodClicks: 0,
        growthPercentage: 0,
        campaignStats: [],
        sellerStats: [],
        dailyClicks: []
      });
    } finally {
      console.log('[useAnalytics] fetchAnalytics complete');
      setLoading(false);
    }
  };

  return { analytics, loading, error, refetch: fetchAnalytics };
};
