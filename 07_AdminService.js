/**
 * DATEI: 07_ADMINSERVICE.GS
 * MASTER-KOMMANDO-ZENTRALE & VOLLSTÄNDIGE SYSTEM-AUDITIERUNG
 * REVISIONS-STATUS: V19.6 (FULL RESTORE: DESIGN, UTF-8 & PROMPT-CLEANING)
 */

// FUNKTION: Generiert die grafische Systemanalyse im Original-Design | EINGRIFF: Admin-Zentrale
function technischerReportErstellen() {
  // FUNKTION: Erzwingt die Synchronisation der Tabellendaten | EINGRIFF: SpreadsheetApp API
  SpreadsheetApp.flush();

  // FUNKTION: Startet die Diagnose-Engine | EINGRIFF: 98_DIAGNOSE.GS
  const diagData = systemIntegritaetPruefen();

  // FUNKTION: Initialisiert die UI-Schnittstelle nur bei verfügbarer Spreadsheet-UI | EINGRIFF: SpreadsheetApp UI
  const ui = uiHolen_();

  // FUNKTION: Lädt das zentrale Konfigurationsobjekt | EINGRIFF: 01_CONFIG.GS
  const c = KONFIGURATION;

  // CHECK: Ist die Config geladen? | FOLGE: Abbruch bei Fehlreferenz
  if (!c) {
    if (ui) {
      ui.alert("X KRITISCH: 01_CONFIG fehlt!");
      return;
    }
    throw new Error("01_CONFIG fehlt.");
  }

  // FUNKTION: Zeitstempel gemäß Zeitzone | EINGRIFF: Zeit-Engine
  const zZone = c.ZOLL_PARAMETER.ZEIT_PARAMETER.ZEITZONE || "GMT+2";
  const stempel = Utilities.formatDate(new Date(), zZone, "dd.MM.yyyy HH:mm:ss");

  let html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>';
  html += ':root { --pink: #ff007f; --neon: #00ff00; --bg: #ffffff; --text: #000; }';
  html += 'html, body { width: 100%; height: 100%; margin: 0; padding: 20px; box-sizing: border-box; overflow-x: hidden; overflow-y: auto; }';
  html += '*, *::before, *::after { box-sizing: border-box; }';
  html += 'body { font-family: "Segoe UI", Tahoma, sans-serif; background: #f4f4f9; padding: 20px; }';
  html += '.pdf-header { border-left: 12px solid var(--text); padding-left: 20px; margin-bottom: 30px; }';
  html += '.pdf-header h1 { font-size: 42px; margin: 0; text-transform: uppercase; }';
  html += '.pdf-header p { font-size: 18px; color: #444; margin-top: 15px; font-weight: bold; }';
  html += '.data-block-box { background: white; border: 1px solid #ccc; padding: 20px; margin-bottom: 20px; border-radius: 10px; box-shadow: 5px 5px 15px rgba(0,0,0,0.05); }';
  html += '.data-block-box h2 { margin: 0; font-size: 24px; text-transform: uppercase; color: var(--text); }';
  html += '.stats-line { font-size: 14px; color: #666; margin-top: 5px; font-family: monospace; }';
  html += 'table { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 15px; }';
  html += 'th { color: var(--pink); text-align: left; padding: 10px; font-size: 12px; border-bottom: 2px solid #eee; }';
  html += '.row-card td { background: #fff; padding: 15px 10px; font-size: 14px; border-bottom: 1px solid #eee; }';
  html += '.pos-col { font-weight: bold; width: 50px; text-align: center; }';
  html += '.header-name { width: 280px; color: #000; font-weight: bold; }';
  html += '.key-config { color: #33f; font-family: monospace; }';
  html += '.dropdown-tag { background: #eef; color: #33f; padding: 4px 8px; border-radius: 8px; font-size: 10px; font-weight: bold; }';
  html += '.admin-card { background: #000; color: white; padding: 30px; border-radius: 15px; margin-top: 20px; border: 3px solid var(--pink); overflow: visible; max-width: 100%; }';
  html += '.file-title { color: var(--pink); font-family: monospace; margin-top: 28px; margin-bottom: 10px; font-size: 24px; font-weight: bold; letter-spacing: 1px; }';
  html += 'pre { background: #1a1a1a; color: #00ff00; padding: 20px; border-radius: 10px; overflow-x: auto; overflow-y: visible; font-family: monospace; white-space: pre-wrap; word-break: break-word; overflow-wrap: anywhere; max-width: 100%; width: 100%; box-sizing: border-box; }';
  html += 'code { white-space: pre-wrap; word-break: break-word; overflow-wrap: anywhere; display: block; max-width: 100%; }';
  html += '@media print { pre, code { white-space: pre-wrap !important; word-break: break-word !important; overflow: visible !important; } }';
  html += 'textarea { width: 100%; height: 350px; background: #0a0a0a; color: #00ff00; padding: 20px; border-radius: 10px; font-family: "Consolas", monospace; border: 1px solid #444; }';
  html += '.btn { background: var(--pink); color: white; padding: 15px 30px; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; transition: 0.3s; }';
  html += '.btn:hover { background: #d00068; }';
  html += '.btn-blue { background: #007bff; color: white; }';
  html += '.no-print { position: fixed; top: 30px; right: 30px; z-index: 1000; }';
  html += '</style></head><body>';

  html += '<div class="no-print"><button class="btn" onclick="window.print()">Drucken / PDF</button></div>';
  html += '<div class="pdf-header"><h1>BRENNEREI STATUS</h1><p>Statusbericht vom: ' + stempel + '</p></div>';

  const triggers = ScriptApp.getProjectTriggers();
  html += '<div class="admin-card"><h2>SYSTEM-AUTOMATION & ZOLL-INTEGRITÄT</h2>';
  const trigHtml = triggers.length > 0 ? '<span style="color:var(--neon)">AKTIV (' + triggers.length + ')</span>' : '<span style="color:red">DEAKTIVIERT</span>';
  html += '<p>Status Hintergrund-Automation: ' + trigHtml + '</p>';

  if (triggers.length === 0) {
    html += '<button class="btn btn-blue" onclick="google.script.run.automationNeuAktivieren()">Automation aktivieren</button>';
  }

  html += '<button class="btn btn-blue" style="margin-left:10px;" onclick="google.script.run.forceAuthorization()">API Autorisierung (Force Auth)</button></div>';

  diagData.tabellen.forEach(tab => {
    html += '<div class="data-block-box"><h2>DATEN-BLOCK: ' + escapeHtml_(tab.name) + '</h2>';
    if (!tab.existiert) {
      html += '<p style="color:red; font-weight:bold;">FEHLER: TABELLE FEHLT ODER NAME FALSCH!</p></div>';
      return;
    }

    html += '<div class="stats-line">Key: ' + tab.key + ' | Zeilen: ' + tab.zeilen + ' | Spalten: ' + tab.spalten + '</div>';

    if (tab.audit && tab.audit.length > 0) {
      html += '<table><thead><tr><th style="text-align:center">POS</th><th>HEADER (IST)</th><th>KEY (CONFIG)</th><th>UI</th></tr></thead><tbody>';
      tab.audit.forEach(col => {
        const ddTag = col.dropdown ? '<span class="dropdown-tag">AKTIV</span>' : 'nein';
        html += '<tr class="row-card"><td class="pos-col">' + col.pos + '</td><td class="header-name">' + escapeHtml_(col.header) + '</td><td class="key-config">' + col.key + '</td><td>' + ddTag + '</td></tr>';
      });
      html += '</tbody></table>';
    }
    html += '</div>';
  });

  html += '<div class="admin-card" style="background: #000; border: 3px solid var(--pink);">';
  html += '<h2 style="color:var(--pink);">GPT-SYSTEM-DIREKTIVE</h2>';
  const rawPrompt = getGptMegaPrompt_(diagData.spaltenScan);
  const cleanPrompt = rawPrompt.replace(/\\n/g, '\n');
  html += '<p style="font-size:12px; color: #888;">Kopiere diesen Text für KI-Revisionen:</p>';
  html += '<textarea id="gptp" readonly>' + cleanPrompt + '</textarea>';
  html += '<button class="btn" style="margin-top:10px;" onclick="var t=document.getElementById(\'gptp\');t.select();document.execCommand(\'copy\');alert(\'MASTER-DIREKTIVE KOPIERT!\')">MEGA-PROMPT KOPIEREN</button></div>';

  html += '<div class="admin-card"><h2>QUELLCODE LIVE-BACKUP (Stand: ' + stempel + ')</h2>';
  try {
    const scripts = getProjectFiles_();
    scripts.forEach(file => {
      const reportSource = quelltextFuerReportBereinigen_(file.source);
      html += '<p style="color:var(--pink); font-family:monospace; margin-top:80px;">DATEI: ' + escapeHtml_(file.name) + '</p>';
      html += '<pre><code>' + escapeHtml_(reportSource) + '</code></pre>';
    });
  } catch (e) {
    html += '<p style="color:red;">X API-ZUGRIFF VERWEIGERT: ' + e.toString() + '</p>';
  }
  html += '</div></body></html>';

  // CHECK: Ist eine Spreadsheet-UI vorhanden? | FOLGE: Dialog im Sheet öffnen
  if (ui) {
    const output = HtmlService.createHtmlOutput(html).setWidth(1600).setHeight(1000);
    ui.showModalDialog(output, "Systemanalyse Leitstand OGV Breitfurt");
    return;
  }

  // FUNKTION: Gibt den HTML-Report im Editor-Kontext als Rückgabe zurück | EINGRIFF: Fallback
  return HtmlService.createHtmlOutput(html).getContent();
}

/**
 * FUNKTION: Bereinigt Quelltext nur für die Anzeige im Systemreport
 * EINGRIFF: Report-Darstellung
 * CHECK: Entfernt externe Cite-Marker | FOLGE: Saubere Codeansicht ohne Fremdmarkierungen
 */
function quelltextFuerReportBereinigen_(source) {
  if (source == null) return "";
  return String(source).replace(/\s*\[cite:\s*\d+(?:-\d+)?\]/g, "");
}

/**
 * FUNKTION: Wandelt HTML-Sonderzeichen zur Anzeige um
 * EINGRIFF: String-Encoding
 * CHECK: HTML sicher, Unicode bleibt erhalten | FOLGE: Emojis und Umlaute bleiben lesbar
 */
function escapeHtml_(text) {
  if (text == null) return "";
  return String(text).replace(/[&<>"']/g, function(m) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return map[m];
  });
}

// FUNKTION: Holt Quellcode über die Google Cloud API | EINGRIFF: REST-Service
function getProjectFiles_() {
  const projectId = ScriptApp.getScriptId();
  const url = "https://script.googleapis.com/v1/projects/" + projectId + "/content";
  const options = { headers: { "Authorization": "Bearer " + ScriptApp.getOAuthToken() } };
  const res = UrlFetchApp.fetch(url, options);
  if (res.getResponseCode() === 200) {
    const data = JSON.parse(res.getContentText());
    return data.files.map(f => {
      return { name: f.name + (f.type === "SERVER_JS" ? ".gs" : ".html"), source: f.source };
    });
  }
  return [];
}

// FUNKTION: Repariert die Automation | EINGRIFF: Trigger-System
function automationNeuAktivieren() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("installierterOnEditTrigger").forSpreadsheet(ss).onEdit().create();

  const ui = uiHolen_();
  if (ui) {
    ui.alert("✔ TRIGGER REPARIERT.");
  }

  return "✔ TRIGGER REPARIERT.";
}

// FUNKTION: Erzwingt die OAuth-Freigabe | EINGRIFF: Sicherheit
function forceAuthorization() {
  DriveApp.getRootFolder();

  const ui = uiHolen_();
  if (ui) {
    ui.alert("✔ SYSTEM VOLLSTÄNDIG AUTORISIERT.");
  }

  return "✔ SYSTEM VOLLSTÄNDIG AUTORISIERT.";
}/**
 * DATEI: 07_ADMINSERVICE.GS
 * SERVERSEITIGER SELBSTTEST FÜR DIE EINGABEMASKE
 */

// FUNKTION: Startet den serverseitigen Selbsttest der Eingabemaske | EINGRIFF: Admin-Menü / UI
function maskenSelbsttestStarten() {
  // FUNKTION: Führt den Test unter Sperre aus | EINGRIFF: 00_LOCKSYSTEM
  return mitSperreAusfuehren_(function() {
    // FUNKTION: Führt den eigentlichen Selbsttest aus | EINGRIFF: 09_MASKENSERVICE
    const report = maskenServerSelbsttest_();

    // FUNKTION: Formatiert das Ergebnis für UI und Log | EINGRIFF: Berichtsausgabe
    const text = maskenSelbsttestTextBauen_(report);

    // FUNKTION: Schreibt das Gesamtergebnis ins Systemlog | EINGRIFF: SYSTEM_LOG
    systemLogSchreiben_(
      report.ok ? "INFO" : "ERROR",
      "MaskenSelbsttest",
      report.ok ? "Selbsttest erfolgreich" : "Selbsttest fehlgeschlagen",
      report.testVId || "",
      text
    );

    // FUNKTION: Holt die UI-Schnittstelle, falls verfügbar | EINGRIFF: SpreadsheetApp UI
    const ui = uiHolen_();

    // CHECK: Ist eine UI verfügbar? | FOLGE: Ergebnisdialog anzeigen
    if (ui) {
      ui.alert(report.ok ? "MASKEN-SELBSTTEST OK" : "MASKEN-SELBSTTEST FEHLER", text, ui.ButtonSet.OK);
    }

    // FUNKTION: Gibt den Bericht zusätzlich programmatisch zurück | EINGRIFF: API-Rückgabe
    return report;
  }, "maskenSelbsttestStarten");
}


// FUNKTION: Baut einen lesbaren Text aus dem Selbsttest-Bericht | EINGRIFF: UI / Log
function maskenSelbsttestTextBauen_(report) {
  // FUNKTION: Initialisiert die Ausgabeliste | EINGRIFF: Textaufbau
  const teile = [];

  // FUNKTION: Schreibt den Gesamtstatus in den Bericht | EINGRIFF: Textaufbau
  teile.push("Gesamtstatus: " + (report.ok ? "OK" : "FEHLER"));

  // CHECK: Liegt eine Test-Vorgangs-ID vor? | FOLGE: Ausgabe des Testankers
  if (report.testVId) {
    teile.push("Test-Vorgang: " + report.testVId);
  }

  // FUNKTION: Übernimmt alle Detailzeilen | EINGRIFF: Textaufbau
  (report.details || []).forEach(function(eintrag) {
    teile.push("[" + eintrag.level + "] " + eintrag.modul + " - " + eintrag.text);
  });

  // FUNKTION: Gibt den Gesamttext zurück | EINGRIFF: API-Rückgabe
  return teile.join("\n");
}