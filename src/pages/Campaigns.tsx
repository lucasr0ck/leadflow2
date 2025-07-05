import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { CampaignCard } from '@/components/campaigns/CampaignCard';
import { Plus } from 'lucide-react';
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<string | null>(null);

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
    
    const distribution: {[sellerId: string]: number} = {};
    selectedSellerData.forEach(seller => {
      const contactCount = seller.seller_contacts.length;
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
        await supabase
          .from('campaigns')
          .update({ name: campaignName, slug })
          .eq('id', editingCampaign.id);

        await supabase
          .from('campaign_links')
          .delete()
          .eq('campaign_id', editingCampaign.id);

        await createCampaignLinks(editingCampaign.id);

        toast({
          title: 'Sucesso',
          description: 'Campanha atualizada com sucesso',
        });
      } else {
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

    for (const sellerId of selectedSellers) {
      const seller = sellers.find(s => s.id === sellerId);
      if (!seller) continue;

      const repetitions = distribution[sellerId] || 1;
      
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

    for (let i = campaignLinks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [campaignLinks[i], campaignLinks[j]] = [campaignLinks[j], campaignLinks[i]];
    }

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
    
    const sellersInCampaign = new Set(
      campaign.campaign_links.map(link => link.seller_contacts.sellers.id)
    );
    setSelectedSellers(Array.from(sellersInCampaign));
    
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

  const handleDeleteClick = (campaignId: string) => {
    setCampaignToDelete(campaignId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!campaignToDelete) return;

    try {
      await supabase.from('campaigns').delete().eq('id', campaignToDelete);
      
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
    } finally {
      setDeleteDialogOpen(false);
      setCampaignToDelete(null);
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
        <div className="p-6">
          {campaigns.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {campaigns.map((campaign) => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  onEdit={handleEdit}
                  onDelete={handleDeleteClick}
                />
              ))}
            </div>
          ) : (
            <div className="text-center text-slate-500 py-12">
              Nenhuma campanha criada ainda. Clique em "Nova Campanha" para começar.
            </div>
          )}
        </div>
      </div>

      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Excluir Campanha"
        description="Tem certeza que deseja excluir esta campanha? Esta ação não pode ser desfeita e todos os dados relacionados serão perdidos."
        onConfirm={handleDeleteConfirm}
        confirmText="Excluir"
        cancelText="Cancelar"
        variant="destructive"
      />
    </div>
  );
};
