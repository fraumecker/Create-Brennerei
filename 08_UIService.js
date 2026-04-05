
/**
 * DATEI: 08_UISERVICE.GS
 * UI-FUNKTIONEN FÜR MASKE UND COCKPIT
 */

// FUNKTION: Öffnet die Web-Maske aus der aktiven Tabellenzeile | EINGRIFF: SpreadsheetApp UI / Index.html
function vorgangOeffnen() {
  // FUNKTION: Referenziert das aktive Blatt | EINGRIFF: SpreadsheetApp
  const sh = SpreadsheetApp.getActiveSheet();
  // CHECK: Existiert ein aktives Blatt? | FOLGE: Abbruch bei fehlendem Kontext
  if (!sh) return;

  // FUNKTION: Liest das dynamische Mapping des aktiven Blatts | EINGRIFF: 02_BASISHELPER
  const sMap = spaltenZuordnungHolen_(sh);
  // FUNKTION: Ermittelt die aktive Zeile | EINGRIFF: SpreadsheetApp
  const row = sh.getActiveCell().getRow();
  // FUNKTION: Liest die ID-Spalte aus dem Mapping | EINGRIFF: Mapping
  const colId = sMap.VORGANGS_ID;
  // FUNKTION: Initialisiert die Vorgangs-ID | EINGRIFF: Datenstruktur
  let vId = "";

  // CHECK: Ist eine Datenzeile mit ID-Spalte aktiv? | FOLGE: Lesen der Vorgangs-ID aus der Tabelle
  if (colId && row > 1) {
    // FUNKTION: Liest und normalisiert die Vorgangs-ID aus der aktiven Zeile | EINGRIFF: Physikalische Tabelle
    vId = textNormalisieren_(sh.getRange(row, colId).getValue());
  }

  // FUNKTION: Erzeugt das HTML-Template der Web-Maske | EINGRIFF: HtmlService
  const t = HtmlService.createTemplateFromFile("Index");
  // FUNKTION: Initialisiert den Start-Tab | EINGRIFF: UI-Navigation
  let startTab = "tab1";
  // FUNKTION: Initialisiert den Bearbeitungsanker | EINGRIFF: UI-Zustand
  let editVId = "";

  // CHECK: Liegt eine verwertbare Vorgangs-ID vor? | FOLGE: Vorab-Prüfung gegen echte Datensätze
  if (vId && vId.length > 1) {
    // FUNKTION: Prüft serverseitig, ob der Vorgang real in Vorplanung oder Maischeannahme vorhanden ist | EINGRIFF: 09_MASKENSERVICE
    const daten = holeVorgangsDatenFuerMaske(vId);

    // CHECK: Wurde ein realer Vorgang gefunden? | FOLGE: Öffnen im Bearbeiten-Modus
    if (daten && daten.vId) {
      // FUNKTION: Übernimmt die aufgelöste Vorgangs-ID in den Template-Kontext | EINGRIFF: Web-Maske
      editVId = daten.vId;
      // FUNKTION: Liest den physischen Namen des aktiven Blatts | EINGRIFF: SpreadsheetApp
      const sName = sh.getName();
      // CHECK: Erfolgt der Aufruf aus der Maischeannahme? | FOLGE: Start auf Tab 3, sonst Tab 1
      startTab = (sName === KONFIGURATION.TABELLEN.MAISCHEANNAHME) ? "tab3" : "tab1";
    }
  }

  // FUNKTION: Übergibt die aufgelöste Vorgangs-ID an das HTML-Template | EINGRIFF: Index.html
  t.editVId = editVId;
  // FUNKTION: Übergibt den Start-Tab an das HTML-Template | EINGRIFF: Index.html
  t.startTab = startTab;

  // FUNKTION: Rendert das UI mit definierter Größe | EINGRIFF: HtmlService
  const ui = t.evaluate().setWidth(1280).setHeight(950);
  // FUNKTION: Öffnet den Dialog im Spreadsheet | EINGRIFF: SpreadsheetApp UI
  SpreadsheetApp.getUi().showModalDialog(ui, " ");
}

// FUNKTION: Zeigt den mobilen Zugang zum Brenner-Cockpit an | EINGRIFF: SpreadsheetApp UI / Web-App
function cockpitZugangAnzeigen() {
  // FUNKTION: Liest die veröffentlichte URL der Web-App | EINGRIFF: ScriptApp
  const scriptUrl = ScriptApp.getService().getUrl();

  // CHECK: Ist eine Web-App-URL vorhanden? | FOLGE: Hinweis bei fehlender Veröffentlichung
  if (!scriptUrl) {
    // FUNKTION: Informiert über die fehlende Veröffentlichung der Web-App | EINGRIFF: SpreadsheetApp UI
    SpreadsheetApp.getUi().alert("⚠️ Web-App ist noch nicht veröffentlicht.");
    return;
  }

  // FUNKTION: Baut die Cockpit-URL mit dem Modus-Parameter auf | EINGRIFF: URL-Logik
  const cockpitUrl = scriptUrl + "?mode=cockpit";
  // FUNKTION: Baut die HTML-Ausgabe für QR-Code und Direktlink auf | EINGRIFF: HtmlService
  const html = `
    <div style="font-family:sans-serif; text-align:center; padding:20px; background:#1a1a1a; color:white;">
      <h2 style="color:#00f2ff;">🏁 BRENNER COCKPIT</h2>
      <p>Scan den Code für den mobilen Leitstand:</p>
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(cockpitUrl)}">
      <br><br>
      <input type="text" value="${cockpitUrl}" style="width:100%; background:#333; color:#00f2ff; border:none; padding:5px;" readonly>
    </div>
  `;

  // FUNKTION: Rendert die HTML-Ausgabe als Dialog | EINGRIFF: HtmlService
  const ui = HtmlService.createHtmlOutput(html).setWidth(400).setHeight(450);
  // FUNKTION: Öffnet den Dialog im Spreadsheet | EINGRIFF: SpreadsheetApp UI
  SpreadsheetApp.getUi().showModalDialog(ui, "Cockpit Zugang");
}