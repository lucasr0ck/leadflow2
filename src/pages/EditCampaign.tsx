
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
import { SellerRotationManager } from '@/components/campaigns/SellerRotationManager';

const campaignSchema = z.object({
  name: z.string().min(1, 'Nome da campanha é obrigatório'),
  slug: z.string().min(1, 'Slug é obrigatório').regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens'),
  greeting_message: z.string().min(1, 'Mensagem de saudação é obrigatória'),
});

type CampaignFormData = z.infer<typeof campaignSchema>;

interface RotationEntry {
  sellerId: string;
  sellerName: string;
  repetitions: number;
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
  const [rotation, setRotation] = useState<RotationEntry[]>([]);

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

      // Convert campaign links to rotation entries
      const campaignLinks = campaign.campaign_links as CampaignLink[];
      const sellerCounts: { [sellerId: string]: { name: string; count: number } } = {};
      
      campaignLinks.forEach(link => {
        const sellerId = link.seller_contacts.sellers.id;
        const sellerName = link.seller_contacts.sellers.name;
        
        if (sellerCounts[sellerId]) {
          sellerCounts[sellerId].count++;
        } else {
          sellerCounts[sellerId] = { name: sellerName, count: 1 };
        }
      });

      const rotationEntries: RotationEntry[] = Object.entries(sellerCounts).map(([sellerId, data]) => ({
        sellerId,
        sellerName: data.name,
        repetitions: data.count,
      }));

      setRotation(rotationEntries);
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


  const onSubmit = async (data: CampaignFormData) => {
    if (!user || !id) return;

    if (rotation.length === 0) {
      toast({
        title: "Erro",
        description: "Adicione pelo menos um vendedor à rotação.",
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

      // Create fair campaign distribution using the new database function
      const sellerRepetitions = rotation.map(entry => ({
        seller_id: entry.sellerId,
        repetitions: entry.repetitions
      }));

      const { data: distributionResult, error: distributionError } = await supabase
        .rpc('create_campaign_distribution', {
          campaign_id_param: id!,
          seller_repetitions: sellerRepetitions
        });

      if (distributionError || !distributionResult?.[0]?.success) {
        toast({
          title: "Erro",
          description: "Erro ao atualizar rotação.",
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

              {/* Seller Rotation Section */}
              <SellerRotationManager 
                rotation={rotation}
                onRotationChange={setRotation}
              />

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
                  disabled={isSubmitting || rotation.length === 0}
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
