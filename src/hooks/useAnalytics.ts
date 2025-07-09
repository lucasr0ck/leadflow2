
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { startOfDay, endOfDay, format } from 'date-fns';
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

interface DateRange {
  start: Date;
  end: Date;
}

export const useAnalytics = (dateRange: DateRange) => {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalClicks: 0,
    campaignStats: [],
    sellerStats: [],
    dailyClicks: []
  });
  const [loading, setLoading] = useState(true);

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
          seller_id,
          campaigns!inner (
            name,
            slug,
            team_id
          ),
          sellers!inner (
            name
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
        const sellerName = click.sellers.name;
        const sellerId = click.seller_id;
        
        if (sellerMap.has(sellerName)) {
          sellerMap.get(sellerName)!.clicks++;
          sellerMap.get(sellerName)!.contacts.add(sellerId);
        } else {
          sellerMap.set(sellerName, {
            name: sellerName,
            clicks: 1,
            contacts: new Set([sellerId])
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

  return { analytics, loading };
};
