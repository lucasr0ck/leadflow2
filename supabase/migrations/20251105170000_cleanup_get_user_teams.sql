-- ============================================================================
-- CLEANUP: Remover versão antiga de get_user_teams sem parâmetros
-- ============================================================================
-- Contexto:
--  - Alguns ambientes ainda possuem a função legado `get_user_teams()` sem
--    parâmetros, criada antes da consolidação multi-tenant.
--  - Quando o PostgREST encontra múltiplas assinaturas, ele pode executar a
--    versão antiga, que ainda contém referências ambíguas à coluna team_id,
--    resultando no erro 42702 após um refresh da aplicação.
--  - A correção definitiva é garantir que apenas a função com parâmetro
--    `user_id_param UUID DEFAULT auth.uid()` exista.
-- ============================================================================

-- Remover função antiga (sem parâmetros) caso ainda exista.
DROP FUNCTION IF EXISTS get_user_teams();

-- Reforçar a assinatura correta da função.
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
    (SELECT COUNT(*) FROM team_members tm2 WHERE tm2.team_id = t.id) AS member_count,
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

GRANT EXECUTE ON FUNCTION get_user_teams(UUID) TO authenticated;
