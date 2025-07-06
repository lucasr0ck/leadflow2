
import { supabase } from '@/integrations/supabase/client';

export const performDataCleanup = async () => {
  try {
    console.log('Starting authorized data cleanup...');
    
    // Use the new cleanup_all_data function for safe deletion
    const { data, error } = await supabase.rpc('cleanup_all_data');
    
    if (error) {
      console.error('Error during data cleanup:', error);
      throw error;
    }
    
    if (data && data.length > 0) {
      console.log('✅ Data cleanup completed:', data[0].message);
      return { success: data[0].success, message: data[0].message };
    }
    
    console.log('✅ Data cleanup completed successfully');
    return { success: true, message: 'Data cleanup completed successfully' };
  } catch (error) {
    console.error('❌ Data cleanup failed:', error);
    return { success: false, error };
  }
};
