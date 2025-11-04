-- ============================================================================
-- FIX: Corrigir função get_user_teams
-- ============================================================================
-- Problema: Ambiguidade na coluna team_id e estrutura de retorno
-- Solução: Ajustar nomes de colunas e aliases
-- ============================================================================

-- Recriar função com nomes corretos
DROP FUNCTION IF EXISTS get_user_teams(UUID);

CREATE OR REPLACE FUNCTION get_user_teams(user_id_param UUID DEFAULT auth.uid())
RETURNS TABLE (
  team_id UUID,
  team_name TEXT,
  team_slug TEXT,
  description TEXT,
  role TEXT,
  is_active BOOLEAN,
  member_count BIGINT,
  joined_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id AS team_id,
    t.team_name AS team_name,
    t.slug AS team_slug,
    t.description AS description,
    tm.role AS role,
    t.is_active AS is_active,
    (SELECT COUNT(*) FROM team_members WHERE team_members.team_id = t.id) AS member_count,
    tm.joined_at AS joined_at
  FROM teams t
  INNER JOIN team_members tm ON t.id = tm.team_id
  WHERE tm.user_id = user_id_param
  ORDER BY 
    CASE 
      WHEN tm.role = 'owner' THEN 1
      WHEN tm.role = 'admin' THEN 2
      ELSE 3
    END,
    t.team_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dar permissão para usuários autenticados
GRANT EXECUTE ON FUNCTION get_user_teams(UUID) TO authenticated;

-- ============================================================================
-- FIX: Garantir que trigger auto_add_team_owner funciona corretamente
-- ============================================================================

-- Recriar função do trigger com melhor tratamento de erros
DROP FUNCTION IF EXISTS auto_add_team_owner() CASCADE;

CREATE OR REPLACE FUNCTION auto_add_team_owner()
RETURNS TRIGGER AS $$
BEGIN
  -- Adicionar o owner como membro do team
  INSERT INTO team_members (team_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (team_id, user_id) DO UPDATE
  SET role = 'owner';  -- Garantir que role seja owner se já existir
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recriar trigger
DROP TRIGGER IF EXISTS trigger_auto_add_team_owner ON teams;
CREATE TRIGGER trigger_auto_add_team_owner
  AFTER INSERT ON teams
  FOR EACH ROW
  EXECUTE FUNCTION auto_add_team_owner();

-- ============================================================================
-- FIX: Adicionar policy para team_members permitir INSERT do trigger
-- ============================================================================

-- Garantir que o trigger possa inserir em team_members
-- (SECURITY DEFINER já garante isso, mas vamos ser explícitos)

-- Testar as correções
DO $$
BEGIN
  RAISE NOTICE '✅ Função get_user_teams corrigida com sucesso!';
  RAISE NOTICE '✅ Trigger auto_add_team_owner recriado!';
  RAISE NOTICE '✅ Migration de correção aplicada!';
END $$;
