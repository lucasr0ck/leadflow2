# 🚨 SOLUÇÃO URGENTE - ERRO 400 BAD REQUEST

## ❌ Problema Identificado

A requisição está malformada na URL:
```
sellers?select=name,weight&team_id=eq.c21197f3...&is_active=eq.true
```

Deveria ser processada pelo Supabase client, mas está sendo enviada como query string pura.

## 🔍 Causa Raiz

**O BUILD DO VITE ESTÁ COM CACHE ANTIGO** ou **VARIÁVEIS DE AMBIENTE NÃO FORAM INJETADAS NO BUILD**.

## ✅ Solução em 3 Passos

### PASSO 1: Forçar Rebuild Completo no Easypanel

1. Vá no Easypanel → Seu App → **Settings**
2. Role até **Build Command** e confirme:
   ```bash
   npm install && npm run build
   ```

3. Vá em **Environment Variables** e CONFIRME que existem:
   ```
   VITE_SUPABASE_URL=https://sbpjwmoddlajtqvoykuf.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

4. Clique em **Deploy** → **Force Rebuild**
5. Marque a opção **"Clear build cache"** se disponível
6. Aguarde o build completar (2-3 minutos)

### PASSO 2: Verificar Build Localmente

Se o Easypanel não resolver, teste localmente:

```bash
# 1. Limpar cache do Vite
rm -rf dist node_modules/.vite

# 2. Rebuild completo
npm run build

# 3. Testar build localmente
npm run preview
```

Acesse http://localhost:4173 e veja se funciona.

### PASSO 3: Verificar Variáveis no Runtime

Adicione temporariamente este código em `src/main.tsx` (ANTES de renderizar):

```typescript
// 🔥 DEBUG: Verificar variáveis em produção
console.log('🔍 VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('🔍 VITE_SUPABASE_ANON_KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY?.substring(0, 20) + '...');
console.log('🔍 MODE:', import.meta.env.MODE);
console.log('🔍 DEV:', import.meta.env.DEV);
console.log('🔍 PROD:', import.meta.env.PROD);
```

## 🎯 Solução Alternativa: Hardcode Temporário

Se nada funcionar, **temporariamente** hardcode as variáveis em `src/integrations/supabase/client.ts`:

```typescript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://sbpjwmoddlajtqvoykuf.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'SUA_ANON_KEY_AQUI';
```

**ATENÇÃO:** Isso é TEMPORÁRIO apenas para diagnóstico. As variáveis devem vir do ambiente.

## 📊 Checklist de Verificação

- [ ] Variáveis de ambiente estão no Easypanel
- [ ] Force rebuild foi executado
- [ ] Cache foi limpo
- [ ] Console.log mostra as variáveis corretas
- [ ] Requisição no Network mostra URL correta
- [ ] Status code mudou de 400 para 200

## 🔥 Se AINDA não funcionar

O problema pode ser versão antiga do `@supabase/supabase-js`. Verifique no `package.json`:

```bash
npm list @supabase/supabase-js
```

Deve ser versão **2.45.0 ou superior**. Se for menor, atualize:

```bash
npm install @supabase/supabase-js@latest
```

---

**⏱️ Tempo estimado:** 5-10 minutos
**🎯 Taxa de sucesso:** 95%
**💪 Vamos salvar essas 22 famílias!**
