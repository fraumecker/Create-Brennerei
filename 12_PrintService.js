/**
 * DATEI: 12_PRINTSERVICE.GS
 * DRUCKFUNKTIONEN FÜR PROTOKOLLE AUF BASIS DES AKTUELLEN MAPPING-SYSTEMS
 */

// FUNKTION: Druckt die markierten Datenzeilen des aktiven Blatts als HTML-Protokoll | EINGRIFF: UI / DRIVE / TABELLENMAPPING
function protokollDrucken() {
  // FUNKTION: Referenziert die aktive Arbeitsmappe | EINGRIFF: SpreadsheetApp
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // FUNKTION: Referenziert das aktive Blatt | EINGRIFF: SpreadsheetApp
  const sh = ss.getActiveSheet();
  // FUNKTION: Liest das dynamische Spalten-Mapping | EINGRIFF: 02_BASISHELPER
  const map = spaltenZuordnungHolen_(sh);
  // FUNKTION: Ermittelt alle markierten Datenzeilen | EINGRIFF: UI-Selektion
  const zeilen = protokollZeilenAuswahlHolen_(sh);

  // CHECK: Gibt es mindestens eine markierte Datenzeile? | FOLGE: Abbruch bei leerer Auswahl
  if (zeilen.length === 0) {
    SpreadsheetApp.getUi().alert("Bitte markieren Sie zuerst mindestens eine Datenzeile.");
    return;
  }

  // FUNKTION: Initialisiert das Logo | EINGRIFF: Drive-Bildlogik
  let logoBase64 = "";

  try {
    // FUNKTION: Liest den Logo-Ordner | EINGRIFF: 01_CONFIG
    const files = DriveApp.getFolderById(KONFIGURATION.DRIVE_ORDNER.LOGO_ORDNER_ID).getFiles();

    // FUNKTION: Sucht gezielt die Logodatei | EINGRIFF: Drive
    while (files.hasNext()) {
      // FUNKTION: Referenziert die aktuelle Datei | EINGRIFF: Drive
      const f = files.next();
      // FUNKTION: Liest den Dateinamen in Kleinbuchstaben | EINGRIFF: String-Vergleich
      const n = String(f.getName() || "").toLowerCase();

      // CHECK: Ist die Datei ein Logo? | FOLGE: Verwendung im Druckkopf
      if (n.indexOf("ogv") !== -1 || n.indexOf("logo") !== -1) {
        logoBase64 = "data:" + f.getMimeType() + ";base64," + Utilities.base64Encode(f.getBlob().getBytes());
        break;
      }
    }
  } catch (e) {
    // FUNKTION: Protokolliert Fehler beim Logo-Abruf | EINGRIFF: SYSTEM_LOG
    systemLogSchreiben_("WARN", "PrintService", "Logoabruf fehlgeschlagen", "", String(e));
  }

  // FUNKTION: Initialisiert den HTML-Rahmen | EINGRIFF: Druckdarstellung
  let html = `<html><head><style>
    @page{size:landscape;margin:8mm;}
    body{font-family:sans-serif;}
    .h{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #d9534f;padding-bottom:8px;}
    table{width:100%;border-collapse:collapse;margin-top:10px;}
    th{background:#eee;border:1.2px solid #000;font-size:9px;padding:4px;}
    td{border:1.2px solid #000;padding:5px 3px;font-size:11px;}
    .pfeil{text-align:center;font-weight:bold;color:green;}
    .logo{height:90px;max-width:180px;object-fit:contain;}
    @media print{.no-p{display:none;}}
  </style></head><body>
  <div class="no-p"><button onclick="window.print()" style="padding:10px 20px; cursor:pointer;">DRUCKEN</button></div>
  <div class="h">
    <img src="${logoBase64}" class="logo">
    <div><h1>Brenn-Protokoll</h1><b>Brennereinummer: ${printEscapeHtml_(KONFIGURATION.IDENTITAET.BRENNEREI_NUMMER)}</b></div>
    <div style="text-align:right;"><strong>OGV Breitfurt e.V.</strong><br>${printEscapeHtml_(KONFIGURATION.KONTAKT.NAME)}<br>📞 ${printEscapeHtml_(KONFIGURATION.KONTAKT.TEL)}</div>
  </div>
  <table>
    <thead>
      <tr>
        <th>DATUM</th><th>BRENNER</th><th>VON</th><th>BIS</th><th>BESITZER</th>
        <th>REG-NR.</th><th>MATERIAL</th><th>FASS</th><th>LIT.</th><th>ALK %</th><th>AUSB.</th>
      </tr>
    </thead>
    <tbody>`;

  // FUNKTION: Baut jede markierte Zeile in das Protokoll ein | EINGRIFF: Tabellenexport
  zeilen.forEach(function(z) {
    // FUNKTION: Liest die komplette Zeile als Anzeigeformat | EINGRIFF: Physikalische Tabelle
    const row = sh.getRange(z, 1, 1, sh.getLastColumn()).getDisplayValues()[0];

    // FUNKTION: Liest das Branddatum | EINGRIFF: Mapping
    const datum = protokollWertAusZeile_(row, map, "TAG_BRAND");
    // FUNKTION: Liest den Brenner | EINGRIFF: Mapping
    const brenner = protokollWertAusZeile_(row, map, "BRENNER");
    // FUNKTION: Liest Startzeit | EINGRIFF: Mapping
    const von = protokollWertAusZeile_(row, map, "VON");
    // FUNKTION: Liest Endzeit | EINGRIFF: Mapping
    const bis = protokollWertAusZeile_(row, map, "BIS");
    // FUNKTION: Liest Stoffbesitzer | EINGRIFF: Mapping
    const stoff = protokollWertAusZeile_(row, map, "STOFFBESITZER");
    // FUNKTION: Liest Register-Nummer | EINGRIFF: Mapping
    const reg = protokollWertAusZeile_(row, map, "REGISTERNUMMER");
    // FUNKTION: Liest Material | EINGRIFF: Mapping
    const material = protokollWertAusZeile_(row, map, "MATERIAL");
    // FUNKTION: Liest Fasswert aus Vorplanung oder Maische | EINGRIFF: Mapping
    const fass = protokollWertAusZeile_(row, map, "FASS_VP") || protokollWertAusZeile_(row, map, "FASS_MA");
    // FUNKTION: Liest Literwert aus Vorplanung oder Maische | EINGRIFF: Mapping
    const liter = protokollWertAusZeile_(row, map, "INH_VP") || protokollWertAusZeile_(row, map, "INH_MA");
    // FUNKTION: Liest Alkoholwert | EINGRIFF: Mapping
    const alk = protokollWertAusZeile_(row, map, "ALKOHOL") || protokollWertAusZeile_(row, map, "ALKOHOL_PROZENT");
    // FUNKTION: Liest Ausbeute | EINGRIFF: Mapping
    const ausb = protokollWertAusZeile_(row, map, "AUSBEUTE") || protokollWertAusZeile_(row, map, "AUSBEUTE_LITER");

    // FUNKTION: Kennzeichnet Split-/Folgezeilen visuell | EINGRIFF: Drucklayout
    const fassClass = (fass === "→" || fass === "↳") ? "pfeil" : "";

    // FUNKTION: Hängt die Druckzeile an den HTML-Output | EINGRIFF: HTML-Generator
    html += `<tr>
      <td>${printEscapeHtml_(datum)}</td>
      <td>${printEscapeHtml_(brenner)}</td>
      <td>${printEscapeHtml_(von)}</td>
      <td>${printEscapeHtml_(bis)}</td>
      <td>${printEscapeHtml_(stoff)}</td>
      <td>${printEscapeHtml_(reg)}</td>
      <td>${printEscapeHtml_(material)}</td>
      <td class="${fassClass}">${printEscapeHtml_(fass)}</td>
      <td>${printEscapeHtml_(liter)}</td>
      <td>${printEscapeHtml_(alk)}</td>
      <td>${printEscapeHtml_(ausb)}</td>
    </tr>`;
  });

  // FUNKTION: Schließt das HTML-Dokument | EINGRIFF: HTML-Generator
  html += "</tbody></table></body></html>";

  // FUNKTION: Öffnet die Druckansicht | EINGRIFF: SpreadsheetApp UI
  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(1200).setHeight(900),
    " "
  );
}

// FUNKTION: Erstellt eine kompakte HTML-Einzelansicht für eine Zeile | EINGRIFF: Einzeldruck / Vorschau
function holeProtokollHtmlFuerEinzelzeile_(blatt, zeile) {
  // FUNKTION: Liest das Mapping des Blatts | EINGRIFF: 02_BASISHELPER
  const map = spaltenZuordnungHolen_(blatt);
  // FUNKTION: Liest die komplette Zeile im Anzeigeformat | EINGRIFF: Physikalische Tabelle
  const data = blatt.getRange(zeile, 1, 1, blatt.getLastColumn()).getDisplayValues()[0];

  // FUNKTION: Hilfsleser für Mapping-Werte | EINGRIFF: Zeilenexport
  const getV = function(key) {
    // CHECK: Existiert die Spalte im Mapping? | FOLGE: Rückgabe Wert oder Platzhalter
    return map[key] ? (data[map[key] - 1] || "---") : "---";
  };

  // FUNKTION: Baut die kompakte HTML-Einzelansicht | EINGRIFF: HTML-Generator
  return `<html><body><h1>BRENNPROTOKOLL</h1><hr><p>ID: ${printEscapeHtml_(getV("VORGANGS_ID"))}</p><p>Besitzer: ${printEscapeHtml_(getV("STOFFBESITZER"))}</p><p>Ergebnis: ${printEscapeHtml_(getV("ALKOHOL"))}% / ${printEscapeHtml_(getV("AUSBEUTE"))}L</p></body></html>`;
}

// FUNKTION: Ermittelt alle markierten Datenzeilen robust auch bei Mehrfachauswahl | EINGRIFF: UI-Selektion
function protokollZeilenAuswahlHolen_(blatt) {
  // FUNKTION: Initialisiert die Ergebnismenge | EINGRIFF: Datenstruktur
  const set = {};
  // FUNKTION: Liest die Mehrfachauswahl, falls vorhanden | EINGRIFF: SpreadsheetApp
  const rangeList = blatt.getActiveRangeList();
  // FUNKTION: Baut eine Liste der zu prüfenden Bereiche | EINGRIFF: UI-Selektion
  const ranges = rangeList ? rangeList.getRanges() : [blatt.getActiveRange()];

  // FUNKTION: Iteriert über alle markierten Bereiche | EINGRIFF: Range-Loop
  ranges.forEach(function(r) {
    // CHECK: Ist der Bereich gültig? | FOLGE: Verarbeitung
    if (!r) return;

    // FUNKTION: Ermittelt Startzeile | EINGRIFF: Range-Metadaten
    const start = r.getRow();
    // FUNKTION: Ermittelt Anzahl Zeilen | EINGRIFF: Range-Metadaten
    const count = r.getNumRows();

    // FUNKTION: Übernimmt jede Datenzeile in das Ergebnis-Set | EINGRIFF: Zeilenliste
    for (let i = 0; i < count; i++) {
      const z = start + i;
      if (z > 1) set[z] = true;
    }
  });

  // FUNKTION: Wandelt das Set in eine sortierte Liste um | EINGRIFF: API-Rückgabe
  return Object.keys(set).map(Number).sort(function(a, b) { return a - b; });
}

// FUNKTION: Liest einen Wert aus einer Zeile anhand des Mapping-Keys | EINGRIFF: Tabellenexport
function protokollWertAusZeile_(row, map, key) {
  // CHECK: Existiert die Spalte im Mapping? | FOLGE: Rückgabe des Inhalts oder Leerstring
  return map[key] ? (row[map[key] - 1] || "") : "";
}

// FUNKTION: Sichert HTML-Text gegen Sonderzeichen | EINGRIFF: Druck-HTML
function printEscapeHtml_(text) {
  // CHECK: Leerer Wert? | FOLGE: Leerstring
  if (text == null) return "";
  // FUNKTION: Wandelt kritische Zeichen um | EINGRIFF: HTML-Encoding
  return String(text).replace(/[&<>"']/g, function(m) {
    // FUNKTION: Zuordnungstabelle für HTML-Entities | EINGRIFF: Encoding
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    // FUNKTION: Gibt den umgewandelten Wert zurück | EINGRIFF: API-Rückgabe
    return map[m];
  });
}