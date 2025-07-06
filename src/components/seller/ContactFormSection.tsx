
import { UseFormReturn } from 'react-hook-form';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { SellerFormData } from './SellerForm';

interface ContactFormSectionProps {
  index: number;
  form: UseFormReturn<SellerFormData>;
  onRemove: () => void;
  canRemove: boolean;
  isSubmitting: boolean;
}

export const ContactFormSection = ({ 
  index, 
  form, 
  onRemove, 
  canRemove, 
  isSubmitting 
}: ContactFormSectionProps) => {
  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium">Contato {index + 1}</h4>
          {canRemove && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRemove}
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
    </Card>
  );
};
