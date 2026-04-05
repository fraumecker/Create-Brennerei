function projektdateienMitTabellenstrukturNachDriveExportieren() {
  const ZIEL_ORDNER_ID = "1pLIWKcvH0_FB2x6MH-LjMci5_H8tsCfO";

  const scriptId = ScriptApp.getScriptId();
  const url = "https://script.googleapis.com/v1/projects/" + scriptId + "/content";

  const res = UrlFetchApp.fetch(url, {
    method: "get",
    headers: {
      Authorization: "Bearer " + ScriptApp.getOAuthToken()
    }
  });

  const data = JSON.parse(res.getContentText());
  const files = data.files || [];

  const zielOrdner = DriveApp.getFolderById(ZIEL_ORDNER_ID);
  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd_HH-mm-ss");
  const exportOrdner = zielOrdner.createFolder("AppsScript_Export_" + stamp);

  files.forEach(function(f) {
    let ext = ".txt";
    if (f.type === "SERVER_JS") ext = ".gs";
    if (f.type === "HTML") ext = ".html";
    if (f.type === "JSON") ext = ".json";

    exportOrdner.createFile(f.name + ext, f.source || "", MimeType.PLAIN_TEXT);
  });

  const struktur = systemIntegritaetPruefen();
  exportOrdner.createFile(
    "tabellenstruktur.json",
    JSON.stringify(struktur, null, 2),
    MimeType.PLAIN_TEXT
  );

  Logger.log("EXPORT_ORDNER: " + exportOrdner.getUrl());
  Logger.log("DATEIEN_EXPORTIERT: " + files.length);
  Logger.log("TABELLENSTRUKTUR: tabellenstruktur.json");
}