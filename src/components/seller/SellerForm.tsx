
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { ContactFormSection } from './ContactFormSection';

const sellerSchema = z.object({
  name: z.string().min(1, 'Nome do vendedor é obrigatório'),
  contacts: z.array(z.object({
    phone_number: z.string().min(1, 'Número de telefone é obrigatório'),
    description: z.string().optional(),
  })).min(1, 'Pelo menos um contato é obrigatório'),
});

export type SellerFormData = z.infer<typeof sellerSchema>;

interface SellerFormProps {
  onSubmit: (data: SellerFormData) => void;
  isSubmitting: boolean;
  onCancel: () => void;
  defaultValues?: Partial<SellerFormData>;
}

export const SellerForm = ({ onSubmit, isSubmitting, onCancel, defaultValues }: SellerFormProps) => {
  const form = useForm<SellerFormData>({
    resolver: zodResolver(sellerSchema),
    defaultValues: {
      name: defaultValues?.name || '',
      contacts: defaultValues?.contacts || [{ phone_number: '', description: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'contacts',
  });

  return (
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
            <ContactFormSection
              key={field.id}
              index={index}
              form={form}
              onRemove={() => remove(index)}
              canRemove={fields.length > 1}
              isSubmitting={isSubmitting}
            />
          ))}
        </div>

        <div className="flex gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
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
            {isSubmitting ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Form>
  );
};
