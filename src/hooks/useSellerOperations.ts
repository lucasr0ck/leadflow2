
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { SellerFormData } from '@/components/seller/SellerForm';

export const useSellerOperations = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createSeller = async (data: SellerFormData) => {
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
      setIsSubmitting(false);
    }
  };

  return {
    createSeller,
    isSubmitting,
  };
};
