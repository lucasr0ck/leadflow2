
import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

const sellerSchema = z.object({
  name: z.string().min(1, 'Nome do vendedor é obrigatório'),
  contacts: z.array(z.object({
    id: z.string().optional(),
    phone_number: z.string().min(1, 'Número de telefone é obrigatório'),
    description: z.string().optional(),
  })).min(1, 'Pelo menos um contato é obrigatório'),
});

type SellerFormData = z.infer<typeof sellerSchema>;

interface Seller {
  id: string;
  name: string;
  contacts: Array<{
    id: string;
    phone_number: string;
    description: string | null;
  }>;
}

interface EditSellerDialogProps {
  seller: Seller | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSellerUpdated: () => void;
}

export const EditSellerDialog = ({ seller, open, onOpenChange, onSellerUpdated }: EditSellerDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  useEffect(() => {
    if (seller && open) {
      form.reset({
        name: seller.name,
        contacts: seller.contacts.length > 0 
          ? seller.contacts.map(contact => ({
              id: contact.id,
              phone_number: contact.phone_number,
              description: contact.description || '',
            }))
          : [{ phone_number: '', description: '' }],
      });
    }
  }, [seller, open, form]);

  const onSubmit = async (data: SellerFormData) => {
    if (!user || !seller) return;

    try {
      setIsSubmitting(true);

      // Update seller name
      const { error: sellerError } = await supabase
        .from('sellers')
        .update({ name: data.name })
        .eq('id', seller.id);

      if (sellerError) {
        toast({
          title: "Erro",
          description: "Não foi possível atualizar o vendedor.",
          variant: "destructive",
        });
        return;
      }

      // Get existing contacts to determine which to update/delete/create
      const existingContacts = seller.contacts;
      const newContacts = data.contacts;

      // Delete contacts that are no longer present
      const contactsToDelete = existingContacts.filter(
        existing => !newContacts.find(newContact => newContact.id === existing.id)
      );

      if (contactsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('seller_contacts')
          .delete()
          .in('id', contactsToDelete.map(c => c.id));

        if (deleteError) {
          console.error('Error deleting contacts:', deleteError);
        }
      }

      // Update existing contacts and create new ones
      for (const contact of newContacts) {
        if (contact.id) {
          // Update existing contact
          const { error: updateError } = await supabase
            .from('seller_contacts')
            .update({
              phone_number: contact.phone_number,
              description: contact.description || null,
            })
            .eq('id', contact.id);

          if (updateError) {
            console.error('Error updating contact:', updateError);
          }
        } else {
          // Create new contact
          const { error: createError } = await supabase
            .from('seller_contacts')
            .insert({
              seller_id: seller.id,
              phone_number: contact.phone_number,
              description: contact.description || null,
            });

          if (createError) {
            console.error('Error creating contact:', createError);
          }
        }
      }

      toast({
        title: "Sucesso",
        description: "Vendedor atualizado com sucesso!",
      });

      onSellerUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating seller:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao atualizar vendedor.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Vendedor</DialogTitle>
        </DialogHeader>
        
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
                  disabled={isSubmitting}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Contato
                </Button>
              </div>

              {fields.map((field, index) => (
                <div key={field.id} className="p-4 border rounded-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Contato {index + 1}</h4>
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(index)}
                        className="text-red-600 hover:text-red-700"
                        disabled={isSubmitting}
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
              ))}
            </div>

            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
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
      </DialogContent>
    </Dialog>
  );
};
