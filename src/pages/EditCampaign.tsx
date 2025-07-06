
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { BackButton } from '@/components/BackButton';
import { Badge } from '@/components/ui/badge';
import { Plus, X } from 'lucide-react';

const campaignSchema = z.object({
  name: z.string().min(1, 'Nome da campanha é obrigatório'),
  slug: z.string().min(1, 'Slug é obrigatório').regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens'),
  greeting_message: z.string().min(1, 'Mensagem de saudação é obrigatória'),
});

type CampaignFormData = z.infer<typeof campaignSchema>;

interface Seller {
  id: string;
  name: string;
  contacts: Array<{
    id: string;
    phone_number: string;
    description?: string;
  }>;
}

interface CampaignLink {
  id: string;
  position: number;
  contact_id: string;
  seller_contacts: {
    id: string;
    phone_number: string;
    description?: string;
    sellers: {
      id: string;
      name: string;
    };
  };
}

export const EditCampaign = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Array<{
    contactId: string;
    sellerName: string;
    phoneNumber: string;
    description?: string;
  }>>([]);

  const form = useForm<CampaignFormData>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      name: '',
      slug: '',
      greeting_message: '',
    },
  });

  useEffect(() => {
    if (user && id) {
      fetchCampaignData();
    }
  }, [user, id]);

  const fetchCampaignData = async () => {
    try {
      setIsLoading(true);

      // Get user's team
      const { data: team } = await supabase
        .from('teams')
        .select('id')
        .eq('owner_id', user!.id)
        .single();

      if (!team) {
        toast({
          title: "Erro",
          description: "Time não encontrado.",
          variant: "destructive",
        });
        navigate('/campaigns');
        return;
      }

      // Fetch campaign data
      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .select(`
          id,
          name,
          slug,
          greeting_message,
          campaign_links (
            id,
            position,
            contact_id,
            seller_contacts (
              id,
              phone_number,
              description,
              sellers (
                id,
                name
              )
            )
          )
        `)
        .eq('id', id)
        .eq('team_id', team.id)
        .single();

      if (campaignError || !campaign) {
        toast({
          title: "Erro",
          description: "Campanha não encontrada.",
          variant: "destructive",
        });
        navigate('/campaigns');
        return;
      }

      // Set form values
      form.setValue('name', campaign.name);
      form.setValue('slug', campaign.slug);
      form.setValue('greeting_message', campaign.greeting_message || '');

      // Set selected contacts from campaign links
      const campaignLinks = campaign.campaign_links as CampaignLink[];
      const contacts = campaignLinks.map(link => ({
        contactId: link.seller_contacts.id,
        sellerName: link.seller_contacts.sellers.name,
        phoneNumber: link.seller_contacts.phone_number,
        description: link.seller_contacts.description,
      }));
      setSelectedContacts(contacts);

      // Fetch all available sellers and their contacts
      const { data: sellersData } = await supabase
        .from('sellers')
        .select(`
          id,
          name,
          seller_contacts (
            id,
            phone_number,
            description
          )
        `)
        .eq('team_id', team.id)
        .order('name');

      const mappedSellers = sellersData?.map(seller => ({
        ...seller,
        contacts: seller.seller_contacts || []
      })) || [];

      setSellers(mappedSellers);
    } catch (error) {
      console.error('Error fetching campaign data:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados da campanha.",
        variant: "destructive",
      });
      navigate('/campaigns');
    } finally {
      setIsLoading(false);
    }
  };

  const addContactToRotation = (contact: { id: string; phone_number: string; description?: string }, sellerName: string) => {
    const isAlreadySelected = selectedContacts.some(c => c.contactId === contact.id);
    if (isAlreadySelected) {
      toast({
        title: "Aviso",
        description: "Este contato já está na rotação.",
        variant: "destructive",
      });
      return;
    }

    setSelectedContacts(prev => [...prev, {
      contactId: contact.id,
      sellerName,
      phoneNumber: contact.phone_number,
      description: contact.description,
    }]);
  };

  const removeContactFromRotation = (contactId: string) => {
    setSelectedContacts(prev => prev.filter(c => c.contactId !== contactId));
  };

  const onSubmit = async (data: CampaignFormData) => {
    if (!user || !id) return;

    if (selectedContacts.length === 0) {
      toast({
        title: "Erro",
        description: "Selecione pelo menos um contato para a rotação.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);

      // Get user's team
      const { data: team } = await supabase
        .from('teams')
        .select('id')
        .eq('owner_id', user.id)
        .single();

      if (!team) {
        toast({
          title: "Erro",
          description: "Time não encontrado.",
          variant: "destructive",
        });
        return;
      }

      // Update campaign
      const { error: campaignError } = await supabase
        .from('campaigns')
        .update({
          name: data.name,
          slug: data.slug,
          greeting_message: data.greeting_message,
        })
        .eq('id', id)
        .eq('team_id', team.id);

      if (campaignError) {
        toast({
          title: "Erro",
          description: "Não foi possível atualizar a campanha.",
          variant: "destructive",
        });
        return;
      }

      // Delete existing campaign links
      const { error: deleteError } = await supabase
        .from('campaign_links')
        .delete()
        .eq('campaign_id', id);

      if (deleteError) {
        toast({
          title: "Erro",
          description: "Erro ao atualizar rotação.",
          variant: "destructive",
        });
        return;
      }

      // Create new campaign links
      const campaignLinks = selectedContacts.map((contact, index) => ({
        campaign_id: id,
        contact_id: contact.contactId,
        position: index + 1,
      }));

      const { error: linksError } = await supabase
        .from('campaign_links')
        .insert(campaignLinks);

      if (linksError) {
        toast({
          title: "Erro",
          description: "Erro ao criar rotação.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Sucesso",
        description: "Campanha atualizada com sucesso!",
      });

      navigate('/campaigns');
    } catch (error) {
      console.error('Error updating campaign:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao atualizar campanha.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="mb-6">
          <BackButton />
        </div>
        <div className="animate-pulse">
          <div className="h-8 bg-slate-200 rounded mb-4"></div>
          <div className="h-96 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="mb-6">
        <BackButton />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Editar Campanha</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da Campanha</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ex: Campanha Instagram"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug (URL)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ex: campanha-instagram"
                        {...field}
                        onChange={(e) => {
                          const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                          field.onChange(value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="greeting_message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mensagem de Saudação</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Ex: Vi seu anúncio no Instagram e gostaria de saber mais sobre seus produtos."
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Rotation Section */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium mb-2">Rotação de Vendedores</h3>
                  <p className="text-sm text-slate-600 mb-4">
                    Selecione os contatos que participarão da rotação desta campanha.
                  </p>
                </div>

                {/* Selected Contacts */}
                {selectedContacts.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Contatos Selecionados ({selectedContacts.length}):</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedContacts.map((contact, index) => (
                        <Badge key={contact.contactId} variant="default" className="px-3 py-1">
                          <span className="mr-2">
                            {index + 1}. {contact.sellerName} - {contact.phoneNumber}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeContactFromRotation(contact.contactId)}
                            className="ml-1 hover:bg-red-600 rounded-full p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Available Sellers */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">Vendedores Disponíveis:</h4>
                  {sellers.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      Nenhum vendedor encontrado. 
                      <a href="/sellers/new" className="text-blue-600 hover:underline ml-1">
                        Adicionar vendedor
                      </a>
                    </p>
                  ) : (
                    <div className="grid gap-3">
                      {sellers.map((seller) => (
                        <Card key={seller.id} className="p-3">
                          <div className="font-medium text-sm mb-2">{seller.name}</div>
                          {seller.contacts.length === 0 ? (
                            <p className="text-sm text-slate-500">Nenhum contato cadastrado</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {seller.contacts.map((contact) => (
                                <Button
                                  key={contact.id}
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => addContactToRotation(contact, seller.name)}
                                  className="text-xs"
                                  disabled={selectedContacts.some(c => c.contactId === contact.id)}
                                >
                                  <Plus className="w-3 h-3 mr-1" />
                                  {contact.phone_number}
                                  {contact.description && ` (${contact.description})`}
                                </Button>
                              ))}
                            </div>
                          )}
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/campaigns')}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};
