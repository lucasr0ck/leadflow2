# 🚨 DEPLOY EASYPANEL - INSTRUÇÕES CRÍTICAS

## ⚠️ IMPORTANTE: Execute ANTES do deploy!

O Easypanel **NÃO executa migrations automaticamente**. 
Você DEVE executar as migrations no Supabase **ANTES** de acessar a aplicação.

---

## 📋 PASSO A PASSO OBRIGATÓRIO:

### **1. Executar Migrations no Supabase (ANTES DO DEPLOY)**

Acesse: **Supabase Dashboard** → **SQL Editor**

Execute **3 migrations** nesta ordem:

#### **Migration 1: Estrutura Multi-Tenant** ✅
```bash
# Copiar para área de transferência:
cat supabase/migrations/20251104120000_multi_tenant_structure_FIXED.sql | pbcopy
```

Cole no SQL Editor e clique **RUN**

#### **Migration 2: Fix get_user_teams** ✅
```bash
cat supabase/migrations/20251104140000_fix_get_user_teams.sql | pbcopy
```

Cole no SQL Editor e clique **RUN**

#### **Migration 3: Performance Fixes** ✅
```bash
cat supabase/migrations/20251104150000_performance_fixes.sql | pbcopy
```

Cole no SQL Editor e clique **RUN**

---

### **2. Atualizar Edge Function no Supabase**

A Edge Function `redirect-handler` também precisa ser atualizada:

**Opção A: Via Supabase CLI**
```bash
cd /Users/lucasrocha/leadflow2-1/leadflow2
supabase functions deploy redirect-handler
```

**Opção B: Manual no Dashboard**
1. Supabase Dashboard → **Edge Functions**
2. Selecione `redirect-handler`
3. Cole o conteúdo de `supabase/functions/redirect-handler/index.ts`
4. Clique **Deploy**

---

### **3. Deploy no Easypanel**

Agora sim, faça o deploy:

1. Easypanel → Seu App
2. Deploy from GitHub (branch: main)
3. Aguarde build finalizar

---

### **4. Verificar Variáveis de Ambiente**

Certifique-se que o Easypanel tem:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key
VITE_APP_BASE_URL=https://seu-dominio.com
```

---

## ✅ CHECKLIST DE VALIDAÇÃO:

Após deploy, teste:

- [ ] Login funciona
- [ ] Dashboard carrega sem erros
- [ ] Menu "Configurações" → "Gerenciar Operações" existe
- [ ] Consegue criar nova operação
- [ ] Dropdown de operações aparece no sidebar
- [ ] Consegue criar campanha
- [ ] Link da campanha tem formato: `/r/operacao-slug-campanha-slug`
- [ ] Redirect funciona (clique no link)

---

## 🐛 Se a aplicação voltar ao estado antigo:

**Causa:** Migrations não foram executadas no Supabase

**Solução:**
1. Pare o Easypanel
2. Execute as 3 migrations acima
3. Reinicie o Easypanel
4. Limpe cache do navegador (Ctrl+Shift+R)

---

## 📊 Verificar se Migrations Foram Executadas:

No Supabase SQL Editor, execute:

```sql
-- Verificar se team_members existe
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_name = 'team_members'
);

-- Verificar se função get_user_teams existe
SELECT EXISTS (
  SELECT FROM pg_proc 
  WHERE proname = 'get_user_teams'
);

-- Verificar se campanhas têm full_slug
SELECT COUNT(*) as total_campaigns,
       COUNT(full_slug) as with_full_slug
FROM campaigns;

-- Verificar índices criados
SELECT tablename, indexname 
FROM pg_indexes 
WHERE tablename IN ('campaigns', 'sellers', 'clicks', 'team_members')
ORDER BY tablename, indexname;
```

**Resultado esperado:**
- `team_members` = true
- `get_user_teams` = true
- `total_campaigns` = `with_full_slug`
- Vários índices listados

---

## 🚀 Ordem Correta:

```
1. ✅ Executar migrations no Supabase
2. ✅ Atualizar edge function
3. ✅ Deploy no Easypanel
4. ✅ Testar aplicação
```

**NÃO:**
```
❌ Deploy no Easypanel
❌ Depois executar migrations (tarde demais!)
```

---

## 📞 Suporte Rápido:

Se ainda não funcionar:

1. Abra DevTools (F12)
2. Vá na aba Console
3. Faça print dos erros
4. Verifique se as migrations foram executadas (queries acima)

---

**Lembre-se:** Easypanel = Frontend Only | Supabase = Backend + Database
