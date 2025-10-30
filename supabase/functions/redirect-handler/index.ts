
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
    // Accept slug from JSON body or query string for easier testing
    let slug: string | null = null
    try {
      const body = await req.json()
      slug = body?.slug ?? null
    } catch (_) {
      // no-op, fall back to query param
    }
    if (!slug) {
      const url = new URL(req.url)
      slug = url.searchParams.get('slug')
    }
    
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

    // Step 1: Try both campaign table versions for compatibility
    let campaign = null
    let campaignError = null
    
    // First try the new table (campaigns2)
    const { data: campaign2, error: campaignError2 } = await supabase
      .from('campaigns2')
      .select('id, greeting_message, team_id, is_active')
      .eq('slug', slug)
      .single()

    if (campaign2) {
      campaign = campaign2
    } else {
      // Fallback to original table (campaigns)
      const { data: campaignOriginal, error: campaignErrorOriginal } = await supabase
        .from('campaigns')
        .select('id, greeting_message, team_id, is_active')
        .eq('slug', slug)
        .single()
      
      campaign = campaignOriginal
      campaignError = campaignErrorOriginal
    }

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
    // Try both table versions for compatibility
    let sellers = null
    let sellersError = null
    
    // First try the new tables (leadflow2)
    const { data: sellers2, error: sellersError2 } = await supabase
      .from('sellers2')
      .select(`
        id,
        name,
        weight,
        created_at,
        seller_contacts2 (
          id,
          phone_number,
          description
        )
      `)
      .eq('team_id', campaign.team_id)
      .order('created_at', { ascending: true })

    if (sellers2 && sellers2.length > 0) {
      sellers = sellers2
      // Normalize the contact relation name
      sellers = sellers.map(seller => ({
        ...seller,
        contacts: seller.seller_contacts2 || []
      }))
    } else {
      // Fallback to original tables (leadflow original)
      const { data: sellersOriginal, error: sellersErrorOriginal } = await supabase
        .from('sellers')
        .select(`
          id,
          name,
          weight,
          created_at,
          seller_contacts (
            id,
            phone_number,
            description
          )
        `)
        .eq('team_id', campaign.team_id)
        .order('created_at', { ascending: true })
      
      sellers = sellersOriginal
      sellersError = sellersErrorOriginal
      // Normalize the contact relation name
      if (sellers) {
        sellers = sellers.map(seller => ({
          ...seller,
          contacts: seller.seller_contacts || []
        }))
      }
    }

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

    // Step 4: Get total clicks for this campaign (try both tables)
    let clickCount = 0
    
    // Try clicks2 first
    const { count: totalClicks2 } = await supabase
      .from('clicks2')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id)
    
    if (totalClicks2 && totalClicks2 > 0) {
      clickCount = totalClicks2
    } else {
      // Fallback to clicks
      const { count: totalClicks } = await supabase
        .from('clicks')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id)
      clickCount = totalClicks || 0
    }

    console.log(`Total clicks for campaign: ${clickCount}`)

    // Step 5: Determine the next seller using round-robin on the virtual wheel
    const nextSellerIndex = clickCount % virtualWheel.length
    const targetSeller = virtualWheel[nextSellerIndex]

    console.log(`Selected seller: ${targetSeller.name} (index: ${nextSellerIndex})`)

    // Step 6: Get this seller's click count (try both tables)
    let sellerClickCount = 0
    
    // Try clicks2 first
    const { count: sellerClicks2 } = await supabase
      .from('clicks2')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id)
      .eq('seller_id', targetSeller.id)
    
    if (sellerClicks2 && sellerClicks2 > 0) {
      sellerClickCount = sellerClicks2
    } else {
      // Fallback to clicks
      const { count: sellerClicks } = await supabase
        .from('clicks')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id)
        .eq('seller_id', targetSeller.id)
      sellerClickCount = sellerClicks || 0
    }
    
    // Step 7: Select the contact using round-robin within the seller's contacts
    const contacts = targetSeller.contacts
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

    // Step 8: Record the click (try both tables)
    // Try clicks2 first
    const { error: insertError2 } = await supabase
      .from('clicks2')
      .insert({
        campaign_id: campaign.id,
        seller_id: targetSeller.id,
        contact_phone: targetContact.phone_number
      })
    
    if (insertError2) {
      // Fallback to clicks table
      const { error: insertError } = await supabase
        .from('clicks')
        .insert({
          campaign_id: campaign.id,
          seller_id: targetSeller.id,
          contact_phone: targetContact.phone_number
        })
      
      if (insertError) {
        console.error('Error recording click in both tables:', insertError2, insertError)
        // Continue anyway - don't block the redirect for analytics
      }
    }    // Step 9: Construct WhatsApp URL
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
