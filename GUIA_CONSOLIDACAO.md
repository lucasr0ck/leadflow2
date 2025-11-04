# 📋 Guia de Consolidação de Dados

## 🎯 Objetivo

Consolidar os dados de duas aplicações LeadFlow separadas em uma única aplicação multi-tenant.

---

## ⚠️ PRÉ-REQUISITOS OBRIGATÓRIOS

- [ ] ✅ Migration multi-tenant executada com sucesso
- [ ] 💾 Backup completo do banco de dados
- [ ] 🔍 Acesso aos dados da aplicação 2
- [ ] 🧪 Ambiente de teste disponível (recomendado)

---

## 📊 Opções de Migração

### **Opção 1: Exportar/Importar via Supabase Dashboard**

#### Passo 1: Exportar dados da App 2

1. Acesse o Supabase Dashboard da **Aplicação 2**
2. Vá em **Database** → **Table Editor**
3. Para cada tabela, exporte os dados:

```sql
-- Exportar Sellers
SELECT id, name, weight, created_at 
FROM sellers;

-- Exportar Seller Contacts
SELECT id, seller_id, phone_number, description, created_at
FROM seller_contacts;

-- Exportar Campaigns
SELECT id, name, slug, greeting_message, is_active, created_at
FROM campaigns;

-- Exportar Clicks
SELECT id, campaign_id, seller_id, created_at
FROM clicks;
```

4. Salve cada resultado em CSV separado

#### Passo 2: Criar tabelas temporárias na App 1

No SQL Editor da **Aplicação 1**:

```sql
-- Criar tabelas temporárias para receber dados da App 2
CREATE TEMP TABLE app2_sellers_temp (
  id uuid,
  name text,
  weight integer,
  created_at timestamptz
);

CREATE TEMP TABLE app2_seller_contacts_temp (
  id uuid,
  seller_id uuid,
  phone_number text,
  description text,
  created_at timestamptz
);

CREATE TEMP TABLE app2_campaigns_temp (
  id uuid,
  name text,
  slug text,
  greeting_message text,
  is_active boolean,
  created_at timestamptz
);

CREATE TEMP TABLE app2_clicks_temp (
  id uuid,
  campaign_id uuid,
  seller_id uuid,
  created_at timestamptz
);
```

#### Passo 3: Importar CSVs

Use o Supabase Dashboard ou psql:

```bash
# Via psql (se tiver acesso direto)
psql -h db.xxx.supabase.co -U postgres -d postgres

# Importar cada CSV
\copy app2_sellers_temp FROM 'sellers.csv' WITH (FORMAT csv, HEADER true);
\copy app2_seller_contacts_temp FROM 'contacts.csv' WITH (FORMAT csv, HEADER true);
\copy app2_campaigns_temp FROM 'campaigns.csv' WITH (FORMAT csv, HEADER true);
\copy app2_clicks_temp FROM 'clicks.csv' WITH (FORMAT csv, HEADER true);
```

#### Passo 4: Executar script de consolidação

No SQL Editor, execute o arquivo `20251104130000_consolidate_app2_data.sql` **seção por seção**, ajustando os valores:

```sql
-- 1. Configurar variáveis
\set app2_owner_id 'UUID-DO-PROPRIETARIO'
\set app2_team_name 'Nome da Operação 2'
\set app2_team_slug 'operacao-2'

-- 2. Criar team (Seção 2 do script)

-- 3. Migrar sellers (Seção 3)

-- 4. Migrar contacts (Seção 4)

-- 5. Migrar campaigns (Seção 5)

-- 6. Migrar clicks (Seção 6)

-- 7. Verificar resultado (Seção 7)
```

---

### **Opção 2: Migração Manual (Poucos Dados)**

Se você tem poucos dados, pode inserir manualmente:

#### 1. Criar nova operação

Via interface (`/settings/teams`):
- Nome: "Operação B"
- Slug: "operacao-b"
- Descrição: "Segunda operação"

Ou via SQL:

```sql
INSERT INTO teams (team_name, slug, description, owner_id, is_active)
VALUES (
  'Operação B',
  'operacao-b',
  'Segunda operação migrada',
  'SEU-USER-ID',
  true
)
RETURNING id;
```

#### 2. Inserir Sellers

```sql
-- Substitua TEAM_ID pelo UUID retornado acima
INSERT INTO sellers (name, weight, team_id) VALUES
  ('Vendedor 1', 1, 'TEAM_ID'),
  ('Vendedor 2', 1, 'TEAM_ID'),
  ('Vendedor 3', 1, 'TEAM_ID');
```

#### 3. Inserir Contatos

```sql
-- Primeiro, obtenha os IDs dos sellers
SELECT id, name FROM sellers WHERE team_id = 'TEAM_ID';

-- Depois insira os contatos
INSERT INTO seller_contacts (seller_id, phone_number, description) VALUES
  ('SELLER_1_ID', '5511999999999', 'WhatsApp principal'),
  ('SELLER_2_ID', '5511988888888', 'WhatsApp principal');
```

#### 4. Inserir Campanhas

```sql
INSERT INTO campaigns (
  name, 
  slug, 
  full_slug, 
  greeting_message, 
  is_active, 
  team_id
) VALUES
  (
    'Black Friday',
    'black-friday',
    'operacao-b-black-friday',  -- IMPORTANTE: formato team-slug-campaign-slug
    'Olá! Temos uma oferta especial pra você!',
    true,
    'TEAM_ID'
  ),
  (
    'Natal 2025',
    'natal-2025',
    'operacao-b-natal-2025',
    'Promoção de Natal! Confira:',
    true,
    'TEAM_ID'
  );
```

#### 5. Não migre clicks históricos

Para facilitar, você pode começar do zero com os clicks. Eles serão registrados automaticamente conforme as pessoas acessarem os novos links.

---

### **Opção 3: Script Automatizado (Dados na mesma conta)**

Se ambas aplicações estão no **mesmo projeto Supabase** mas em tabelas diferentes (ex: `sellers` e `sellers2`):

```sql
-- 1. Criar team
INSERT INTO teams (team_name, slug, description, owner_id, is_active)
VALUES ('Operação B', 'operacao-b', 'Migrada de sellers2', 'USER_ID', true)
RETURNING id;

-- Salvar o team_id
DO $$
DECLARE
  v_team_id uuid;
BEGIN
  SELECT id INTO v_team_id FROM teams WHERE slug = 'operacao-b';
  
  -- 2. Migrar sellers de sellers2 para sellers
  INSERT INTO sellers (name, weight, team_id, created_at)
  SELECT name, weight, v_team_id, created_at
  FROM sellers2;
  
  -- 3. Migrar contacts
  INSERT INTO seller_contacts (seller_id, phone_number, description, created_at)
  SELECT 
    s.id as seller_id,
    sc2.phone_number,
    sc2.description,
    sc2.created_at
  FROM seller_contacts2 sc2
  JOIN sellers2 s2 ON sc2.seller_id = s2.id
  JOIN sellers s ON s2.name = s.name AND s.team_id = v_team_id;
  
  -- 4. Migrar campaigns
  INSERT INTO campaigns (name, slug, full_slug, greeting_message, is_active, team_id, created_at)
  SELECT 
    name,
    slug,
    'operacao-b-' || slug,
    greeting_message,
    is_active,
    v_team_id,
    created_at
  FROM campaigns2;
  
  -- 5. Migrar clicks (mapear IDs)
  INSERT INTO clicks (campaign_id, seller_id, team_id, created_at)
  SELECT 
    c.id,
    s.id,
    v_team_id,
    cl2.created_at
  FROM clicks2 cl2
  JOIN campaigns2 c2 ON cl2.campaign_id = c2.id
  JOIN sellers2 s2 ON cl2.seller_id = s2.id
  JOIN campaigns c ON c2.slug = c.slug AND c.team_id = v_team_id
  JOIN sellers s ON s2.name = s.name AND s.team_id = v_team_id;
  
END $$;
```

---

## ✅ Verificações Pós-Migração

Execute estas queries para validar:

```sql
-- 1. Verificar teams criados
SELECT id, team_name, slug, owner_id FROM teams;

-- 2. Contar registros por team
SELECT 
  t.team_name,
  COUNT(DISTINCT s.id) as sellers,
  COUNT(DISTINCT sc.id) as contacts,
  COUNT(DISTINCT c.id) as campaigns,
  COUNT(DISTINCT cl.id) as clicks
FROM teams t
LEFT JOIN sellers s ON t.id = s.team_id
LEFT JOIN seller_contacts sc ON s.id = sc.seller_id
LEFT JOIN campaigns c ON t.id = c.team_id
LEFT JOIN clicks cl ON c.id = cl.campaign_id
GROUP BY t.id, t.team_name;

-- 3. Verificar full_slugs únicos
SELECT full_slug, COUNT(*) 
FROM campaigns 
GROUP BY full_slug 
HAVING COUNT(*) > 1;

-- 4. Testar RLS (como usuário específico)
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims.sub = 'USER_ID';

SELECT * FROM teams;  -- Deve ver apenas os teams que você é membro
SELECT * FROM sellers;  -- Deve ver apenas sellers dos seus teams
```

---

## 🔗 Atualizar Links de Redirect

Após migração, atualize os links nas suas campanhas:

### Antes (App 2 separada):
```
https://app2.com/r/black-friday
```

### Depois (App única):
```
https://app.com/r/operacao-b-black-friday
```

Use o formato: `/r/{team-slug}-{campaign-slug}`

---

## 🚨 Troubleshooting

### Erro: "duplicate key value violates unique constraint"

**Causa:** Full_slug duplicado ou slug duplicado  
**Solução:** Ajuste o slug da campanha antes de inserir

```sql
-- Verificar slugs existentes
SELECT slug, full_slug FROM campaigns WHERE slug = 'black-friday';

-- Ajustar slug se necessário
UPDATE campaigns 
SET slug = 'black-friday-op2', 
    full_slug = 'operacao-b-black-friday-op2'
WHERE id = 'UUID';
```

### Erro: "foreign key constraint violated"

**Causa:** Tentando inserir contact/click com seller_id ou campaign_id inexistente  
**Solução:** Sempre migre na ordem: Teams → Sellers → Contacts → Campaigns → Clicks

### Erro: "permission denied"

**Causa:** RLS está bloqueando  
**Solução:** Use Service Role Key ou desabilite RLS temporariamente:

```sql
ALTER TABLE sellers DISABLE ROW LEVEL SECURITY;
-- ... fazer inserções ...
ALTER TABLE sellers ENABLE ROW LEVEL SECURITY;
```

---

## 📞 Suporte

Se encontrar problemas, verifique:

1. ✅ Logs do Supabase (Dashboard → Logs)
2. ✅ Verificações de integridade acima
3. ✅ Documentação em `PLANO_MULTI_OPERACAO.md`

---

## ✨ Próximos Passos

Após consolidação bem-sucedida:

1. ✅ Testar login e acesso às operações
2. ✅ Verificar que cada operação mostra apenas seus dados
3. ✅ Testar links de redirect: `/r/operacao-a-...` e `/r/operacao-b-...`
4. ✅ Adicionar membros às operações via `/settings/teams` (futuro)
5. ✅ Desativar aplicação 2 antiga
6. ✅ Remover tabelas duplicadas (sellers2, campaigns2, etc)

---

**Boa migração! 🚀**
