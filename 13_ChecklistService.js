
/**
 * DATEI: 13_CHECKLISTSERVICE.GS
 * ERZEUGT DIE CHECKLISTE FÜR STOFFBESITZER AUF BASIS DES AKTUELLEN MAPPING-SYSTEMS
 */

// FUNKTION: Erzeugt die Checkliste für den aktiven Vorgang | EINGRIFF: UI / DRIVE / TABELLENMAPPING
function stoffbesitzerChecklisteErstellen() {
  // FUNKTION: Referenziert das aktive Blatt | EINGRIFF: SpreadsheetApp
  const sh = SpreadsheetApp.getActiveSheet();
  // FUNKTION: Ermittelt die aktive Zeile | EINGRIFF: UI-Selektion
  const row = sh.getActiveCell().getRow();
  // FUNKTION: Liest das dynamische Spalten-Mapping | EINGRIFF: 02_BASISHELPER
  const map = spaltenZuordnungHolen_(sh);

  // CHECK: Ist eine Datenzeile ausgewählt? | FOLGE: Abbruch bei Header-Zeile
  if (row <= 1) {
    SpreadsheetApp.getUi().alert("Bitte wählen Sie eine Datenzeile aus.");
    return;
  }

  // CHECK: Ist die Stoffbesitzer-Spalte vorhanden? | FOLGE: Abbruch bei Strukturfehler
  if (!map.STOFFBESITZER) {
    SpreadsheetApp.getUi().alert("Fehlende Spalte: Stoffbesitzer.");
    return;
  }

  // FUNKTION: Liest den Stoffbesitzer aus der aktiven Zeile | EINGRIFF: Physikalische Tabelle
  const owner = sh.getRange(row, map.STOFFBESITZER).getDisplayValue();
  // FUNKTION: Liest den Maischetermin aus der aktiven Zeile | EINGRIFF: Physikalische Tabelle
  const termin = map.TERMIN_MAISCHE ? sh.getRange(row, map.TERMIN_MAISCHE).getDisplayValue() : "";
  // FUNKTION: Liest den Brandtag aus der aktiven Zeile | EINGRIFF: Physikalische Tabelle
  const brand = map.TAG_BRAND ? sh.getRange(row, map.TAG_BRAND).getDisplayValue() : "";

  // FUNKTION: Initialisiert Bilddaten für Logo und Fasshinweis | EINGRIFF: Drive
  let logo = "";
  let fass = "";

  try {
    // FUNKTION: Liest alle Dateien des gemeinsamen Bildordners | EINGRIFF: Drive
    const fs = DriveApp.getFolderById(KONFIGURATION.DRIVE_ORDNER.LOGO_ORDNER_ID).getFiles();

    // FUNKTION: Iteriert über die Dateien des Bildordners | EINGRIFF: Datei-Loop
    while (fs.hasNext()) {
      // FUNKTION: Referenziert die aktuelle Datei | EINGRIFF: Drive
      const f = fs.next();
      // FUNKTION: Liest den Dateinamen in Kleinbuchstaben | EINGRIFF: String-Vergleich
      const fileName = String(f.getName() || "").toLowerCase();
      // FUNKTION: Erzeugt eine Data-URL für die HTML-Einbettung | EINGRIFF: Bild-Einbettung
      const b64 = "data:" + f.getMimeType() + ";base64," + Utilities.base64Encode(f.getBlob().getBytes());

      // CHECK: Ist die Datei ein Logo? | FOLGE: Zuweisung an den Kopfbereich
      if (fileName.indexOf("ogv") !== -1 || fileName.indexOf("logo") !== -1) {
        logo = b64;
      } else {
        // FUNKTION: Verwendet die übrige Bilddatei als Fasshinweis | EINGRIFF: Bild-Einbettung
        fass = b64;
      }
    }
  } catch (e) {
    // FUNKTION: Protokolliert Fehler beim Bildabruf | EINGRIFF: SYSTEM_LOG
    systemLogSchreiben_("WARN", "ChecklistService", "Bildabruf fehlgeschlagen", "", String(e));
  }

  // FUNKTION: Baut die HTML-Checkliste auf | EINGRIFF: Druckdarstellung
  let html = `<html><head><style>
    @page { size: A4 portrait; margin: 10mm; }
    body { font-family: "Segoe UI", sans-serif; font-size: 13px; line-height: 1.4; color: #333; }
    .header { display: flex; justify-content: space-between; border-bottom: 3px solid #d9534f; padding-bottom: 10px; margin-bottom: 15px; }
    .logo-img { height: 75px; }
    .contact-info { text-align: right; font-size: 11px; }
    .client-data { background: #f9f9f9; border: 1px solid #ccc; padding: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; border-radius: 5px; margin-bottom: 15px; }
    .client-data b { color: #d9534f; }
    .danger-box { border: 2.5px solid #d9534f; background: #fff8f8; padding: 12px; border-radius: 8px; margin-bottom: 15px; }
    .danger-box h2 { color: #d9534f; margin: 0 0 5px 0; font-size: 15px; text-transform: uppercase; }
    .fass-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    .fass-table th { background: #444; color: #fff; padding: 8px; font-size: 11px; text-transform: uppercase; }
    .fass-table td { border: 1.5px solid #000; height: 38px; }
    .info-section { display: flex; gap: 25px; align-items: flex-start; }
    .check-row { display: flex; align-items: center; margin-bottom: 8px; font-weight: bold; }
    .check-box { width: 18px; height: 18px; border: 2px solid #000; margin-right: 12px; text-align: center; line-height: 18px; color: #28a745; font-size: 16px; }
    .footer { text-align: center; font-size: 10px; color: #888; border-top: 1px solid #eee; padding-top: 10px; margin-top: 30px; }
    .no-p { text-align: center; padding: 15px; background: #eee; border-bottom: 1px solid #ccc; }
    @media print { .no-p { display: none; } }
  </style></head><body>
  <div class="no-p"><button style="padding:12px 40px; background:#d9534f; color:white; font-weight:bold; border:none; border-radius:5px; cursor:pointer; font-size:16px;" onclick="window.print()">📄 CHECKLISTE DRUCKEN</button></div>
  <div class="header">
    <img src="${logo}" class="logo-img">
    <div class="contact-info">
      <strong>OGV Breitfurt e.V. - Brennerei</strong><br>
      Ansprechpartner: ${printEscapeHtml_(KONFIGURATION.KONTAKT.NAME)}<br>
      📞 ${printEscapeHtml_(KONFIGURATION.KONTAKT.TEL)}<br>
      📧 ${printEscapeHtml_(KONFIGURATION.KONTAKT.MAIL)}
    </div>
  </div>
  <div class="client-data">
    <div>Stoffbesitzer: <b>${printEscapeHtml_(owner)}</b></div>
    <div>Brennereinummer: <b>${printEscapeHtml_(KONFIGURATION.IDENTITAET.BRENNEREI_NUMMER)}</b></div>
    <div>Termin Maischeabgabe: <b>${printEscapeHtml_(termin || "________________")}</b></div>
    <div>Geplanter Brandtag: <b>${printEscapeHtml_(brand || "________________")}</b></div>
  </div>
  <div class="danger-box">
    <h2>Zwingend zur Maischeannahme mitbringen:</h2>
    <p>Ohne diese Unterlagen ist <b>keine</b> Annahme möglich:</p>
    <ul style="font-weight: bold;">
      <li>Onlinefähiger Personalausweis (nPA) + PIN-Nummer</li>
      <li>Stoffbesitzernummer / E-Mailadresse</li>
    </ul>
  </div>
  <table class="fass-table">
    <thead><tr><th style="width: 40%">Material / Rohstoff</th><th style="width: 20%">Fassvolumen (L)</th><th style="width: 20%">Inhalt (Liter)</th><th style="width: 20%">Interne Fass-Nr.</th></tr></thead>
    <tbody><tr><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td></tr></tbody>
  </table>
  <div class="info-section">
    <div style="flex: 2;">
      <div class="check-row"><div class="check-box">✓</div> Persönliches Erscheinen zur Zoll-Anmeldung erforderlich.</div>
      <div class="check-row"><div class="check-box">✓</div> Unsere Brennblase fasst maximal 120 Liter.</div>
      <div class="check-row"><div class="check-box">✓</div> <b>Keine Annahme von Gärfässern mit kleiner Öffnung:</b></div>
    </div>
    <div style="flex: 1; text-align: right;">
      <img src="${fass}" style="width: 130px; border: 1px solid #ccc;">
      <div style="font-size: 10px; color: #d9534f; font-weight: bold; text-align: center;">NICHT ZULÄSSIG!</div>
    </div>
  </div>
  <div class="footer">OGV Breitfurt e.V. | Wiesenweg 4 | 66440 Blieskastel-Breitfurt</div>
</body></html>`;

  // FUNKTION: Öffnet die Checkliste als Dialog | EINGRIFF: SpreadsheetApp UI
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(1000).setHeight(950), " ");
}