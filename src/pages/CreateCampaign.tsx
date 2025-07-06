import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

const campaignSchema = z.object({
  name: z.string().min(1, 'Nome da campanha é obrigatório'),
  slug: z.string().min(1, 'Slug é obrigatório').regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens'),
  greeting_message: z.string().min(1, 'Mensagem de saudação é obrigatória'),
});

type CampaignFormData = z.infer<typeof campaignSchema>;

export const CreateCampaign = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sellers, setSellers] = useState<SellerWithContacts[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CampaignFormData>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      name: '',
      slug: '',
      greeting_message: '',
    },
  });

  const onSubmit = async (data: CampaignFormData) => {
    if (!user) return;

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

      // Create campaign
      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .insert({
          name: data.name,
          slug: data.slug,
          greeting_message: data.greeting_message,
          team_id: team.id,
          is_active: true,
        })
        .select()
        .single();

      if (campaignError || !campaign) {
        toast({
          title: "Erro",
          description: "Não foi possível criar a campanha.",
          variant: "destructive",
        });
        return;
      }

      // Create campaign links
      const campaignLinks = data.contacts.map((contactData, index) => ({
        campaign_id: campaign.id,
        contact_id: contactData.contact_id,
        position: index,
      }));

      const { error: linksError } = await supabase
        .from('campaign_links')
        .insert(campaignLinks);

      if (linksError) {
        toast({
          title: "Erro",
          description: "Não foi possível criar os links da campanha.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Sucesso",
        description: "Campanha criada com sucesso!",
      });

      navigate('/campaigns');
    } catch (error) {
      console.error('Error creating campaign:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao criar campanha.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="mb-6">
        <BackButton />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Nova Campanha</CardTitle>
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
                  {isSubmitting ? 'Criando...' : 'Criar Campanha'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};
