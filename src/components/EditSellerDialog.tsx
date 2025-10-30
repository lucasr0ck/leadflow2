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
import { ConfirmationDialog } from '@/components/ConfirmationDialog';

const sellerSchema = z.object({
  name: z.string().min(1, 'Nome do vendedor é obrigatório'),
  contacts: z.array(z.object({
    id: z.string().optional(),
    phone_number: z.string().min(1, 'Número de telefone é obrigatório'),
    description: z.string().optional(),
  })).min(0, 'Lista de contatos deve ser válida'),
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

// Type for the delete_contact_and_links RPC response
interface DeleteContactResponse {
  success: boolean;
  deleted_links_count?: number;
  message?: string;
}

export const EditSellerDialog = ({ seller, open, onOpenChange, onSellerUpdated }: EditSellerDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<{ id: string; index: number } | null>(null);
  const [isDeletingContact, setIsDeletingContact] = useState(false);

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
      const contactsData = seller.contacts.length > 0 
        ? seller.contacts.map(contact => ({
            id: contact.id,
            phone_number: contact.phone_number,
            description: contact.description || '',
          }))
        : [];
      
      form.reset({
        name: seller.name,
        contacts: contactsData,
      });
    } else if (!open) {
      // Clear form when dialog is closed
      form.reset({
        name: '',
        contacts: [],
      });
    }
  }, [seller, open, form]);

  const handleDeleteContact = (contactId: string, index: number) => {
    setContactToDelete({ id: contactId, index });
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteContact = async () => {
    if (!contactToDelete || !user) return;

    try {
      setIsDeletingContact(true);

      // Try to use the RPC function first
      const { data, error } = await supabase.rpc('delete_contact_and_links', {
        contact_id_to_delete: contactToDelete.id
      }) as { data: any; error: any };

      // RPC pode devolver objeto único ou array
      const payload: DeleteContactResponse | undefined = Array.isArray(data) ? data[0] : data;

      if (error || !payload || payload.success !== true) {
        // If RPC fails, try direct deletion
        console.log('RPC function failed, trying direct deletion...');
        
        const { error: deleteError } = await supabase
          .from('seller_contacts2')
          .delete()
          .eq('id', contactToDelete.id);

        if (deleteError) {
          toast({
            title: "Erro",
            description: "Não foi possível remover o contato.",
            variant: "destructive",
          });
          return;
        }

        toast({
          title: "Sucesso",
          description: "Contato removido com sucesso.",
        });
      } else {
        // RPC function worked
        const linksDeleted = payload.deleted_links_count || 0;
        toast({
          title: "Sucesso",
          description: `Contato removido com sucesso${linksDeleted > 0 ? ` (${linksDeleted} links de campanha também foram removidos)` : ''}.`,
        });
      }

      // Remove from form array immediately for visual feedback
      remove(contactToDelete.index);
      setDeleteConfirmOpen(false);
      setContactToDelete(null);

      // Refresh the parent component to sync with database
      onSellerUpdated();
    } catch (error) {
      console.error('Error deleting contact:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao remover contato.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingContact(false);
    }
  };

  const onSubmit = async (data: SellerFormData) => {
    if (!user || !seller) return;

    try {
      setIsSubmitting(true);

      // Update seller name
      const { error: sellerError } = await supabase
        .from('sellers2')
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

      // Update existing contacts and create new ones
      for (const contact of data.contacts) {
        if (contact.id) {
          // Update existing contact
          const { error: updateError } = await supabase
            .from('seller_contacts2')
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
            .from('seller_contacts2')
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
    <>
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

                {fields.length === 0 ? (
                  <div className="p-4 border rounded-lg text-center text-muted-foreground">
                    <p>Nenhum contato cadastrado. Este vendedor ficará ativo em prontidão, mas não receberá redirecionamentos.</p>
                    <p className="text-sm mt-2">Clique em "Adicionar Contato" para cadastrar um número de telefone.</p>
                  </div>
                ) : (
                  fields.map((field, index) => (
                    <div key={field.id} className="p-4 border rounded-lg space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">Contato {index + 1}</h4>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const contactData = form.getValues(`contacts.${index}`);
                            if (contactData.id) {
                              handleDeleteContact(contactData.id, index);
                            } else {
                              remove(index);
                            }
                          }}
                          className="text-red-600 hover:text-red-700"
                          disabled={isSubmitting || isDeletingContact}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
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
                  ))
                )}
              </div>

              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting || isDeletingContact}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || isDeletingContact}
                  className="flex-1"
                >
                  {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Confirmar Exclusão do Contato"
        description="Tem certeza que deseja excluir este contato? Esta ação também removerá todos os links de campanha associados e não pode ser desfeita."
        onConfirm={confirmDeleteContact}
        confirmText={isDeletingContact ? "Excluindo..." : "Excluir"}
        cancelText="Cancelar"
        variant="destructive"
      />
    </>
  );
};
