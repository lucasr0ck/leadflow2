
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { BackButton } from '@/components/BackButton';

const sellerSchema = z.object({
  name: z.string().min(1, 'Nome do vendedor é obrigatório'),
  contacts: z.array(z.object({
    phone_number: z.string().min(1, 'Número de telefone é obrigatório'),
    description: z.string().optional(),
  })).min(1, 'Pelo menos um contato é obrigatório'),
});

type SellerFormData = z.infer<typeof sellerSchema>;

export const CreateSeller = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const form = useForm<SellerFormData>({
    resolver: zodResolver(sellerSchema),
    defaultValues: {
      name: '',
      contacts: [{ phone_number: '', description: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'contacts',
  });

  const onSubmit = async (data: SellerFormData) => {
    if (!user) return;

    try {
      setLoading(true);

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

      // Create seller
      const { data: seller, error: sellerError } = await supabase
        .from('sellers')
        .insert({
          name: data.name,
          team_id: team.id,
        })
        .select()
        .single();

      if (sellerError || !seller) {
        toast({
          title: "Erro",
          description: "Não foi possível criar o vendedor.",
          variant: "destructive",
        });
        return;
      }

      // Create contacts
      const contacts = data.contacts.map(contact => ({
        seller_id: seller.id,
        phone_number: contact.phone_number,
        description: contact.description || null,
      }));

      const { error: contactsError } = await supabase
        .from('seller_contacts')
        .insert(contacts);

      if (contactsError) {
        toast({
          title: "Erro",
          description: "Não foi possível criar os contatos.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Sucesso",
        description: "Vendedor criado com sucesso!",
      });

      navigate('/sellers');
    } catch (error) {
      console.error('Error creating seller:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao criar vendedor.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      <div className="mb-6">
        <BackButton />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Novo Vendedor</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Vendedor</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ex: João Silva"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <FormLabel>Contatos</FormLabel>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ phone_number: '', description: '' })}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Contato
                  </Button>
                </div>

                {fields.map((field, index) => (
                  <Card key={field.id} className="p-4">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">Contato {index + 1}</h4>
                        {fields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => remove(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>

                      <FormField
                        control={form.control}
                        name={`contacts.${index}.phone_number`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Número de Contato</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Ex: 5511999998888"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`contacts.${index}.description`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Descrição (Opcional)</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Ex: WhatsApp pessoal"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </Card>
                ))}
              </div>

              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/sellers')}
                  disabled={loading}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? 'Criando...' : 'Criar Vendedor'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};
