-- Supprimer les doublons existants avant d'ajouter la contrainte
DELETE FROM game_participants a USING game_participants b
WHERE a.id > b.id 
AND a.game_id = b.game_id 
AND a.user_id = b.user_id;

-- Ajouter la contrainte unique
ALTER TABLE game_participants ADD CONSTRAINT unique_game_participant UNIQUE (game_id, user_id); 