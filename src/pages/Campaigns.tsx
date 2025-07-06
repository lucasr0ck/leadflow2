
import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CampaignCard } from '@/components/campaigns/CampaignCard';
import { Button } from '@/components/ui/button';
import { subDays, startOfDay } from 'date-fns';
import { performDataCleanup } from '@/utils/dataCleanup';

interface Campaign {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  totalClicks: number;
  clicksLast7Days: number;
  sellers: Array<{
    name: string;
    positions: number;
  }>;
}

export const Campaigns = () => {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      initializeData();
    }
  }, [user]);

  const initializeData = async () => {
    // Perform one-time data cleanup
    console.log('Performing authorized data cleanup...');
    await performDataCleanup();
    
    // Then fetch campaigns
    fetchCampaigns();
  };

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      
      // Get user's team
      const { data: team } = await supabase
        .from('teams')
        .select('id')
        .eq('owner_id', user!.id)
        .single();

      if (!team) return;

      // Fetch campaigns with their data
      const { data: campaignsData } = await supabase
        .from('campaigns')
        .select(`
          id,
          name,
          slug,
          is_active,
          campaign_links (
            id,
            position,
            seller_contacts (
              seller_id,
              sellers (
                name
              )
            )
          )
        `)
        .eq('team_id', team.id)
        .order('created_at', { ascending: false });

      if (!campaignsData) return;

      // Fetch click data for each campaign
      const campaignsWithMetrics = await Promise.all(
        campaignsData.map(async (campaign) => {
          // Get total clicks
          const { data: totalClicksData } = await supabase
            .from('clicks')
            .select('id')
            .eq('campaign_id', campaign.id);

          // Get clicks from last 7 days
          const sevenDaysAgo = startOfDay(subDays(new Date(), 7));
          const { data: recentClicksData } = await supabase
            .from('clicks')
            .select('id')
            .eq('campaign_id', campaign.id)
            .gte('created_at', sevenDaysAgo.toISOString());

          // Calculate seller distribution
          const sellerCounts: { [key: string]: number } = {};
          campaign.campaign_links.forEach((link: any) => {
            const sellerName = link.seller_contacts?.sellers?.name;
            if (sellerName) {
              sellerCounts[sellerName] = (sellerCounts[sellerName] || 0) + 1;
            }
          });

          const sellers = Object.entries(sellerCounts).map(([name, positions]) => ({
            name,
            positions,
          }));

          return {
            id: campaign.id,
            name: campaign.name,
            slug: campaign.slug,
            is_active: campaign.is_active,
            totalClicks: totalClicksData?.length || 0,
            clicksLast7Days: recentClicksData?.length || 0,
            sellers,
          };
        })
      );

      setCampaigns(campaignsWithMetrics);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">Campanhas</h1>
            <p className="text-sm lg:text-base text-slate-600 mt-1">Gerencie suas campanhas de distribuição de leads</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-64 bg-slate-100 animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">Campanhas</h1>
          <p className="text-sm lg:text-base text-slate-600 mt-1">Gerencie suas campanhas de distribuição de leads</p>
        </div>
        <Button asChild className="sm:w-auto">
          <Link to="/campaigns/new">
            <Plus className="w-4 h-4 mr-2" />
            Nova Campanha
          </Link>
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-500 mb-4">Nenhuma campanha encontrada</p>
          <Button asChild>
            <Link to="/campaigns/new">
              <Plus className="w-4 h-4 mr-2" />
              Criar primeira campanha
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          {campaigns.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </div>
      )}
    </div>
  );
};
