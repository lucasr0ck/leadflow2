# 🎯 MIGRAÇÃO GUSTAVO DE CASTRO - GUIA EXECUTIVO

## ❌ **PROBLEMA IDENTIFICADO:**

A migration anterior (`MIGRATION_POPULATE_GUSTAVO.sql`) tentou mover dados **dentro da tabela `sellers`** usando filtro `name LIKE '%2'`, mas os dados do Gustavo estão em **TABELAS SEPARADAS**:

- `sellers2` (vendedores do Gustavo)
- `seller_contacts2` (contatos dos vendedores do Gustavo)
- `campaigns2` (campanhas do Gustavo - se existir)
- `clicks2` (clicks do Gustavo - se existir)

---

## ✅ **SOLUÇÃO:**

Criadas 2 novas queries SQL:

1. **`DIAGNOSTICO_TABLES2.sql`** - Verificar o que existe
2. **`MIGRATION_TABLES2_TO_GUSTAVO.sql`** - Migrar tudo de uma vez

---

## 📋 **PASSO A PASSO:**

### **PASSO 1: Diagnóstico (Opcional mas Recomendado)** 🔍

Execute no Supabase SQL Editor: **`DIAGNOSTICO_TABLES2.sql`**

**O que verifica:**
- ✅ Quais tabelas com sufixo `2` existem
- ✅ Quantos registros tem em cada
- ✅ Primeiros registros de cada tabela
- ✅ Estado atual das operações

**Console esperado:**
```
sellers: X registros
sellers2: Y registros ⚠️ PRECISA MIGRAR
seller_contacts: X registros
seller_contacts2: Y registros ⚠️ PRECISA MIGRAR
campaigns2: Y registros ⚠️ PRECISA MIGRAR (se existir)
```

---

### **PASSO 2: Migration Principal** 🚀 **CRÍTICO**

Execute no Supabase SQL Editor: **`MIGRATION_TABLES2_TO_GUSTAVO.sql`**

**O que faz:**
1. ✅ Busca ID do Gustavo de Castro
2. ✅ Migra `sellers2` → `sellers` (com `team_id` do Gustavo)
3. ✅ Migra `seller_contacts2` → `seller_contacts`
4. ✅ Migra `campaigns2` → `campaigns` (com `full_slug` correto)
5. ✅ Migra `clicks2` → `clicks`
6. ✅ Mostra relatório final

**Console esperado:**
```
✅ Gustavo de Castro ID: [uuid]

📦 Migrando sellers2 → sellers...
✅ Vendedores migrados: X

📦 Migrando seller_contacts2 → seller_contacts...
✅ Contatos migrados: Y

📦 Migrando campaigns2 → campaigns...
✅ Campanhas migradas: Z

📦 Migrando clicks2 → clicks...
✅ Clicks migrados: W

MIGRAÇÃO CONCLUÍDA COM SUCESSO!
Totais na operação Gustavo de Castro:
  - Vendedores: X
  - Contatos: Y
  - Campanhas: Z
  - Clicks: W
```

---

### **PASSO 3: Verificar Resultado** ✅

A migration já traz queries de verificação no final. Você verá:

**3.1 - Tabelas antigas ainda existem?**
```
table_name           | status
---------------------+------------------
sellers2            | ⚠️ Ainda existe
seller_contacts2    | ⚠️ Ainda existe
campaigns2          | ⚠️ Ainda existe
```

**3.2 - Vendedores por operação:**
```
team_name         | sellers_count | contacts_count
------------------+---------------+----------------
Caio Martins      |      X        |       Y
Gustavo de Castro |      Z        |       W
```

**3.3 - Vendedores do Gustavo:**
```
name     | weight | contacts
---------+--------+----------
Jhoni2   |   1    |    3
Sergio2  |   1    |    5
Rafael2  |   1    |    4
...
```

**3.4 - Campanhas do Gustavo:**
```
name        | full_slug                      | clicks
------------+--------------------------------+--------
IG Bio2     | gustavo-de-castro-ig-bio       |   10
WhatsApp2   | gustavo-de-castro-whatsapp     |   5
```

---

### **PASSO 4: Excluir Tabelas Antigas** 🗑️ **OPCIONAL**

**⚠️ CUIDADO: Só execute depois de confirmar que está tudo OK!**

Na migration `MIGRATION_TABLES2_TO_GUSTAVO.sql`, descomente estas linhas:

```sql
DROP TABLE IF EXISTS clicks2 CASCADE;
DROP TABLE IF EXISTS seller_contacts2 CASCADE;
DROP TABLE IF EXISTS sellers2 CASCADE;
DROP TABLE IF EXISTS campaigns2 CASCADE;
DROP TABLE IF EXISTS teams2 CASCADE;
```

Execute novamente para limpar as tabelas antigas.

**✅ Quando executar:**
- Após verificar que todos os dados foram migrados
- Após testar na aplicação que tudo funciona
- Após confirmar que não precisa mais das tabelas antigas

---

## 🧪 **TESTAR NA APLICAÇÃO:**

Após a migration:

1. **Limpe cache do navegador** (Cmd+Shift+Delete)
2. **Reabra aplicação**
3. **Faça login**
4. **Troque para operação "Gustavo de Castro"**
5. **Verifique:**
   - ✅ Vendedores aparecem (Jhoni2, Sergio2, Rafael2...)
   - ✅ Campanhas aparecem
   - ✅ Contatos dos vendedores aparecem
   - ✅ Dashboard mostra estatísticas
6. **Teste redirect:**
   - Copie link de campanha do Gustavo
   - Abra em aba anônima
   - Deve redirecionar para WhatsApp

---

## 🐛 **TROUBLESHOOTING:**

### **Problema: "Gustavo de Castro não encontrada"**

**Causa:** Operação não foi criada

**Solução:**
```sql
-- Verificar operações:
SELECT * FROM teams WHERE slug LIKE '%gustavo%';

-- Se não existir, criar:
INSERT INTO teams (team_name, slug, description, owner_id, is_active)
VALUES (
  'Gustavo de Castro',
  'gustavo-de-castro',
  'Operação secundária',
  (SELECT id FROM auth.users WHERE email = 'multiumcursoltda@gmail.com'),
  true
);
```

---

### **Problema: "Tabela sellers2 não existe"**

**Causa:** Dados já foram migrados OU nunca existiram

**Solução:**
```sql
-- Verificar se vendedores já estão em sellers:
SELECT name, team_id FROM sellers WHERE name LIKE '%2';

-- Se estiverem com team_id errado:
UPDATE sellers
SET team_id = (SELECT id FROM teams WHERE slug = 'gustavo-de-castro')
WHERE name LIKE '%2';
```

---

### **Problema: "Vendedores migrados mas sem contatos"**

**Causa:** `seller_contacts2` não foi migrada OU IDs não correspondem

**Solução:**
```sql
-- Verificar contatos órfãos:
SELECT * FROM seller_contacts2
WHERE seller_id NOT IN (SELECT id FROM sellers);

-- Se houver, verificar IDs corretos e migrar manualmente
```

---

### **Problema: "Campanhas com full_slug NULL"**

**Causa:** Migration não gerou `full_slug` corretamente

**Solução:**
```sql
UPDATE campaigns c
SET full_slug = 'gustavo-de-castro-' || c.slug
WHERE c.team_id = (SELECT id FROM teams WHERE slug = 'gustavo-de-castro')
AND (c.full_slug IS NULL OR c.full_slug = '');
```

---

## 📊 **ESTRUTURA FINAL ESPERADA:**

### **Tabelas Unificadas:**
```
sellers (todos os vendedores de todas operações)
  ├─ Caio Martins: Jhoni, Sergio, Rafael...
  └─ Gustavo de Castro: Jhoni2, Sergio2, Rafael2...

seller_contacts (todos os contatos de todos vendedores)
  ├─ Contatos do Jhoni (Caio)
  ├─ Contatos do Sergio (Caio)
  ├─ Contatos do Jhoni2 (Gustavo)
  └─ Contatos do Sergio2 (Gustavo)

campaigns (todas as campanhas de todas operações)
  ├─ Caio: full_slug = caio-martins-X
  └─ Gustavo: full_slug = gustavo-de-castro-X

clicks (todos os clicks de todas operações)
  ├─ Clicks do Caio
  └─ Clicks do Gustavo
```

### **Tabelas Antigas (podem ser excluídas):**
```
sellers2 → MIGRADO para sellers
seller_contacts2 → MIGRADO para seller_contacts
campaigns2 → MIGRADO para campaigns
clicks2 → MIGRADO para clicks
```

---

## ✅ **CHECKLIST FINAL:**

- [ ] Execute `DIAGNOSTICO_TABLES2.sql` para ver o que existe
- [ ] Execute `MIGRATION_TABLES2_TO_GUSTAVO.sql` para migrar
- [ ] Verifique console: todos os dados migrados com sucesso
- [ ] Teste na aplicação: vendedores do Gustavo aparecem
- [ ] Teste na aplicação: campanhas do Gustavo aparecem
- [ ] Teste redirect de campanha do Gustavo → abre WhatsApp
- [ ] (Opcional) Exclua tabelas antigas se tudo estiver OK

---

## 🚀 **EXECUTE AGORA:**

### **1. Diagnóstico (Opcional):**
```sql
-- Copie e cole: DIAGNOSTICO_TABLES2.sql
```

### **2. Migration Principal:**
```sql
-- Copie e cole: MIGRATION_TABLES2_TO_GUSTAVO.sql
```

### **3. Me confirme o resultado do console!** 📊

---

**💡 TIP:** Se estiver com dúvida, execute primeiro o diagnóstico e me envie o resultado. Assim posso confirmar exatamente o que precisa ser migrado!
