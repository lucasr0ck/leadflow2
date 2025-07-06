
import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { EditSellerDialog } from '@/components/EditSellerDialog';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';

interface Seller {
  id: string;
  name: string;
  created_at: string;
  contacts: Array<{
    id: string;
    phone_number: string;
    description: string | null;
  }>;
}

export const Sellers = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSeller, setEditingSeller] = useState<Seller | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sellerToDelete, setSellerToDelete] = useState<Seller | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (user) {
      fetchSellers();
    }
  }, [user]);

  const fetchSellers = async () => {
    try {
      setLoading(true);
      
      // Get user's team
      const { data: team } = await supabase
        .from('teams')
        .select('id')
        .eq('owner_id', user!.id)
        .single();

      if (!team) return;

      // Fetch sellers with their contacts
      const { data: sellersData } = await supabase
        .from('sellers')
        .select(`
          id,
          name,
          created_at,
          seller_contacts (
            id,
            phone_number,
            description
          )
        `)
        .eq('team_id', team.id)
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

      // First delete all seller contacts
      const { error: contactsError } = await supabase
        .from('seller_contacts')
        .delete()
        .eq('seller_id', sellerToDelete.id);

      if (contactsError) {
        toast({
          title: "Erro",
          description: "Não foi possível remover os contatos do vendedor.",
          variant: "destructive",
        });
        return;
      }

      // Then delete the seller
      const { error: sellerError } = await supabase
        .from('sellers')
        .delete()
        .eq('id', sellerToDelete.id);

      if (sellerError) {
        toast({
          title: "Erro",
          description: "Não foi possível remover o vendedor.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Sucesso",
        description: "Vendedor removido com sucesso!",
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">Vendedores</h1>
            <p className="text-sm lg:text-base text-slate-600 mt-1">Gerencie sua equipe de vendas</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-48 bg-slate-100 animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">Vendedores</h1>
          <p className="text-sm lg:text-base text-slate-600 mt-1">Gerencie sua equipe de vendas</p>
        </div>
        <Button asChild className="sm:w-auto">
          <Link to="/sellers/new">
            <Plus className="w-4 h-4 mr-2" />
            Novo Vendedor
          </Link>
        </Button>
      </div>

      {sellers.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-500 mb-4">Nenhum vendedor encontrado</p>
          <Button asChild>
            <Link to="/sellers/new">
              <Plus className="w-4 h-4 mr-2" />
              Adicionar primeiro vendedor
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
          {sellers.map((seller) => (
            <Card key={seller.id} className="h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold text-slate-800 truncate">
                    {seller.name}
                  </CardTitle>
                  <div className="flex gap-1 shrink-0">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-8 w-8 p-0"
                      onClick={() => handleEditSeller(seller)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                      onClick={() => handleDeleteSeller(seller)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Contact Count */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Contatos:</span>
                  <Badge variant="secondary" className="text-xs">
                    {seller.contacts?.length || 0}
                  </Badge>
                </div>
                
                {/* Contacts List */}
                {seller.contacts && seller.contacts.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-600">Números de Contato:</p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {seller.contacts.map((contact) => (
                        <div key={contact.id} className="p-2 bg-slate-50 rounded text-xs">
                          <p className="font-mono text-slate-700 truncate">
                            {contact.phone_number}
                          </p>
                          {contact.description && (
                            <p className="text-slate-500 mt-1 truncate">
                              {contact.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-slate-500 text-sm">
                    Nenhum contato cadastrado
                  </div>
                )}
                
                {/* Add Contact Button */}
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="w-full"
                  onClick={() => handleEditSeller(seller)}
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
        description={`Tem certeza que deseja excluir o vendedor "${sellerToDelete?.name}"? Esta ação também removerá todos os contatos associados e não pode ser desfeita.`}
        onConfirm={confirmDeleteSeller}
        confirmText={isDeleting ? "Excluindo..." : "Excluir"}
        cancelText="Cancelar"
        variant="destructive"
      />
    </div>
  );
};
