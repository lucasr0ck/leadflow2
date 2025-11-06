# 🚨 SOLUÇÃO RADICAL - USAR SERVICE ROLE KEY TEMPORARIAMENTE

## ⚠️ ATENÇÃO: Isso é APENAS para testar!

Se mesmo depois de desabilitar triggers o erro 500 persistir, o problema pode ser no PostgREST (API do Supabase).

### Solução Temporária:

1. **No Easypanel**, vá em **Environment Variables**

2. **SUBSTITUA temporariamente** a ANON_KEY pela SERVICE_ROLE_KEY:

```
VITE_SUPABASE_ANON_KEY=sua_service_role_key_aqui
```

3. **Onde encontrar a SERVICE_ROLE_KEY:**
   - Vá no Supabase Dashboard
   - Settings → API
   - Copie a **`service_role` key** (NÃO a anon key)

4. **Deploy** no Easypanel

5. **Teste** se funciona

### ⚠️ IMPORTANTE:

- **NUNCA** use service_role em produção com usuários reais
- É apenas para diagnóstico
- Depois que confirmar que funciona, voltamos para anon_key com RLS correto

---

## 🔍 Diagnóstico Alternativo:

Antes de usar service_role, tente verificar os **LOGS do Supabase**:

1. Vá no Supabase Dashboard
2. **Logs** → **Postgres Logs**
3. Procure por erros que aconteceram nos últimos minutos
4. Me diga o que aparece lá

Pode ter um erro específico que está causando o 500!
