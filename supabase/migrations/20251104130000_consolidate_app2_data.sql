-- ============================================================================
-- SCRIPT DE CONSOLIDAÇÃO: Importar dados da Aplicação 2 para Aplicação 1
-- ============================================================================
-- 
-- OBJETIVO: Consolidar dados de duas aplicações LeadFlow em uma única,
--           separando-os por team_id
--
-- PRÉ-REQUISITOS:
-- 1. Executar migration 20251104120000_multi_tenant_structure_FIXED.sql
-- 2. Backup completo do banco de dados
-- 3. Ter acesso aos dados da aplicação 2 (pode ser via dump SQL)
--
-- INSTRUÇÕES:
-- 1. Identifique o user_id do proprietário da operação 2
-- 2. Substitua as variáveis abaixo pelos valores corretos
-- 3. Execute seção por seção, verificando os resultados
-- ============================================================================

-- ============================================================================
-- SEÇÃO 1: CONFIGURAÇÃO
-- ============================================================================

-- IMPORTANTE: Substituir estes valores antes de executar!
-- Usuário proprietário da aplicação 2 (pode ser o mesmo ou diferente)
\set app2_owner_id '00000000-0000-0000-0000-000000000000'  -- UUID do owner da app 2

-- Informações do novo team para aplicação 2
\set app2_team_name 'Operação B'
\set app2_team_slug 'operacao-b'
\set app2_team_description 'Dados migrados da aplicação duplicada'

-- ============================================================================
-- SEÇÃO 2: CRIAR TEAM PARA APLICAÇÃO 2
-- ============================================================================

-- Criar team para a segunda operação
INSERT INTO teams (team_name, slug, description, owner_id, is_active)
VALUES (
  :'app2_team_name',
  :'app2_team_slug',
  :'app2_team_description',
  :'app2_owner_id',
  true
)
ON CONFLICT (slug) DO NOTHING
RETURNING id, team_name, slug;

-- Guardar o team_id para uso posterior
\set app2_team_id (SELECT id FROM teams WHERE slug = :'app2_team_slug')

-- Verificar se o team foi criado
SELECT 
  id,
  team_name,
  slug,
  owner_id,
  created_at
FROM teams 
WHERE slug = :'app2_team_slug';

-- ============================================================================
-- SEÇÃO 3: MIGRAR SELLERS
-- ============================================================================

-- OPÇÃO A: Se os dados da App 2 estão em tabelas temporárias (app2_sellers)
-- Ajuste conforme sua estrutura de dados

-- Exemplo com dados em tabelas temporárias:
/*
INSERT INTO sellers (id, name, weight, team_id, created_at)
SELECT 
  gen_random_uuid(),  -- Gera novo UUID para evitar conflitos
  name,
  weight,
  :'app2_team_id'::uuid,
  created_at
FROM app2_sellers_temp;
*/

-- OPÇÃO B: Se precisa importar de um CSV
-- 1. Prepare CSV com colunas: name, weight, created_at
-- 2. Execute via psql:
-- \copy sellers(name, weight, team_id, created_at) FROM 'app2_sellers.csv' WITH (FORMAT csv, HEADER true);

-- OPÇÃO C: Migração manual (para poucos registros)
-- Exemplo:
/*
INSERT INTO sellers (name, weight, team_id) VALUES
  ('Vendedor A', 1, :'app2_team_id'::uuid),
  ('Vendedor B', 1, :'app2_team_id'::uuid),
  ('Vendedor C', 1, :'app2_team_id'::uuid);
*/

-- Verificar sellers migrados
SELECT id, name, weight, team_id, created_at
FROM sellers
WHERE team_id = :'app2_team_id'::uuid
ORDER BY created_at;

-- ============================================================================
-- SEÇÃO 4: MIGRAR SELLER_CONTACTS
-- ============================================================================

-- IMPORTANTE: Mapear seller_id antigos para novos
-- Se você criou uma tabela de mapeamento:
/*
CREATE TEMP TABLE seller_id_mapping AS
SELECT 
  old_id,
  new_id
FROM (
  SELECT 
    s_old.id as old_id,
    s_new.id as new_id,
    s_old.name,
    ROW_NUMBER() OVER (PARTITION BY s_old.id ORDER BY s_new.created_at) as rn
  FROM app2_sellers_temp s_old
  JOIN sellers s_new ON s_old.name = s_new.name
  WHERE s_new.team_id = :'app2_team_id'::uuid
) t
WHERE rn = 1;

INSERT INTO seller_contacts (seller_id, phone_number, description, created_at)
SELECT 
  m.new_id,
  sc.phone_number,
  sc.description,
  sc.created_at
FROM app2_seller_contacts_temp sc
JOIN seller_id_mapping m ON sc.seller_id = m.old_id;
*/

-- Verificar contatos migrados
SELECT 
  s.name as seller_name,
  sc.phone_number,
  sc.description,
  sc.created_at
FROM seller_contacts sc
JOIN sellers s ON sc.seller_id = s.id
WHERE s.team_id = :'app2_team_id'::uuid
ORDER BY s.name, sc.created_at;

-- ============================================================================
-- SEÇÃO 5: MIGRAR CAMPAIGNS
-- ============================================================================

-- Migrar campanhas e gerar full_slug automaticamente
/*
INSERT INTO campaigns (
  name, 
  slug, 
  full_slug, 
  greeting_message, 
  is_active, 
  team_id, 
  created_at
)
SELECT 
  name,
  slug,
  :'app2_team_slug' || '-' || slug,  -- Gera full_slug: operacao-b-slug
  greeting_message,
  is_active,
  :'app2_team_id'::uuid,
  created_at
FROM app2_campaigns_temp;
*/

-- Verificar campanhas migradas
SELECT 
  id,
  name,
  slug,
  full_slug,
  is_active,
  team_id,
  created_at
FROM campaigns
WHERE team_id = :'app2_team_id'::uuid
ORDER BY created_at;

-- ============================================================================
-- SEÇÃO 6: MIGRAR CLICKS
-- ============================================================================

-- IMPORTANTE: Precisa mapear campaign_id e seller_id antigos para novos
/*
CREATE TEMP TABLE campaign_id_mapping AS
SELECT 
  c_old.id as old_id,
  c_new.id as new_id
FROM app2_campaigns_temp c_old
JOIN campaigns c_new ON c_old.slug = c_new.slug
WHERE c_new.team_id = :'app2_team_id'::uuid;

INSERT INTO clicks (campaign_id, seller_id, team_id, created_at)
SELECT 
  cm.new_id,
  sm.new_id,
  :'app2_team_id'::uuid,
  cl.created_at
FROM app2_clicks_temp cl
JOIN campaign_id_mapping cm ON cl.campaign_id = cm.old_id
JOIN seller_id_mapping sm ON cl.seller_id = sm.old_id;
*/

-- Verificar clicks migrados
SELECT 
  c.name as campaign_name,
  s.name as seller_name,
  COUNT(*) as click_count
FROM clicks cl
JOIN campaigns c ON cl.campaign_id = c.id
JOIN sellers s ON cl.seller_id = s.id
WHERE cl.team_id = :'app2_team_id'::uuid
GROUP BY c.name, s.name
ORDER BY c.name, s.name;

-- ============================================================================
-- SEÇÃO 7: VERIFICAÇÃO FINAL
-- ============================================================================

-- Resumo da migração
SELECT 
  'Teams' as tabela,
  COUNT(*) as total
FROM teams
WHERE slug IN (:'app2_team_slug')

UNION ALL

SELECT 
  'Sellers',
  COUNT(*)
FROM sellers
WHERE team_id = :'app2_team_id'::uuid

UNION ALL

SELECT 
  'Seller Contacts',
  COUNT(*)
FROM seller_contacts sc
JOIN sellers s ON sc.seller_id = s.id
WHERE s.team_id = :'app2_team_id'::uuid

UNION ALL

SELECT 
  'Campaigns',
  COUNT(*)
FROM campaigns
WHERE team_id = :'app2_team_id'::uuid

UNION ALL

SELECT 
  'Clicks',
  COUNT(*)
FROM clicks
WHERE team_id = :'app2_team_id'::uuid;

-- Verificar integridade dos full_slugs (devem ser únicos)
SELECT 
  full_slug,
  COUNT(*) as count
FROM campaigns
GROUP BY full_slug
HAVING COUNT(*) > 1;

-- Se houver duplicados, ajustar manualmente:
-- UPDATE campaigns 
-- SET full_slug = 'operacao-b-' || slug || '-2'
-- WHERE id = 'uuid-do-duplicado';

-- ============================================================================
-- SEÇÃO 8: LIMPEZA (OPCIONAL)
-- ============================================================================

-- Após confirmar que tudo foi migrado corretamente, remover tabelas temporárias:
/*
DROP TABLE IF EXISTS app2_sellers_temp;
DROP TABLE IF EXISTS app2_seller_contacts_temp;
DROP TABLE IF EXISTS app2_campaigns_temp;
DROP TABLE IF EXISTS app2_clicks_temp;
DROP TABLE IF EXISTS seller_id_mapping;
DROP TABLE IF EXISTS campaign_id_mapping;
*/

-- ============================================================================
-- NOTAS IMPORTANTES
-- ============================================================================
--
-- 1. BACKUP: Sempre faça backup completo antes de executar
-- 
-- 2. AMBIENTE DE TESTE: Execute primeiro em ambiente de desenvolvimento
--
-- 3. MAPEAMENTO DE IDs: Os UUIDs da app 2 não podem ser reutilizados.
--    Você precisa criar tabelas de mapeamento (old_id -> new_id)
--
-- 4. FULL_SLUG: Todas as campanhas migradas terão formato:
--    operacao-b-nome-da-campanha
--
-- 5. RLS POLICIES: As policies já criadas garantirão que cada usuário
--    só veja os dados das operações em que é membro
--
-- 6. LINKS DE REDIRECT: Após migração, os novos links serão:
--    - App 1: https://app.com/r/operacao-a-black-friday
--    - App 2: https://app.com/r/operacao-b-black-friday
--
-- 7. TEAM_MEMBERS: O trigger auto_add_team_owner() já adicionou
--    automaticamente o owner ao criar o team
--
-- ============================================================================
