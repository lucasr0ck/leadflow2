-- =====================================================
-- FIX: Row Level Security para team_members
-- =====================================================

-- 1. Verificar se RLS está habilitado
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = 'team_members';

-- 2. Ver políticas atuais
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'team_members';

-- 3. REMOVER políticas antigas (se existirem)
DROP POLICY IF EXISTS "Users can view their team memberships" ON team_members;
DROP POLICY IF EXISTS "Users can view team members" ON team_members;
DROP POLICY IF EXISTS "Team admins can manage members" ON team_members;

-- 4. CRIAR política que permite usuários verem seus próprios memberships
CREATE POLICY "Users can view their own team memberships"
  ON team_members
  FOR SELECT
  USING (user_id = auth.uid());

-- 5. CRIAR política que permite ver membros de teams que você pertence
CREATE POLICY "Users can view members of their teams"
  ON team_members
  FOR SELECT
  USING (
    team_id IN (
      SELECT team_id 
      FROM team_members 
      WHERE user_id = auth.uid()
    )
  );

-- 6. HABILITAR RLS se não estiver habilitado
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- 7. TESTAR: Verificar se consegue buscar seus próprios team_members
-- Execute isso logado como seu usuário
SELECT * FROM team_members WHERE user_id = auth.uid();

-- 8. Mensagem de sucesso
DO $$
BEGIN
  RAISE NOTICE '✅ Políticas RLS configuradas com sucesso!';
  RAISE NOTICE 'Execute o SELECT acima para testar se consegue ver seus team_members';
END $$;
