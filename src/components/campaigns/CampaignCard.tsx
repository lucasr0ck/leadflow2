
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Edit2, Trash2, Copy, BarChart3, Users } from 'lucide-react';
import { CampaignWithLinks } from '@/types/database';
import { useCampaignAnalytics } from '@/hooks/useCampaignAnalytics';

interface CampaignCardProps {
  campaign: CampaignWithLinks;
  onEdit: (campaign: CampaignWithLinks) => void;
  onDelete: (campaignId: string) => void;
}

export const CampaignCard = ({ campaign, onEdit, onDelete }: CampaignCardProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { analytics } = useCampaignAnalytics(campaign.id);
  const [isHovered, setIsHovered] = useState(false);

  const redirectLink = `/r/${campaign.slug}`;
  const baseUrl = window.location.origin;
  const fullRedirectUrl = `${baseUrl}${redirectLink}`;

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(fullRedirectUrl);
      toast({
        title: 'Link copiado!',
        description: 'O link de redirecionamento foi copiado para a área de transferência.',
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Falha ao copiar o link.',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(campaign);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(campaign.id);
  };

  const handleCardClick = () => {
    navigate(`/analytics/campaign/${campaign.id}`);
  };

  const getSellerDistribution = () => {
    const sellerDistribution: {[sellerName: string]: number} = {};
    
    campaign.campaign_links.forEach(link => {
      const sellerName = link.seller_contacts.sellers.name;
      sellerDistribution[sellerName] = (sellerDistribution[sellerName] || 0) + 1;
    });

    return sellerDistribution;
  };

  const sellerDistribution = getSellerDistribution();

  return (
    <Card 
      className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
        isHovered ? 'scale-[1.02]' : ''
      }`}
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-slate-800 text-lg">{campaign.name}</h3>
            <Badge variant={campaign.is_active ? 'default' : 'secondary'}>
              {campaign.is_active ? 'Ativa' : 'Inativa'}
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleEdit}
              className="hover:bg-slate-50"
            >
              <Edit2 className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              className="hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Analytics Section */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-50 p-3 rounded-md">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-4 h-4 text-[#2D9065]" />
              <span className="text-sm font-medium text-slate-600">Total de Cliques</span>
            </div>
            <p className="text-2xl font-bold text-slate-800">{analytics.totalClicks}</p>
          </div>
          <div className="bg-slate-50 p-3 rounded-md">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-slate-600">Últimos 7 dias</span>
            </div>
            <p className="text-2xl font-bold text-slate-800">{analytics.last7DaysClicks}</p>
          </div>
        </div>

        {/* Redirect Link Section */}
        <div className="bg-slate-50 p-3 rounded-md">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-slate-600">Link de Redirecionamento</span>
              <p className="text-sm text-slate-800 font-mono">{redirectLink}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              className="ml-2"
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Seller Distribution Section */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-[#2D9065]" />
            <span className="text-sm font-medium text-slate-700">Distribuição por Vendedor</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(sellerDistribution).map(([sellerName, count]) => (
              <Badge key={sellerName} variant="outline" className="bg-white">
                {sellerName}: {count} posições
              </Badge>
            ))}
          </div>
        </div>

        {/* Campaign Details */}
        <div className="text-sm text-slate-600 pt-2 border-t border-slate-100">
          <p>Slug: {campaign.slug} • {campaign.campaign_links.length} posições totais</p>
        </div>
      </CardContent>
    </Card>
  );
};
