
import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { EditSellerDialog } from '@/components/EditSellerDialog';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuditLog } from '@/hooks/useAuditLog';

interface Seller {
  id: string;
  name: string;
  weight: number;
  created_at: string;
  contacts: Array<{
    id: string;
    phone_number: string;
    description: string | null;
  }>;
}

// Type for the delete_seller_and_children RPC response
interface DeleteSellerResponse {
  success: boolean;
  deleted_contacts_count?: number;
  deleted_links_count?: number;
  message?: string;
}

export const Sellers = () => {
  const { user } = useAuth();
  const { currentTeam } = useTeam();
  const { toast } = useToast();
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSeller, setEditingSeller] = useState<Seller | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sellerToDelete, setSellerToDelete] = useState<Seller | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (user && currentTeam) {
      fetchSellers();
    }
  }, [user, currentTeam]);

  const fetchSellers = async () => {
    if (!currentTeam) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Fetch sellers with their contacts using currentTeam
      const { data: sellersData } = await supabase
        .from('sellers')
        .select(`
          id,
          name,
          weight,
          created_at,
          seller_contacts (
            id,
            phone_number,
            description
          )
        `)
        .eq('team_id', currentTeam.team_id)
        .order('created_at', { ascending: false });

      // Map seller_contacts to contacts to match our interface
      const mappedSellers = sellersData?.map(seller => ({
        ...seller,
        contacts: seller.seller_contacts || []
      })) || [];

      setSellers(mappedSellers);
    } catch (error) {
      console.error('Error fetching sellers:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os vendedores.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditSeller = (seller: Seller) => {
    setEditingSeller(seller);
    setEditDialogOpen(true);
  };

  const handleDeleteSeller = (seller: Seller) => {
    setSellerToDelete(seller);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteSeller = async () => {
    if (!sellerToDelete) return;

    try {
      setIsDeleting(true);

      // Use the new delete_seller_and_children function
      const { data, error } = await supabase.rpc('delete_seller_and_children', {
        seller_id_to_delete: sellerToDelete.id
      }) as { data: any; error: any };

      // A função RPC pode retornar um objeto único ou um array. Normalizamos aqui.
      const payload: DeleteSellerResponse | undefined = Array.isArray(data)
        ? data[0]
        : data;

      if (error || !payload || payload.success !== true) {
        toast({
          title: "Erro",
          description: payload?.message || "Não foi possível remover o vendedor.",
          variant: "destructive",
        });
        return;
      }

      const contactsDeleted = payload.deleted_contacts_count || 0;
      const linksDeleted = payload.deleted_links_count || 0;
      
      toast({
        title: "Sucesso",
        description: `Vendedor removido com sucesso! (${contactsDeleted} contatos e ${linksDeleted} links de campanha também foram removidos)`,
      });

      // Update the local state
      setSellers(prev => prev.filter(s => s.id !== sellerToDelete.id));
      setDeleteDialogOpen(false);
    } catch (error) {
      console.error('Error deleting seller:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao remover vendedor.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const { logAudit } = useAuditLog();

  const updateSellerWeight = async (sellerId: string, newWeight: number) => {
    try {
      // Get old weight before update
      const oldSeller = sellers.find(s => s.id === sellerId);
      const oldWeight = oldSeller?.weight || 0;

      const { error } = await supabase
        .from('sellers')
        .update({ weight: newWeight })
        .eq('id', sellerId);

      if (error) {
        toast({
          title: "Erro",
          description: "Não foi possível atualizar o peso do vendedor.",
          variant: "destructive",
        });
        return;
      }

      // Log the weight change
      await logAudit({
        action_type: 'update',
        entity_type: 'seller',
        entity_id: sellerId,
        old_value: { weight: oldWeight },
        new_value: { weight: newWeight },
        metadata: {
          seller_name: oldSeller?.name,
          field_changed: 'weight'
        }
      });

      // Update local state
      setSellers(prev => prev.map(seller => 
        seller.id === sellerId ? { ...seller, weight: newWeight } : seller
      ));

      toast({
        title: "Sucesso",
        description: "Peso do vendedor atualizado com sucesso!",
      });
    } catch (error) {
      console.error('Error updating seller weight:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao atualizar peso.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Vendedores"
          description="Gerencie sua equipe de vendas"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-48 bg-muted/20 animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Vendedores"
        description="Gerencie sua equipe de vendas"
        actions={
          <Button asChild className="sm:w-auto">
            <Link to="/sellers/new">
              <Plus className="w-4 h-4 mr-2" />
              Novo Vendedor
            </Link>
          </Button>
        }
      />

      {sellers.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Nenhum vendedor encontrado</p>
          <Button asChild>
            <Link to="/sellers/new">
              <Plus className="w-4 h-4 mr-2" />
              Adicionar primeiro vendedor
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {sellers.map((seller) => (
            <Card key={seller.id} className="h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold text-foreground truncate">
                    {seller.name}
                  </CardTitle>
                  <div className="flex gap-1 shrink-0">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-8 w-8 p-0"
                      onClick={() => handleEditSeller(seller)}
                      disabled={isDeleting}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                      onClick={() => handleDeleteSeller(seller)}
                      disabled={isDeleting}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Weight Control Section */}
                <div className="space-y-3 p-3 bg-muted/30 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-foreground">
                        Peso (Distribuição Global)
                      </label>
                      <p className="text-xs text-muted-foreground">
                        Um vendedor com peso 2 recebe o dobro de leads de um com peso 1
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => updateSellerWeight(seller.id, Math.max(1, seller.weight - 1))}
                        disabled={seller.weight <= 1}
                      >
                        -
                      </Button>
                      <span className="text-lg font-bold text-primary min-w-[2rem] text-center">
                        {seller.weight}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => updateSellerWeight(seller.id, seller.weight + 1)}
                        disabled={seller.weight >= 10}
                      >
                        +
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Contact Count */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Contatos:</span>
                  <Badge variant="secondary" className="text-xs">
                    {seller.contacts?.length || 0}
                  </Badge>
                </div>
                
                {/* Contacts List */}
                {seller.contacts && seller.contacts.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Números de Contato:</p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {seller.contacts.map((contact) => (
                        <div key={contact.id} className="p-2 bg-muted/50 rounded text-xs">
                          <p className="font-mono text-foreground truncate">
                            {contact.phone_number}
                          </p>
                          {contact.description && (
                            <p className="text-muted-foreground mt-1 truncate">
                              {contact.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    Nenhum contato cadastrado
                  </div>
                )}
                
                {/* Add Contact Button */}
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="w-full"
                  onClick={() => handleEditSeller(seller)}
                  disabled={isDeleting}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Adicionar Contato
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <EditSellerDialog
        seller={editingSeller}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSellerUpdated={fetchSellers}
      />

      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Confirmar Exclusão"
        description={`Tem certeza que deseja excluir o vendedor "${sellerToDelete?.name}"? Esta ação também removerá todos os contatos associados e links de campanha, e não pode ser desfeita.`}
        onConfirm={confirmDeleteSeller}
        confirmText={isDeleting ? "Excluindo..." : "Excluir"}
        cancelText="Cancelar"
        variant="destructive"
      />
    </div>
  );
};
