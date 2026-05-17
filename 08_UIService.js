/**
 * DATEI: 08_UISERVICE.GS
 * STATUS: UI OHNE EINGABEMASKE
 * ZWECK: DIALOGE, AKTIONEN AUF AKTIVE ZEILE, DOSSIER-LINK, COCKPIT-ZUGANG
 */

function cockpitZugangAnzeigen() {
  const scriptUrl = ScriptApp.getService().getUrl();

  if (!scriptUrl) {
    systemAlert_('FEHLER', 'Die Web-App ist noch nicht deployt.');
    return;
  }

  const cockpitUrl = scriptUrl + '?mode=index';

  const html = `
    <html>
      <head>
        <base target="_top">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        ${HtmlService.createHtmlOutputFromFile('Styles').getContent()}
      </head>
      <body>
        <div class="container" style="padding:24px; max-width:700px; margin:0 auto;">
          <div class="card" style="text-align:center;">
            <h2>Web-App-Zugang</h2>
            <p>QR-Code für den mobilen Aufruf</p>
            <img
              src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(cockpitUrl)}"
              alt="QR-Code"
              style="max-width:220px; border-radius:16px;"
            >
            <div style="margin-top:16px;">
              <input
                type="text"
                value="${cockpitUrl}"
                readonly
                style="width:100%; padding:10px; box-sizing:border-box;"
              >
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(520).setHeight(620),
    'Web-App-Zugang'
  );
}


function aktivenDossierLinkAktualisieren() {
  const kontext = aktiveMaischeannahmeZeileHolen_();
  if (!kontext) return;

  dossierLinkAktualisieren_(kontext.blatt, kontext.zeile, kontext.sMap);

  const vId = kontext.sMap.VORGANGS_ID
    ? textNormalisieren_(kontext.blatt.getRange(kontext.zeile, kontext.sMap.VORGANGS_ID).getValue())
    : '';

  systemLogSchreiben_('INFO', 'UIService', 'Dossier-Link manuell aktualisiert', vId, 'Zeile ' + kontext.zeile);
  systemAlert_('ERFOLG', 'Dossier-Link wurde aktualisiert.');
}
/**
 * DATEI: 08_UISERVICE.GS
 * STATUS: UI OHNE EINGABEMASKE
 * ZWECK: DIALOGE, AKTIONEN AUF AKTIVE ZEILE, DOSSIER-LINK, COCKPIT-ZUGANG
 */

function cockpitZugangAnzeigen() {
  const scriptUrl = ScriptApp.getService().getUrl();

  if (!scriptUrl) {
    systemAlert_('FEHLER', 'Die Web-App ist noch nicht deployt.');
    return;
  }

  const cockpitUrl = scriptUrl + '?mode=index';

  const html = `
    <html>
      <head>
        <base target="_top">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        ${HtmlService.createHtmlOutputFromFile('Styles').getContent()}
      </head>
      <body>
        <div class="container" style="padding:24px; max-width:700px; margin:0 auto;">
          <div class="card" style="text-align:center;">
            <h2>Web-App-Zugang</h2>
            <p>QR-Code für den mobilen Aufruf</p>
            <img
              src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(cockpitUrl)}"
              alt="QR-Code"
              style="max-width:220px; border-radius:16px;"
            >
            <div style="margin-top:16px;">
              <input
                type="text"
                value="${cockpitUrl}"
                readonly
                style="width:100%; padding:10px; box-sizing:border-box;"
              >
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(520).setHeight(620),
    'Web-App-Zugang'
  );
}


function aktivenDossierLinkAktualisieren() {
  const kontext = aktiveMaischeannahmeZeileHolen_();
  if (!kontext) return;

  dossierLinkAktualisieren_(kontext.blatt, kontext.zeile, kontext.sMap);

  const vId = kontext.sMap.VORGANGS_ID
    ? textNormalisieren_(kontext.blatt.getRange(kontext.zeile, kontext.sMap.VORGANGS_ID).getValue())
    : '';

  systemLogSchreiben_('INFO', 'UIService', 'Dossier-Link manuell aktualisiert', vId, 'Zeile ' + kontext.zeile);
  systemAlert_('ERFOLG', 'Dossier-Link wurde aktualisiert.');
}


function aktiveMaischeannahmeZeileHolen_() {
  const blatt = SpreadsheetApp.getActiveSheet();

  if (!blatt || blatt.getName() !== KONFIGURATION.TABELLEN.MAISCHEANNAHME) {
    systemAlert_('HINWEIS', 'Bitte zuerst eine Zeile in ' + KONFIGURATION.TABELLEN.MAISCHEANNAHME + ' auswählen.');
    return null;
  }

  const zeile = blatt.getActiveCell().getRow();
  if (zeile <= 1) {
    systemAlert_('HINWEIS', 'Bitte zuerst eine Datenzeile auswählen.');
    return null;
  }

  const sMap = spaltenZuordnungHolen_(blatt);

  return {
    blatt: blatt,
    zeile: zeile,
    sMap: sMap
  };
}

function aktiveMaischeannahmeZeileHolen_() {
  const blatt = SpreadsheetApp.getActiveSheet();

  if (!blatt || blatt.getName() !== KONFIGURATION.TABELLEN.MAISCHEANNAHME) {
    systemAlert_('HINWEIS', 'Bitte zuerst eine Zeile in ' + KONFIGURATION.TABELLEN.MAISCHEANNAHME + ' auswählen.');
    return null;
  }

  const zeile = blatt.getActiveCell().getRow();
  if (zeile <= 1) {
    systemAlert_('HINWEIS', 'Bitte zuerst eine Datenzeile auswählen.');
    return null;
  }

  const sMap = spaltenZuordnungHolen_(blatt);

  return {
    blatt: blatt,
    zeile: zeile,
    sMap: sMap
  };
}