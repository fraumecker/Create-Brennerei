/**
 * DATEI: 98_DIAGNOSE.GS
 * KERN-LOGIK FÜR DEN LÜCKENLOSEN TABELLEN-SCAN (EMOJI-SAFE)
 * REVISIONS-STATUS: V19.0
 */

// FUNKTION: Führt eine Tiefenprüfung der gesamten Tabellenstruktur durch | EINGRIFF: Admin-Service
function systemIntegritaetPruefen() {
  // FUNKTION: Referenziert die aktive Arbeitsmappe | EINGRIFF: SpreadsheetApp API
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // FUNKTION: Lädt das zentrale Konfigurationsobjekt | EINGRIFF: 01_Config.gs
  const cfg = KONFIGURATION;
  
  // FUNKTION: Initialisiert das Report-Objekt | EINGRIFF: Daten-Struktur
  const report = {
    zeitpunkt: Utilities.formatDate(new Date(), cfg.ZOLL_PARAMETER.ZEIT_PARAMETER.ZEITZONE, "dd.MM.yyyy HH:mm:ss"),
    tabellen: []
  };

  // FUNKTION: Holt alle konfigurierten Tabellen-Keys | EINGRIFF: 01_Config.gs
  const alleKeys = Object.keys(cfg.TABELLEN);

  // FUNKTION: Iteriert durch jeden konfigurierten Tabellen-Key | EINGRIFF: Diagnose-Loop
  alleKeys.forEach(function(tKey) {
    // FUNKTION: Holt den physischen Namen (inkl. Emojis) aus der Config | EINGRIFF: 01_Config.gs
    const sName = cfg.TABELLEN[tKey];
    // FUNKTION: Sucht das Blatt im Spreadsheet | EINGRIFF: SpreadsheetApp API
    const sh = ss.getSheetByName(sName);
    
    // FUNKTION: Erstellt das Status-Objekt für die Tabelle | EINGRIFF: Audit-Logik
    const tStatus = {
      key: tKey,
      name: sName,
      existiert: !!sh,
      zeilen: sh ? sh.getLastRow() : 0,
      spalten: sh ? sh.getLastColumn() : 0,
      audit: []
    };

    // CHECK: Ist das Blatt vorhanden und hat es Spalten? | FOLGE: Header-Audit starten
    if (sh && tStatus.spalten > 0) {
      // FUNKTION: Liest die Header-Zeile und die ersten Validierungen ein | EINGRIFF: Physische Tabelle
      const istHeaders = sh.getRange(1, 1, 1, tStatus.spalten).getValues()[0];
      const validations = sh.getRange(2, 1, 1, tStatus.spalten).getDataValidations()[0];

      // FUNKTION: Prüft jede physische Spalte gegen die Config | EINGRIFF: Mapping-Check
      istHeaders.forEach(function(hName, index) {
        // FUNKTION: Bereinigt den Header-Namen | EINGRIFF: Text-Normalisierung
        const hClean = String(hName).trim();
        let gefundenerKey = "---";

        // FUNKTION: Sucht den passenden Config-Key für diesen Header | EINGRIFF: 01_Config.gs
        for (let configKey in cfg.SPALTEN) {
          if (cfg.SPALTEN[configKey] === hClean) {
            gefundenerKey = configKey;
            break;
          }
        }

        // FUNKTION: Schreibt das Spalten-Ergebnis in das Audit-Array | EINGRIFF: Report-Struktur
        tStatus.audit.push({
          pos: index + 1,
          header: hClean || "(Leerzeile)",
          key: gefundenerKey,
          dropdown: !!(validations && validations[index])
        });
      });
    }
    
    // FUNKTION: Fügt die Tabelle dem Gesamtbericht hinzu | EINGRIFF: Ergebnis-Sammeln
    report.tabellen.push(tStatus);
  });

  return report;
}

/**
 * GPT-HELPER V19.0 (ULTIMATE ARCHITECT & TRANSPARENCY EDITION)
 * REVISIONS-STATUS: MASTER-DIREKTIVE V19.0 (EMOJI-TREUE & SYNTAX-GESETZ)
 */

// FUNKTION: Öffnet das GPT-Briefing Tool als Dialog | EINGRIFF: Admin-UI
function zeigeGptBriefingTool(returnString = false) {
  // FUNKTION: Referenziert die aktive Arbeitsmappe | EINGRIFF: SpreadsheetApp API
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // FUNKTION: Lädt das zentrale Konfigurationsobjekt | EINGRIFF: 01_Config.gs
  const c = KONFIGURATION;
  
  // CHECK: Ist die Konfiguration geladen? | FOLGE: Abbruch bei Fehlreferenz
  if (typeof c === 'undefined') {
    if (returnString) return "X KRITISCH: 01_CONFIG nicht geladen!";
    SpreadsheetApp.getUi().alert("X FEHLER: KONFIGURATION fehlt!");
    return;
  }

  // FUNKTION: Führt den System-Scan durch | EINGRIFF: 98_Diagnose.gs
  const integrity = checkSystemIntegrity_(ss, c);
  // FUNKTION: Generiert den Mega-Prompt | EINGRIFF: Prompt-Engine
  const prompt = getGptMegaPrompt_(integrity.spaltenScan);

  // CHECK: Soll der String nur zurückgegeben werden? | FOLGE: API-Rückgabe
  if (returnString === true) return prompt;

  // FUNKTION: Konstruiert das HTML-Interface | EINGRIFF: UI-Design
  // CHECK: Template-Literal nutzt ${prompt} | FOLGE: Dynamische Injektion
  const html = '<div style="font-family: \'Segoe UI\', sans-serif; background: #1a1a1a; color: white; padding: 20px;">' +
      '<h1 style="color:#ff007f; text-transform:uppercase; letter-spacing: 2px;">Architect</h1>' +
      '<p style="color:#00f2ff; font-weight: bold;">Status: Verifikations-Workflow aktiv (V19.0)</p>' +
      '<textarea id="pArea" readonly style="width:100%; height: 350px; background: #000; color:#0f0; font-family: monospace; padding: 10px; border: 2px solid #333;">' + prompt + '</textarea>' +
      '<div style="margin-top: 20px; text-align:center;">' +
        '<button onclick="copyP()" style="background: linear-gradient(135deg, #ff007f, #c20061); color: white; padding: 15px 30px; border: none; border-radius: 10px; cursor: pointer; font-weight: bold;">' +
          'MEGA-PROMPT KOPIEREN & GPT VERPFLICHTEN' +
        '</button>' +
      '</div>' +
      '<script>' +
        'function copyP() { ' +
          'var t = document.getElementById("pArea"); ' +
          't.select(); ' +
          'document.execCommand("copy"); ' +
          'alert("SYSTEM-DIREKTIVE KOPIEREN!\\n\\nDie KI muss nun:\\n1. Datei-Header setzen\\n2. Syntax exakt spiegeln\\n3. Vorab-Freigabe einholen"); ' +
        '}' +
      '</script>' +
    '</div>';

  // FUNKTION: Zeigt den modalen Dialog an | EINGRIFF: SpreadsheetApp UI
  const ui = HtmlService.createHtmlOutput(html).setWidth(900).setHeight(750);
  SpreadsheetApp.getUi().showModalDialog(ui, "Master-Admin OGV Breitfurt");
}

// FUNKTION: Konstruiert die GPT-Master-Direktive | EINGRIFF: Prompt-Logic
function getGptMegaPrompt_(scanOverride = null) {
  const c = KONFIGURATION;
  const scan = scanOverride || "Fehler beim Header-Scan.";
  
  let p = "MASTER-DIREKTIVE: SYSTEM-ARCHITEKT OGV BREITFURT (REVISION-MODUS)\n\n";
  p += "DEIN CODE-AUSGABE-GESETZ (ZWINGEND):\n";
  p += "1. DATEI-HEADER: Beginne JEDEN Code-Block mit 'DATEI: [NAME].GS'.\n";
  p += "2. REVISIONS-PFLICHT: Zitiere erst den ALT-CODE, dann präsentiere den NEU-CODE.\n";
  p += "3. SYNTAX-TREUE: Klammern, Backticks und Plexus-Struktur sind UNANTASTBAR.\n";
  p += "4. SACHLICHE DOKUMENTATION: Kommentiere jede Zeile neutral.\n";
  p += "VERBOTEN: Wörter wie 'Korrektur', 'Fix' oder 'Verbesserung'.\n\n";
  
  p += "DOKUMENTATIONS-MUSTER PRO ZEILE:\n";
  p += "// FUNKTION: [Zweck der Zeile] | EINGRIFF: [Welches Blatt/Modul?]\n";
  p += "// CHECK: [Grund der Prüfung] | FOLGE: [Ergebnis bei Erfolg]\n\n";

  const zp = c.ZOLL_PARAMETER.ZEIT_PARAMETER;
  p += "ZOLL & AUTOMATIONS-GESETZE:\n";
  p += "Max. Brennblase: " + c.IDENTITAET.MAX_BLASE + "L\n";
  p += "Kaltstart: " + zp.KALTSTART + "m | Folgebrand: " + zp.FOLGEBRAND + "m | Reinigung: " + zp.REINIGUNG + "m\n\n";

  p += "PHYSIKALISCHE STRUKTUR (UNANTASTBAR):\n";
  for (let key in c.TABELLEN) {
    p += "Tab [" + key + "] = \"" + c.TABELLEN[key] + "\"\n";
  }

  p += "\nLIVE-HEADER-SCAN (SOURCE OF TRUTH):\n" + scan + "\n";
  p += "\n=== PROTOKOLL ENDE. BESTÄTIGE DIE DATEI-HEADER-PFLICHT UND START-LOGIK. ===\n";
  
  return p;
}

// FUNKTION: Scannt die Header aller konfigurierten Blätter | EINGRIFF: Diagnose
function checkSystemIntegrity_(ss, c) {
  let scan = "";
  // FUNKTION: Liste der zu prüfenden Keys | EINGRIFF: 01_Config.gs
  const tabsToCheck = ["VORPLANUNG", "MAISCHEANNAHME", "ZENTRALREGISTER", "PAPIERKORB", "SYSTEM_LOG"];
  
  tabsToCheck.forEach(k => {
    let sName = c.TABELLEN[k];
    let sh = ss.getSheetByName(sName);
    if (sh) {
      scan += "\n[HEADER-SCAN FÜR: " + sName + "]\n";
      let headers = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0];
      headers.forEach((name, i) => {
        if (name) scan += "Spalte " + (i + 1) + ": \"" + name + "\"\n";
      });
    }
  });
  return { spaltenScan: scan };
}