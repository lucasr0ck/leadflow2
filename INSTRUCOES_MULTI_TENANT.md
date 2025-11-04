# 🚀 INSTRUÇÕES: EXECUTAR MULTI-TENANT NO SUPABASE

## ⚠️ IMPORTANTE - LEIA ANTES DE EXECUTAR

Esta migration transforma sua aplicação de **single-tenant** para **multi-tenant**.

### O que vai acontecer:
1. ✅ Adiciona campos `slug`, `description`, `is_active` na tabela `teams`
2. ✅ Cria tabela `team_members` (usuário pode participar de múltiplos teams)
3. ✅ Adiciona campo `full_slug` na tabela `campaigns` (evita conflitos entre operações)
4. ✅ Atualiza todas as RLS policies para usar `team_members` ao invés de `owner_id`
5. ✅ Migra dados existentes (owners viram members com role 'owner')
6. ✅ Cria funções auxiliares (`is_team_member`, `is_team_admin`, `get_user_teams`)
7. ✅ Atualiza função `get_next_campaign_link` para usar `full_slug`

### ⏱️ Tempo estimado: 2-3 minutos

---

## 📋 PASSO A PASSO

### **1. FAZER BACKUP (OBRIGATÓRIO)**

Antes de executar qualquer migration, faça backup:

1. Acesse: [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecione seu projeto
3. Vá em **Database** → **Backups**
4. Clique em **Create backup** (se disponível no seu plano)

**OU** exporte as tabelas principais:

```sql
-- Copie e execute isso no SQL Editor para gerar um backup em JSON
SELECT json_build_object(
  'teams', (SELECT json_agg(teams.*) FROM teams),
  'sellers', (SELECT json_agg(sellers.*) FROM sellers),
  'campaigns', (SELECT json_agg(campaigns.*) FROM campaigns),
  'clicks', (SELECT json_agg(clicks.*) FROM clicks)
);
```

Salve o resultado em um arquivo `backup_antes_multi_tenant.json`.

---

### **2. EXECUTAR MIGRATIONS ANTERIORES (se ainda não executou)**

Se você ainda não executou as migrations de audit logs e analytics, execute primeiro:

```bash
# No terminal do seu projeto
cd /Users/lucasrocha/leadflow2-1/leadflow2
cat supabase/migrations/20251104000000_create_audit_logs.sql | pbcopy
```

Depois cole no SQL Editor do Supabase e execute.

Repita para:
```bash
cat supabase/migrations/20251104100000_analytics_functions.sql | pbcopy
```

---

### **3. EXECUTAR MIGRATION MULTI-TENANT**

#### **Opção A: Via SQL Editor (Recomendado)**

1. Acesse: [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecione seu projeto
3. No menu lateral, clique em **SQL Editor**
4. Clique em **New query**
5. Copie todo o conteúdo do arquivo: `supabase/migrations/20251104120000_multi_tenant_structure.sql`
6. Cole no editor
7. Clique em **Run** (ou pressione `Cmd + Enter`)

#### **Opção B: Via Terminal (se tiver CLI configurado)**

```bash
cd /Users/lucasrocha/leadflow2-1/leadflow2
supabase db push
```

---

### **4. VERIFICAR SE DEU CERTO**

Execute estas queries no SQL Editor para validar:

```sql
-- 1. Verificar se team_members foi criada
SELECT COUNT(*) as total_members FROM team_members;
-- Deve retornar pelo menos 1 (o owner do team atual)

-- 2. Verificar se teams têm slug
SELECT id, team_name, slug, is_active FROM teams;
-- Todos devem ter slug preenchido

-- 3. Verificar se campanhas têm full_slug
SELECT id, name, slug, full_slug FROM campaigns;
-- Todas devem ter full_slug no formato: team-slug-campaign-slug

-- 4. Testar função get_user_teams
SELECT * FROM get_user_teams();
-- Deve retornar os teams que você pertence

-- 5. Verificar policies
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('teams', 'team_members', 'sellers', 'campaigns');
-- Deve mostrar as novas policies com 'belong to'
```

---

### **5. TESTAR NA APLICAÇÃO**

Após executar a migration:

1. **Faça logout e login novamente** - Importante para atualizar a sessão
2. Verifique se a aplicação continua funcionando normalmente
3. Teste criar um seller, campanha, etc
4. Verifique se os analytics continuam carregando

---

## ⚡ PRÓXIMOS PASSOS (FASE 2)

Após confirmar que a migration funcionou:

1. ✅ **FASE 1 COMPLETA** - Database está pronto para multi-tenant
2. 🔄 **FASE 2** - Criar `TeamContext` no frontend
3. 🔄 **FASE 3** - Adicionar seletor de operação no header
4. 🔄 **FASE 4** - Tela de gestão de operações
5. 🔄 **FASE 5** - Atualizar links de redirect para usar `full_slug`
6. 🔄 **FASE 6** - Migrar dados da aplicação duplicada

---

## 🐛 TROUBLESHOOTING

### Erro: "column teams.slug does not exist"
**Solução:** A migration não foi executada. Execute novamente.

### Erro: "relation team_members does not exist"
**Solução:** A tabela não foi criada. Verifique se há erros no SQL Editor.

### Erro: "null value in column slug violates not-null constraint"
**Solução:** Execute só a parte do UPDATE antes do ALTER COLUMN:
```sql
UPDATE teams 
SET slug = LOWER(REGEXP_REPLACE(team_name, '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL;
```

### Slugs duplicados
**Solução:** Se dois teams tiverem mesmo nome, adicione sufixo:
```sql
UPDATE teams 
SET slug = slug || '-' || SUBSTRING(id::text, 1, 8)
WHERE id IN (
  SELECT id FROM teams 
  GROUP BY slug 
  HAVING COUNT(*) > 1
);
```

### Links de campanha não funcionam
**Solução:** Atualize os links nas suas campanhas para usar o novo formato:
- **Antes:** `https://seuapp.com/r/black-friday`
- **Depois:** `https://seuapp.com/r/operacao-a-black-friday`

---

## 📞 SUPORTE

Se encontrar problemas:

1. Verifique os logs de erro no SQL Editor
2. Execute as queries de verificação acima
3. Confira o arquivo `PLANO_MULTI_OPERACAO.md` para entender a arquitetura
4. Reverta para o backup se necessário

---

## ✅ CHECKLIST FINAL

Antes de continuar para FASE 2, confirme:

- [ ] Backup criado
- [ ] Migration executada sem erros
- [ ] Queries de verificação rodaram com sucesso
- [ ] Aplicação continua funcionando
- [ ] Todos os teams têm `slug` único
- [ ] Todas as campanhas têm `full_slug` único
- [ ] `team_members` tem pelo menos 1 registro
- [ ] Função `get_user_teams()` retorna dados

**Tudo OK?** Pode me avisar que continuo com a FASE 2! 🚀
