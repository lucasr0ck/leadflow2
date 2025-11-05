-- Create function for intelligent campaign link distribution
CREATE OR REPLACE FUNCTION public.create_campaign_distribution(
    campaign_id_param uuid,
    seller_repetitions jsonb -- Array of objects: [{"seller_id": "uuid", "repetitions": number}]
)
RETURNS TABLE(success boolean, total_links_created integer, message text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    seller_entry jsonb;
    seller_id_val uuid;
    repetitions_val integer;
    contact_record record;
    all_contacts uuid[] := ARRAY[]::uuid[];
    contact_id uuid;
    shuffled_contacts uuid[];
    i integer;
    links_created integer := 0;
BEGIN
    -- First, delete existing campaign links for this campaign
    DELETE FROM campaign_links WHERE campaign_id = campaign_id_param;
    
    -- Build the complete list of contacts based on seller repetitions
    FOR seller_entry IN SELECT * FROM jsonb_array_elements(seller_repetitions)
    LOOP
        seller_id_val := (seller_entry->>'seller_id')::uuid;
        repetitions_val := (seller_entry->>'repetitions')::integer;
        
        -- Get all contacts for this seller
        FOR contact_record IN 
            SELECT id FROM seller_contacts WHERE seller_id = seller_id_val
        LOOP
            -- Add this contact repeated based on seller repetitions
            FOR i IN 1..repetitions_val LOOP
                all_contacts := array_append(all_contacts, contact_record.id);
            END LOOP;
        END LOOP;
    END LOOP;
    
    -- Shuffle the contacts array for fair distribution
    -- Using Fisher-Yates shuffle algorithm
    shuffled_contacts := all_contacts;
    FOR i IN REVERSE array_length(shuffled_contacts, 1)..2 LOOP
        -- Generate random index between 1 and i
        DECLARE
            j integer := floor(random() * i + 1)::integer;
            temp uuid;
        BEGIN
            -- Swap elements at positions i and j
            temp := shuffled_contacts[i];
            shuffled_contacts[i] := shuffled_contacts[j];
            shuffled_contacts[j] := temp;
        END;
    END LOOP;
    
    -- Insert the shuffled contacts into campaign_links with sequential positions
    FOR i IN 1..array_length(shuffled_contacts, 1) LOOP
        INSERT INTO campaign_links (campaign_id, contact_id, position)
        VALUES (campaign_id_param, shuffled_contacts[i], i - 1); -- Position starts at 0
        
        links_created := links_created + 1;
    END LOOP;
    
    RETURN QUERY SELECT true, links_created, format('Successfully created %s campaign links with fair distribution', links_created)::text;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT false, 0, format('Error creating campaign distribution: %s', SQLERRM)::text;
END;
$function$;