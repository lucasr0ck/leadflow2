
import { supabase } from '@/integrations/supabase/client';

export const performDataCleanup = async () => {
  try {
    console.log('Starting data cleanup...');
    
    // Delete in the correct order to respect foreign key constraints
    
    // 1. Delete all clicks
    const { error: clicksError } = await supabase
      .from('clicks')
      .delete()
      .neq('id', 0); // Delete all records
    
    if (clicksError) {
      console.error('Error deleting clicks:', clicksError);
      throw clicksError;
    }
    console.log('✓ Deleted all clicks');

    // 2. Delete all campaign_links
    const { error: campaignLinksError } = await supabase
      .from('campaign_links')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records
    
    if (campaignLinksError) {
      console.error('Error deleting campaign_links:', campaignLinksError);
      throw campaignLinksError;
    }
    console.log('✓ Deleted all campaign_links');

    // 3. Delete all seller_contacts
    const { error: sellerContactsError } = await supabase
      .from('seller_contacts')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records
    
    if (sellerContactsError) {
      console.error('Error deleting seller_contacts:', sellerContactsError);
      throw sellerContactsError;
    }
    console.log('✓ Deleted all seller_contacts');

    // 4. Delete all campaigns
    const { error: campaignsError } = await supabase
      .from('campaigns')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records
    
    if (campaignsError) {
      console.error('Error deleting campaigns:', campaignsError);
      throw campaignsError;
    }
    console.log('✓ Deleted all campaigns');

    // 5. Delete all sellers
    const { error: sellersError } = await supabase
      .from('sellers')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records
    
    if (sellersError) {
      console.error('Error deleting sellers:', sellersError);
      throw sellersError;
    }
    console.log('✓ Deleted all sellers');

    console.log('✅ Data cleanup completed successfully');
    return { success: true };
  } catch (error) {
    console.error('❌ Data cleanup failed:', error);
    return { success: false, error };
  }
};
