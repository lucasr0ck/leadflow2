# 🚀 DEPLOY EDGE FUNCTION - INSTRUÇÕES COMPLETAS

## ❌ **PROBLEMA ATUAL:**

O redirect está travando em "Redirecionando..." porque a **Edge Function não foi deployada no Supabase**.

---

## 🎯 **OPÇÃO 1: DEPLOY AUTOMÁTICO (CLI)** ⭐

### **Pré-requisitos:**
```bash
# Instalar Supabase CLI (se não tiver)
brew install supabase/tap/supabase

# Fazer login
supabase login

# Link com o projeto
supabase link --project-ref SEU_PROJECT_REF
```

**Como encontrar PROJECT_REF:**
1. https://supabase.com/dashboard
2. Selecione seu projeto
3. Settings → General → Reference ID

### **Deploy:**
```bash
# No diretório do projeto
./deploy-edge-function.sh

# OU manualmente:
supabase functions deploy redirect-handler
```

---

## 🎯 **OPÇÃO 2: DEPLOY MANUAL (DASHBOARD)** 💻

Se o CLI não funcionar, use este método:

### **PASSO 1: Copiar código da função**

Abra: `supabase/functions/redirect-handler/index.ts`

Selecione **TODO** o conteúdo (Cmd+A) e copie (Cmd+C)

### **PASSO 2: Acessar Supabase Dashboard**

1. https://supabase.com/dashboard
2. Selecione projeto **LeadFlow - Multium Cursos**
3. Clique em **Edge Functions** no menu lateral

### **PASSO 3: Criar/Atualizar função**

**Se função NÃO EXISTE:**
1. Clique **"Create a new function"**
2. Name: `redirect-handler`
3. Cole o código copiado
4. Clique **"Create function"**

**Se função JÁ EXISTE:**
1. Clique na função `redirect-handler`
2. Aba **"Code"**
3. Apague tudo e cole o novo código
4. Clique **"Deploy"** (botão verde inferior direito)

### **PASSO 4: Aguardar deploy**

Você verá:
```
Deploying function...
✅ Function deployed successfully!
```

---

## ✅ **VERIFICAR SE FUNCIONOU:**

### **Teste 1: Via Dashboard**

1. Supabase → Edge Functions → `redirect-handler`
2. Clique **"Invoke function"** (ou aba "Test")
3. Cole este JSON:
```json
{
  "slug": "caio-martins-ig-bio"
}
```
4. Clique **"Invoke"**

**Resposta esperada:**
```json
{
  "redirectUrl": "https://wa.me/5547996922988?text=Ol%C3%A1..."
}
```

### **Teste 2: Via cURL**

```bash
# Substitua PROJECT_REF e ANON_KEY
curl -X POST \
  'https://SEU_PROJECT_REF.supabase.co/functions/v1/redirect-handler' \
  -H "Authorization: Bearer SEU_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"slug": "caio-martins-ig-bio"}'
```

### **Teste 3: Via aplicação**

1. Abra uma campanha
2. Copie o link de redirecionamento
3. Cole em uma aba anônima
4. Deve redirecionar para WhatsApp em ~2s

---

## 🐛 **TROUBLESHOOTING:**

### **Erro: "Function does not exist"**

**Causa:** Função não foi deployada

**Solução:** Siga OPÇÃO 2 (manual) acima

---

### **Erro: "Campaign not found"**

**Causa 1:** Campanhas não têm `full_slug` correto

**Solução:**
```sql
-- Verificar campanhas:
SELECT name, slug, full_slug FROM campaigns;

-- Se full_slug está null ou errado:
UPDATE campaigns c
SET full_slug = t.slug || '-' || c.slug
FROM teams t
WHERE c.team_id = t.id;
```

**Causa 2:** Usando `slug` ao invés de `full_slug`

**Solução:** Links devem ser `/r/team-slug-campaign-slug`

---

### **Erro: "No sellers available"**

**Causa:** Vendedores sem `team_id` correto

**Solução:**
```sql
-- Verificar vendedores:
SELECT s.name, s.team_id, t.team_name 
FROM sellers s
LEFT JOIN teams t ON s.team_id = t.id;

-- Se team_id está null:
-- Execute MIGRATION_POPULATE_GUSTAVO.sql
```

---

### **Erro: "No contacts available"**

**Causa:** Vendedores sem contatos

**Solução:**
```sql
-- Verificar contatos:
SELECT s.name, COUNT(sc.id) as contacts
FROM sellers s
LEFT JOIN seller_contacts sc ON s.id = sc.seller_id
GROUP BY s.name;

-- Adicionar contatos manualmente ou via interface
```

---

### **Redirect trava em "Redirecionando..." infinito**

**Causa 1:** Edge function não deployada

**Solução:** Deploy usando OPÇÃO 1 ou 2

**Causa 2:** CORS bloqueando

**Verificar:**
1. F12 → Console
2. Procure por erro CORS
3. Se tiver, verifique `corsHeaders` na edge function

**Causa 3:** Timeout

**Verificar:**
1. F12 → Network tab
2. Procure por request `redirect-handler`
3. Se status 504 (timeout), função está demorando muito

---

## 📊 **COMO A LÓGICA FUNCIONA:**

### **1. Round-Robin entre Vendedores**

```typescript
// Exemplo: 3 vendedores, 10 clicks
// Click 1: vendedor index 0 (10 % 3 = 1)
// Click 2: vendedor index 1 (11 % 3 = 2)
// Click 3: vendedor index 2 (12 % 3 = 0)
// Click 4: vendedor index 0 (13 % 3 = 1)

const sellerIndex = (clickCount || 0) % sellers.length
const selectedSeller = sellers[sellerIndex]
```

**Equidade:** Cada vendedor recebe ~33% dos leads (se 3 vendedores)

### **2. Round-Robin entre Contatos do Vendedor**

```typescript
// Exemplo: vendedor tem 3 contatos, recebeu 5 clicks
// Click 1: contato 0 (5 % 3 = 2)
// Click 2: contato 1 (6 % 3 = 0)
// Click 3: contato 2 (7 % 3 = 1)

const contactIndex = (sellerClickCount || 0) % contacts.length
const selectedContact = contacts[contactIndex]
```

**Equidade:** Cada contato recebe ~33% dos leads daquele vendedor

### **3. Mensagem de Saudação**

```typescript
const encodedMessage = encodeURIComponent(campaign.greeting_message || '')
const redirectUrl = `https://wa.me/${phone}?text=${encodedMessage}`
```

**Resultado:** Link WhatsApp com mensagem pré-preenchida

---

## ✅ **CHECKLIST FINAL:**

Após deploy:

- [ ] Edge function `redirect-handler` deployada no Supabase
- [ ] Teste via Dashboard retorna `redirectUrl`
- [ ] Campanhas têm `full_slug` correto (team-slug-campaign-slug)
- [ ] Vendedores têm `team_id` correto
- [ ] Vendedores têm ao menos 1 contato cadastrado
- [ ] Link de campanha abre em aba anônima
- [ ] Redireciona para WhatsApp em ~2s
- [ ] Mensagem de saudação aparece no WhatsApp
- [ ] Cada click vai para um vendedor diferente (round-robin)
- [ ] Cada vendedor usa seus contatos em round-robin

---

## 📝 **LOGS ÚTEIS:**

A edge function loga todas as operações:

```
[2025-11-04T19:00:00.000Z] Processing full_slug: caio-martins-ig-bio
Total clicks: 10
Selected seller: Jhoni (index: 1/3)
Seller clicks: 3
Selected contact: 5547996922988 (index: 0/2)
Click recorded successfully
Redirecting to: https://wa.me/5547996922988?text=Ol%C3%A1...
```

**Como ver logs:**
1. Supabase Dashboard → Edge Functions
2. Clique em `redirect-handler`
3. Aba **"Logs"**

---

## 🚀 **EXECUTE AGORA:**

1. **Copie** `supabase/functions/redirect-handler/index.ts`
2. **Cole** no Supabase Dashboard → Edge Functions
3. **Deploy**
4. **Teste** com uma campanha real
5. **Confirme** que redireciona para WhatsApp! 📱
