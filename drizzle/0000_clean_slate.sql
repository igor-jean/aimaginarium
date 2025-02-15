-- Supprimer toutes les tables existantes
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS game_participants;
DROP TABLE IF EXISTS games;
DROP TABLE IF EXISTS users;

-- Recréer les tables avec le nouveau schéma
CREATE TABLE users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  username text NOT NULL,
  avatar_url text,
  created_at timestamp DEFAULT now()
);

CREATE TABLE games (
  id serial PRIMARY KEY,
  name text NOT NULL,
  code varchar(8) NOT NULL UNIQUE,
  is_public boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'waiting',
  master_id uuid REFERENCES users(id),
  prompt text,
  master_image_url text,
  created_at timestamp DEFAULT now(),
  ended_at timestamp
);

CREATE TABLE game_participants (
  id serial PRIMARY KEY,
  game_id integer REFERENCES games(id),
  user_id uuid REFERENCES users(id),
  image_url text,
  prompt text,
  score integer DEFAULT 0,
  is_ready boolean DEFAULT false,
  created_at timestamp DEFAULT now()
);

CREATE TABLE messages (
  id serial PRIMARY KEY,
  game_id integer REFERENCES games(id),
  user_id uuid REFERENCES users(id),
  content text NOT NULL,
  created_at timestamp DEFAULT now()
); 