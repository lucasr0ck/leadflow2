# ✅ VERIFICAR MIGRAÇÃO MULTI-TENANT NO SUPABASE

## 🔍 **CHECKLIST DE VERIFICAÇÃO**

Execute estas queries no **SQL Editor do Supabase** para confirmar que a migration foi bem-sucedida:

---

### **1. Verificar tabela `team_members` foi criada**

```sql
SELECT COUNT(*) as total_members FROM team_members;
```

**✅ Esperado:** Retorna um número (deve ter pelo menos 1 - você como owner)  
**❌ Erro:** `relation "team_members" does not exist` = Migration não foi executada

---

### **2. Verificar campos novos em `teams`**

```sql
SELECT 
  id, 
  team_name, 
  slug, 
  description, 
  is_active, 
  owner_id 
FROM teams 
LIMIT 5;
```

**✅ Esperado:** Mostra colunas `slug`, `description`, `is_active` preenchidas  
**❌ Erro:** `column "slug" does not exist` = Migration não foi executada

---

### **3. Verificar campo `full_slug` em `campaigns`**

```sql
SELECT 
  id, 
  name, 
  slug, 
  full_slug, 
  team_id 
FROM campaigns 
LIMIT 5;
```

**✅ Esperado:** Coluna `full_slug` existe e está preenchida (formato: `team-slug-campaign-slug`)  
**❌ Erro:** `column "full_slug" does not exist` = Migration não foi executada

---

### **4. Verificar funções RPC foram criadas**

```sql
-- Listar todas as funções criadas
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN (
    'get_user_teams',
    'is_team_member',
    'is_team_admin',
    'get_next_campaign_link'
  )
ORDER BY routine_name;
```

**✅ Esperado:** Retorna 4 funções  
**❌ Problema:** Se faltar alguma, a migration não executou completamente

---

### **5. Testar função `get_user_teams()`**

```sql
SELECT * FROM get_user_teams();
```

**✅ Esperado:** Retorna seus teams com colunas:
- `team_id`
- `team_name`
- `team_slug`
- `description`
- `role` (deve ser 'owner')
- `is_active`
- `member_count`
- `joined_at`

**❌ Erro:** `function get_user_teams() does not exist` = Migration não foi executada

---

### **6. Verificar RLS Policies foram atualizadas**

```sql
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies 
WHERE tablename IN ('teams', 'team_members', 'sellers', 'campaigns', 'clicks')
ORDER BY tablename, policyname;
```

**✅ Esperado:** Policies com nomes contendo "belong to" ou "teams they belong to"  
**❌ Problema:** Se aparecer "owner_id" nas policies antigas, migration não atualizou

---

### **7. Verificar se você é membro do seu team**

```sql
SELECT 
  tm.id,
  tm.role,
  tm.joined_at,
  t.team_name
FROM team_members tm
JOIN teams t ON tm.team_id = t.id
WHERE tm.user_id = auth.uid();
```

**✅ Esperado:** Retorna pelo menos 1 linha com `role = 'owner'`  
**❌ Problema:** Se retornar vazio, o trigger de auto-add não funcionou

---

### **8. Testar função `is_team_member()`**

```sql
-- Pegue um team_id da query anterior e substitua abaixo
SELECT is_team_member('SEU_TEAM_ID_AQUI'::uuid);
```

**✅ Esperado:** Retorna `true`  
**❌ Problema:** Se retornar `false`, há problema nas policies

---

## 🚨 **SE ALGO DEU ERRADO:**

### **Cenário 1: Nenhuma função/tabela existe**
❌ **Causa:** Migration não foi executada  
✅ **Solução:** 
1. Copie o SQL novamente: `cat supabase/migrations/20251104120000_multi_tenant_structure.sql | pbcopy`
2. Cole no SQL Editor do Supabase
3. Clique em **Run**

---

### **Cenário 2: Erro de sintaxe ao executar**
❌ **Causa:** SQL copiado incorretamente ou versão do Postgres incompatível  
✅ **Solução:**
1. Verifique a versão do Postgres: `SELECT version();`
2. Execute linha por linha para identificar o erro
3. Veja a mensagem de erro no SQL Editor

---

### **Cenário 3: Tabelas existem mas `full_slug` está NULL**
❌ **Causa:** Update automático não rodou  
✅ **Solução:**
```sql
UPDATE campaigns c
SET full_slug = t.slug || '-' || c.slug
FROM teams t
WHERE c.team_id = t.id
AND c.full_slug IS NULL;
```

---

### **Cenário 4: `team_members` vazio**
❌ **Causa:** Trigger não funcionou  
✅ **Solução:**
```sql
INSERT INTO team_members (team_id, user_id, role)
SELECT id, owner_id, 'owner'
FROM teams
WHERE owner_id IS NOT NULL
ON CONFLICT (team_id, user_id) DO NOTHING;
```

---

## 🎯 **TESTE FINAL - Aplicação Frontend**

Depois de confirmar que tudo está OK no Supabase:

1. **Faça logout e login novamente** no app
2. **Verifique se o seletor de operação aparece** no sidebar
3. **Teste criar um vendedor** - deve aparecer na operação ativa
4. **Teste criar uma campanha** - verá o `full_slug` sendo gerado

---

## ✅ **TUDO OK? Próximos Passos:**

Se todas as queries acima funcionaram:

1. ✅ Migration está completa
2. ✅ Database está pronto para multi-tenant
3. 🚀 Pode continuar para **TAREFA 6** (atualizar links de redirect)

---

**Executou as queries? Me diga os resultados!** 🔍
