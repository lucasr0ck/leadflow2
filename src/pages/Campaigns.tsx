
import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CampaignCard } from '@/components/campaigns/CampaignCard';
import { Button } from '@/components/ui/button';
import { subDays, startOfDay } from 'date-fns';
import { performDataCleanup } from '@/utils/dataCleanup';
import { PageHeader } from '@/components/layout/PageHeader';

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
    // Perform one-time authorized data cleanup
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

      // Fetch campaigns with basic data - seller distribution is now dynamic
      const { data: campaignsData } = await supabase
        .from('campaigns2')
        .select(`
          id,
          name,
          slug,
          is_active,
          team_id
        `)
        .eq('team_id', team.id)
        .order('created_at', { ascending: false });

      if (!campaignsData) return;

      // Fetch click data for each campaign
      const campaignsWithMetrics = await Promise.all(
        campaignsData.map(async (campaign) => {
          // Get total clicks
          const { data: totalClicksData } = await supabase
            .from('clicks2')
            .select('id')
            .eq('campaign_id', campaign.id);

          // Get clicks from last 7 days
          const sevenDaysAgo = startOfDay(subDays(new Date(), 7));
          const { data: recentClicksData } = await supabase
            .from('clicks2')
            .select('id')
            .eq('campaign_id', campaign.id)
            .gte('created_at', sevenDaysAgo.toISOString());

          // Get sellers for this team with their weights (dynamic distribution)
          const { data: sellersData } = await supabase
            .from('sellers')
            .select('name, weight')
            .eq('team_id', team.id);

          const sellers = sellersData?.map(seller => ({
            name: seller.name,
            positions: seller.weight, // Weight represents their share in the distribution
          })) || [];

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
      <div className="space-y-8">
        <PageHeader
          title="Campanhas"
          description="Gerencie suas campanhas de distribuição de leads"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-64 bg-muted/20 animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Campanhas"
        description="Gerencie suas campanhas de distribuição de leads"
        actions={
          <Button asChild className="sm:w-auto">
            <Link to="/campaigns/new">
              <Plus className="w-4 h-4 mr-2" />
              Nova Campanha
            </Link>
          </Button>
        }
      />

      {campaigns.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Nenhuma campanha encontrada</p>
          <Button asChild>
            <Link to="/campaigns/new">
              <Plus className="w-4 h-4 mr-2" />
              Criar primeira campanha
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((campaign) => (
            <CampaignCard 
              key={campaign.id} 
              campaign={campaign} 
              onCampaignDeleted={fetchCampaigns}
            />
          ))}
        </div>
      )}
    </div>
  );
};
