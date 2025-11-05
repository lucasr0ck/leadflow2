
-- Create function to safely delete a contact and all its associated campaign links
CREATE OR REPLACE FUNCTION delete_contact_and_links(contact_id_to_delete uuid)
RETURNS TABLE(success boolean, deleted_links_count integer, message text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    links_count integer := 0;
BEGIN
    -- First, delete all campaign_links that reference this contact
    DELETE FROM campaign_links WHERE contact_id = contact_id_to_delete;
    GET DIAGNOSTICS links_count = ROW_COUNT;
    
    -- Then delete the contact itself
    DELETE FROM seller_contacts WHERE id = contact_id_to_delete;
    
    -- Check if the contact was actually deleted
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 0, 'Contact not found or could not be deleted'::text;
    ELSE
        RETURN QUERY SELECT true, links_count, 'Contact and associated links deleted successfully'::text;
    END IF;
END;
$$;

-- Create function to safely delete a seller and all its children
CREATE OR REPLACE FUNCTION delete_seller_and_children(seller_id_to_delete uuid)
RETURNS TABLE(success boolean, deleted_contacts_count integer, deleted_links_count integer, message text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    contacts_count integer := 0;
    links_count integer := 0;
BEGIN
    -- First, delete all campaign_links that reference contacts of this seller
    DELETE FROM campaign_links 
    WHERE contact_id IN (
        SELECT id FROM seller_contacts WHERE seller_id = seller_id_to_delete
    );
    GET DIAGNOSTICS links_count = ROW_COUNT;
    
    -- Then delete all contacts of this seller
    DELETE FROM seller_contacts WHERE seller_id = seller_id_to_delete;
    GET DIAGNOSTICS contacts_count = ROW_COUNT;
    
    -- Finally delete the seller itself
    DELETE FROM sellers WHERE id = seller_id_to_delete;
    
    -- Check if the seller was actually deleted
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 0, 0, 'Seller not found or could not be deleted'::text;
    ELSE
        RETURN QUERY SELECT true, contacts_count, links_count, 'Seller and all associated data deleted successfully'::text;
    END IF;
END;
$$;

-- Create function to safely delete a campaign and all its children
CREATE OR REPLACE FUNCTION delete_campaign_and_children(campaign_id_to_delete uuid)
RETURNS TABLE(success boolean, deleted_clicks_count integer, deleted_links_count integer, message text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    clicks_count integer := 0;
    links_count integer := 0;
BEGIN
    -- First, delete all clicks for this campaign
    DELETE FROM clicks WHERE campaign_id = campaign_id_to_delete;
    GET DIAGNOSTICS clicks_count = ROW_COUNT;
    
    -- Then delete all campaign_links for this campaign
    DELETE FROM campaign_links WHERE campaign_id = campaign_id_to_delete;
    GET DIAGNOSTICS links_count = ROW_COUNT;
    
    -- Finally delete the campaign itself
    DELETE FROM campaigns WHERE id = campaign_id_to_delete;
    
    -- Check if the campaign was actually deleted
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 0, 0, 'Campaign not found or could not be deleted'::text;
    ELSE
        RETURN QUERY SELECT true, clicks_count, links_count, 'Campaign and all associated data deleted successfully'::text;
    END IF;
END;
$$;

-- Create function to perform complete data cleanup
CREATE OR REPLACE FUNCTION cleanup_all_data()
RETURNS TABLE(success boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    clicks_count integer := 0;
    links_count integer := 0;
    contacts_count integer := 0;
    campaigns_count integer := 0;
    sellers_count integer := 0;
BEGIN
    -- Delete in the correct order to respect foreign key constraints
    
    -- 1. Delete all clicks
    DELETE FROM clicks;
    GET DIAGNOSTICS clicks_count = ROW_COUNT;
    
    -- 2. Delete all campaign_links
    DELETE FROM campaign_links;
    GET DIAGNOSTICS links_count = ROW_COUNT;
    
    -- 3. Delete all seller_contacts
    DELETE FROM seller_contacts;
    GET DIAGNOSTICS contacts_count = ROW_COUNT;
    
    -- 4. Delete all campaigns
    DELETE FROM campaigns;
    GET DIAGNOSTICS campaigns_count = ROW_COUNT;
    
    -- 5. Delete all sellers
    DELETE FROM sellers;
    GET DIAGNOSTICS sellers_count = ROW_COUNT;
    
    RETURN QUERY SELECT true, format('Cleanup completed: %s clicks, %s links, %s contacts, %s campaigns, %s sellers deleted', 
                                   clicks_count, links_count, contacts_count, campaigns_count, sellers_count)::text;
END;
$$;
