import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface HealthCheckProps {
  isVisible?: boolean;
}

export const SupabaseHealthCheck: React.FC<HealthCheckProps> = ({ isVisible = false }) => {
  const [status, setStatus] = useState<'checking' | 'healthy' | 'error'>('checking');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isVisible) return;

    const checkHealth = async () => {
      try {
        console.log('Performing Supabase health check...');
        
        // Try to get the current session
        const { data, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Session check failed:', sessionError);
          setError(sessionError.message);
          setStatus('error');
          return;
        }

        // Try a simple query to test the connection
        const { error: queryError } = await supabase
          .from('campaigns')
          .select('id')
          .limit(1);

        if (queryError) {
          console.error('Query check failed:', queryError);
          setError(queryError.message);
          setStatus('error');
          return;
        }

        console.log('Supabase health check passed');
        setStatus('healthy');
      } catch (err) {
        console.error('Health check failed:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setStatus('error');
      }
    };

    checkHealth();
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '10px',
      right: '10px',
      background: status === 'healthy' ? 'rgba(0, 255, 0, 0.8)' : 
                 status === 'error' ? 'rgba(255, 0, 0, 0.8)' : 
                 'rgba(255, 165, 0, 0.8)',
      color: 'white',
      padding: '10px',
      borderRadius: '5px',
      fontSize: '12px',
      fontFamily: 'monospace',
      zIndex: 9999,
      maxWidth: '300px',
    }}>
      <div style={{ marginBottom: '5px', fontWeight: 'bold' }}>
        Supabase Health: {status}
      </div>
      {error && (
        <div style={{ fontSize: '10px', marginTop: '5px' }}>
          Error: {error}
        </div>
      )}
    </div>
  );
}; 