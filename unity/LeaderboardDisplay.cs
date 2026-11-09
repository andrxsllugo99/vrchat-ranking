using TMPro;
using UdonSharp;
using UnityEngine;
using VRC.SDK3.Data;
using VRC.SDK3.StringLoading;
using VRC.SDKBase;

/// <summary>
/// Lee ranking.json desde GitHub Pages y lo muestra en tres TextMeshPro.
/// IMPORTANTE: este componente es SOLO DE LECTURA; no envía puntuaciones.
/// </summary>
public class LeaderboardDisplay : UdonSharpBehaviour
{
    [Header("URL pública de ranking.json (GitHub Pages)")]
    public VRCUrl rankingUrl;

    [Header("Textos de destino")]
    public TMP_Text globalText;
    public TMP_Text parkourText;
    public TMP_Text alternativesText;
    public TMP_Text statusText;

    [Header("Opciones")]
    public bool downloadOnStart = true;

    private bool isDownloading;

    void Start()
    {
        if (downloadOnStart) RefreshRanking();
    }

    // Conecta este método al OnClick de un botón de actualización del mundo.
    public void RefreshRanking()
    {
        if (isDownloading) return;
        if (VRCUrl.IsNullOrEmpty(rankingUrl))
        {
            SetStatus("Falta configurar rankingUrl en el Inspector.");
            return;
        }

        isDownloading = true;
        SetStatus("Actualizando ranking…");
        VRCStringDownloader.LoadUrl(rankingUrl, this);
    }

    public override void OnStringLoadSuccess(IVRCStringDownload result)
    {
        isDownloading = false;
        string json = result.Result;

        if (!VRCJson.TryDeserializeFromJson(json, out DataToken rootToken) ||
            rootToken.TokenType != TokenType.DataDictionary)
        {
            SetStatus("No se pudo interpretar ranking.json.");
            Debug.LogError("Ranking JSON inválido: " + rootToken.ToString());
            return;
        }

        DataDictionary root = rootToken.DataDictionary;
        RenderBoard(root, "global", globalText, "globalScore", false);
        RenderBoard(root, "parkour", parkourText, "timeSeconds", true);
        RenderBoard(root, "alternatives", alternativesText, "alternativesScore", false);
        SetStatus("Ranking actualizado.");
    }

    public override void OnStringLoadError(IVRCStringDownload result)
    {
        isDownloading = false;
        SetStatus("Error al descargar ranking: " + result.ErrorCode);
        Debug.LogError("Ranking download error: " + result.ErrorCode + " - " + result.Error);
    }

    private void RenderBoard(DataDictionary root, string boardKey, TMP_Text target, string valueKey, bool isParkour)
    {
        if (target == null) return;
        if (!root.TryGetValue(boardKey, TokenType.DataList, out DataToken listToken))
        {
            target.text = "Sin datos.";
            return;
        }

        DataList list = listToken.DataList;
        if (list.Count == 0)
        {
            target.text = "Todavía no hay jugadores en el Top 10.";
            return;
        }

        string output = "";
        for (int i = 0; i < list.Count; i++)
        {
            if (!list.TryGetValue(i, TokenType.DataDictionary, out DataToken playerToken)) continue;
            DataDictionary player = playerToken.DataDictionary;
            string name = ReadString(player, "playerName", "Jugador");
            double value = ReadNumber(player, valueKey, 0);
            string formatted = isParkour ? value.ToString("F2") + " s" : value.ToString("F0") + " pts";
            output += (i + 1).ToString() + ". " + name + " — " + formatted + "\n";
        }
        target.text = output;
    }

    private string ReadString(DataDictionary dictionary, string key, string fallback)
    {
        if (dictionary.TryGetValue(key, TokenType.String, out DataToken token)) return token.String;
        return fallback;
    }

    private double ReadNumber(DataDictionary dictionary, string key, double fallback)
    {
        if (dictionary.TryGetValue(key, out DataToken token) && token.IsNumber) return token.Number;
        return fallback;
    }

    private void SetStatus(string message)
    {
        if (statusText != null) statusText.text = message;
    }
}
