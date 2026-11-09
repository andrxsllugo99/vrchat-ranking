-- Cada tabla lógica se representa con una fila por jugador y categoría.
-- El Worker conserva como máximo 10 filas por categoría: 30 filas como máximo.
CREATE TABLE IF NOT EXISTS leaderboard_entries (
  board TEXT NOT NULL CHECK (board IN ('global', 'parkour', 'alternatives')),
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  sort_value REAL NOT NULL,
  parkour_seconds REAL,
  parkour_score REAL NOT NULL DEFAULT 0,
  alternatives_correct INTEGER NOT NULL DEFAULT 0,
  alternatives_total INTEGER NOT NULL DEFAULT 20,
  alternatives_score REAL NOT NULL DEFAULT 0,
  global_score REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (board, player_id)
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_board_sort
ON leaderboard_entries(board, sort_value);
