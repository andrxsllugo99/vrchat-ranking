ARCHIVOS
- cloudflare/schema.sql: estructura de D1 (máximo 30 registros).
- cloudflare/src/index.js: API GET/POST con cálculo y Top 10, y publicación de ranking.json a GitHub.
- cloudflare/wrangler.toml: configuración de Wrangler; reemplazar el database_id.
- site/index.html: página web que lee ranking.json.
- site/ranking.json: JSON inicial vacío.
- tools/submit-test.html: envío manual para probar API (no es integración Udon).
- unity/LeaderboardDisplay.cs: lector UdonSharp de ranking.json, solo lectura.

NO INCLUYE: envío automático desde ScoreManager, porque el mecanismo oficial de String Loading de Udon no expone POST/PUT. No insertar secretos en Udon.
