
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
    // First get the slug to determine which application we're dealing with
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
    } else {
      // Try original campaigns table (leadflow original)
      const { data: campaignOriginal, error: campaignErrorOriginal } = await supabase
        .from('campaigns')
        .select('id, greeting_message, team_id, is_active')
        .eq('slug', slug)
        .single()
      
      campaign = campaignOriginal
      campaignError = campaignErrorOriginal
    }

    console.log(`[${new Date().toISOString()}] Processing redirect for slug: ${slug}, detected as ${isLeadflow2 ? 'leadflow2' : 'original'} application`)

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

    // Step 2: Fetch all sellers for this team with their contacts and weights from correct tables
    let sellers = null
    let sellersError = null
    
    if (isLeadflow2) {
      // Use new tables for leadflow2 application
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

      sellers = sellers2
      sellersError = sellersError2
      // Normalize the contact relation name
      if (sellers) {
        sellers = sellers.map(seller => ({
          ...seller,
          contacts: seller.seller_contacts2 || []
        }))
      }
    } else {
      // Use original tables for original application
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
    
    // Log detailed seller information
    sellers.forEach(seller => {
      console.log(`Seller: ${seller.name}, Weight: ${seller.weight}, Contacts: ${seller.contacts?.length || 0}, Slots in wheel: ${seller.weight}`)
    })

    // Step 4: Get total clicks for this campaign from the correct table
    let clickCount = 0
    let clicksError = null
    
    if (isLeadflow2) {
      // Use clicks2 table for leadflow2 application
      const { count: totalClicks2, error: clicksError2 } = await supabase
        .from('clicks2')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id)
      
      clickCount = totalClicks2 || 0
      clicksError = clicksError2
    } else {
      // Use clicks table for original application
      const { count: totalClicks, error: clicksError1 } = await supabase
        .from('clicks')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id)
      
      clickCount = totalClicks || 0
      clicksError = clicksError1
    }

    console.log(`Total clicks for campaign (${isLeadflow2 ? 'clicks2' : 'clicks'} table): ${clickCount}`)

    if (clicksError) {
      console.error('Error getting click count:', clicksError)
    }

    // Step 5: Determine the next seller using round-robin on the virtual wheel
    const nextSellerIndex = clickCount % virtualWheel.length
    const targetSeller = virtualWheel[nextSellerIndex]

    console.log(`Selected seller: ${targetSeller.name} (index: ${nextSellerIndex})`)

    // Step 6: Get this seller's click count from the correct table
    let sellerClickCount = 0
    let sellerClicksError = null
    
    if (isLeadflow2) {
      // Use clicks2 table for leadflow2 application
      const { count: sellerClicks2, error: sellerClicksError2 } = await supabase
        .from('clicks2')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id)
        .eq('seller_id', targetSeller.id)
      
      sellerClickCount = sellerClicks2 || 0
      sellerClicksError = sellerClicksError2
    } else {
      // Use clicks table for original application
      const { count: sellerClicks, error: sellerClicksError1 } = await supabase
        .from('clicks')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id)
        .eq('seller_id', targetSeller.id)
      
      sellerClickCount = sellerClicks || 0
      sellerClicksError = sellerClicksError1
    }

    console.log(`Seller clicks count (${isLeadflow2 ? 'clicks2' : 'clicks'} table): ${sellerClickCount}`)

    if (sellerClicksError) {
      console.error('Error getting seller click count:', sellerClicksError)
    }

    // Step 6.5: Get the last contact used to avoid immediate repetition
    let lastContactPhone = null
    if (isLeadflow2) {
      const { data: lastClick } = await supabase
        .from('clicks2')
        .select('contact_phone')
        .eq('campaign_id', campaign.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      
      lastContactPhone = lastClick?.contact_phone
    } else {
      const { data: lastClick } = await supabase
        .from('clicks')
        .select('contact_phone')
        .eq('campaign_id', campaign.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      
      lastContactPhone = lastClick?.contact_phone
    }

    console.log(`Last contact used: ${lastContactPhone || 'none'}`)
    
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

    // Calculate next contact index using round-robin
    let nextContactIndex = sellerClickCount % contacts.length
    let targetContact = contacts[nextContactIndex]
    
    // If we have more than one contact and the selected contact is the same as last used,
    // advance to next contact to avoid immediate repetition
    if (contacts.length > 1 && lastContactPhone && targetContact.phone_number === lastContactPhone) {
      console.log(`Avoiding repetition of contact ${lastContactPhone}, advancing to next contact`)
      nextContactIndex = (nextContactIndex + 1) % contacts.length
      targetContact = contacts[nextContactIndex]
    }

    console.log(`Contact selection details:`)
    console.log(`- Seller: ${targetSeller.name} (ID: ${targetSeller.id})`)
    console.log(`- Seller click count: ${sellerClickCount}`)
    console.log(`- Total contacts for seller: ${contacts.length}`)
    console.log(`- Contact index selected: ${nextContactIndex}`)
    console.log(`- Selected contact: ${targetContact.phone_number}`)
    console.log(`- Last used contact: ${lastContactPhone || 'none'}`)
    
    // Log all contacts for this seller for debugging
    contacts.forEach((contact, index) => {
      const isSelected = index === nextContactIndex
      const wasLast = contact.phone_number === lastContactPhone
      console.log(`  Contact ${index}: ${contact.phone_number} ${isSelected ? '← SELECTED' : ''} ${wasLast ? '(was last)' : ''}`)
    })

    // Step 8: Record the click in the correct table
    let insertError = null
    
    if (isLeadflow2) {
      // Use clicks2 table for leadflow2 application
      const { error: insertError2 } = await supabase
        .from('clicks2')
        .insert({
          campaign_id: campaign.id,
          seller_id: targetSeller.id,
          contact_phone: targetContact.phone_number
        })
      insertError = insertError2
    } else {
      // Use clicks table for original application
      const { error: insertError1 } = await supabase
        .from('clicks')
        .insert({
          campaign_id: campaign.id,
          seller_id: targetSeller.id,
          contact_phone: targetContact.phone_number
        })
      insertError = insertError1
    }

    if (insertError) {
      console.error(`Error recording click in ${isLeadflow2 ? 'clicks2' : 'clicks'} table:`, insertError)
      // Continue anyway - don't block the redirect for analytics
    } else {
      console.log(`Click recorded successfully in ${isLeadflow2 ? 'clicks2' : 'clicks'} table`)
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
