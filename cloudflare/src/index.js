const PARKOUR_FASTEST_SECONDS = 25;
const PARKOUR_SLOWEST_SECONDS = 120;
const MAX_ROWS_PER_BOARD = 10;
const ALLOWED_BOARDS = ["global", "parkour", "alternatives"];

function responseJson(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function parkourScore(seconds, hasParkour) {
  if (!hasParkour || !Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.round(
    clamp(
      ((PARKOUR_SLOWEST_SECONDS - seconds) /
        (PARKOUR_SLOWEST_SECONDS - PARKOUR_FASTEST_SECONDS)) * 1000,
      0,
      1000
    ) * 100
  ) / 100;
}

function alternativesScore(correct, total, hasAlternatives) {
  if (!hasAlternatives || !Number.isFinite(correct) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.round(clamp(correct / total, 0, 1) * 100000) / 100;
}

function validateSubmission(body) {
  if (!body || typeof body !== "object") throw new Error("El cuerpo JSON no es válido.");

  const playerId = String(body.playerId || "").trim();
  const playerName = String(body.playerName || "").trim();
  const hasParkour = body.hasParkour === true;
  const hasAlternatives = body.hasAlternatives === true;
  const seconds = Number(body.parkourSeconds);
  const correct = Number(body.alternativesCorrect);
  const total = Number(body.alternativesTotal ?? 20);

  if (!/^[A-Za-z0-9_-]{3,128}$/.test(playerId)) {
    throw new Error("playerId debe tener entre 3 y 128 caracteres: letras, números, _ o -.");
  }
  if (!playerName || playerName.length > 32) {
    throw new Error("playerName debe tener entre 1 y 32 caracteres.");
  }
  if (hasParkour && (!Number.isFinite(seconds) || seconds <= 0 || seconds > 3600)) {
    throw new Error("parkourSeconds debe estar entre 0 y 3600.");
  }
  if (hasAlternatives && (!Number.isInteger(correct) || !Number.isInteger(total) || total < 1 || total > 100 || correct < 0 || correct > total)) {
    throw new Error("Alternativas necesita respuestas correctas/total válidas.");
  }
  if (!hasParkour && !hasAlternatives) {
    throw new Error("El jugador debe tener al menos un resultado.");
  }

  const safeSeconds = hasParkour ? seconds : null;
  const safeCorrect = hasAlternatives ? correct : 0;
  const safeTotal = hasAlternatives ? total : 20;
  const pScore = parkourScore(seconds, hasParkour);
  const aScore = alternativesScore(correct, total, hasAlternatives);
  // El Global exige haber jugado las dos modalidades; ambas pesan 50%.
  const gScore = hasParkour && hasAlternatives ? Math.round(((pScore + aScore) / 2) * 100) / 100 : 0;

  return {
    playerId,
    playerName,
    hasParkour,
    hasAlternatives,
    parkourSeconds: safeSeconds,
    parkourScore: pScore,
    alternativesCorrect: safeCorrect,
    alternativesTotal: safeTotal,
    alternativesScore: aScore,
    globalScore: gScore,
    updatedAt: new Date().toISOString()
  };
}

async function submitBoard(env, board, row) {
  if (!ALLOWED_BOARDS.includes(board)) throw new Error("Categoría inválida.");
  if (board === "parkour" && !row.hasParkour) return;
  if (board === "alternatives" && !row.hasAlternatives) return;
  if (board === "global" && (!row.hasParkour || !row.hasAlternatives)) return;

  const sortValue = board === "parkour"
    ? row.parkourSeconds
    : board === "alternatives"
      ? row.alternativesScore
      : row.globalScore;

  await env.DB.prepare(`
    INSERT INTO leaderboard_entries (
      board, player_id, player_name, sort_value, parkour_seconds,
      parkour_score, alternatives_correct, alternatives_total,
      alternatives_score, global_score, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(board, player_id) DO UPDATE SET
      player_name = excluded.player_name,
      sort_value = excluded.sort_value,
      parkour_seconds = excluded.parkour_seconds,
      parkour_score = excluded.parkour_score,
      alternatives_correct = excluded.alternatives_correct,
      alternatives_total = excluded.alternatives_total,
      alternatives_score = excluded.alternatives_score,
      global_score = excluded.global_score,
      updated_at = excluded.updated_at
    WHERE
      (excluded.board = 'parkour' AND excluded.sort_value < leaderboard_entries.sort_value)
      OR
      (excluded.board != 'parkour' AND excluded.sort_value > leaderboard_entries.sort_value)
  `).bind(
    board,
    row.playerId,
    row.playerName,
    sortValue,
    row.parkourSeconds,
    row.parkourScore,
    row.alternativesCorrect,
    row.alternativesTotal,
    row.alternativesScore,
    row.globalScore,
    row.updatedAt
  ).run();

  const order = board === "parkour" ? "ASC" : "DESC";
  await env.DB.prepare(`
    DELETE FROM leaderboard_entries
    WHERE board = ?
      AND player_id NOT IN (
        SELECT player_id
        FROM leaderboard_entries
        WHERE board = ?
        ORDER BY sort_value ${order}, updated_at ASC, player_id ASC
        LIMIT ${MAX_ROWS_PER_BOARD}
      )
  `).bind(board, board).run();
}

async function buildLeaderboard(env) {
  const getRows = async (board, order) => {
    const result = await env.DB.prepare(`
      SELECT player_id, player_name, parkour_seconds, parkour_score,
             alternatives_correct, alternatives_total, alternatives_score,
             global_score, updated_at
      FROM leaderboard_entries
      WHERE board = ?
      ORDER BY sort_value ${order}, updated_at ASC, player_id ASC
      LIMIT 10
    `).bind(board).all();
    return (result.results || []).map((r, index) => ({
      rank: index + 1,
      playerId: r.player_id,
      playerName: r.player_name,
      timeSeconds: r.parkour_seconds,
      parkourScore: Number(r.parkour_score || 0),
      alternativesCorrect: Number(r.alternatives_correct || 0),
      alternativesTotal: Number(r.alternatives_total || 20),
      alternativesScore: Number(r.alternatives_score || 0),
      globalScore: Number(r.global_score || 0),
      updatedAt: r.updated_at
    }));
  };

  const [global, parkour, alternatives] = await Promise.all([
    getRows("global", "DESC"),
    getRows("parkour", "ASC"),
    getRows("alternatives", "DESC")
  ]);

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    scoring: {
      parkourFastestSeconds: PARKOUR_FASTEST_SECONDS,
      parkourSlowestSeconds: PARKOUR_SLOWEST_SECONDS,
      alternativesTotalQuestions: 20,
      global: "Promedio de Parkour y Alternativas; requiere un resultado en ambas modalidades."
    },
    global,
    parkour,
    alternatives
  };
}

function base64Utf8(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function publishToGitHub(env, payload) {
  if (!env.GITHUB_TOKEN || !env.GITHUB_OWNER || !env.GITHUB_REPO || !env.GITHUB_PATH) {
    return { published: false, reason: "Faltan secretos o variables de GitHub." };
  }

  const owner = env.GITHUB_OWNER;
  const repo = env.GITHUB_REPO;
  const branch = env.GITHUB_BRANCH || "main";
  const path = env.GITHUB_PATH;
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const headers = {
    "Accept": "application/vnd.github+json",
    "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json"
  };

  const currentResponse = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, { headers });
  let sha;
  if (currentResponse.ok) {
    const current = await currentResponse.json();
    sha = current.sha;
  } else if (currentResponse.status !== 404) {
    const errorText = await currentResponse.text();
    return { published: false, reason: `GitHub GET ${currentResponse.status}: ${errorText.slice(0, 300)}` };
  }

  const body = {
    message: "Actualizar ranking.json desde Cloudflare Worker",
    content: base64Utf8(JSON.stringify(payload, null, 2) + "\n"),
    branch
  };
  if (sha) body.sha = sha;

  const putResponse = await fetch(apiUrl, {
    method: "PUT",
    headers,
    body: JSON.stringify(body)
  });
  if (!putResponse.ok) {
    const errorText = await putResponse.text();
    return { published: false, reason: `GitHub PUT ${putResponse.status}: ${errorText.slice(0, 300)}` };
  }
  return { published: true };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400"
        }
      });
    }

    if (request.method === "GET" && url.pathname === "/api/leaderboard") {
      try {
        return responseJson(await buildLeaderboard(env));
      } catch (error) {
        return responseJson({ error: error.message || "Error interno." }, 500);
      }
    }

    if (request.method === "POST" && url.pathname === "/api/submit") {
      if (!env.SUBMIT_TOKEN) return responseJson({ error: "SUBMIT_TOKEN no está configurado." }, 500);
      const suppliedToken = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
      if (!suppliedToken || suppliedToken !== env.SUBMIT_TOKEN) {
        return responseJson({ error: "No autorizado." }, 401);
      }

      try {
        const body = await request.json();
        const row = validateSubmission(body);
        await submitBoard(env, "parkour", row);
        await submitBoard(env, "alternatives", row);
        await submitBoard(env, "global", row);
        const leaderboard = await buildLeaderboard(env);
        const publication = await publishToGitHub(env, leaderboard);
        return responseJson({
          success: true,
          message: "Resultado procesado. Las listas conservan solo 10 puestos por categoría.",
          publication,
          leaderboard
        });
      } catch (error) {
        return responseJson({ error: error.message || "No se pudo procesar el resultado." }, 400);
      }
    }

    return responseJson({
      service: "VRChat Ranking API",
      endpoints: ["GET /api/leaderboard", "POST /api/submit"]
    });
  }
};
