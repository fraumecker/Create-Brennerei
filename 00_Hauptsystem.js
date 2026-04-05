function onOpen(e) {
  const ui = SpreadsheetApp.getUi();

  ui.createMenu('🔥 BRENNEREI')
    .addItem('📱 Vorgang öffnen', 'vorgangOeffnen')
    .addItem('📜 Protokoll drucken', 'protokollDrucken')
    .addItem('📋 Checkliste', 'stoffbesitzerChecklisteErstellen')
    .addItem('🗑️ Löschen', 'aktivenVorgangLoeschen')
    .addToUi();

  ui.createMenu('🛠️ TOOLS')
    .addItem('❌ Zeilen löschen', 'markierteZeilenLoeschenDirekt')
    .addItem('📥 Papierkorb', 'markierteZeilenInPapierkorbSichernUndLoeschen')
    .addToUi();

  ui.createMenu('⚙️ SYSTEM')
    .addItem('📊 Technischer Report', 'technischerReportErstellen')
    .addItem('🧪 Masken-Selbsttest', 'maskenSelbsttestStarten')
    .addItem('🎨 3D-Design anwenden', 'layoutModernisieren')
    .addItem('🔗 Cockpit-Login (QR)', 'cockpitZugangAnzeigen')
    .addItem('⚙️ Automation aktivieren', 'automationNeuAktivieren')
    .addItem('🛡️ API Autorisierung (Force Auth)', 'forceAuthorization')
    .addToUi();
}

function installierterOnEditTrigger(e) {
  if (!e || !e.range) return;

  const blatt = e.range.getSheet();
  const blattName = blatt.getName();
  const zeile = e.range.getRow();
  const spalte = e.range.getColumn();

  if (blattName === KONFIGURATION.TABELLEN.VORPLANUNG && zeile > 1) {
    vorplanungEditVerarbeiten_(zeile, spalte);
  }
}

function doGet(e) {
  const params = (e && e.parameter) ? e.parameter : {};
  const mode = params.mode || "maske";

  if (mode === "cockpit") {
    return HtmlService
      .createTemplateFromFile('Cockpit')
      .evaluate()
      .setTitle("OGV BREITFURT - LEITSTAND")
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  const template = HtmlService.createTemplateFromFile('Index');
  template.editVId = params.id || "";
  template.startTab = params.tab || "tab1";

  return template
    .evaluate()
    .setTitle("OGV BREITFURT - LEITSTAND")
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}