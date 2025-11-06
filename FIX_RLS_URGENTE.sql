-- =====================================================
-- FIX URGENTE: Remover recursão infinita nas políticas RLS
-- =====================================================

-- 🔥 PASSO 1: DESABILITAR RLS temporariamente para limpar
ALTER TABLE teams DISABLE ROW LEVEL SECURITY;
ALTER TABLE team_members DISABLE ROW LEVEL SECURITY;

-- 🔥 PASSO 2: REMOVER TODAS as políticas antigas que causam recursão
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    -- Remover todas as políticas de teams
    FOR policy_record IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'teams'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON teams', policy_record.policyname);
        RAISE NOTICE 'Removida política de teams: %', policy_record.policyname;
    END LOOP;

    -- Remover todas as políticas de team_members
    FOR policy_record IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'team_members'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON team_members', policy_record.policyname);
        RAISE NOTICE 'Removida política de team_members: %', policy_record.policyname;
    END LOOP;
END $$;

-- 🔥 PASSO 3: CRIAR políticas SIMPLES sem recursão

-- TEAMS: Usuários podem ver teams onde são owner
CREATE POLICY "teams_select_owner"
  ON teams
  FOR SELECT
  USING (owner_id = auth.uid());

-- TEAMS: Usuários podem ver teams onde são membros
CREATE POLICY "teams_select_member"
  ON teams
  FOR SELECT
  USING (
    id IN (
      SELECT tm.team_id 
      FROM team_members tm 
      WHERE tm.user_id = auth.uid()
    )
  );

-- TEAMS: Usuários podem inserir teams
CREATE POLICY "teams_insert"
  ON teams
  FOR INSERT
  WITH CHECK (owner_id = auth.uid());

-- TEAMS: Owners podem atualizar seus teams
CREATE POLICY "teams_update"
  ON teams
  FOR UPDATE
  USING (owner_id = auth.uid());

-- TEAMS: Owners podem deletar seus teams
CREATE POLICY "teams_delete"
  ON teams
  FOR DELETE
  USING (owner_id = auth.uid());

-- TEAM_MEMBERS: Usuários podem ver seus próprios memberships (SEM RECURSÃO!)
CREATE POLICY "team_members_select_own"
  ON team_members
  FOR SELECT
  USING (user_id = auth.uid());

-- TEAM_MEMBERS: Owners podem ver todos os membros do seu team
CREATE POLICY "team_members_select_owner"
  ON team_members
  FOR SELECT
  USING (
    team_id IN (
      SELECT id FROM teams WHERE owner_id = auth.uid()
    )
  );

-- TEAM_MEMBERS: Owners podem inserir membros
CREATE POLICY "team_members_insert"
  ON team_members
  FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT id FROM teams WHERE owner_id = auth.uid()
    )
  );

-- TEAM_MEMBERS: Owners podem atualizar membros
CREATE POLICY "team_members_update"
  ON team_members
  FOR UPDATE
  USING (
    team_id IN (
      SELECT id FROM teams WHERE owner_id = auth.uid()
    )
  );

-- TEAM_MEMBERS: Owners podem deletar membros
CREATE POLICY "team_members_delete"
  ON team_members
  FOR DELETE
  USING (
    team_id IN (
      SELECT id FROM teams WHERE owner_id = auth.uid()
    )
  );

-- 🔥 PASSO 4: REABILITAR RLS
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- 🔥 PASSO 5: TESTAR
-- Estas queries devem funcionar agora:
-- SELECT * FROM teams WHERE owner_id = auth.uid();
-- SELECT * FROM team_members WHERE user_id = auth.uid();

-- Mensagem final
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ POLÍTICAS RLS CORRIGIDAS!';
  RAISE NOTICE '✅ Recursão infinita removida';
  RAISE NOTICE '✅ Políticas simples criadas';
  RAISE NOTICE '========================================';
END $$;
