-- Supprimer tous les doublons en gardant l'entrée la plus récente
WITH duplicates AS (
  SELECT game_id, user_id, MAX(created_at) as max_created_at
  FROM game_participants
  GROUP BY game_id, user_id
  HAVING COUNT(*) > 1
)
DELETE FROM game_participants gp
WHERE EXISTS (
  SELECT 1
  FROM duplicates d
  WHERE gp.game_id = d.game_id
  AND gp.user_id = d.user_id
  AND gp.created_at < d.max_created_at
); 