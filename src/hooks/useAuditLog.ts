import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AuditActionType, AuditEntityType } from '@/types/database';

interface LogAuditParams {
  action_type: AuditActionType;
  entity_type?: AuditEntityType;
  entity_id?: string;
  old_value?: Record<string, any>;
  new_value?: Record<string, any>;
  metadata?: Record<string, any>;
}

export const useAuditLog = () => {
  const logAudit = useCallback(async (params: LogAuditParams) => {
    try {
      // Get user agent and attempt to get IP address
      const userAgent = navigator.userAgent;
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      // Insert audit log
      const { error } = await supabase.from('audit_logs').insert({
        user_id: user?.id || null,
        action_type: params.action_type,
        entity_type: params.entity_type || null,
        entity_id: params.entity_id || null,
        old_value: params.old_value || null,
        new_value: params.new_value || null,
        user_agent: userAgent,
        metadata: params.metadata || null,
      });

      if (error) {
        console.error('Error logging audit:', error);
      }
    } catch (error) {
      console.error('Error in audit log:', error);
    }
  }, []);

  return { logAudit };
};
