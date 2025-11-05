-- =====================================================
-- VERIFICAR SE FUNÇÃO get_user_teams EXISTE
-- =====================================================

-- 1. Ver se a função existe
SELECT 
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'get_user_teams';

-- 2. Se não existir, criar a função
DO $$
BEGIN
  -- Verificar se a função existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'get_user_teams'
  ) THEN
    RAISE NOTICE 'Função get_user_teams NÃO EXISTE! Criando...';
    
    -- Criar a função
    CREATE OR REPLACE FUNCTION get_user_teams(user_id_param UUID DEFAULT auth.uid())
    RETURNS TABLE (
      team_id UUID,
      team_name TEXT,
      user_role TEXT,
      owner_id UUID,
      member_count BIGINT,
      created_at TIMESTAMPTZ
    )
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    BEGIN
      RETURN QUERY
      SELECT 
        t.id AS team_id,
        t.team_name,
        tm.role AS user_role,
        t.owner_id,
        (
          SELECT COUNT(*)::BIGINT 
          FROM team_members 
          WHERE team_id = t.id
        ) AS member_count,
        t.created_at
      FROM teams t
      INNER JOIN team_members tm ON t.id = tm.team_id
      WHERE tm.user_id = user_id_param
      ORDER BY t.created_at DESC;
    END;
    $$;
    
    RAISE NOTICE '✅ Função get_user_teams criada com sucesso!';
  ELSE
    RAISE NOTICE '✅ Função get_user_teams já existe';
  END IF;
END $$;

-- 3. Testar a função (substitua pelo seu user_id)
-- SELECT * FROM get_user_teams('e3df4e9b-a293-4c58-a828-8c5d95b8fecd');
