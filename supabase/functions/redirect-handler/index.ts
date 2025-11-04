
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

    console.log(`[${new Date().toISOString()}] Processing full_slug: ${slug}`)

    // Get campaign by full_slug (multi-tenant unified table)
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, greeting_message, team_id, is_active')
      .eq('full_slug', slug)
      .single()

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

    // Get sellers with contacts
    const { data: sellers, error: sellersError } = await supabase
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

    if (sellersError || !sellers || sellers.length === 0) {
      console.error('No sellers found:', sellersError)
      return new Response(
        JSON.stringify({ error: 'No sellers available' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
      )
    }

    // Get total clicks for this campaign
    const { count: clickCount } = await supabase
      .from('clicks')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id)

    console.log(`Total clicks: ${clickCount || 0}`)

    // Simple round-robin: select seller by click count
    const sellerIndex = (clickCount || 0) % sellers.length
    const selectedSeller = sellers[sellerIndex]
    
    console.log(`Selected seller: ${selectedSeller.name} (index: ${sellerIndex}/${sellers.length})`)

    // Get this seller's click count
    const { count: sellerClickCount } = await supabase
      .from('clicks')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id)
      .eq('seller_id', selectedSeller.id)

    console.log(`Seller clicks: ${sellerClickCount || 0}`)

    // Select contact by seller's click count
    const contacts = selectedSeller.seller_contacts || []
      
    if (contacts.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No contacts available' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
      )
    }

    const contactIndex = (sellerClickCount || 0) % contacts.length
    const selectedContact = contacts[contactIndex]
    
    console.log(`Selected contact: ${selectedContact.phone_number} (index: ${contactIndex}/${contacts.length})`)

    // Record the click
    const { error: insertError } = await supabase
      .from('clicks')
      .insert({
        campaign_id: campaign.id,
        seller_id: selectedSeller.id,
        team_id: campaign.team_id
      })

    if (insertError) {
      console.error('Error recording click:', insertError)
    } else {
      console.log('Click recorded successfully')
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
