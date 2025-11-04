
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Check, Edit, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { supabase } from '@/integrations/supabase/client';

interface CampaignCardProps {
  campaign: {
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
  };
  onCampaignDeleted: () => void;
}

// Type for the delete_campaign_and_children RPC response
interface DeleteCampaignResponse {
  success: boolean;
  deleted_clicks_count?: number;
  deleted_links_count?: number;
  message?: string;
}

export const CampaignCard = ({ campaign, onCampaignDeleted }: CampaignCardProps) => {
  const [copied, setCopied] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Use absolute URL for production deployment
    const baseUrl = import.meta.env.VITE_APP_BASE_URL || window.location.origin;
    const redirectUrl = `${baseUrl}/r/${campaign.full_slug}`;
    
    try {
      await navigator.clipboard.writeText(redirectUrl);
      setCopied(true);
      toast({
        title: "Link copiado!",
        description: "O link de redirecionamento foi copiado para a área de transferência.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar o link.",
        variant: "destructive",
      });
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteDialogOpen(true);
  };

  const confirmDeleteCampaign = async () => {
    try {
      setIsDeleting(true);

      // Use the new delete_campaign_and_children function
      const { data, error } = await supabase.rpc('delete_campaign_and_children', {
        campaign_id_to_delete: campaign.id
      }) as { data: any; error: any };

      const payload: DeleteCampaignResponse | undefined = Array.isArray(data) ? data[0] : data;

      if (error || !payload || payload.success !== true) {
        toast({
          title: "Erro",
          description: payload?.message || "Não foi possível remover a campanha.",
          variant: "destructive",
        });
        return;
      }

      const clicksDeleted = payload.deleted_clicks_count || 0;
      const linksDeleted = payload.deleted_links_count || 0;
      
      toast({
        title: "Sucesso",
        description: `Campanha removida com sucesso! (${clicksDeleted} cliques e ${linksDeleted} links também foram removidos)`,
      });

      setDeleteDialogOpen(false);
      onCampaignDeleted();
    } catch (error) {
      console.error('Error deleting campaign:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao remover campanha.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Card className="h-full hover:shadow-lg transition-all duration-200 hover:scale-[1.02] cursor-pointer">
        <Link to={`/analytics/campaign/${campaign.id}`} className="block h-full">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-slate-800 truncate">
                {campaign.name}
              </h3>
              <div className="flex items-center gap-2">
                <Link 
                  to={`/campaigns/edit/${campaign.id}`}
                  onClick={handleEditClick}
                  className="p-1 hover:bg-slate-100 rounded transition-colors"
                  title="Editar campanha"
                >
                  <Edit className="h-4 w-4 text-slate-600" />
                </Link>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDeleteClick}
                  className="p-1 h-auto hover:bg-red-50 text-red-600 hover:text-red-700"
                  title="Excluir campanha"
                  disabled={isDeleting}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Badge 
                  variant={campaign.is_active ? "default" : "secondary"}
                  className={campaign.is_active 
                    ? "bg-green-100 text-green-800 hover:bg-green-100" 
                    : "bg-red-100 text-red-800 hover:bg-red-100"
                  }
                >
                  {campaign.is_active ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* Metrics */}
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-600 mb-1">Total de Cliques</p>
                <p className="text-lg font-bold text-slate-800">{campaign.totalClicks}</p>
              </div>
              <div className="text-center p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-600 mb-1">Últimos 7 dias</p>
                <p className="text-lg font-bold text-slate-800">{campaign.clicksLast7Days}</p>
              </div>
            </div>
            
            {/* Redirect Link */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-600">Link de Redirecionamento:</p>
              <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                <code className="flex-1 text-xs text-slate-700 truncate">
                  /r/{campaign.full_slug}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCopyLink}
                  className="h-6 w-6 p-0 shrink-0"
                >
                  {copied ? (
                    <Check className="h-3 w-3 text-green-600" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>
            
            {/* Seller Distribution */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-600">Distribuição por Vendedor:</p>
              <div className="flex flex-wrap gap-1">
                {campaign.sellers.map((seller) => (
                  <Badge key={seller.name} variant="outline" className="text-xs px-2 py-1">
                    {seller.name}: {seller.positions}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Link>
      </Card>

      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Confirmar Exclusão da Campanha"
        description={`Tem certeza que deseja excluir a campanha "${campaign.name}"? Esta ação também removerá todos os cliques e links associados e não pode ser desfeita.`}
        onConfirm={confirmDeleteCampaign}
        confirmText={isDeleting ? "Excluindo..." : "Excluir"}
        cancelText="Cancelar"
        variant="destructive"
      />
    </>
  );
};
