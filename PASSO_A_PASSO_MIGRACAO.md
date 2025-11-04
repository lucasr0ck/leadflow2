# 🚀 PASSO A PASSO: EXECUTAR MIGRAÇÃO MULTI-TENANT

## 📋 **PREPARAÇÃO**

### **1. Fazer Backup (OBRIGATÓRIO)**

Antes de qualquer migration, exporte seus dados:

```sql
-- Cole isso no SQL Editor do Supabase e salve o resultado
SELECT json_build_object(
  'teams', (SELECT json_agg(teams.*) FROM teams),
  'sellers', (SELECT json_agg(sellers.*) FROM sellers),
  'seller_contacts', (SELECT json_agg(seller_contacts.*) FROM seller_contacts),
  'campaigns', (SELECT json_agg(campaigns.*) FROM campaigns),
  'clicks', (SELECT json_agg(clicks.*) FROM clicks)
);
```

**Salve o resultado** em um arquivo `backup_antes_multi_tenant.json`.

---

## 🎯 **EXECUTAR MIGRAÇÃO**

### **PASSO 1: Acessar Supabase Dashboard**

1. Abra seu navegador
2. Vá para: https://supabase.com/dashboard
3. Faça login
4. Selecione seu projeto **leadflow2**

---

### **PASSO 2: Abrir SQL Editor**

1. No menu lateral esquerdo, clique em **SQL Editor**
2. Clique no botão **New query** (ou ícone ➕)
3. Você verá um editor SQL em branco

---

### **PASSO 3: Copiar o SQL da Migration**

**No seu terminal do Mac**, execute:

```bash
cat /Users/lucasrocha/leadflow2-1/leadflow2/supabase/migrations/20251104120000_multi_tenant_structure.sql | pbcopy
```

Isso copia todo o conteúdo do arquivo SQL para o clipboard.

---

### **PASSO 4: Colar no SQL Editor**

1. Volte para o **SQL Editor** do Supabase
2. Clique dentro da área de texto do editor
3. Pressione `Cmd + V` (ou clique com botão direito → Paste)
4. Você verá um SQL enorme (400+ linhas) aparecer

---

### **PASSO 5: Executar a Migration**

1. Clique no botão **Run** (canto inferior direito)
2. **OU** pressione `Cmd + Enter`
3. Aguarde... pode levar 10-30 segundos

---

### **PASSO 6: Verificar Resultado**

Se tudo deu certo, você verá no final:

```
✅ Migration concluída com sucesso!
📊 Teams com slug: 1
👥 Team members criados: 1
🔗 Campanhas com full_slug: X
```

**Se aparecer qualquer ERRO**, copie a mensagem completa e me envie.

---

## 🔍 **VALIDAÇÃO RÁPIDA**

Depois de executar, rode estas 3 queries para confirmar:

### **Validação 1: Tabela team_members existe**

```sql
SELECT COUNT(*) as total FROM team_members;
```

**✅ Deve retornar:** um número (pelo menos 1)

---

### **Validação 2: Teams têm slug**

```sql
SELECT id, team_name, slug FROM teams;
```

**✅ Deve mostrar:** coluna `slug` preenchida

---

### **Validação 3: Suas operações**

```sql
SELECT * FROM get_user_teams();
```

**✅ Deve retornar:** seus teams com role='owner'

---

## 🚨 **ERROS COMUNS E SOLUÇÕES**

### **Erro 1: "column teams.slug already exists"**

**Significa:** Você já executou parte da migration antes

**Solução:**
```sql
-- Execute isso ANTES de rodar a migration principal
DROP TABLE IF EXISTS team_members CASCADE;
ALTER TABLE teams DROP COLUMN IF EXISTS slug CASCADE;
ALTER TABLE teams DROP COLUMN IF EXISTS description CASCADE;
ALTER TABLE teams DROP COLUMN IF EXISTS is_active CASCADE;
ALTER TABLE campaigns DROP COLUMN IF EXISTS full_slug CASCADE;
```

Depois rode a migration completa novamente.

---

### **Erro 2: "syntax error near..."**

**Significa:** SQL não foi copiado corretamente ou tem caracteres especiais

**Solução:**

1. Abra o arquivo manualmente no VS Code
2. Selecione TUDO (`Cmd + A`)
3. Copie (`Cmd + C`)
4. Cole no SQL Editor
5. Execute

---

### **Erro 3: "function get_user_teams already exists"**

**Significa:** Função já foi criada antes

**Solução:**
```sql
-- Execute isso ANTES da migration
DROP FUNCTION IF EXISTS get_user_teams CASCADE;
DROP FUNCTION IF EXISTS is_team_member CASCADE;
DROP FUNCTION IF EXISTS is_team_admin CASCADE;
DROP FUNCTION IF EXISTS auto_add_team_owner CASCADE;
```

Depois rode a migration completa.

---

### **Erro 4: Nada acontece ou demora muito**

**Causa:** Migration travou em alguma operação

**Solução:**
1. Espere 2 minutos
2. Se não finalizar, clique no ❌ para cancelar
3. Execute as queries de limpeza acima
4. Tente novamente

---

## 📸 **SCREENSHOTS (Referência)**

### Como deve estar o SQL Editor ANTES de executar:

```
┌──────────────────────────────────────┐
│ SQL Editor                    [Run]  │
├──────────────────────────────────────┤
│                                      │
│ -- MIGRATION: MULTI-TENANT...        │
│ ALTER TABLE teams ADD COLUMN...      │
│ CREATE TABLE team_members...         │
│ ...                                  │
│ (400+ linhas de SQL)                 │
│                                      │
└──────────────────────────────────────┘
```

### Como deve estar DEPOIS de executar com sucesso:

```
┌──────────────────────────────────────┐
│ Results                              │
├──────────────────────────────────────┤
│ ✅ Success                           │
│                                      │
│ ✅ Migration concluída com sucesso! │
│ 📊 Teams com slug: 1                │
│ 👥 Team members criados: 1          │
│ 🔗 Campanhas com full_slug: 5       │
└──────────────────────────────────────┘
```

---

## ✅ **CHECKLIST FINAL**

Depois de executar, marque ✅:

- [ ] Executei o comando `pbcopy` no terminal
- [ ] Colei o SQL no SQL Editor do Supabase
- [ ] Cliquei em Run e aguardei
- [ ] Vi mensagem de sucesso
- [ ] Executei as 3 queries de validação
- [ ] Todas retornaram dados (não erro)

---

## 🆘 **PRECISA DE AJUDA?**

Se algo deu errado:

1. **Copie a mensagem de erro COMPLETA**
2. **Tire um screenshot do SQL Editor**
3. **Me envie**

Vou ajustar a migration para seu caso específico!

---

**Conseguiu executar? Me avise o resultado!** 🚀
