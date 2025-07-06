
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { slug } = await req.json();
    
    if (!slug) {
      return new Response(
        JSON.stringify({ error: 'Slug is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Processing redirect for slug:', slug);

    // Get campaign by slug with greeting message
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, name, is_active, greeting_message')
      .eq('slug', slug)
      .single();

    if (campaignError || !campaign) {
      console.error('Campaign not found:', campaignError);
      return new Response(
        JSON.stringify({ error: 'Campaign not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Check if campaign is active
    if (!campaign.is_active) {
      console.log('Campaign is inactive:', campaign.id);
      return new Response(
        JSON.stringify({ error: 'Campaign is inactive' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get campaign links ordered by position with phone numbers
    const { data: campaignLinks, error: linksError } = await supabase
      .from('campaign_links')
      .select(`
        id,
        position,
        seller_contacts (
          phone_number
        )
      `)
      .eq('campaign_id', campaign.id)
      .order('position');

    if (linksError || !campaignLinks || campaignLinks.length === 0) {
      console.error('No campaign links found:', linksError);
      return new Response(
        JSON.stringify({ error: 'No campaign links found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get total clicks for this campaign to implement round-robin
    const { data: clicksData, error: clicksError } = await supabase
      .from('clicks')
      .select('id')
      .eq('campaign_id', campaign.id);

    if (clicksError) {
      console.error('Error fetching clicks count:', clicksError);
    }

    const totalClicks = clicksData?.length || 0;
    const numberOfLinks = campaignLinks.length;
    const nextIndex = totalClicks % numberOfLinks;
    const selectedLink = campaignLinks[nextIndex];

    console.log(`Round-robin: totalClicks=${totalClicks}, numberOfLinks=${numberOfLinks}, nextIndex=${nextIndex}`);

    // Log the click asynchronously (don't wait for it)
    supabase
      .from('clicks')
      .insert({
        campaign_id: campaign.id,
        campaign_link_id: selectedLink.id
      })
      .then(({ error }) => {
        if (error) {
          console.error('Error logging click:', error);
        } else {
          console.log('Click logged successfully');
        }
      });

    const phoneNumber = selectedLink.seller_contacts?.phone_number;
    
    if (!phoneNumber) {
      console.error('No phone number found for selected link');
      return new Response(
        JSON.stringify({ error: 'Invalid contact configuration' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Construct WhatsApp URL with encoded greeting message
    const greetingMessage = campaign.greeting_message || 'Olá! Gostaria de mais informações.';
    const encodedMessage = encodeURIComponent(greetingMessage);
    const redirectUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;

    console.log('Redirecting to:', redirectUrl);

    return new Response(
      JSON.stringify({ redirectUrl }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Redirect handler error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
