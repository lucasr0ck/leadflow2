
import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { useToast } from '@/hooks/use-toast';
import { CampaignCard } from '@/components/campaigns/CampaignCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { subDays, startOfDay } from 'date-fns';
import { PageHeader } from '@/components/layout/PageHeader';

interface Campaign {
  id: string;
  name: string;
  slug: string;
  full_slug: string;
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
  const { currentTeam, loading: teamLoading, availableTeams } = useTeam();
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('[Campaigns] useEffect triggered:', { 
      hasUser: !!user, 
      hasTeam: !!currentTeam, 
      teamLoading,
      teamId: currentTeam?.team_id 
    });
    
    // ⚠️ CRITICAL FIX: Aguardar teams carregarem
    if (teamLoading) {
      console.log('[Campaigns] Aguardando teams carregarem...');
      return;
    }
    
    if (user && currentTeam) {
      console.log('[Campaigns] Fetching campaigns for team:', currentTeam.team_name);
      fetchCampaigns();
    } else {
      console.log('[Campaigns] Stopping loading - no team or user');
      setLoading(false);
    }
  }, [user, currentTeam?.team_id, teamLoading]); // Dependência específica no team_id, não no objeto inteiro

  const fetchCampaigns = async () => {
    if (!currentTeam) {
      console.log('[Campaigns] fetchCampaigns: No currentTeam, aborting');
      setLoading(false);
      return;
    }

    try {
      console.log('[Campaigns] fetchCampaigns: Starting fetch for team:', currentTeam.team_id);
      setLoading(true);

      // Fetch campaigns with basic data - seller distribution is now dynamic
      const { data: campaignsData, error: campaignsError } = await supabase
        .from('campaigns')
        .select(`
          id,
          name,
          slug,
          full_slug,
          is_active,
          team_id
        `)
        .eq('team_id', currentTeam.team_id)
        .order('created_at', { ascending: false });

      if (campaignsError) {
        console.error('[Campaigns] Error fetching campaigns:', campaignsError);
        throw campaignsError;
      }

      if (!campaignsData) {
        console.log('[Campaigns] No campaigns data returned');
        return;
      }

      console.log('[Campaigns] Fetched', campaignsData.length, 'campaigns');

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

          // Get sellers for this team with their weights (dynamic distribution)
          // Note: In the new architecture, ALL active sellers from the team participate in ALL campaigns
          // The distribution is based on weight, not pre-assigned links
          const { data: sellersData } = await supabase
            .from('sellers')
            .select('name, weight')
            .eq('team_id', currentTeam.team_id)
            .eq('is_active', true);

          const sellers = sellersData?.map(seller => ({
            name: seller.name,
            positions: seller.weight, // Weight represents their share in the distribution
          })) || [];

          return {
            id: campaign.id,
            name: campaign.name,
            slug: campaign.slug,
            full_slug: campaign.full_slug,
            is_active: campaign.is_active,
            totalClicks: totalClicksData?.length || 0,
            clicksLast7Days: recentClicksData?.length || 0,
            sellers,
          };
        })
      );

      console.log('[Campaigns] Setting campaigns state with', campaignsWithMetrics.length, 'items');
      setCampaigns(campaignsWithMetrics);
    } catch (error) {
      console.error('[Campaigns] ERROR fetching campaigns:', error);
      toast({
        title: "Erro ao carregar campanhas",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      console.log('[Campaigns] fetchCampaigns complete');
      setLoading(false);
    }
  };

  // Mostrar loading apenas se team está carregando ou campaigns estão carregando
  if (loading || teamLoading) {
    return (
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <PageHeader
            title="Campanhas"
            description="Gerencie suas campanhas de distribuição de leads"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-64 bg-muted/20 animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // Se não tem team, mostrar mensagem
  if (!currentTeam) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Campanhas"
          description="Gerencie suas campanhas de distribuição de leads"
        />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-lg text-muted-foreground text-center">
              {availableTeams.length === 0 
                ? "Você ainda não faz parte de nenhuma operação. Crie uma operação em Configurações → Gerenciar Operações."
                : "Selecione uma operação para ver as campanhas."}
            </p>
          </CardContent>
        </Card>
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
