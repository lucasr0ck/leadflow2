
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface CampaignAnalytics {
  totalClicks: number;
  last7DaysClicks: number;
}

export const useCampaignAnalytics = (campaignId: string) => {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<CampaignAnalytics>({
    totalClicks: 0,
    last7DaysClicks: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && campaignId) {
      fetchAnalytics();
    }
  }, [user, campaignId]);

  const fetchAnalytics = async () => {
    try {
      // Get total clicks
      const { data: totalClicksData } = await supabase
        .from('clicks')
        .select('id')
        .eq('campaign_id', campaignId);

      // Get clicks from last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: last7DaysData } = await supabase
        .from('clicks')
        .select('id')
        .eq('campaign_id', campaignId)
        .gte('created_at', sevenDaysAgo.toISOString());

      setAnalytics({
        totalClicks: totalClicksData?.length || 0,
        last7DaysClicks: last7DaysData?.length || 0
      });
    } catch (error) {
      console.error('Error fetching campaign analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  return { analytics, loading };
};
