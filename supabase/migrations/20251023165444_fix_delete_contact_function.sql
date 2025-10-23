-- Fix the delete_contact_and_links function to work without campaign_links table
-- Since campaign_links table was removed, we only need to delete the contact
CREATE OR REPLACE FUNCTION delete_contact_and_links(contact_id_to_delete uuid)
RETURNS TABLE(success boolean, deleted_links_count integer, message text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    links_count integer := 0;
BEGIN
    -- Since campaign_links table was removed, we don't need to delete campaign links
    -- Just delete the contact itself
    DELETE FROM seller_contacts WHERE id = contact_id_to_delete;
    
    -- Check if the contact was actually deleted
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 0, 'Contact not found or could not be deleted'::text;
    ELSE
        RETURN QUERY SELECT true, 0, 'Contact deleted successfully'::text;
    END IF;
END;
$$;
