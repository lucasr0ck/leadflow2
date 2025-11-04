# 🚨 SOLUÇÃO DEFINITIVA - APLICAÇÃO LENTA SEM OPERAÇÕES

## ❌ **PROBLEMA IDENTIFICADO:**

Migrations executadas ✅ MAS **operações não foram criadas ainda!**

A aplicação precisa de:
1. ✅ Estrutura criada (migrations) - **FEITO**
2. ❌ **Operações populadas com dados** - **FALTANDO**
3. ❌ **Usuário associado às operações** - **FALTANDO**

---

## 🎯 **SOLUÇÃO EM 3 PASSOS:**

### **PASSO 1: Execute a Migration de Dados**

Escolha **UMA** das opções abaixo:

#### **OPÇÃO A: Automática (Recomendado)** ⭐

1. Abra: `MIGRATION_POPULATE_DATA.sql`
2. **EDITE LINHA 16** com seu email:
   ```sql
   WHERE email = 'multiumcursolida@gmail.com' -- ✏️ SEU EMAIL AQUI
   ```
3. Se tiver email do Gustavo, **EDITE LINHA 21**, senão deixe usar o mesmo
4. Copie **TUDO** (Cmd+A → Cmd+C)
5. Cole no **Supabase SQL Editor**
6. Clique **RUN**

#### **OPÇÃO B: Manual (Mais Controle)**

1. Abra: `MIGRATION_POPULATE_MANUAL.sql`
2. Execute **linha por linha**, substituindo IDs conforme instruções
3. Siga os comentários ✏️

---

### **PASSO 2: Verificar Criação**

Execute no Supabase SQL Editor:

```sql
-- Ver operações criadas
SELECT 
  t.team_name,
  t.slug,
  tm.role,
  (SELECT COUNT(*) FROM sellers WHERE team_id = t.id) as sellers,
  (SELECT COUNT(*) FROM campaigns WHERE team_id = t.id) as campaigns
FROM teams t
INNER JOIN team_members tm ON t.id = tm.team_id
WHERE tm.user_id = auth.uid()
ORDER BY t.team_name;
```

**Resultado esperado:**
```
team_name         | slug              | role  | sellers | campaigns
------------------+-------------------+-------+---------+----------
Caio Martins      | caio-martins      | owner |    X    |    X
Gustavo de Castro | gustavo-de-castro | owner |    Y    |    Y
```

---

### **PASSO 3: Limpar Cache e Testar**

1. **Feche TODAS as abas** da aplicação
2. **Limpe cache:** Cmd+Shift+Delete → Selecione "Cached images and files" → Clear data
3. **Abra novamente** a aplicação
4. **Faça login**
5. **Verifique:**
   - ✅ Sidebar mostra dropdown de operações
   - ✅ Campanhas e Vendedores carregam
   - ✅ Dashboard mostra dados

---

## 🐛 **TROUBLESHOOTING:**

### **Problema: "Ainda não aparece seletor de operações"**

**Causa:** TeamContext não encontrou operações

**Solução:**
1. Abra **DevTools** (F12)
2. Vá na aba **Console**
3. Procure por erros vermelhos
4. Execute no Supabase:
   ```sql
   SELECT * FROM get_user_teams();
   ```
   - Se retornar **vazio** → operações não foram criadas
   - Se der **erro** → função não existe (execute migrations novamente)

---

### **Problema: "Campanhas e Vendedores vazios"**

**Causa:** `full_slug` não foi populado OU `team_id` não foi associado

**Solução:**
```sql
-- Verificar campanhas sem full_slug
SELECT COUNT(*) as sem_full_slug
FROM campaigns
WHERE full_slug IS NULL OR full_slug = '';

-- Corrigir (execute se houver campanhas sem full_slug)
UPDATE campaigns c
SET full_slug = t.slug || '-' || c.slug
FROM teams t
WHERE c.team_id = t.id
AND (c.full_slug IS NULL OR c.full_slug = '');
```

---

### **Problema: "Aplicação ainda lenta"**

**Causa:** Queries sem índices

**Solução:**
```sql
-- Verificar índices criados
SELECT tablename, indexname 
FROM pg_indexes 
WHERE tablename IN ('campaigns', 'sellers', 'clicks', 'team_members')
ORDER BY tablename;

-- Se não houver índices, execute:
CREATE INDEX IF NOT EXISTS idx_campaigns_team_id ON campaigns(team_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_full_slug ON campaigns(full_slug);
CREATE INDEX IF NOT EXISTS idx_sellers_team_id ON sellers(team_id);
CREATE INDEX IF NOT EXISTS idx_clicks_team_id ON clicks(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
```

---

## 📊 **VERIFICAÇÃO COMPLETA DO SISTEMA:**

Execute esta query para diagnóstico completo:

```sql
-- DIAGNÓSTICO COMPLETO
DO $$
DECLARE
  v_user_id UUID;
  v_teams_count INT;
  v_memberships_count INT;
  v_campaigns_without_full_slug INT;
  v_function_exists BOOLEAN;
BEGIN
  -- ID do usuário atual
  v_user_id := auth.uid();
  
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'DIAGNÓSTICO DO SISTEMA';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'User ID: %', v_user_id;
  
  -- Verificar função get_user_teams
  SELECT EXISTS (
    SELECT FROM pg_proc WHERE proname = 'get_user_teams'
  ) INTO v_function_exists;
  
  IF v_function_exists THEN
    RAISE NOTICE '✅ Função get_user_teams existe';
  ELSE
    RAISE NOTICE '❌ Função get_user_teams NÃO existe - Execute migrations!';
  END IF;
  
  -- Contar operações do usuário
  SELECT COUNT(*) INTO v_teams_count
  FROM team_members
  WHERE user_id = v_user_id;
  
  IF v_teams_count > 0 THEN
    RAISE NOTICE '✅ Usuário pertence a % operação(ões)', v_teams_count;
  ELSE
    RAISE NOTICE '❌ Usuário NÃO pertence a nenhuma operação - Execute MIGRATION_POPULATE_DATA.sql!';
  END IF;
  
  -- Contar campanhas sem full_slug
  SELECT COUNT(*) INTO v_campaigns_without_full_slug
  FROM campaigns
  WHERE full_slug IS NULL OR full_slug = '';
  
  IF v_campaigns_without_full_slug = 0 THEN
    RAISE NOTICE '✅ Todas as campanhas têm full_slug';
  ELSE
    RAISE NOTICE '⚠️  % campanhas sem full_slug - Execute UPDATE!', v_campaigns_without_full_slug;
  END IF;
  
  -- Listar operações
  RAISE NOTICE '';
  RAISE NOTICE 'OPERAÇÕES DO USUÁRIO:';
  FOR v_teams_count IN 
    SELECT t.team_name
    FROM teams t
    INNER JOIN team_members tm ON t.id = tm.team_id
    WHERE tm.user_id = v_user_id
  LOOP
    RAISE NOTICE '  - %', v_teams_count;
  END LOOP;
  
  RAISE NOTICE '============================================================================';
END $$;

-- Listar detalhes das operações
SELECT 
  t.team_name,
  t.slug,
  t.is_active,
  (SELECT COUNT(*) FROM sellers WHERE team_id = t.id) as sellers_count,
  (SELECT COUNT(*) FROM campaigns WHERE team_id = t.id) as campaigns_count,
  (SELECT COUNT(*) FROM clicks WHERE team_id = t.id) as clicks_count
FROM teams t
INNER JOIN team_members tm ON t.id = tm.team_id
WHERE tm.user_id = auth.uid()
ORDER BY t.team_name;
```

---

## ✅ **CHECKLIST FINAL:**

Após executar a migration de dados:

- [ ] Query `SELECT * FROM get_user_teams();` retorna 2 linhas
- [ ] Sidebar mostra dropdown com "Caio Martins" e "Gustavo de Castro"
- [ ] Campanhas carregam (não está vazio)
- [ ] Vendedores carregam (não está vazio)
- [ ] Dashboard mostra estatísticas
- [ ] Analytics carrega gráficos
- [ ] Consegue criar nova campanha rapidamente (<3s)
- [ ] Links de campanha têm formato: `/r/caio-martins-nome-campanha`

---

## 🆘 **SE NADA FUNCIONAR:**

Execute esta query para **resetar e recriar tudo**:

```sql
-- ⚠️ CUIDADO: Isso vai limpar team_members e recriar operações
DELETE FROM team_members;
DELETE FROM teams WHERE slug IN ('caio-martins', 'gustavo-de-castro');

-- Depois execute MIGRATION_POPULATE_DATA.sql novamente
```

---

## 📞 **PRÓXIMO PASSO:**

**EXECUTE AGORA:** `MIGRATION_POPULATE_DATA.sql` no Supabase SQL Editor

Depois me confirme o resultado que aparecer no console! 🚀
