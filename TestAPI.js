function projektdateienMitTabellenstrukturNachDriveExportieren() {
  const ZIEL_ORDNER_ID = '1pLIWKcvH0_FB2x6MH-LjMci5_H8tsCfO';
  const scriptId = ScriptApp.getScriptId();

  if (!scriptId) {
    throw new Error('Script-ID konnte nicht ermittelt werden.');
  }

  if (!textNormalisieren_(ZIEL_ORDNER_ID)) {
    throw new Error('Zielordner-ID für Export fehlt.');
  }

  const url = 'https://script.googleapis.com/v1/projects/' + scriptId + '/content';

  const data = driveMitRetry_('Apps-Script-Projektinhalt laden', '', function() {
    const res = UrlFetchApp.fetch(url, {
      method: 'get',
      muteHttpExceptions: true,
      headers: {
        Authorization: 'Bearer ' + ScriptApp.getOAuthToken()
      }
    });

    const code = Number(res.getResponseCode());
    const body = res.getContentText() || '';

    if (code < 200 || code >= 300) {
      throw new Error('HTTP ' + code + ' | ' + body.slice(0, 500));
    }

    return JSON.parse(body);
  }, 3, 500);

  const files = Array.isArray(data.files) ? data.files : [];
  const zielOrdner = driveMitRetry_('Zielordner laden', '', function() {
    return DriveApp.getFolderById(ZIEL_ORDNER_ID);
  }, 3, 400);

  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HH-mm-ss');
  const exportOrdner = driveMitRetry_('Exportordner erstellen', '', function() {
    return zielOrdner.createFolder('AppsScript_Export_' + stamp);
  }, 3, 500);

  files.forEach(function(f) {
    let ext = '.txt';
    if (f.type === 'SERVER_JS') ext = '.gs';
    if (f.type === 'HTML') ext = '.html';
    if (f.type === 'JSON') ext = '.json';

    driveMitRetry_('Exportdatei schreiben', textNormalisieren_(f.name), function() {
      exportOrdner.createFile(f.name + ext, f.source || '', MimeType.PLAIN_TEXT);
      return true;
    }, 3, 300);
  });

  const struktur = systemIntegritaetPruefen();
  driveMitRetry_('tabellenstruktur.json schreiben', '', function() {
    exportOrdner.createFile(
      'tabellenstruktur.json',
      JSON.stringify(struktur, null, 2),
      MimeType.PLAIN_TEXT
    );
    return true;
  }, 3, 300);

  Logger.log('EXPORT_ORDNER: ' + exportOrdner.getUrl());
  Logger.log('DATEIEN_EXPORTIERT: ' + files.length);
  Logger.log('TABELLENSTRUKTUR: tabellenstruktur.json');

  return {
    ok: true,
    exportOrdnerUrl: exportOrdner.getUrl(),
    dateienExportiert: files.length
  };
}
