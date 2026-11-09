# VRChat Ranking — base gratuita (con la limitación de Udon explicada)

Este paquete deja preparado el sitio del ranking, el backend, la base de datos y un lector UdonSharp para mostrar el ranking dentro del mundo.

**No está conectado todavía al momento de terminar un minijuego.** La API oficial de Udon que usamos para descargar cadenas (`VRCStringDownloader`) descarga contenido; no expone una operación HTTP `POST` para subir puntuaciones. Por eso el paquete incluye una herramienta web de envío manual para probar el backend, pero NO debe confundirse con una integración automática desde Unity. Tampoco pongas un token secreto en un script Udon: cualquier secreto incluido en el mundo puede extraerse.

## Qué queda implementado

- Top 10 Global, Top 10 Parkour y Top 10 Alternativas.
- La base conserva como máximo 10 filas por categoría (máximo 30 filas en total).
- Parkour se ordena por menor tiempo.
- Alternativas se ordena por mayor porcentaje de aciertos.
- Global usa la media de ambas puntuaciones normalizadas y exige que el jugador tenga un resultado en las dos modalidades.
- El mejor registro de un jugador reemplaza al anterior si mejora su posición.
- La web lee `ranking.json` desde GitHub Pages.
- El Worker puede publicar el `ranking.json` actualizado en tu repositorio.
- `LeaderboardDisplay.cs` permite leer ese JSON y presentarlo en el mundo.

## Fórmulas

- Parkour: 25 s = 1000 puntos; 120 s = 0 puntos; se limita el resultado al intervalo 0–1000.
- Alternativas: `correctas / total * 1000`.
- Global: `(ParkourNormalizado + AlternativasNormalizado) / 2`.
- Para entrar al Global, el jugador debe haber terminado al menos una vez ambas modalidades.

Ajusta 25 y 120 segundos en `cloudflare/src/index.js` si tu sistema de tiempos usa otra escala. Deben coincidir con el diseño de tu minijuego.

## Parte A — preparar GitHub Pages

Tu repositorio existente es `andrxsllugo99/vrchat-ranking`.

1. Copia `site/index.html` a la raíz del repositorio, reemplazando el `index.html` actual.
2. Copia `site/ranking.json` a la raíz, reemplazando el archivo actual.
3. Conserva tu workflow de GitHub Pages que ya funciona.
4. Comprueba que abran estas direcciones:
   - `https://andrxsllugo99.github.io/vrchat-ranking/`
   - `https://andrxsllugo99.github.io/vrchat-ranking/ranking.json`

## Parte B — crear Cloudflare D1 y el Worker

Necesitas una cuenta gratuita de Cloudflare y Node.js instalado en tu PC.

1. Abre una terminal dentro de la carpeta `cloudflare`.
2. Ejecuta:

   ```bash
   npm install -g wrangler
   npx wrangler login
   npx wrangler d1 create vrchat-ranking
   ```

3. Cloudflare mostrará un `database_id`. Pégalo en `cloudflare/wrangler.toml`, reemplazando `PEGA_AQUI_EL_DATABASE_ID_DE_CLOUDFLARE`.
4. Ejecuta el esquema:

   ```bash
   npx wrangler d1 execute vrchat-ranking --remote --file=./schema.sql
   ```

5. Crea dos secretos. El primero es una clave privada que inventas tú; el segundo será el token de GitHub:

   ```bash
   npx wrangler secret put SUBMIT_TOKEN
   npx wrangler secret put GITHUB_TOKEN
   ```

   Guarda el `SUBMIT_TOKEN` en tu administrador de contraseñas. No lo subas a GitHub ni lo pongas en Unity.

6. En GitHub, crea un Fine-grained Personal Access Token limitado únicamente al repositorio `andrxsllugo99/vrchat-ranking`, con permiso **Contents: Read and write**. Pega ese token al ejecutar `wrangler secret put GITHUB_TOKEN`. No necesita guardarse en el proyecto.
7. Despliega:

   ```bash
   npx wrangler deploy
   ```

8. Copia la URL que devuelve Wrangler. Tendrá una forma parecida a `https://vrchat-ranking-api.<tu-cuenta>.workers.dev`.

## Parte C — probar el backend

1. Abre `tools/submit-test.html` en tu navegador.
2. Completa la URL del Worker, el `SUBMIT_TOKEN`, un identificador de prueba, un nombre, un tiempo y las respuestas correctas.
3. Envía una puntuación de prueba.
4. La respuesta debe indicar `success: true` y `publication.published: true`.
5. Espera a que GitHub Pages publique el commit y revisa `ranking.json` y la página web.
6. Repite la prueba con un tiempo de Parkour más rápido o una puntuación de Alternativas mayor. Debe mejorar el registro del mismo jugador.
7. Para comprobar el límite, envía más de 10 jugadores de prueba. En cada categoría deben quedar solo 10.

La herramienta de prueba es manual y para el creador. No es el envío automático desde Udon.

## Parte D — mostrar el ranking dentro de VRChat

1. Añade `unity/LeaderboardDisplay.cs` al proyecto Unity dentro de una carpeta de scripts UdonSharp.
2. En la escena, crea un GameObject llamado `LeaderboardDisplay` y añade el componente UdonSharp correspondiente.
3. En `Ranking Url`, asigna una `VRCUrl` creada en el Inspector con esta dirección exacta:

   `https://andrxsllugo99.github.io/vrchat-ranking/ranking.json`

4. Crea tres textos TextMeshPro (Global, Parkour y Alternativas) y arrástralos a los campos correspondientes.
5. Asigna también un texto pequeño para `Status Text`.
6. Opcional: crea un botón de actualización y conecta su evento `OnClick` al método público `LeaderboardDisplay.RefreshRanking`.
7. Compila UdonSharp y prueba en una build subida. GitHub Pages (`*.github.io`) está en la lista de dominios de String Loading de VRChat, de modo que la descarga del JSON no debería pedir a los visitantes activar URLs no confiables.

Este componente solo LEE el ranking. No envía puntajes.

## Qué falta para el requisito de actualización automática

La barrera está en el cliente de VRChat, no en la tabla SQL: el sistema estándar de Udon String Loading está pensado para descargar contenido desde URLs permitidas. No ofrece un método de subida `POST` para mandar un tiempo o puntaje recién obtenido. Además, las `VRCUrl` no pueden construirse dinámicamente desde strings durante la ejecución normal.

Por lo tanto, no hay un código honesto que pueda pegarse en `ScoreManager` y que garantice el envío automático a este Worker cumpliendo a la vez estas condiciones:

- todos los visitantes sin tocar ajustes;
- ningún programa adicional instalado por ellos;
- envío de resultados al terminar el juego;
- ranking global persistente;
- coste cero.

El backend y la pantalla quedan listos para el día en que exista una vía de escritura compatible/permitida. Para hacer el envío automático ahora habría que relajar al menos una condición y verificar la alternativa (por ejemplo, un cliente externo en PC, o una acción web fuera del mundo). Ninguna de esas alternativas cumple tu requisito original de cero configuración para todos.

## Seguridad y honestidad del resultado

- No insertes `GITHUB_TOKEN` ni `SUBMIT_TOKEN` dentro de un script Unity/UdonSharp.
- Un cliente de juego no puede demostrar por sí solo que un tiempo no fue manipulado. Incluso cuando se integre el envío automático, la clasificación necesitará validaciones y medidas antitrampas.
- Cloudflare Free no es una garantía de servicio ilimitado: tiene cuotas; al excederlas, las solicitudes pueden fallar hasta que se restablezcan o se cambie de plan.
