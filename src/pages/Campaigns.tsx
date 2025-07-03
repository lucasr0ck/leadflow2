
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit2, Trash2, Users, BarChart3 } from 'lucide-react';
import { CampaignWithLinks, SellerWithContacts } from '@/types/database';

export const Campaigns = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<CampaignWithLinks[]>([]);
  const [sellers, setSellers] = useState<SellerWithContacts[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<CampaignWithLinks | null>(null);
  const [campaignName, setCampaignName] = useState('');
  const [campaignSlug, setCampaignSlug] = useState('');
  const [selectedSellers, setSelectedSellers] = useState<string[]>([]);
  const [distributionConfig, setDistributionConfig] = useState<{[sellerId: string]: number}>({});

  useEffect(() => {
    if (user) {
      fetchCampaigns();
      fetchSellers();
    }
  }, [user]);

  const fetchCampaigns = async () => {
    try {
      const { data: team } = await supabase
        .from('teams')
        .select('id')
        .eq('owner_id', user!.id)
        .single();

      if (!team) return;

      const { data: campaignData } = await supabase
        .from('campaigns')
        .select(`
          *,
          campaign_links (
            *,
            seller_contacts (
              *,
              sellers (*)
            )
          )
        `)
        .eq('team_id', team.id)
        .order('created_at', { ascending: false });

      setCampaigns(campaignData || []);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    }
  };

  const fetchSellers = async () => {
    try {
      const { data: team } = await supabase
        .from('teams')
        .select('id')
        .eq('owner_id', user!.id)
        .single();

      if (!team) return;

      const { data: sellersData } = await supabase
        .from('sellers')
        .select(`
          *,
          seller_contacts (*)
        `)
        .eq('team_id', team.id)
        .order('created_at', { ascending: false });

      setSellers(sellersData || []);
    } catch (error) {
      console.error('Error fetching sellers:', error);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const calculateDistribution = () => {
    const selectedSellerData = sellers.filter(s => selectedSellers.includes(s.id));
    const totalContacts = selectedSellerData.reduce((sum, seller) => sum + seller.seller_contacts.length, 0);
    
    if (totalContacts === 0) return {};
    
    // Distribuição equilibrada baseada no número de contatos por vendedor
    const distribution: {[sellerId: string]: number} = {};
    selectedSellerData.forEach(seller => {
      const contactCount = seller.seller_contacts.length;
      // Cada vendedor deve ter pelo menos 1 posição por contato para distribuição equilibrada
      distribution[seller.id] = contactCount;
    });
    
    return distribution;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedSellers.length === 0) {
      toast({
        title: 'Erro',
        description: 'Selecione pelo menos um vendedor',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { data: team } = await supabase
        .from('teams')
        .select('id')
        .eq('owner_id', user!.id)
        .single();

      if (!team) return;

      const slug = campaignSlug || generateSlug(campaignName);

      if (editingCampaign) {
        // Update existing campaign
        await supabase
          .from('campaigns')
          .update({ name: campaignName, slug })
          .eq('id', editingCampaign.id);

        // Delete existing campaign links
        await supabase
          .from('campaign_links')
          .delete()
          .eq('campaign_id', editingCampaign.id);

        // Create new distribution
        await createCampaignLinks(editingCampaign.id);

        toast({
          title: 'Sucesso',
          description: 'Campanha atualizada com sucesso',
        });
      } else {
        // Create new campaign
        const { data: newCampaign } = await supabase
          .from('campaigns')
          .insert({
            team_id: team.id,
            name: campaignName,
            slug,
          })
          .select()
          .single();

        if (newCampaign) {
          await createCampaignLinks(newCampaign.id);
        }

        toast({
          title: 'Sucesso',
          description: 'Campanha criada com sucesso',
        });
      }

      // Reset form
      resetForm();
      fetchCampaigns();
    } catch (error) {
      console.error('Error saving campaign:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao salvar campanha',
        variant: 'destructive',
      });
    }
  };

  const createCampaignLinks = async (campaignId: string) => {
    const distribution = Object.keys(distributionConfig).length > 0 ? distributionConfig : calculateDistribution();
    const campaignLinks: any[] = [];
    let position = 1;

    // Criar links baseado na distribuição configurada
    for (const sellerId of selectedSellers) {
      const seller = sellers.find(s => s.id === sellerId);
      if (!seller) continue;

      const repetitions = distribution[sellerId] || 1;
      
      // Para cada repetição, adicionar todos os contatos do vendedor
      for (let rep = 0; rep < repetitions; rep++) {
        for (const contact of seller.seller_contacts) {
          campaignLinks.push({
            campaign_id: campaignId,
            contact_id: contact.id,
            position: position++,
          });
        }
      }
    }

    // Embaralhar os links para distribuição aleatória
    for (let i = campaignLinks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [campaignLinks[i], campaignLinks[j]] = [campaignLinks[j], campaignLinks[i]];
    }

    // Reordenar as posições após embaralhar
    campaignLinks.forEach((link, index) => {
      link.position = index + 1;
    });

    if (campaignLinks.length > 0) {
      await supabase
        .from('campaign_links')
        .insert(campaignLinks);
    }
  };

  const handleEdit = (campaign: CampaignWithLinks) => {
    setEditingCampaign(campaign);
    setCampaignName(campaign.name);
    setCampaignSlug(campaign.slug);
    
    // Extrair vendedores únicos da campanha
    const sellersInCampaign = new Set(
      campaign.campaign_links.map(link => link.seller_contacts.sellers.id)
    );
    setSelectedSellers(Array.from(sellersInCampaign));
    
    // Calcular distribuição atual
    const currentDistribution: {[sellerId: string]: number} = {};
    Array.from(sellersInCampaign).forEach(sellerId => {
      const linksForSeller = campaign.campaign_links.filter(
        link => link.seller_contacts.sellers.id === sellerId
      );
      const seller = sellers.find(s => s.id === sellerId);
      const contactCount = seller?.seller_contacts.length || 1;
      currentDistribution[sellerId] = Math.ceil(linksForSeller.length / contactCount);
    });
    
    setDistributionConfig(currentDistribution);
    setShowForm(true);
  };

  const handleDelete = async (campaignId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta campanha?')) return;

    try {
      await supabase.from('campaigns').delete().eq('id', campaignId);
      
      toast({
        title: 'Sucesso',
        description: 'Campanha excluída com sucesso',
      });
      
      fetchCampaigns();
    } catch (error) {
      console.error('Error deleting campaign:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao excluir campanha',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingCampaign(null);
    setCampaignName('');
    setCampaignSlug('');
    setSelectedSellers([]);
    setDistributionConfig({});
  };

  const handleSellerToggle = (sellerId: string) => {
    setSelectedSellers(prev => {
      const newSelection = prev.includes(sellerId)
        ? prev.filter(id => id !== sellerId)
        : [...prev, sellerId];
      
      // Recalcular distribuição quando seleção muda
      if (newSelection.length > 0) {
        const newDistribution = calculateDistribution();
        setDistributionConfig(newDistribution);
      }
      
      return newSelection;
    });
  };

  const updateDistribution = (sellerId: string, count: number) => {
    setDistributionConfig(prev => ({
      ...prev,
      [sellerId]: Math.max(1, count)
    }));
  };

  const getCampaignStats = (campaign: CampaignWithLinks) => {
    const totalLinks = campaign.campaign_links.length;
    const sellerDistribution: {[sellerName: string]: number} = {};
    
    campaign.campaign_links.forEach(link => {
      const sellerName = link.seller_contacts.sellers.name;
      sellerDistribution[sellerName] = (sellerDistribution[sellerName] || 0) + 1;
    });

    return { totalLinks, sellerDistribution };
  };

  return (
    <div className="space-y-6">
      <BackButton />
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Campanhas</h1>
          <p className="text-slate-600">Gerencie suas campanhas de lead</p>
        </div>
        <Button
          onClick={() => setShowForm(true)}
          className="bg-[#2D9065] hover:bg-[#2D9065]/90"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova Campanha
        </Button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-lg border border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            {editingCampaign ? 'Editar Campanha' : 'Nova Campanha'}
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="campaignName">Nome da Campanha</Label>
                <Input
                  id="campaignName"
                  value={campaignName}
                  onChange={(e) => {
                    setCampaignName(e.target.value);
                    if (!campaignSlug) {
                      setCampaignSlug(generateSlug(e.target.value));
                    }
                  }}
                  placeholder="Digite o nome da campanha"
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="campaignSlug">Slug da Campanha</Label>
                <Input
                  id="campaignSlug"
                  value={campaignSlug}
                  onChange={(e) => setCampaignSlug(e.target.value)}
                  placeholder="slug-da-campanha"
                  required
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label>Seleção de Vendedores</Label>
              <div className="mt-2 space-y-2 max-h-60 overflow-y-auto border rounded-md p-3">
                {sellers.map((seller) => (
                  <div key={seller.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={selectedSellers.includes(seller.id)}
                        onChange={() => handleSellerToggle(seller.id)}
                        className="rounded"
                      />
                      <div>
                        <span className="font-medium">{seller.name}</span>
                        <span className="text-sm text-slate-500 ml-2">
                          ({seller.seller_contacts.length} contatos)
                        </span>
                      </div>
                    </div>
                    
                    {selectedSellers.includes(seller.id) && (
                      <div className="flex items-center space-x-2">
                        <Label className="text-xs">Repetições:</Label>
                        <Input
                          type="number"
                          min="1"
                          value={distributionConfig[seller.id] || 1}
                          onChange={(e) => updateDistribution(seller.id, parseInt(e.target.value))}
                          className="w-16 h-8 text-center"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {sellers.length === 0 && (
                <p className="text-slate-500 text-sm mt-2">
                  Nenhum vendedor encontrado. Adicione vendedores primeiro.
                </p>
              )}
            </div>

            {selectedSellers.length > 0 && (
              <div className="bg-slate-50 p-4 rounded-md">
                <h4 className="font-medium text-slate-800 mb-2">Prévia da Distribuição:</h4>
                <div className="space-y-1 text-sm">
                  {selectedSellers.map(sellerId => {
                    const seller = sellers.find(s => s.id === sellerId);
                    const repetitions = distributionConfig[sellerId] || 1;
                    const totalPositions = seller ? seller.seller_contacts.length * repetitions : 0;
                    return (
                      <div key={sellerId} className="flex justify-between">
                        <span>{seller?.name}</span>
                        <span className="text-slate-600">
                          {totalPositions} posições ({seller?.seller_contacts.length} contatos × {repetitions})
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                type="submit"
                className="bg-[#2D9065] hover:bg-[#2D9065]/90"
              >
                {editingCampaign ? 'Atualizar' : 'Criar'} Campanha
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={resetForm}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">Campanhas Ativas</h2>
        </div>
        <div className="divide-y divide-slate-200">
          {campaigns.map((campaign) => {
            const stats = getCampaignStats(campaign);
            return (
              <div key={campaign.id} className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-medium text-slate-800">{campaign.name}</h3>
                    <p className="text-sm text-slate-600">
                      Slug: {campaign.slug} • {stats.totalLinks} posições totais
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(campaign)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(campaign.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="bg-slate-50 p-4 rounded-md">
                  <h4 className="font-medium text-slate-700 mb-2 flex items-center">
                    <Users className="w-4 h-4 mr-2" />
                    Distribuição por Vendedor:
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {Object.entries(stats.sellerDistribution).map(([sellerName, count]) => (
                      <div key={sellerName} className="flex justify-between text-sm">
                        <span>{sellerName}</span>
                        <span className="font-medium text-[#2D9065]">{count} posições</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
          {campaigns.length === 0 && (
            <div className="p-6 text-center text-slate-500">
              Nenhuma campanha criada ainda. Clique em "Nova Campanha" para começar.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
