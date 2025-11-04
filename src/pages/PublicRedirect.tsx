
import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export const PublicRedirect = () => {
  // slug format: "team-slug-campaign-slug" (full_slug from campaigns table)
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (slug) {
      handleRedirect();
    }
  }, [slug]);

  const handleRedirect = async () => {
    try {
      // Call the edge function to handle the redirect logic
      const { data, error } = await supabase.functions.invoke('redirect-handler', {
        body: { slug }
      });

      if (error) {
        console.error('Error calling redirect function:', error);
        // Redirect to a default error page or home
        window.location.href = '/';
        return;
      }

      if (data?.redirectUrl) {
        // Redirect to the WhatsApp URL
        window.location.href = data.redirectUrl;
      } else {
        // Redirect to home if no URL found
        window.location.href = '/';
      }
    } catch (error) {
      console.error('Redirect error:', error);
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2D9065] mx-auto mb-4"></div>
        <p className="text-slate-600">Redirecionando...</p>
      </div>
    </div>
  );
};
