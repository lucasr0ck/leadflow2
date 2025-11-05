# 🎯 CHECKLIST COMPLETO - ORDEM DE EXECUÇÃO

## ✅ **JÁ FEITO:**
- [x] Migrations de estrutura executadas (team_members, full_slug, etc)
- [x] Edge function redirect-handler atualizada
- [x] Código com correções pushed para GitHub (commit cf18099)

---

## 🔴 **FAZER AGORA (NESTA ORDEM):**

### **1️⃣ EXECUTAR NO SUPABASE SQL EDITOR**

Copie e cole **TODO** o arquivo: `MIGRATION_CONSOLIDATE_CAIO.sql`

**O que vai acontecer:**
```
✅ Mover campanhas Multium Cursos → Caio Martins
✅ Mover vendedores Multium Cursos → Caio Martins  
✅ Mover clicks Multium Cursos → Caio Martins
✅ EXCLUIR operação Multium Cursos
```

**Resultado esperado no console:**
```
NOTICE: ✅ Caio Martins ID: [uuid]
NOTICE: ✅ Multium Cursos ID: [uuid]
NOTICE: ✅ Campanhas movidas: X
NOTICE: ✅ Vendedores movidos: Y
NOTICE: ✅ Clicks movidos: Z
NOTICE: ✅ Operação Multium Cursos EXCLUÍDA

Query returned successfully in X ms.
```

---

### **2️⃣ REDEPLOY NO EASYPANEL**

1. Acesse Easypanel → Seu App
2. Clique **"Redeploy"** ou **"Rebuild"**
3. Aguarde finalizar (1-2 min)

**O novo código inclui:**
- ✅ Dropdown com key (não some mais)
- ✅ Botão Sair funcional
- ✅ Logs de debug

---

### **3️⃣ LIMPAR CACHE DO NAVEGADOR**

**Chrome/Edge/Brave:**
1. Cmd+Shift+Delete (Mac) ou Ctrl+Shift+Delete (Windows)
2. Marque "Cached images and files"
3. Time range: "All time"
4. Clique "Clear data"

**OU feche TODAS as abas da aplicação e reabra**

---

### **4️⃣ TESTAR APLICAÇÃO**

Abra DevTools (F12) ANTES de fazer login para ver logs.

**Teste 1: Login**
```
✅ Faz login normalmente
✅ Console mostra: "Auth state change: SIGNED_IN"
```

**Teste 2: Dropdown**
```
✅ Dropdown aparece no sidebar
✅ Mostra apenas 2 operações:
   - Caio Martins
   - Gustavo de Castro
❌ Multium Cursos NÃO aparece mais
```

**Teste 3: Navegação**
```
1. Clique em "Campanhas" → Dropdown continua visível ✅
2. Clique em "Vendedores" → Dropdown continua visível ✅
3. Clique em "Dashboard" → Dropdown continua visível ✅
4. Troque para "Gustavo de Castro" → Console mostra "Switching to team: [uuid]" ✅
5. Dropdown NÃO SOME ✅
6. Troque de volta para "Caio Martins" → Tudo funciona ✅
```

**Teste 4: Dados Consolidados**
```
✅ Campanhas de Caio Martins: TODAS (sem sufixo 2)
✅ Vendedores de Caio Martins: TODOS (sem sufixo 2)
✅ Dashboard mostra estatísticas corretas
```

**Teste 5: Botão Sair**
```
1. Clique no botão "Sair"
2. Console mostra: "Logout clicked" ✅
3. Redireciona para página de login ✅
```

---

## 📊 **VERIFICAÇÃO NO SUPABASE**

Se algo não funcionar, execute estas queries:

### **Verificar operações:**
```sql
SELECT team_name, slug, 
  (SELECT COUNT(*) FROM sellers WHERE team_id = teams.id) as sellers,
  (SELECT COUNT(*) FROM campaigns WHERE team_id = teams.id) as campaigns
FROM teams 
ORDER BY team_name;
```

**Esperado:**
```
team_name         | slug              | sellers | campaigns
------------------+-------------------+---------+----------
Caio Martins      | caio-martins      |   X     |    Y
Gustavo de Castro | gustavo-de-castro |   Z     |    W
```

### **Verificar Multium Cursos foi excluído:**
```sql
SELECT COUNT(*) FROM teams WHERE slug = 'multium-cursos';
```

**Esperado:** `0`

### **Verificar membros:**
```sql
SELECT t.team_name, tm.role 
FROM team_members tm
INNER JOIN teams t ON tm.team_id = t.id
WHERE tm.user_id = auth.uid();
```

**Esperado:**
```
team_name         | role
------------------+------
Caio Martins      | owner
Gustavo de Castro | owner
```

---

## 🐛 **TROUBLESHOOTING RÁPIDO:**

### Problema: "Dropdown ainda some"
**Solução:**
1. Abra DevTools (F12)
2. Vá na aba Console
3. Navegue entre páginas
4. Procure por erros vermelhos
5. Me mande print

### Problema: "Botão Sair não funciona"
**Solução:**
1. Clique no botão
2. Verifique se aparece "Logout clicked" no console
3. Se não aparecer: clear cache e tente novamente
4. Se aparecer mas não desloga: problema no Supabase

### Problema: "Multium Cursos ainda aparece"
**Solução:**
```sql
-- Forçar exclusão manual:
DELETE FROM team_members WHERE team_id IN (
  SELECT id FROM teams WHERE slug = 'multium-cursos'
);
DELETE FROM teams WHERE slug = 'multium-cursos';
```

---

## ✅ **QUANDO TUDO FUNCIONAR:**

Você terá:

```
┌─────────────────────────────────────────────────────┐
│ ✅ 2 operações funcionais                            │
│ ✅ Dropdown sempre visível                          │
│ ✅ Botão Sair funcional                             │
│ ✅ Dados consolidados corretamente                  │
│ ✅ Navegação rápida (<1s)                           │
│ ✅ Sistema multi-tenant completo                    │
└─────────────────────────────────────────────────────┘
```

---

**🚀 COMECE AGORA: Execute `MIGRATION_CONSOLIDATE_CAIO.sql` no Supabase!**
