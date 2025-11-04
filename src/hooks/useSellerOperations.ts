
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { useToast } from '@/hooks/use-toast';
import { SellerFormData } from '@/components/seller/SellerForm';
import { useAuditLog } from '@/hooks/useAuditLog';

export const useSellerOperations = () => {
  const { user } = useAuth();
  const { currentTeam } = useTeam();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { logAudit } = useAuditLog();

  const createSeller = async (data: SellerFormData) => {
    if (!user || !currentTeam) return;

    try {
      setIsSubmitting(true);

      // Create seller
      const { data: seller, error: sellerError } = await supabase
        .from('sellers')
        .insert({
          name: data.name,
          team_id: currentTeam.team_id,
          weight: 1,
        })
        .select()
        .single();

      if (sellerError || !seller) {
        console.error('Error creating seller:', sellerError);
        toast({
          title: "Erro",
          description: sellerError?.message || "Não foi possível criar o vendedor.",
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
        console.error('Error creating contacts:', contactsError);
        toast({
          title: "Erro",
          description: contactsError?.message || "Não foi possível criar os contatos.",
          variant: "destructive",
        });
        return;
      }

      // Log seller creation audit
      await logAudit({
        action_type: 'create',
        entity_type: 'seller',
        entity_id: seller.id,
        new_value: {
          name: seller.name,
          weight: seller.weight,
          contacts_count: contacts.length,
        },
        metadata: {
          seller_name: seller.name,
          team_id: currentTeam.team_id,
        }
      });

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
