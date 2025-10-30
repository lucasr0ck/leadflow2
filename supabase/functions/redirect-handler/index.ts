
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { slug } = await req.json()
    
    if (!slug) {
      return new Response(
        JSON.stringify({ error: 'Slug is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log(`[${new Date().toISOString()}] Processing redirect for slug: ${slug}`)

    // Step 1: Fetch campaign and validate it's active
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns2')
      .select('id, greeting_message, team_id, is_active')
      .eq('slug', slug)
      .single()

    if (campaignError || !campaign) {
      console.error('Campaign not found:', campaignError)
      return new Response(
        JSON.stringify({ error: 'Campaign not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (!campaign.is_active) {
      console.error('Campaign is not active:', campaign.id)
      return new Response(
        JSON.stringify({ error: 'Campaign is not active' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Step 2: Fetch all sellers for this team with their contacts and weights
    const { data: sellers, error: sellersError } = await supabase
      .from('sellers2')
      .select(`
        id,
        name,
        weight,
        created_at,
        seller_contacts2!inner (
          id,
          phone_number,
          description
        )
      `)
      .eq('team_id', campaign.team_id)
      .order('created_at', { ascending: true }) // Consistent ordering for deterministic distribution

    if (sellersError || !sellers || sellers.length === 0) {
      console.error('No sellers found for team:', sellersError)
      return new Response(
        JSON.stringify({ error: 'No sellers available for this campaign' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Step 3: Build the virtual weighted wheel
    const virtualWheel = []
    for (const seller of sellers) {
      // Add each seller to the wheel according to their weight
      for (let i = 0; i < seller.weight; i++) {
        virtualWheel.push(seller)
      }
    }

    console.log(`Virtual wheel created with ${virtualWheel.length} slots for ${sellers.length} sellers`)

    // Step 4: Get total clicks for this campaign to determine next seller
    const { count: totalClicks, error: clicksError } = await supabase
      .from('clicks2')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id)

    if (clicksError) {
      console.error('Error fetching clicks count:', clicksError)
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const clickCount = totalClicks || 0
    console.log(`Total clicks for campaign: ${clickCount}`)

    // Step 5: Determine the next seller using round-robin on the virtual wheel
    const nextSellerIndex = clickCount % virtualWheel.length
    const targetSeller = virtualWheel[nextSellerIndex]

    console.log(`Selected seller: ${targetSeller.name} (index: ${nextSellerIndex})`)

    // Step 6: Get this seller's click count to determine which contact to use
    const { count: sellerClicks, error: sellerClicksError } = await supabase
      .from('clicks2')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id)
      .eq('seller_id', targetSeller.id)

    if (sellerClicksError) {
      console.error('Error fetching seller clicks count:', sellerClicksError)
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const sellerClickCount = sellerClicks || 0
    
    // Step 7: Select the contact using round-robin within the seller's contacts
    // Supabase retorna a relação como "seller_contacts2" após a mudança de tabela
    const contacts = (targetSeller as any).seller_contacts2
    if (!contacts || contacts.length === 0) {
      console.error('No contacts found for seller:', targetSeller.id)
      return new Response(
        JSON.stringify({ error: 'No contacts available for selected seller' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

  const nextContactIndex = sellerClickCount % contacts.length
  const targetContact = contacts[nextContactIndex]

    console.log(`Selected contact: ${targetContact.phone_number} (seller clicks: ${sellerClickCount}, contact index: ${nextContactIndex})`)

    // Step 8: Log the click asynchronously
    const logClick = async () => {
      try {
        const { error: logError } = await supabase
          .from('clicks2')
          .insert({
            campaign_id: campaign.id,
            seller_id: targetSeller.id
          })

        if (logError) {
          console.error('Error logging click:', logError)
        } else {
          console.log('Click logged successfully')
        }
      } catch (error) {
        console.error('Unexpected error logging click:', error)
      }
    }

    // Start logging in background
    logClick()

    // Step 9: Construct WhatsApp URL
  const encodedMessage = encodeURIComponent(campaign.greeting_message || '')
  // Sanitize phone number to keep only digits (format required by wa.me)
  const sanitizedPhone = String(targetContact.phone_number).replace(/\D/g, '')
  const redirectUrl = `https://wa.me/${sanitizedPhone}?text=${encodedMessage}`

    console.log(`Redirecting to: ${redirectUrl}`)

    return new Response(
      JSON.stringify({ redirectUrl }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Unexpected error in redirect handler:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
