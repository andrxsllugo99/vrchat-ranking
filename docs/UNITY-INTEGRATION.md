# Integración Unity 2022 / UdonSharp

## Contrato de `ranking.json`
- `version`: versión del formato.
- `updatedAt`: fecha UTC o `null`.
- `global`, `parkour`, `alternatives`: arrays de hasta 10 entradas.
- Cada entrada contiene `name` y `points` (0–100).

Ejemplo:
```json
{
  "version": 1,
  "updatedAt": "2026-11-04T00:00:00Z",
  "global": [{"name": "JugadorEjemplo", "points": 95.5}],
  "parkour": [],
  "alternatives": []
}
```

## Reglas de puntuación propuestas
- Parkour: normalización lineal existente, limitada a 0–100.
- Alternativas: `respuestasCorrectas / totalPreguntas * 100`.
- Global: `(parkourPoints + alternativesPoints) / 2`, tratando un juego no completado como 0 para que ambos juegos pesen igual.

## Seguridad y red
La descarga de JSON es una operación de lectura. La publicación de GitHub Pages no crea una API de escritura. No incrustes tokens de GitHub en UdonSharp: el contenido de un mundo publicado puede inspeccionarse. Antes de implementar la lectura desde VRChat, verifica la allowlist vigente del SDK para el dominio de GitHub Pages. La recepción de récords necesita un endpoint compatible y aún no está implementada en esta plantilla.
