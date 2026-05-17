/**
 * DATEI: 00_Hauptsystem.gs
 * ZWECK: HAUPTSYSTEM / MENÜ / WEBAPP-EINSTIEG
 */

function onOpen(e) {
  const ui = SpreadsheetApp.getUi();

  ui.createMenu('🔥 BRENNEREI')
    .addItem('📜 Protokoll drucken', 'protokollDrucken')
    .addItem('📋 Checkliste', 'stoffbesitzerChecklisteErstellen')
    .addSeparator()
    .addItem('📂 Dossier-Link aktualisieren', 'aktivenDossierLinkAktualisieren')
    .addSeparator()
    .addItem('📨 Brenner-Info per E-Mail', 'aktiveBrennerInfoPerMailSenden')
    .addItem('💬 Brenner-Info per Chat', 'aktiveBrennerInfoPerChatSenden')
    .addItem('📨💬 Brenner-Info Mail + Chat', 'aktiveBrennerInfoPerMailUndChatSenden')
    .addSeparator()
    .addItem('🗑️ Vorgang löschen', 'aktivenVorgangLoeschen')
    .addToUi();

  ui.createMenu('🛠️ TOOLS')
    .addItem('❌ Markierte Zeilen direkt löschen', 'markierteZeilenLoeschenDirekt')
    .addItem('📥 Markierte Zeilen in Papierkorb', 'markierteZeilenInPapierkorbSichernUndLoeschen')
    .addToUi();

  ui.createMenu('📱 WEBAPP')
    .addItem('📲 Web-App-Zugang anzeigen', 'cockpitZugangAnzeigen')
    .addItem('🔗 Leitstand-Zugang anzeigen', 'leitstandZugangAnzeigen')
    .addItem('🗓️ Brandplanung-Zugang anzeigen', 'brandplanungZugangAnzeigen')
    .addItem('🔥 Brennfreigabe-Zugang anzeigen', 'brennfreigabeZugangAnzeigen')
    .addToUi();

  ui.createMenu('⚙️ SYSTEM')
    .addItem('🔽 Dropdowns Maischeannahme neu aufbauen', 'dropdownsMaischeannahmeNeuAufbauen')
    .addItem('⚙️ Automation aktivieren', 'automationNeuAktivieren')
    .addItem('🛡️ API Autorisierung', 'forceAuthorization')
    .addItem('📊 Technischer Report', 'technischerReportErstellen')
    .addItem('🎨 3D-Design anwenden', 'layoutModernisieren')
    .addToUi();
}


function doGet(e) {
  const params = (e && e.parameter) ? e.parameter : {};
  const mode = textNormalisieren_(params.mode || '').toLowerCase();
  const returnModus = textNormalisieren_(params.return || params.rueckkehr || '').toLowerCase();
  const originModus = textNormalisieren_(params.origin || params.herkunft || params.return || params.rueckkehr || '').toLowerCase();
  const istAdminRuecksprung = originModus === 'admin' || returnModus === 'admin';
  const webAppUrl = ScriptApp.getService().getUrl();

  if (mode === 'admin') {
    const template = HtmlService.createTemplateFromFile('Admin');
    template.webAppUrl = webAppUrl;
    return template
      .evaluate()
      .setTitle('OGV BREITFURT - ADMIN')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  if (mode === 'brandplanung') {
    const template = HtmlService.createTemplateFromFile('Brandplanung');
    template.webAppUrl = webAppUrl;
    template.returnModus = returnModus;
    template.originModus = originModus;
    template.istAdminRuecksprung = istAdminRuecksprung;
    return template
      .evaluate()
      .setTitle('OGV BREITFURT - BRANDPLANUNG')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  if (mode === 'vorplanung') {
    const template = HtmlService.createTemplateFromFile('Index');
    template.startModus = 'vorplanung';
    template.webAppUrl = webAppUrl;
    template.returnModus = returnModus;
    template.originModus = originModus;
    template.istAdminRuecksprung = istAdminRuecksprung;
    return template
      .evaluate()
      .setTitle('OGV BREITFURT - VORPLANUNG')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  if (mode === 'maischeannahme') {
    const template = HtmlService.createTemplateFromFile('Index');
    template.startModus = 'maischeannahme';
    template.webAppUrl = webAppUrl;
    template.returnModus = returnModus;
    template.originModus = originModus;
    template.istAdminRuecksprung = istAdminRuecksprung;
    return template
      .evaluate()
      .setTitle('OGV BREITFURT - MAISCHEANNAHME')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  if (mode === 'brennfreigabe') {
    const template = HtmlService.createTemplateFromFile('Index');
    template.startModus = 'brennfreigabe';
    template.webAppUrl = webAppUrl;
    template.returnModus = returnModus;
    template.originModus = originModus;
    template.istAdminRuecksprung = istAdminRuecksprung;
    return template
      .evaluate()
      .setTitle('OGV BREITFURT - BRENNFREIGABE')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  if (mode === 'index') {
    const template = HtmlService.createTemplateFromFile('Index');
    template.startModus = '';
    template.webAppUrl = webAppUrl;
    template.returnModus = returnModus;
    template.originModus = originModus;
    template.istAdminRuecksprung = istAdminRuecksprung;
    return template
      .evaluate()
      .setTitle('OGV BREITFURT - Vorgangserfassung')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  if (mode === 'leitstand') {
    const template = HtmlService.createTemplateFromFile('Leitstand');
    template.webAppUrl = webAppUrl;
    template.returnModus = returnModus;
    template.originModus = originModus;
    template.istAdminRuecksprung = istAdminRuecksprung;
    return template
      .evaluate()
      .setTitle('OGV BREITFURT - ÜBERSICHT BRANDTAG')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  if (mode === 'zollkontakte') {
    const template = HtmlService.createTemplateFromFile('Zollkontakte');
    template.webAppUrl = webAppUrl;
    template.originModus = originModus || 'index';
    template.istAdminRuecksprung = istAdminRuecksprung;
    return template
      .evaluate()
      .setTitle('OGV BREITFURT - ZOLL-KONTAKTLISTE')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  if (mode === 'cockpit') {
    const template = HtmlService.createTemplateFromFile('Index');
    template.startModus = '';
    template.webAppUrl = webAppUrl;
    template.returnModus = returnModus;
    template.originModus = 'index';
    template.istAdminRuecksprung = false;
    return template
      .evaluate()
      .setTitle('OGV BREITFURT - WEB APP')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  const template = HtmlService.createTemplateFromFile('Index');
  template.startModus = '';
  template.webAppUrl = webAppUrl;
  template.returnModus = returnModus;
  template.originModus = originModus;
  template.istAdminRuecksprung = istAdminRuecksprung;
  return template
    .evaluate()
    .setTitle('OGV BREITFURT - Vorgangserfassung')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}


function escapeHtmlMini_(text) {
  if (text == null) return '';

  return String(text).replace(/[&<>"']/g, function(m) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[m];
  });
}


function installierterOnEditTrigger(e) {
  if (!e || !e.range) return;

  const blatt = e.range.getSheet();
  if (!blatt) return;

  try {
    if (blatt.getName() === KONFIGURATION.TABELLEN.MITGLIEDER) {
      onEditMitgliederVerarbeiten_(e, blatt);
      return;
    }

    if (blatt.getName() !== KONFIGURATION.TABELLEN.MAISCHEANNAHME) return;

    const zeile = e.range.getRow();
    if (zeile <= 1) return;

    const sMap = spaltenZuordnungHolen_(blatt);
    const spalte = e.range.getColumn();

    onEditMaischeannahmeVerarbeiten_(blatt, zeile, spalte, sMap);
  } catch (err) {
    systemLogSchreiben_(
      'ERROR',
      'Hauptsystem',
      'OnEdit fehlgeschlagen',
      '',
      String(err)
    );
  }
}

function onEditMitgliederVerarbeiten_(e, blatt) {
  if (!e || !e.range || !blatt) return;

  const zeile = e.range.getRow();
  if (zeile <= 1) return;

  const header = blatt.getRange(1, 1, 1, blatt.getLastColumn()).getDisplayValues()[0]
    .map(function(wert) { return textNormalisieren_(wert); });

  const nameAnzeigeSpalte = header.indexOf('NameAnzeige') + 1;
  if (!nameAnzeigeSpalte) return;

  const editStartSpalte = e.range.getColumn();
  const editEndSpalte = editStartSpalte + e.range.getNumColumns() - 1;
  const betrifftNameAnzeige = editStartSpalte <= nameAnzeigeSpalte && editEndSpalte >= nameAnzeigeSpalte;

  if (!betrifftNameAnzeige) return;

  const alterName = textNormalisieren_(e.oldValue);
  const neuerName = textNormalisieren_(blatt.getRange(zeile, nameAnzeigeSpalte).getDisplayValue());

  if (alterName && neuerName && alterName !== neuerName && typeof synchronisiereStoffbesitzerNameInProzessblaettern_ === 'function') {
    const sync = synchronisiereStoffbesitzerNameInProzessblaettern_(alterName, neuerName);
    systemLogSchreiben_(
      'INFO',
      'Hauptsystem',
      'Mitglieder-Name synchronisiert',
      '',
      'Alt: ' + alterName + ' | Neu: ' + neuerName + ' | Zellen: ' + sync.geaenderteZellen + ' | Blaetter: ' + sync.betroffeneBlaetter
    );
  }

  if (typeof dropdownsMaischeannahmeNeuAufbauen === 'function') {
    dropdownsMaischeannahmeNeuAufbauen(true);
  }
}


function onEditMaischeannahmeVerarbeiten_(blatt, zeile, spalte, sMap) {
  const stoffCol = sMap.STOFFBESITZER || 0;
  const idCol = sMap.VORGANGS_ID || 0;
  const statusCol = sMap.STATUS || 0;

  if (stoffCol && spalte === stoffCol) {
    vorgangGrunddatenSicherstellen_(blatt, zeile, sMap);
  }

  const dossierRelevant = [
    sMap.VORGANGS_ID || -1,
    sMap.STOFFBESITZER || -1,
    sMap.TERMIN_MAISCHE || -1,
    sMap.TAG_BRAND || -1,
    sMap.REGISTERNUMMER || -1
  ];

  if (dossierRelevant.indexOf(spalte) !== -1) {
    dossierLinkAktualisieren_(blatt, zeile, sMap);
  }

  if (statusCol && !textNormalisieren_(blatt.getRange(zeile, statusCol).getValue())) {
    blatt.getRange(zeile, statusCol).setValue(KONFIGURATION.STATUSWERTE.GEPLANT);
  }

  if (idCol) {
    const vId = textNormalisieren_(blatt.getRange(zeile, idCol).getValue());
    if (vId) {
      systemLogSchreiben_(
        'INFO',
        'Hauptsystem',
        'Maischeannahme OnEdit verarbeitet',
        vId,
        'Zeile ' + zeile + ', Spalte ' + spalte
      );
    }
  }
}


function vorgangGrunddatenSicherstellen_(blatt, zeile, sMap) {
  const stoffCol = sMap.STOFFBESITZER || 0;
  const idCol = sMap.VORGANGS_ID || 0;
  const statusCol = sMap.STATUS || 0;

  if (!stoffCol || !idCol) return;

  const stoff = textNormalisieren_(blatt.getRange(zeile, stoffCol).getValue());
  if (!stoff) return;

  let vId = textNormalisieren_(blatt.getRange(zeile, idCol).getValue());

  if (!vId) {
    vId = vorgangsIdSicherstellen_(stoff);
    blatt.getRange(zeile, idCol).setValue(vId);

    systemLogSchreiben_(
      'INFO',
      'Hauptsystem',
      'Vorgangs-ID automatisch vergeben',
      vId,
      'Zeile ' + zeile
    );
  }

  if (statusCol && !textNormalisieren_(blatt.getRange(zeile, statusCol).getValue())) {
    blatt.getRange(zeile, statusCol).setValue(KONFIGURATION.STATUSWERTE.GEPLANT);
  }
}



function automationNeuAktivieren() {
  const handler = 'leitstandErledigteEintraegeMitternachtArchivieren';
  const triggers = ScriptApp.getProjectTriggers();

  triggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction && trigger.getHandlerFunction() === handler) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger(handler)
    .timeBased()
    .everyDays(1)
    .atHour(0)
    .nearMinute(5)
    .create();

  systemAlert_(
    'ERFOLG',
    'Automation aktiviert: erledigte Leitstand-Einträge werden täglich nach Mitternacht ins Jahresarchiv verschoben und aus der App entfernt.'
  );
}


function forceAuthorization() {
  const authInfo = ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL);
  const status = authInfo.getAuthorizationStatus();
  const url = authInfo.getAuthorizationUrl();

  if (status === ScriptApp.AuthorizationStatus.REQUIRED && url) {
    systemAlert_(
      'AUTORISIERUNG ERFORDERLICH',
      'Öffne diesen Link zur Autorisierung: ' + url
    );
    return;
  }

  DriveApp.getRootFolder();
  SpreadsheetApp.getActiveSpreadsheet().getId();
  UrlFetchApp.fetch('https://www.google.com', { muteHttpExceptions: true });
  MailApp.getRemainingDailyQuota();

  systemAlert_(
    'ERFOLG',
    'Keine zusätzliche Autorisierung erforderlich. Die aktuell verwendeten Dienste sind bereits freigegeben.'
  );
}


function testMailAutorisierung() {
  MailApp.sendEmail({
    to: "fraumecker@gmail.com",
    subject: "Test Autorisierung",
    body: "Mailberechtigung ist aktiv."
  });
}


/**
 * FUNKTION: Zeigt den internen Link zur Brandplanung an.
 */
function brandplanungZugangAnzeigen() {
  const url = ScriptApp.getService().getUrl();

  if (!url) {
    systemAlert_(
      'HINWEIS',
      'Für die Brandplanung ist noch keine WebApp-URL verfügbar. Die WebApp muss zuerst bereitgestellt oder neu bereitgestellt werden.'
    );
    return;
  }

  const link = url + '?mode=brandplanung';

  SpreadsheetApp.getUi().alert(
    'Brandplanung-Zugang',
    'Interner Link zur Brandplanung:\n\n' + link,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}


/**
 * FUNKTION: Zeigt den Link zum Leitstand an.
 */
function leitstandZugangAnzeigen() {
  const url = ScriptApp.getService().getUrl();

  if (!url) {
    systemAlert_(
      'HINWEIS',
      'Für den Leitstand ist noch keine WebApp-URL verfügbar. Die WebApp muss zuerst bereitgestellt oder neu bereitgestellt werden.'
    );
    return;
  }

  const link = url + '?mode=leitstand';

  SpreadsheetApp.getUi().alert(
    'Leitstand-Zugang',
    'Link zum Leitstand\n\n' + link,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}


/**
 * FUNKTION: Zeigt den internen Link zur Brennfreigabe an.
 */
function brennfreigabeZugangAnzeigen() {
  const url = ScriptApp.getService().getUrl();

  if (!url) {
    systemAlert_(
      'HINWEIS',
      'Für die Brennfreigabe ist noch keine WebApp-URL verfügbar. Die WebApp muss zuerst bereitgestellt oder neu bereitgestellt werden.'
    );
    return;
  }

  const link = url + '?mode=brennfreigabe';

  SpreadsheetApp.getUi().alert(
    'Brennfreigabe-Zugang',
    'Interner Link zur Brennfreigabe:\n\n' + link,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}