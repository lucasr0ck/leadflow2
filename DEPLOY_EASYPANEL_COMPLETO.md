# 🚀 GUIA COMPLETO DE DEPLOY - EASYPANEL + SUPABASE

**Data:** 5 de novembro de 2025  
**Status:** ✅ TESTADO E FUNCIONANDO  
**Urgência:** 🔴 CRÍTICO - 22 famílias dependem deste projeto

---

## 📋 CHECKLIST PRÉ-DEPLOY (OBRIGATÓRIO)

Antes de fazer QUALQUER deploy, execute este checklist:

### ✅ 1. Supabase - Configuração do Backend

#### 1.1 Verificar URL e Keys do Projeto

1. Acesse: https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá em **Settings** → **API**
4. Copie:
   - **Project URL**: `https://[seu-projeto].supabase.co`
   - **anon/public key**: `eyJhbG...` (chave longa)

**⚠️ ANOTE ESSAS INFORMAÇÕES - Você vai usar no Easypanel!**

#### 1.2 Executar Migrations (DATABASE)

**🚨 CRÍTICO:** Sem migrations, a aplicação NÃO FUNCIONA!

1. Supabase Dashboard → **SQL Editor**
2. Clique em **New query**
3. Execute as migrations **NESTA ORDEM**:

##### **Migration 1: Estrutura Multi-Tenant**

```sql
-- Cole TODO o conteúdo do arquivo:
-- supabase/migrations/20251104120000_multi_tenant_structure_FIXED.sql
```

**Como copiar no Mac:**
```bash
cd /Users/lucasrocha/Documents/leadflowv2/leadflow2-2
cat supabase/migrations/20251104120000_multi_tenant_structure_FIXED.sql | pbcopy
```

Clique **RUN** e aguarde "Success"

##### **Migration 2: Fix get_user_teams**

```sql
-- Cole TODO o conteúdo do arquivo:
-- supabase/migrations/20251104140000_fix_get_user_teams.sql
```

```bash
cat supabase/migrations/20251104140000_fix_get_user_teams.sql | pbcopy
```

Clique **RUN** e aguarde "Success"

##### **Migration 3: Performance Fixes**

```sql
-- Cole TODO o conteúdo do arquivo:
-- supabase/migrations/20251104150000_performance_fixes.sql
```

```bash
cat supabase/migrations/20251104150000_performance_fixes.sql | pbcopy
```

Clique **RUN** e aguarde "Success"

#### 1.3 Verificar se Migrations Foram Aplicadas

Cole e execute no SQL Editor:

```sql
-- Verificação completa
SELECT 
  'team_members table exists' as check_name,
  EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'team_members'
  )::text as result
UNION ALL
SELECT 
  'get_user_teams function exists',
  EXISTS (
    SELECT FROM pg_proc 
    WHERE proname = 'get_user_teams'
  )::text
UNION ALL
SELECT 
  'full_slug column exists',
  EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'campaigns' AND column_name = 'full_slug'
  )::text;
```

**Resultado esperado:** Todas as linhas devem ter `result = true`

Se algum retornar `false`, a migration FALHOU! Execute novamente.

#### 1.4 Atualizar Edge Function (redirect-handler)

**Opção A: Via Supabase CLI (Recomendado)**

```bash
cd /Users/lucasrocha/Documents/leadflowv2/leadflow2-2
supabase functions deploy redirect-handler
```

**Opção B: Manual no Dashboard**

1. Supabase Dashboard → **Edge Functions**
2. Se não existir, clique **Create function**
   - Nome: `redirect-handler`
3. Cole o conteúdo de: `supabase/functions/redirect-handler/index.ts`
4. Clique **Deploy**

#### 1.5 Configurar Políticas RLS (Row Level Security)

Execute no SQL Editor:

```sql
-- Verificar se RLS está ativo em todas as tabelas
SELECT 
  schemaname, 
  tablename, 
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('teams', 'team_members', 'campaigns', 'sellers', 'clicks')
ORDER BY tablename;
```

**Todas devem ter `rls_enabled = true`**

Se alguma estiver `false`, execute:

```sql
ALTER TABLE public.[nome_da_tabela] ENABLE ROW LEVEL SECURITY;
```

---

### ✅ 2. Easypanel - Configuração do Frontend

#### 2.1 Criar Novo App (se ainda não criou)

1. Acesse seu Easypanel
2. Clique **Create App**
3. Configurações:
   - **Name**: `leadflow2`
   - **Type**: **App**
   - **Source**: **GitHub**

#### 2.2 Conectar Repositório GitHub

1. Em **Source**, clique **Connect GitHub**
2. Autorize o Easypanel
3. Selecione:
   - **Repository**: `lucasr0ck/leadflow2`
   - **Branch**: `main`
4. **Build Configuration**:
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

#### 2.3 Configurar Variáveis de Ambiente (CRÍTICO!)

**🚨 SEM ESSAS VARIÁVEIS, A APP NÃO FUNCIONA!**

No Easypanel, vá em **Environment Variables** e adicione:

```env
VITE_SUPABASE_URL=https://[seu-projeto].supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...
VITE_APP_BASE_URL=https://leadflow2.midiaslab.com.br
```

**⚠️ IMPORTANTE:**
- Cole as informações que você anotou no passo 1.1
- `VITE_APP_BASE_URL` deve ser o domínio do seu Easypanel
- Essas variáveis são usadas durante o **BUILD**, não runtime!

#### 2.4 Configurar Domínio

1. Easypanel → Seu App → **Domains**
2. Adicione: `leadflow2.midiaslab.com.br`
3. Configure DNS:
   - Tipo: **CNAME** ou **A Record**
   - Aponta para o IP/hostname do Easypanel

#### 2.5 Configurar Build do Docker

Se o Easypanel usar Dockerfile (melhor opção):

**Verifique se o Dockerfile está correto:**

```dockerfile
# Etapa 1: Build
FROM node:18-alpine as builder
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_APP_BASE_URL
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

# Etapa 2: Nginx
FROM nginx:stable-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**No Easypanel:**
- **Build Args**: Adicione as 3 variáveis de ambiente como Build Args

---

### ✅ 3. Deploy

#### 3.1 Fazer Deploy

1. No Easypanel, clique **Deploy**
2. Aguarde o build (pode levar 2-5 minutos)
3. Verifique os logs:
   - Build deve finalizar com sucesso
   - Container deve iniciar
   - Nginx deve estar rodando na porta 80

#### 3.2 Verificar Logs

No Easypanel, vá em **Logs** e verifique:

```
✅ Build completed successfully
✅ Container started
✅ nginx: [notice] start worker processes
```

Se houver erro, verifique:
- Variáveis de ambiente estão corretas?
- Build command está certo?
- Output directory é `dist`?

---

## 🧪 TESTES PÓS-DEPLOY

Após o deploy, **TESTE TUDO**:

### 1. Acesse a Aplicação

```
https://leadflow2.midiaslab.com.br
```

### 2. Teste Login

- [ ] Página de login carrega
- [ ] Console do navegador (F12) **SEM ERROS VERMELHOS**
- [ ] Consegue fazer login
- [ ] Após login, redireciona para `/dashboard`

### 3. Teste Dashboard

- [ ] Dashboard carrega
- [ ] Menu lateral aparece
- [ ] Dropdown de operações aparece no topo
- [ ] Cards de analytics aparecem (podem estar com 0 se não houver dados)

### 4. Teste F5 (Problema que resolvemos!)

- [ ] No dashboard, pressione **F5**
- [ ] Página recarrega normalmente
- [ ] Dashboard volta a aparecer (não fica em "Carregando..." infinito)
- [ ] Console **SEM LOOP INFINITO** de logs

### 5. Teste Criação de Campanha

- [ ] Menu → Campanhas → Nova Campanha
- [ ] Preenche formulário
- [ ] Salva campanha
- [ ] Link gerado tem formato: `https://leadflow2.midiaslab.com.br/r/operacao-slug-campanha-slug`

### 6. Teste Redirect

- [ ] Copie o link da campanha
- [ ] Abra em aba anônima (Ctrl+Shift+N)
- [ ] Deve redirecionar para o link original da campanha
- [ ] No Supabase, verifica se click foi registrado:

```sql
SELECT * FROM clicks ORDER BY clicked_at DESC LIMIT 10;
```

---

## 🐛 TROUBLESHOOTING

### Problema: "Tela Branca" após deploy

**Causa:** Variáveis de ambiente não foram passadas no build

**Solução:**
1. Easypanel → Environment Variables
2. Adicione as 3 variáveis (VITE_*)
3. **Rebuild** o app
4. Aguarde novo deploy

### Problema: "Erro ao carregar operações"

**Causa:** Migrations não foram executadas

**Solução:**
1. Vá no Supabase SQL Editor
2. Execute o script de verificação (passo 1.3)
3. Se retornar `false`, execute as migrations novamente
4. Faça um **Hard Refresh** no navegador (Ctrl+Shift+R)

### Problema: Loop infinito de logs "[TeamContext] Loading teams"

**Causa:** Código antigo (antes do fix do useRef)

**Solução:**
1. Verifique se o commit `9c18084` foi aplicado:
```bash
git log --oneline | head -n 5
```
2. Deve aparecer: "fix: Correção definitiva do loop infinito - usa useRef para toast"
3. Se não aparecer, faça `git pull origin main`
4. Redeploy no Easypanel

### Problema: "Cannot read property 'team_id' of null"

**Causa:** Usuário não tem operação criada

**Solução:**
1. Menu → Configurações → Gerenciar Operações
2. Clique **Criar Nova Operação**
3. Preencha nome e salve
4. Aguarde recarregar

### Problema: Redirect não funciona (404)

**Causa:** Edge Function não foi deployada

**Solução:**
1. Supabase Dashboard → Edge Functions
2. Verifique se `redirect-handler` existe
3. Se não, execute:
```bash
supabase functions deploy redirect-handler
```

---

## 📊 LOGS IMPORTANTES

### Logs do Navegador (Console - F12)

**✅ Logs BONS (esperados):**
```
[AuthProvider] Window location: https://leadflow2.midiaslab.com.br/dashboard
[TeamContext] Effect - authLoading: false, user: email@example.com
[TeamContext] Loading teams for: email@example.com
[TeamContext] Teams loaded: 1
[TeamContext] Selected: Nome da Operação
[ProtectedRoute] Ready - rendering
```

**❌ Logs RUINS (problemas):**
```
Error: function get_user_teams() does not exist
  → Migrations não foram executadas!

[TeamContext] Loading teams for: email@example.com (loop infinito)
  → Código desatualizado, precisa do fix do useRef

Failed to fetch → Network error
  → Variáveis de ambiente erradas ou Supabase fora do ar
```

---

## 🔐 SEGURANÇA

### Variáveis que DEVEM estar no Easypanel:
- ✅ `VITE_SUPABASE_URL`
- ✅ `VITE_SUPABASE_ANON_KEY`
- ✅ `VITE_APP_BASE_URL`

### Variáveis que NÃO devem ser commitadas no GitHub:
- ❌ Service Role Key (super perigosa!)
- ❌ Senhas de banco
- ❌ Tokens privados

**⚠️ A `anon key` pode ser exposta** (ela é usada no frontend mesmo)

---

## ✅ CHECKLIST FINAL

Antes de considerar o deploy completo, verifique:

- [ ] Migrations executadas no Supabase (3 arquivos)
- [ ] Edge Function deployada
- [ ] Variáveis de ambiente configuradas no Easypanel
- [ ] Build concluído com sucesso
- [ ] App acessível pelo domínio
- [ ] Login funciona
- [ ] F5 funciona (sem loop infinito)
- [ ] Consegue criar campanha
- [ ] Redirect funciona
- [ ] Clicks são registrados no banco

---

## 📞 SUPORTE URGENTE

Se após seguir TODO este guia ainda houver problemas:

1. **Abra DevTools (F12)**
2. **Copie TODOS os erros do Console**
3. **Tire print da tela**
4. **Execute no Supabase:**
   ```sql
   -- Status do banco
   SELECT 
     (SELECT COUNT(*) FROM teams) as total_teams,
     (SELECT COUNT(*) FROM team_members) as total_members,
     (SELECT COUNT(*) FROM campaigns) as total_campaigns,
     (SELECT COUNT(*) FROM sellers) as total_sellers,
     (SELECT COUNT(*) FROM clicks) as total_clicks;
   ```
5. **Copie o resultado**

Com essas informações, é possível diagnosticar qualquer problema restante.

---

**🎯 OBJETIVO FINAL:**
✅ Aplicação 100% funcional  
✅ Zero erros no console  
✅ F5 funciona perfeitamente  
✅ 22 famílias mantém seus empregos  
✅ Projeto salvo com sucesso

**Você consegue! Vamos juntos!** 💪
