
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
    // Get slug from request
    let slug: string | null = null
    try {
      const body = await req.json()
      slug = body?.slug ?? null
    } catch (_) {
      const url = new URL(req.url)
      slug = url.searchParams.get('slug')
    }
    
    if (!slug) {
      return new Response(
        JSON.stringify({ error: 'Slug is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log(`[${new Date().toISOString()}] Processing slug: ${slug}`)

    // Determine which application by checking which table contains the campaign
    let isLeadflow2 = false
    let campaign = null
    let campaignError = null

    // First try campaigns2 table (leadflow2)
    const { data: campaign2, error: campaignError2 } = await supabase
      .from('campaigns2')
      .select('id, greeting_message, team_id, is_active')
      .eq('slug', slug)
      .single()

    if (campaign2) {
      isLeadflow2 = true
      campaign = campaign2
      console.log(`Campaign found in campaigns2 - using LeadFlow2 tables`)
    } else {
      // Try original campaigns table (leadflow original)
      const { data: campaignOriginal, error: campaignErrorOriginal } = await supabase
        .from('campaigns')
        .select('id, greeting_message, team_id, is_active')
        .eq('slug', slug)
        .single()
      
      campaign = campaignOriginal
      campaignError = campaignErrorOriginal
      console.log(`Campaign found in campaigns - using original tables`)
    }

    if (campaignError || !campaign) {
      console.error('Campaign not found:', campaignError)
      return new Response(
        JSON.stringify({ error: 'Campaign not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
      )
    }

    if (!campaign.is_active) {
      return new Response(
        JSON.stringify({ error: 'Campaign is not active' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
      )
    }

    // Get sellers with contacts from correct tables
    let sellers = null
    let sellersError = null
    
    if (isLeadflow2) {
      const { data: sellers2, error: sellersError2 } = await supabase
        .from('sellers2')
        .select(`
          id,
          name,
          weight,
          seller_contacts2 (
            id,
            phone_number,
            description
          )
        `)
        .eq('team_id', campaign.team_id)
        .order('created_at', { ascending: true })

      sellers = sellers2
      sellersError = sellersError2
    } else {
      const { data: sellersOriginal, error: sellersErrorOriginal } = await supabase
        .from('sellers')
        .select(`
          id,
          name,
          weight,
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
    }

    if (sellersError || !sellers || sellers.length === 0) {
      console.error('No sellers found:', sellersError)
      return new Response(
        JSON.stringify({ error: 'No sellers available' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
      )
    }

    // Get total clicks for this campaign from correct table
    let clickCount = 0
    if (isLeadflow2) {
      const { count: totalClicks2 } = await supabase
        .from('clicks2')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id)
      clickCount = totalClicks2 || 0
    } else {
      const { count: totalClicks } = await supabase
        .from('clicks')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id)
      clickCount = totalClicks || 0
    }

    console.log(`Total clicks (${isLeadflow2 ? 'clicks2' : 'clicks'}): ${clickCount}`)

    // Simple round-robin: select seller by click count
    const sellerIndex = clickCount % sellers.length
    const selectedSeller = sellers[sellerIndex]
    
    console.log(`Selected seller: ${selectedSeller.name} (index: ${sellerIndex}/${sellers.length})`)

    // Get this seller's click count from correct table
    let sellerClickCount = 0
    if (isLeadflow2) {
      const { count: sellerClicks2 } = await supabase
        .from('clicks2')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id)
        .eq('seller_id', selectedSeller.id)
      sellerClickCount = sellerClicks2 || 0
    } else {
      const { count: sellerClicks } = await supabase
        .from('clicks')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id)
        .eq('seller_id', selectedSeller.id)
      sellerClickCount = sellerClicks || 0
    }

    console.log(`Seller clicks: ${sellerClickCount}`)

    // Select contact by seller's click count
    const contacts = isLeadflow2 ? 
      (selectedSeller.seller_contacts2 || []) : 
      (selectedSeller.seller_contacts || [])
      
    if (contacts.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No contacts available' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
      )
    }

    const contactIndex = sellerClickCount % contacts.length
    const selectedContact = contacts[contactIndex]
    
    console.log(`Selected contact: ${selectedContact.phone_number} (index: ${contactIndex}/${contacts.length})`)

    // Record the click in correct table
    let insertError = null
    if (isLeadflow2) {
      const { error } = await supabase
        .from('clicks2')
        .insert({
          campaign_id: campaign.id,
          seller_id: selectedSeller.id
        })
      insertError = error
    } else {
      const { error } = await supabase
        .from('clicks')
        .insert({
          campaign_id: campaign.id,
          seller_id: selectedSeller.id
        })
      insertError = error
    }

    if (insertError) {
      console.error(`Error recording click in ${isLeadflow2 ? 'clicks2' : 'clicks'}:`, insertError)
    } else {
      console.log(`Click recorded successfully in ${isLeadflow2 ? 'clicks2' : 'clicks'}`)
    }

    // Generate WhatsApp URL
    const encodedMessage = encodeURIComponent(campaign.greeting_message || '')
    const sanitizedPhone = String(selectedContact.phone_number).replace(/\D/g, '')
    const redirectUrl = `https://wa.me/${sanitizedPhone}?text=${encodedMessage}`

    console.log(`Redirecting to: ${redirectUrl}`)

    return new Response(
      JSON.stringify({ redirectUrl }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    )
  }
})
