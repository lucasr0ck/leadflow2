# 🚨 CORREÇÕES APLICADAS - LOADING INFINITO E GUSTAVO VAZIO

## ❌ **PROBLEMAS IDENTIFICADOS:**

1. **Loading infinito** ("Carregando..." sem parar)
   - Causa: `useEffect` chamando `loadUserTeams()` duas vezes
   - Causa: Race condition entre múltiplas chamadas

2. **Gustavo de Castro vazio**
   - Vendedores com sufixo "2" estão em Caio Martins
   - Campanhas com sufixo "2" estão em Caio Martins

---

## ✅ **CORREÇÕES APLICADAS:**

### **1. TeamContext.tsx - Fix Loading Infinito**

#### **Problema:**
```tsx
// useEffect 1: Chama loadUserTeams ao montar
useEffect(() => {
  loadUserTeams();
}, []);

// useEffect 2: Chama loadUserTeams em SIGNED_IN
useEffect(() => {
  onAuthStateChange(() => {
    loadUserTeams(); // SEGUNDA CHAMADA!
  });
}, []);
```

#### **Solução:**
```tsx
// useCallback com dependências corretas
const loadUserTeams = useCallback(async () => {
  // Ref para prevenir chamadas simultâneas
  if (isLoadingRef.current) {
    console.log('Já está carregando, ignorando');
    return;
  }
  
  isLoadingRef.current = true;
  try {
    // ... código
  } finally {
    isLoadingRef.current = false; // ✅ SEMPRE reseta
  }
}, [toast]);

// UM ÚNICO useEffect
useEffect(() => {
  loadUserTeams(); // Chamada inicial
  
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN') {
      loadUserTeams(); // Só chama se já não estiver carregando
    }
  });
  
  return () => subscription.unsubscribe();
}, [loadUserTeams]); // ✅ Dependência correta
```

**Benefícios:**
- ✅ Previne chamadas duplicadas com `isLoadingRef`
- ✅ `useCallback` garante estabilidade da função
- ✅ `finally` sempre reseta o ref (mesmo com erro)
- ✅ Logs de debug para troubleshooting
- ✅ Um único `useEffect` = menos race conditions

---

### **2. MIGRATION_POPULATE_GUSTAVO.sql**

**O que faz:**
1. ✅ Move vendedores com `name LIKE '%2'` → Gustavo de Castro
2. ✅ Move campanhas com `name LIKE '%2'` → Gustavo de Castro
3. ✅ Atualiza `full_slug` das campanhas para `gustavo-de-castro-X`
4. ✅ Atualiza clicks para apontar para Gustavo de Castro

**Resultado esperado:**
```
✅ Vendedores movidos para Gustavo de Castro: X
✅ Campanhas movidas para Gustavo de Castro: Y
✅ Clicks atualizados para Gustavo de Castro: Z

Operação Caio Martins: X vendedores, Y campanhas
Operação Gustavo de Castro: Z vendedores, W campanhas
```

---

## 🎯 **INSTRUÇÕES DE DEPLOY:**

### **PASSO 1: Execute as 2 Migrations no Supabase** 🔴 **OBRIGATÓRIO**

#### **Migration 1: Consolidar Caio Martins**
```sql
-- Execute: MIGRATION_CONSOLIDATE_CAIO.sql
-- Move tudo de Multium Cursos → Caio Martins
-- Exclui Multium Cursos
```

#### **Migration 2: Popular Gustavo de Castro**
```sql
-- Execute: MIGRATION_POPULATE_GUSTAVO.sql
-- Move dados sufixo 2 → Gustavo de Castro
```

**IMPORTANTE:** Execute nesta ordem!

---

### **PASSO 2: Redeploy no Easypanel**

Código novo já está no GitHub (commit d9400db)

1. Easypanel → Seu App
2. **Redeploy**
3. Aguarde finalizar

---

### **PASSO 3: Limpar Cache COMPLETAMENTE**

```bash
# Chrome DevTools (F12)
1. Application tab
2. Storage → Clear site data
3. Marcar TUDO (Cache, Cookies, Local Storage)
4. Click "Clear site data"

# OU Cmd+Shift+Delete → All time → Clear all
```

---

### **PASSO 4: Testar com DevTools Aberto**

Abra **F12 ANTES** de recarregar a página!

#### **Console esperado:**
```
TeamContext: Inicializando...
TeamContext: Já está carregando, ignorando chamada duplicada ✅
Auth state change: SIGNED_IN
TeamContext: Auth mudou -> SIGNED_IN
[Carregando operações...]
✅ 2 operações carregadas
```

#### **Teste de navegação:**
1. Login → Loading para em ~2s ✅
2. Dashboard carrega ✅
3. Dropdown mostra 2 operações ✅
4. Troca para Gustavo → Console: "Switching to team: [uuid]" ✅
5. Vendedores carregam (com sufixo 2) ✅
6. Campanhas carregam (com sufixo 2) ✅
7. Troca de volta para Caio → Tudo funciona ✅
8. Botão Sair → Desloga corretamente ✅

---

## 🐛 **TROUBLESHOOTING:**

### **Loading ainda infinito?**

Abra Console (F12) e procure por:

```javascript
// Se aparecer LOOP:
TeamContext: Inicializando...
TeamContext: Inicializando...
TeamContext: Inicializando...
// ❌ PROBLEMA: useEffect em loop

// Se aparecer TRAVADO em:
[Carregando operações...]
// ❌ PROBLEMA: Query RPC travada

// Teste a query manualmente no Supabase:
SELECT * FROM get_user_teams();
```

**Solução se query travar:**
```sql
-- Verificar se há índices:
SELECT tablename, indexname FROM pg_indexes 
WHERE tablename = 'team_members';

-- Se não houver, criar:
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
```

---

### **Gustavo ainda vazio?**

```sql
-- Verificar vendedores com sufixo 2:
SELECT name, team_id FROM sellers WHERE name LIKE '%2';

-- Verificar campanhas com sufixo 2:
SELECT name, team_id FROM campaigns WHERE name LIKE '%2';

-- Se ainda estiverem em Caio Martins, execute novamente:
-- MIGRATION_POPULATE_GUSTAVO.sql
```

---

### **Dropdown ainda some?**

Se dropdown sumir ao trocar de operação:

1. Verificar Console (F12): procure por erros
2. Verificar Network tab: procure por requests falhando
3. Execute no Console:
   ```javascript
   localStorage.getItem('leadflow_current_team_id')
   ```
4. Se retornar `null`, significa que `switchTeam` não está salvando

---

## 📊 **VERIFICAÇÃO COMPLETA:**

Execute no Supabase após migrations:

```sql
-- Status geral
SELECT 
  t.team_name,
  t.slug,
  t.is_active,
  (SELECT COUNT(*) FROM sellers WHERE team_id = t.id) as sellers,
  (SELECT COUNT(*) FROM campaigns WHERE team_id = t.id) as campaigns,
  (SELECT COUNT(*) FROM clicks WHERE team_id = t.id) as clicks,
  (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) as members
FROM teams t
ORDER BY t.team_name;
```

**Esperado:**
```
team_name         | slug              | sellers | campaigns | clicks | members
------------------+-------------------+---------+-----------+--------+---------
Caio Martins      | caio-martins      |   X     |    Y      |   Z    |    1
Gustavo de Castro | gustavo-de-castro |   W     |    V      |   U    |    1
```

```sql
-- Verificar vendedores por operação
SELECT 
  t.team_name,
  COUNT(*) as total,
  STRING_AGG(s.name, ', ' ORDER BY s.name) as vendedores
FROM sellers s
INNER JOIN teams t ON s.team_id = t.id
GROUP BY t.team_name
ORDER BY t.team_name;
```

**Esperado:**
```
team_name         | total | vendedores
------------------+-------+----------------------------------
Caio Martins      |   X   | Jhoni, Sergio, Rafael, ...
Gustavo de Castro |   Y   | Jhoni2, Sergio2, Rafael2, ...
```

---

## ✅ **CHECKLIST FINAL:**

Após todas as correções:

- [ ] Loading para em ~2s (não fica infinito)
- [ ] Console mostra logs sem loops
- [ ] Dropdown mostra 2 operações (Caio + Gustavo)
- [ ] Caio Martins tem vendedores SEM sufixo 2
- [ ] Caio Martins tem campanhas SEM sufixo 2
- [ ] Gustavo de Castro tem vendedores COM sufixo 2
- [ ] Gustavo de Castro tem campanhas COM sufixo 2
- [ ] Dropdown não some ao navegar
- [ ] Botão Sair funciona
- [ ] Sem erros no Console (F12)
- [ ] ~~Multium Cursos não existe mais~~

---

## 📝 **RESUMO DOS COMMITS:**

```
cf18099 - fix: dropdown sumindo e botão sair
d9400db - fix: loading infinito e migration Gustavo
```

**Arquivos modificados:**
- `src/contexts/TeamContext.tsx` → useCallback + useRef + logs
- `MIGRATION_CONSOLIDATE_CAIO.sql` → consolida Multium → Caio
- `MIGRATION_POPULATE_GUSTAVO.sql` → move sufixo 2 → Gustavo

---

**🚀 EXECUTE AS 2 MIGRATIONS AGORA NO SUPABASE!**

1. `MIGRATION_CONSOLIDATE_CAIO.sql` (primeiro)
2. `MIGRATION_POPULATE_GUSTAVO.sql` (depois)

Depois: Redeploy + Clear cache + Testar! 🎯
