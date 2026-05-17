/**
 * DATEI: 07_AdminService.gs
 * ZWECK: ADMIN / DIAGNOSE / REPORT / MASKEN-SELBSTTEST
 */


/**
 * FUNKTION: Generiert die grafische Systemanalyse im Dialog oder als HTML-Rückgabe.
 * EINGRIFF: Admin-Menü / Diagnose
 */
function technischerReportErstellen() {
  SpreadsheetApp.flush();

  const diagData = systemIntegritaetPruefen();
  const ui = uiHolen_();
  const c = KONFIGURATION;

  if (!c) {
    if (ui) {
      ui.alert("KRITISCH: 01_Config fehlt.");
      return;
    }
    throw new Error("01_Config fehlt.");
  }

  const zZone = (c.ZOLL_PARAMETER && c.ZOLL_PARAMETER.ZEIT_PARAMETER && c.ZOLL_PARAMETER.ZEIT_PARAMETER.ZEITZONE)
    ? c.ZOLL_PARAMETER.ZEIT_PARAMETER.ZEITZONE
    : "GMT+2";

  const stempel = Utilities.formatDate(new Date(), zZone, "dd.MM.yyyy HH:mm:ss");

  let html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>';
  html += ':root { --pink:#ff007f; --neon:#00ff00; --bg:#ffffff; --text:#000000; }';
  html += 'html,body{width:100%;height:100%;margin:0;padding:20px;box-sizing:border-box;overflow-x:hidden;overflow-y:auto;}';
  html += '*,*::before,*::after{box-sizing:border-box;}';
  html += 'body{font-family:"Segoe UI",Tahoma,sans-serif;background:#f4f4f9;padding:20px;}';
  html += '.pdf-header{border-left:12px solid var(--text);padding-left:20px;margin-bottom:30px;}';
  html += '.pdf-header h1{font-size:42px;margin:0;text-transform:uppercase;}';
  html += '.pdf-header p{font-size:18px;color:#444;margin-top:15px;font-weight:bold;}';
  html += '.data-block-box{background:#fff;border:1px solid #ccc;padding:20px;margin-bottom:20px;border-radius:10px;box-shadow:5px 5px 15px rgba(0,0,0,0.05);}';
  html += '.data-block-box h2{margin:0;font-size:24px;text-transform:uppercase;color:var(--text);}';
  html += '.stats-line{font-size:14px;color:#666;margin-top:5px;font-family:monospace;}';
  html += 'table{width:100%;border-collapse:separate;border-spacing:0;margin-top:15px;}';
  html += 'th{color:var(--pink);text-align:left;padding:10px;font-size:12px;border-bottom:2px solid #eee;}';
  html += '.row-card td{background:#fff;padding:15px 10px;font-size:14px;border-bottom:1px solid #eee;}';
  html += '.pos-col{font-weight:bold;width:50px;text-align:center;}';
  html += '.header-name{width:280px;color:#000;font-weight:bold;}';
  html += '.key-config{color:#33f;font-family:monospace;}';
  html += '.dropdown-tag{background:#eef;color:#33f;padding:4px 8px;border-radius:8px;font-size:10px;font-weight:bold;}';
  html += '.admin-card{background:#000;color:#fff;padding:30px;border-radius:15px;margin-top:20px;border:3px solid var(--pink);overflow:visible;max-width:100%;}';
  html += 'pre{background:#1a1a1a;color:#00ff00;padding:20px;border-radius:10px;overflow-x:auto;overflow-y:visible;font-family:monospace;white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere;max-width:100%;width:100%;box-sizing:border-box;}';
  html += 'code{white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere;display:block;max-width:100%;}';
  html += 'textarea{width:100%;height:350px;background:#0a0a0a;color:#00ff00;padding:20px;border-radius:10px;font-family:"Consolas",monospace;border:1px solid #444;}';
  html += '.btn{background:var(--pink);color:#fff;padding:15px 30px;border:none;border-radius:8px;cursor:pointer;font-weight:bold;transition:0.3s;}';
  html += '.btn:hover{background:#d00068;}';
  html += '.btn-blue{background:#007bff;color:#fff;}';
  html += '.no-print{position:fixed;top:30px;right:30px;z-index:1000;}';
  html += '@media print { pre,code{white-space:pre-wrap!important;word-break:break-word!important;overflow:visible!important;} .no-print{display:none;} }';
  html += '</style></head><body>';

  html += '<div class="no-print"><button class="btn" onclick="window.print()">Drucken / PDF</button></div>';
  html += '<div class="pdf-header"><h1>BRENNEREI STATUS</h1><p>Statusbericht vom: ' + escapeHtml_(stempel) + '</p></div>';

  const triggers = ScriptApp.getProjectTriggers();
  const trigHtml = triggers.length > 0
    ? '<span style="color:var(--neon)">AKTIV (' + triggers.length + ')</span>'
    : '<span style="color:red">DEAKTIVIERT</span>';

  html += '<div class="admin-card">';
  html += '<h2>SYSTEM-AUTOMATION & ZOLL-INTEGRITÄT</h2>';
  html += '<p>Status Hintergrund-Automation: ' + trigHtml + '</p>';

  if (triggers.length === 0) {
    html += '<button class="btn btn-blue" onclick="google.script.run.automationNeuAktivieren()">Automation aktivieren</button>';
  }

  html += '<button class="btn btn-blue" style="margin-left:10px;" onclick="google.script.run.forceAuthorization()">API Autorisierung</button>';
  html += '</div>';

  (diagData.tabellen || []).forEach(function(tab) {
    html += '<div class="data-block-box"><h2>DATEN-BLOCK: ' + escapeHtml_(tab.name) + '</h2>';

    if (!tab.existiert) {
      html += '<p style="color:red;font-weight:bold;">FEHLER: TABELLE FEHLT ODER NAME FALSCH.</p></div>';
      return;
    }

    html += '<div class="stats-line">Key: ' + escapeHtml_(tab.key) + ' | Zeilen: ' + escapeHtml_(tab.zeilen) + ' | Spalten: ' + escapeHtml_(tab.spalten) + '</div>';

    if (tab.audit && tab.audit.length > 0) {
      html += '<table><thead><tr><th style="text-align:center">POS</th><th>HEADER (IST)</th><th>KEY (CONFIG)</th><th>UI</th></tr></thead><tbody>';

      tab.audit.forEach(function(col) {
        const ddTag = col.dropdown ? '<span class="dropdown-tag">AKTIV</span>' : 'nein';
        html += '<tr class="row-card">';
        html += '<td class="pos-col">' + escapeHtml_(col.pos) + '</td>';
        html += '<td class="header-name">' + escapeHtml_(col.header) + '</td>';
        html += '<td class="key-config">' + escapeHtml_(col.key) + '</td>';
        html += '<td>' + ddTag + '</td>';
        html += '</tr>';
      });

      html += '</tbody></table>';
    }

    html += '</div>';
  });

  html += '<div class="admin-card">';
  html += '<h2 style="color:var(--pink);">GPT-SYSTEM-DIREKTIVE</h2>';

  try {
    const rawPrompt = getGptMegaPrompt_(diagData.spaltenScan || []);
    const cleanPrompt = String(rawPrompt || "").replace(/\\n/g, '\n');

    html += '<p style="font-size:12px;color:#888;">Kopiere diesen Text für KI-Revisionen:</p>';
    html += '<textarea id="gptp" readonly>' + escapeHtmlTextarea_(cleanPrompt) + '</textarea>';
    html += '<button class="btn" style="margin-top:10px;" onclick="var t=document.getElementById(\'gptp\');t.select();document.execCommand(\'copy\');alert(\'MASTER-DIREKTIVE KOPIERT\')">MEGA-PROMPT KOPIEREN</button>';
  } catch (e) {
    html += '<p style="color:red;">Prompt-Erzeugung fehlgeschlagen: ' + escapeHtml_(String(e)) + '</p>';
  }

  html += '</div>';

  html += '<div class="admin-card">';
  html += '<h2>QUELLCODE LIVE-BACKUP (Stand: ' + escapeHtml_(stempel) + ')</h2>';

  try {
    const scripts = getProjectFiles_();

    scripts.forEach(function(file) {
      const reportSource = quelltextFuerReportBereinigen_(file.source);
      html += '<p style="color:var(--pink);font-family:monospace;margin-top:80px;">DATEI: ' + escapeHtml_(file.name) + '</p>';
      html += '<pre><code>' + escapeHtml_(reportSource) + '</code></pre>';
    });
  } catch (e) {
    html += '<p style="color:red;">API-ZUGRIFF VERWEIGERT: ' + escapeHtml_(String(e)) + '</p>';
  }

  html += '</div>';
  html += '</body></html>';

  if (ui) {
    const output = HtmlService.createHtmlOutput(html).setWidth(1600).setHeight(1000);
    ui.showModalDialog(output, "Systemanalyse Leitstand OGV Breitfurt");
    return;
  }

  return HtmlService.createHtmlOutput(html).getContent();
}


/**
 * FUNKTION: Startet den serverseitigen Selbsttest der Eingabemaske.
 * EINGRIFF: Admin-Menü / UI
 */
function maskenSelbsttestStarten() {
  return mitSperreAusfuehren_(function() {
    const report = maskenServerSelbsttest_();
    const text = maskenSelbsttestTextBauen_(report);

    systemLogSchreiben_(
      report.ok ? "INFO" : "ERROR",
      "MaskenSelbsttest",
      report.ok ? "Selbsttest erfolgreich" : "Selbsttest fehlgeschlagen",
      report.testVId || "",
      text
    );

    const ui = uiHolen_();
    if (ui) {
      ui.alert(report.ok ? "MASKEN-SELBSTTEST OK" : "MASKEN-SELBSTTEST FEHLER", text, ui.ButtonSet.OK);
    }

    return report;
  }, "maskenSelbsttestStarten");
}


/**
 * FUNKTION: Baut einen lesbaren Text aus dem Selbsttest-Bericht.
 */
function maskenSelbsttestTextBauen_(report) {
  const teile = [];

  teile.push("Gesamtstatus: " + (report.ok ? "OK" : "FEHLER"));

  if (report.testVId) {
    teile.push("Test-Vorgang: " + report.testVId);
  }

  (report.details || []).forEach(function(eintrag) {
    teile.push("[" + eintrag.level + "] " + eintrag.modul + " - " + eintrag.text);
  });

  return teile.join("\n");
}


/**
 * FUNKTION: Bereinigt Quelltext nur für die Anzeige im Systemreport.
 */
function quelltextFuerReportBereinigen_(source) {
  if (source == null) return "";
  return String(source).replace(/\s*\[cite:\s*\d+(?:-\d+)?\]/g, "");
}


/**
 * FUNKTION: Wandelt HTML-Sonderzeichen zur Anzeige um.
 */
function escapeHtml_(text) {
  if (text == null) return "";
  return String(text).replace(/[&<>"']/g, function(m) {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#039;"
    };
    return map[m];
  });
}


/**
 * FUNKTION: Escape speziell für textarea-Inhalt.
 */
function escapeHtmlTextarea_(text) {
  if (text == null) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}


/**
 * FUNKTION: Holt Quellcode über die Apps-Script-API.
 */
function getProjectFiles_() {
  const projectId = ScriptApp.getScriptId();
  const url = "https://script.googleapis.com/v1/projects/" + projectId + "/content";
  const options = {
    headers: {
      Authorization: "Bearer " + ScriptApp.getOAuthToken()
    },
    muteHttpExceptions: true
  };

  const res = UrlFetchApp.fetch(url, options);

  if (res.getResponseCode() !== 200) {
    throw new Error("Apps-Script-API Antwort: " + res.getResponseCode() + " | " + res.getContentText());
  }

  const data = JSON.parse(res.getContentText());

  return (data.files || []).map(function(f) {
    return {
      name: f.name + (f.type === "SERVER_JS" ? ".gs" : ".html"),
      source: f.source || ""
    };
  });
}