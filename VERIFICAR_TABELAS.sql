-- =====================================================
-- QUERY DE VERIFICAÇÃO: Verificar se tabelas existem
-- =====================================================
-- Copie este SQL completo e execute no Supabase SQL Editor

SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('teams', 'team_members', 'sellers', 'campaigns', 'seller_contacts', 'clicks', 'audit_logs')
ORDER BY tablename;
