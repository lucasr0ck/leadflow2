# 🎯 PLANO DE AÇÃO: MULTI-OPERAÇÃO (MULTI-TENANT)

## 📋 Situação Atual vs Objetivo

### ❌ **Problema Atual:**
- 2 aplicações duplicadas (leadflow2 e leadflow2-1)
- Manutenção em dobro
- Dados isolados em bancos diferentes
- Um usuário = uma operação

### ✅ **Objetivo:**
- 1 aplicação única
- Múltiplas operações na mesma aplicação
- Um usuário pode gerenciar várias operações
- Dados isolados por `team_id`
- Links de redirect únicos por operação

---

## 🏗️ ARQUITETURA PROPOSTA

### **Conceito: Multi-Tenant por Team**

```
┌─────────────────────────────────────┐
│         LEADFLOW (Única App)        │
├─────────────────────────────────────┤
│                                     │
│  Operação A          Operação B     │
│  ├─ Vendedores      ├─ Vendedores  │
│  ├─ Campanhas       ├─ Campanhas   │
│  ├─ Cliques         ├─ Cliques     │
│  └─ Analytics       └─ Analytics   │
│                                     │
│  Usuário pode acessar ambas!       │
└─────────────────────────────────────┘
```

### **Isolamento de Dados:**
- Cada `team` = uma operação
- Todos os dados têm `team_id`
- RLS garante isolamento total
- Slugs de campanha com prefixo da operação

---

## 📝 FASES DE IMPLEMENTAÇÃO

### **FASE 1: Estrutura Multi-Tenant (Database)** ⏱️ 30 min

#### 1.1 - Nova tabela `team_members`
```sql
-- Relacionamento N:N entre usuários e teams
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member', -- 'owner', 'admin', 'member'
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_id, user_id)
);
```

#### 1.2 - Adicionar campos em `teams`
```sql
ALTER TABLE teams ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Gerar slugs para teams existentes
UPDATE teams SET slug = LOWER(REGEXP_REPLACE(team_name, '[^a-zA-Z0-9]+', '-', 'g'));
```

#### 1.3 - Atualizar campanhas para slugs únicos
```sql
-- Adicionar prefixo do team ao slug da campanha
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS full_slug TEXT UNIQUE;

-- Gerar full_slug = team_slug + '-' + campaign_slug
UPDATE campaigns c
SET full_slug = t.slug || '-' || c.slug
FROM teams t
WHERE c.team_id = t.id;
```

---

### **FASE 2: Context e Estado da Operação** ⏱️ 1h

#### 2.1 - Criar `TeamContext.tsx`
```typescript
// Gerencia qual operação está ativa
interface TeamContextType {
  currentTeam: Team | null;
  availableTeams: Team[];
  switchTeam: (teamId: string) => void;
  loading: boolean;
}
```

#### 2.2 - Modificar `AuthContext.tsx`
- Carregar teams do usuário após login
- Salvar team ativo no localStorage
- Se múltiplos teams, mostrar seletor

#### 2.3 - Atualizar todos os hooks
- Garantir que todas as queries usam `currentTeam.id`
- Verificar se team está selecionado antes de fazer queries

---

### **FASE 3: Interface Multi-Operação** ⏱️ 2h

#### 3.1 - Seletor de Operação no Header
```typescript
<Select value={currentTeam?.id} onValueChange={switchTeam}>
  {availableTeams.map(team => (
    <SelectItem value={team.id}>{team.team_name}</SelectItem>
  ))}
</Select>
```

#### 3.2 - Tela de Gestão de Operações (`/settings/teams`)
- Listar operações do usuário
- Criar nova operação
- Editar operação (nome, descrição)
- Convidar membros (se owner/admin)
- Ver membros da operação

#### 3.3 - Onboarding para novo usuário
- Se 0 teams → criar primeiro team
- Se 1 team → selecionar automaticamente
- Se 2+ teams → mostrar seletor

---

### **FASE 4: Links de Redirect Únicos** ⏱️ 30 min

#### 4.1 - Atualizar `PublicRedirect.tsx`
```typescript
// Antes: /r/:slug
// Depois: /r/:team_slug-:campaign_slug

// Exemplo:
// Operação A: /r/operacao-a-black-friday
// Operação B: /r/operacao-b-black-friday
```

#### 4.2 - Atualizar função `get_next_campaign_link`
```sql
-- Buscar por full_slug ao invés de slug
WHERE campaigns.full_slug = campaign_slug_param
```

---

### **FASE 5: Migração de Dados** ⏱️ 1h

#### 5.1 - Script de consolidação
```sql
-- 1. Exportar dados da aplicação duplicada
-- 2. Importar como novo team na aplicação principal
-- 3. Atualizar todos os team_ids
-- 4. Gerar novos full_slugs
-- 5. Adicionar membros ao novo team
```

#### 5.2 - Criar script de rollback (segurança)

---

### **FASE 6: RLS e Segurança** ⏱️ 30 min

#### 6.1 - Atualizar policies de teams
```sql
-- Usuário vê apenas teams que é membro
CREATE POLICY "Users see teams they belong to"
ON teams FOR SELECT
USING (
  id IN (
    SELECT team_id FROM team_members WHERE user_id = auth.uid()
  )
);
```

#### 6.2 - Políticas para todas as tabelas
```sql
-- Sellers, Campaigns, Clicks, etc
-- Verificar se usuário é membro do team
```

---

### **FASE 7: Analytics Multi-Operação** ⏱️ 30 min

#### 7.1 - Dashboard mostra apenas dados do team ativo
#### 7.2 - Comparação entre operações (opcional)
#### 7.3 - Relatórios consolidados (opcional)

---

## 🎯 RESULTADO FINAL

### **Para o Usuário:**

1. **Login** → Sistema detecta que tem 2 operações
2. **Seletor** → "Qual operação você quer gerenciar?"
   - 🏢 Operação A (Imobiliária)
   - 🏪 Operação B (E-commerce)
3. **Trabalha normalmente** → Vendedores, campanhas, analytics
4. **Troca de operação** → Clique no seletor no header
5. **Convida membros** → Compartilha acesso com outros usuários

### **Links de Redirect:**
```
Operação A: https://app.com/r/imobiliaria-promo-maio
Operação B: https://app.com/r/ecommerce-promo-maio
```

### **Vantagens:**
✅ Uma aplicação para manter  
✅ Dados isolados e seguros  
✅ Escalável para N operações  
✅ Compartilhamento de acesso  
✅ Analytics independentes  
✅ Slugs únicos garantidos  

---

## 📊 ESTIMATIVA DE TEMPO

| Fase | Tempo | Complexidade |
|------|-------|--------------|
| 1. Database | 30 min | Baixa |
| 2. Context/Estado | 1h | Média |
| 3. Interface | 2h | Média |
| 4. Links Redirect | 30 min | Baixa |
| 5. Migração Dados | 1h | Alta |
| 6. RLS/Segurança | 30 min | Média |
| 7. Analytics | 30 min | Baixa |
| **TOTAL** | **~6h** | |

---

## 🚀 ORDEM DE EXECUÇÃO RECOMENDADA

### **Sprint 1 (Core):** 3h
1. ✅ FASE 1: Database (team_members, slugs)
2. ✅ FASE 2: TeamContext
3. ✅ FASE 3.1: Seletor no header

**Resultado:** Aplicação funcional com multi-tenant básico

### **Sprint 2 (Completo):** 3h
4. ✅ FASE 3.2-3.3: Gestão de operações
5. ✅ FASE 4: Links únicos
6. ✅ FASE 5: Migração de dados
7. ✅ FASE 6-7: Segurança e polish

**Resultado:** Sistema completo e migrado

---

## 📌 PRÓXIMOS PASSOS

1. **Revisar este plano** - Fazer ajustes se necessário
2. **Backup completo** - Exportar dados antes de começar
3. **Começar FASE 1** - Eu crio as migrations
4. **Testar em desenvolvimento** - Validar antes de produção
5. **Migrar dados** - Consolidar as 2 aplicações
6. **Desativar duplicata** - Redirecionar para app única

---

**Quer que eu comece implementando a FASE 1?** 🚀
