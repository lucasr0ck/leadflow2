import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';

const teamSchema = z.object({
  name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  slug: z
    .string()
    .min(3, 'Slug deve ter no mínimo 3 caracteres')
    .regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens')
    .refine((slug) => !slug.startsWith('-') && !slug.endsWith('-'), {
      message: 'Slug não pode começar ou terminar com hífen',
    }),
  description: z.string().optional(),
});

type TeamFormData = z.infer<typeof teamSchema>;

interface CreateTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const CreateTeamDialog = ({ open, onOpenChange, onSuccess }: CreateTeamDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<TeamFormData>({
    resolver: zodResolver(teamSchema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
    },
  });

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^a-z0-9\s-]/g, '') // Remove caracteres especiais
      .trim()
      .replace(/\s+/g, '-') // Substitui espaços por hífens
      .replace(/-+/g, '-'); // Remove hífens duplicados
  };

  const handleNameChange = (name: string) => {
    form.setValue('name', name);
    if (!form.formState.dirtyFields.slug) {
      form.setValue('slug', generateSlug(name));
    }
  };

  const onSubmit = async (data: TeamFormData) => {
    if (!user) return;

    try {
      setIsSubmitting(true);

      // Check if slug already exists
      const { data: existingTeam } = await supabase
        .from('teams')
        .select('id')
        .eq('slug', data.slug)
        .single();

      if (existingTeam) {
        form.setError('slug', {
          message: 'Este slug já está em uso. Escolha outro.',
        });
        return;
      }

      // Create team
      const { data: newTeam, error: teamError } = await supabase
        .from('teams')
        .insert({
          team_name: data.name,
          slug: data.slug,
          description: data.description || null,
          owner_id: user.id,
          is_active: true,
        })
        .select()
        .single();

      if (teamError) {
        console.error('Error creating team:', teamError);
        toast({
          title: 'Erro',
          description: 'Não foi possível criar a operação.',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Sucesso',
        description: `Operação "${data.name}" criada com sucesso!`,
      });

      form.reset();
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error creating team:', error);
      toast({
        title: 'Erro',
        description: 'Erro inesperado ao criar operação.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Nova Operação</DialogTitle>
          <DialogDescription>
            Crie uma nova operação para gerenciar campanhas e vendedores separadamente.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Operação</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: Imobiliária Premium"
                      {...field}
                      onChange={(e) => handleNameChange(e.target.value)}
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
                    <Input placeholder="imobiliaria-premium" {...field} />
                  </FormControl>
                  <FormDescription>
                    Usado nos links de campanha: /r/slug-campanha
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descreva o propósito desta operação..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Criando...' : 'Criar Operação'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
