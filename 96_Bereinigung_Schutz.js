/**
 * DATEI: 96_BEREINIGUNG_SCHUTZ.GS
 * STATUS: REVISION V22.2 - VALIDIERUNGSSCHUTZ
 */

function bereinigungsschutzAnalyseStarten() {
  bereinigungsschutzHauptlauf_(false, false);
}

function bereinigungsschutzUngueltigeIdsLoeschen() {
  bereinigungsschutzHauptlauf_(true, false);
}

function bereinigungsschutzVerwaisteRegisterLoeschen() {
  bereinigungsschutzHauptlauf_(false, true);
}

function bereinigungsschutzAllesBereinigen() {
  bereinigungsschutzHauptlauf_(true, true);
}

function bereinigungsschutzHauptlauf_(ungueltigeIdsLoeschen, verwaisteRegisterLoeschen) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const report = bereinigungsschutzReportNeu_();

  const shVP = tabelleHolen_("VORPLANUNG");
  const shMA = tabelleHolen_("MAISCHEANNAHME");
  const shZR = tabelleHolen_("ZENTRALREGISTER");

  bereinigungsschutzPflichtblattCheck_(report, "VORPLANUNG", shVP);
  bereinigungsschutzPflichtblattCheck_(report, "MAISCHEANNAHME", shMA);
  bereinigungsschutzPflichtblattCheck_(report, "ZENTRALREGISTER", shZR);

  if (!shVP || !shZR) {
    bereinigungsschutzReportSchreiben_(ss, report);
    SpreadsheetApp.getUi().alert("Abbruch: Kernblätter fehlen.");
    return;
  }

  bereinigungsschutzUngueltigeIdsInBlattBearbeiten_(report, shVP, "VORPLANUNG", ungueltigeIdsLoeschen);
  if (shMA) bereinigungsschutzUngueltigeIdsInBlattBearbeiten_(report, shMA, "MAISCHEANNAHME", ungueltigeIdsLoeschen);
  bereinigungsschutzUngueltigeIdsInBlattBearbeiten_(report, shZR, "ZENTRALREGISTER", ungueltigeIdsLoeschen);

  const vpIndex = bereinigungsschutzIndexNachVorgangsId_(shVP);
  const maIndex = shMA ? bereinigungsschutzIndexNachVorgangsId_(shMA) : {};
  const zrIndex = bereinigungsschutzIndexNachVorgangsId_(shZR);

  bereinigungsschutzVerwaisteRegisterBearbeiten_(report, shZR, vpIndex, maIndex, zrIndex, verwaisteRegisterLoeschen);
  bereinigungsschutzReportSchreiben_(ss, report);

  SpreadsheetApp.getUi().alert("Bereinigungsschutz abgeschlossen. Details im Blatt 🧹_BEREINIGUNGSSCHUTZ");
}

/**
 * PRÜFUNG DES ID-FORMATS (STRIKT V-YYYY-XXX)
 */
function bereinigungsschutzIdFormatIstPlausibel_(vId) {
  // Regex: Startet mit V- gefolgt von 4 Ziffern (Jahr), einem Bindestrich und mindestens 3 Ziffern
  const pattern = /^V-\d{4}-\d{3,}$/i;
  return pattern.test(textNormalisieren_(vId));
}

function bereinigungsschutzIdIstUngueltig_(vId) {
  const id = textNormalisieren_(vId).toLowerCase();
  if (!id || id === '""' || id === "''" || id === "-" || id === "null" || id === "undefined") return true;
  return false;
}

function bereinigungsschutzUngueltigeIdsInBlattBearbeiten_(report, sh, key, loeschen) {
  if (!sh || sh.getLastRow() < 2) return;
  const sMap = spaltenZuordnungHolen_(sh);
  if (!sMap.VORGANGS_ID) return;

  const daten = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  const zeilenZumLoeschen = [];

  for (let i = 0; i < daten.length; i++) {
    const rowNr = i + 2;
    const vId = textNormalisieren_(daten[i][sMap.VORGANGS_ID - 1]);

    if (bereinigungsschutzIdIstUngueltig_(vId)) {
      bereinigungsschutzReportEintrag_(report, "ID_PRUEFUNG", loeschen ? "AKTION" : "FEHLER", sh.getName(), rowNr, vId, "UNGUELTIGE_ID", "ID ist leer oder korrupt.", "");
      if (loeschen) zeilenZumLoeschen.push(rowNr);
    } else if (!bereinigungsschutzIdFormatIstPlausibel_(vId)) {
      bereinigungsschutzReportEintrag_(report, "ID_PRUEFUNG", "WARNUNG", sh.getName(), rowNr, vId, "ID_FORMAT_ABWEICHEND", "ID entspricht nicht dem Muster V-YYYY-XXX.", "");
    }
  }

  if (loeschen && zeilenZumLoeschen.length > 0) {
    bereinigungsschutzZeilenAbsteigendLoeschen_(sh, zeilenZumLoeschen);
  }
}

// [HILFSFUNKTIONEN BLEIBEN ZUR VOLLSTÄNDIGKEIT ERHALTEN]

function bereinigungsschutzIndexNachVorgangsId_(sh) {
  const map = {};
  if (!sh || sh.getLastRow() < 2) return map;
  const sMap = spaltenZuordnungHolen_(sh);
  if (!sMap.VORGANGS_ID) return map;
  const daten = sh.getRange(2, sMap.VORGANGS_ID, sh.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < daten.length; i++) {
    const vId = textNormalisieren_(daten[i][0]);
    if (!map[vId]) map[vId] = [];
    map[vId].push(i + 2);
  }
  return map;
}

function bereinigungsschutzZeilenAbsteigendLoeschen_(sh, zeilen) {
  const uniq = Array.from(new Set(zeilen)).sort((a, b) => b - a);
  uniq.forEach(rowNr => sh.deleteRow(rowNr));
}

function bereinigungsschutzVerwaisteRegisterBearbeiten_(report, shZR, vpIndex, maIndex, zrIndex, loeschen) {
  const alleIds = Object.keys(zrIndex);
  const zeilenZumLoeschen = [];
  alleIds.forEach(vId => {
    if (bereinigungsschutzIdIstUngueltig_(vId)) return;
    const vpRows = vpIndex[vId] || [];
    const zrRows = zrIndex[vId] || [];
    if (zrRows.length > 0 && vpRows.length === 0) {
      bereinigungsschutzReportEintrag_(report, "REGISTER", loeschen ? "AKTION" : "FEHLER", "ZENTRALREGISTER", zrRows[0], vId, "VERWAIST", "Im Register aber nicht in Vorplanung.", "");
      if (loeschen) zrRows.forEach(r => zeilenZumLoeschen.push(r));
    }
  });
  if (loeschen && zeilenZumLoeschen.length > 0) bereinigungsschutzZeilenAbsteigendLoeschen_(shZR, zeilenZumLoeschen);
}

function bereinigungsschutzPflichtblattCheck_(report, key, sh) {
  if (sh) bereinigungsschutzReportEintrag_(report, "BASIS", "OK", sh.getName(), 0, "", "BLATT_OK", "Pflichtblatt vorhanden.", key);
  else bereinigungsschutzReportEintrag_(report, "BASIS", "FEHLER", "", 0, "", "BLATT_FEHLT", "Pflichtblatt fehlt.", key);
}

function bereinigungsschutzReportNeu_() {
  return { erstelltAm: Utilities.formatDate(new Date(), KONFIGURATION.ZOLL_PARAMETER.ZEIT_PARAMETER.ZEITZONE, "dd.MM.yyyy HH:mm:ss"), eintraege: [] };
}

function bereinigungsschutzReportEintrag_(report, block, level, blatt, zeile, vId, code, meldung, details) {
  report.eintraege.push([report.erstelltAm, block, level, blatt, zeile, vId, code, meldung, details]);
}

function bereinigungsschutzReportSchreiben_(ss, report) {
  const sheetName = "🧹_BEREINIGUNGSSCHUTZ";
  let sh = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
  const header = [["Zeitpunkt", "Block", "Level", "Blatt", "Zeile", "Vorgangs_ID", "Code", "Meldung", "Details"]];
  const zeilen = header.concat(report.eintraege);
  sh.clear().getRange(1, 1, zeilen.length, zeilen[0].length).setValues(zeilen);
  sh.setFrozenRows(1);
}

function bereinigungsschutzRowFeld_(row, sMap, key) {
  if (!sMap || !sMap[key]) return "";
  return textNormalisieren_(row[sMap[key] - 1]);
}