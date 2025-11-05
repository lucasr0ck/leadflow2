-- ============================================================================
-- VERIFICAR COLUNAS IDENTITY (AUTO-INCREMENT)
-- ============================================================================
-- Execute no Supabase SQL Editor para identificar quais colunas são IDENTITY

SELECT 
  table_name,
  column_name,
  data_type,
  is_identity,
  identity_generation
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name IN ('sellers', 'campaigns', 'seller_contacts', 'clicks', 
                     'sellers2', 'campaigns2', 'seller_contacts2', 'clicks2')
  AND column_name = 'id'
ORDER BY table_name;
