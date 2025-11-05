-- ============================================================================
-- DIAGNÓSTICO SIMPLES E FUNCIONAL
-- ============================================================================

-- 1. Estrutura da tabela clicks
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'clicks'
ORDER BY ordinal_position;

-- 2. Estrutura da tabela clicks2
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'clicks2'
ORDER BY ordinal_position;

-- 3. Dados nas operações
SELECT 
  t.team_name,
  t.slug,
  (SELECT COUNT(*) FROM sellers WHERE team_id = t.id) as vendedores,
  (SELECT COUNT(*) FROM campaigns WHERE team_id = t.id) as campanhas,
  (SELECT COUNT(*) FROM clicks WHERE team_id = t.id) as clicks
FROM teams t
ORDER BY t.team_name;

-- 4. Verificar dados em tabelas antigas
SELECT 
  'sellers2' as tabela,
  COUNT(*) as registros
FROM sellers2
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sellers2')

UNION ALL

SELECT 
  'clicks2' as tabela,
  COUNT(*) as registros
FROM clicks2
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clicks2')

UNION ALL

SELECT 
  'campaigns2' as tabela,
  COUNT(*) as registros
FROM campaigns2
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaigns2')

UNION ALL

SELECT 
  'seller_contacts2' as tabela,
  COUNT(*) as registros
FROM seller_contacts2
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'seller_contacts2');

-- 5. Vendedores por operação
SELECT 
  t.team_name,
  s.name as vendedor,
  s.weight,
  (SELECT COUNT(*) FROM seller_contacts WHERE seller_id = s.id) as contatos
FROM teams t
INNER JOIN sellers s ON t.id = s.team_id
ORDER BY t.team_name, s.name;

-- 6. Campanhas por operação
SELECT 
  t.team_name,
  c.name as campanha,
  c.full_slug,
  c.is_active,
  (SELECT COUNT(*) FROM clicks WHERE campaign_id = c.id) as clicks
FROM teams t
INNER JOIN campaigns c ON t.id = c.team_id
ORDER BY t.team_name, c.name;
