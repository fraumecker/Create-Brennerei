/**
 * DATEI: 97_DIAGNOSE_ABLAUF.GS
 * STATUS: REVISION V20.0 - SYSTEM DIAGNOSIS & REPAIR MODULE
 */

// FUNKTION: Startet die vollständige Systemdiagnose | EINGRIFF: Diagnose-Start
function diagnoseGesamtsystemStarten() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const report = diagnoseReportNeu_();

  const shVP = tabelleHolen_("VORPLANUNG");
  const shMA = tabelleHolen_("MAISCHEANNAHME");
  const shZR = tabelleHolen_("ZENTRALREGISTER");

  diagnosePflichtblattPruefen_(report, "VORPLANUNG", shVP);
  diagnosePflichtblattPruefen_(report, "MAISCHEANNAHME", shMA);
  diagnosePflichtblattPruefen_(report, "ZENTRALREGISTER", shZR);

  if (!shVP) {
    diagnoseReportSchreiben_(ss, report);
    SpreadsheetApp.getUi().alert("Diagnose beendet. Vorplanung fehlt.");
    return;
  }

  diagnoseKernspaltenPruefen_(report, shVP, "VORPLANUNG", ["VORGANGS_ID", "STOFFBESITZER", "ANRUF_DATUM", "MATERIAL", "INH_VP", "ANZAHL_BRAENDE", "STATUS"]);
  if (shMA) diagnoseKernspaltenPruefen_(report, shMA, "MAISCHEANNAHME", ["VORGANGS_ID", "STOFFBESITZER", "MATERIAL", "INH_MA", "FAßnmmer", "REGISTERNUMMER", "STATUS_AKTION", "DOSSIER_LINK"]);
  if (shZR) diagnoseKernspaltenPruefen_(report, shZR, "ZENTRALREGISTER", ["VORGANGS_ID", "DATUM", "STOFFBESITZER", "STATUS"]);

  diagnoseUngueltigeIdsImBlatt_(report, shVP, "VORPLANUNG");
  if (shMA) diagnoseUngueltigeIdsImBlatt_(report, shMA, "MAISCHEANNAHME");
  if (shZR) diagnoseUngueltigeIdsImBlatt_(report, shZR, "ZENTRALREGISTER");

  diagnosePhantomUndKonsistenz_(report, shVP, shMA, shZR);

  diagnoseReportSchreiben_(ss, report);
  SpreadsheetApp.getUi().alert("Diagnose beendet. Blatt: 🧪_DIAGNOSE");
}

// --- NEU: SYSTEM-REPARATUR MODUL ---

// FUNKTION: Findet IDs ohne Register-Eintrag und repariert sie | EINGRIFF: Reparatur-Task
function diagnoseUndReparaturVorgangsIds() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const report = diagnoseReportNeu_();
  const shVP = tabelleHolen_("VORPLANUNG");
  
  if (!shVP) return;
  
  const s = spaltenZuordnungHolen_(shVP);
  const daten = shVP.getRange(2, 1, shVP.getLastRow() - 1, shVP.getLastColumn()).getValues();
  let reparaturen = 0;

  // FUNKTION: Scannt alle Zeilen der Vorplanung nach fehlenden IDs | EINGRIFF: Integritäts-Check
  for (let i = 0; i < daten.length; i++) {
    const rowNr = i + 2;
    const vId = textNormalisieren_(daten[i][s.VORGANGS_ID - 1]);
    const stoff = textNormalisieren_(daten[i][s.STOFFBESITZER - 1]);

    // CHECK: Zeile hat Stoffbesitzer, aber keine ID? | FOLGE: Reparatur einleiten
    if (stoff && !vId) {
      const neueId = vorgangsIdSicherstellen_(stoff);
      shVP.getRange(rowNr, s.VORGANGS_ID).setValue(neueId);
      
      diagnoseReportEintrag_(report, "REPARATUR", "AKTION", shVP.getName(), rowNr, neueId, "ID_NACHGETRAGEN", "Verwaiste Zeile repariert.", "Stoff: " + stoff);
      reparaturen++;
    }
  }

  diagnoseReportSchreiben_(ss, report);
  SpreadsheetApp.getUi().alert("Diagnose & Reparatur beendet.\nReparierte Zeilen: " + reparaturen + "\nDetails im Blatt: 🧪_DIAGNOSE");
}

// --- BESTEHENDE DIAGNOSE-HILFSFUNKTIONEN (VOLLSTÄNDIG) ---

function diagnosePflichtblattPruefen_(report, key, sh) {
  if (sh) {
    diagnoseReportEintrag_(report, "BASIS", "OK", sh.getName(), 0, "", "BLATT_OK", "Pflichtblatt vorhanden.", key);
  } else {
    diagnoseReportEintrag_(report, "BASIS", "FEHLER", "", 0, "", "BLATT_FEHLT", "Pflichtblatt fehlt.", key);
  }
}

function diagnoseKernspaltenPruefen_(report, sh, key, keys) {
  const sMap = spaltenZuordnungHolen_(sh);
  keys.forEach(function(spKey) {
    if (sMap[spKey]) {
      diagnoseReportEintrag_(report, "HEADER", "OK", sh.getName(), 1, "", "SPALTE_OK", "Pflichtspalte vorhanden.", spKey);
    } else {
      diagnoseReportEintrag_(report, "HEADER", "FEHLER", sh.getName(), 1, "", "SPALTE_FEHLT", "Pflichtspalte fehlt.", spKey);
    }
  });
}

function diagnoseUngueltigeIdsImBlatt_(report, sh, key) {
  if (!sh || sh.getLastRow() < 2) return;
  const sMap = spaltenZuordnungHolen_(sh);
  const daten = sh.getRange(2, sMap.VORGANGS_ID, sh.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < daten.length; i++) {
    const id = textNormalisieren_(daten[i][0]);
    if (!id || id === "null" || id === "undefined") {
      diagnoseReportEintrag_(report, "ID_PRUEFUNG", "FEHLER", sh.getName(), i + 2, id, "UNGUELTIGE_ID", "Ungültige ID gefunden.", "");
    }
  }
}

function diagnosePhantomUndKonsistenz_(report, shVP, shMA, shZR) {
  const vp = diagnoseIndexNachVorgangsId_(shVP);
  const zr = diagnoseIndexNachVorgangsId_(shZR);
  Object.keys(vp).forEach(vId => {
    if (!zr[vId]) {
      diagnoseReportEintrag_(report, "KONSISTENZ", "FEHLER", shVP.getName(), vp[vId][0], vId, "REGISTER_FEHLT", "Vorgang nicht im Register.", "");
    }
  });
}

function diagnoseIndexNachVorgangsId_(sh) {
  const map = {};
  if (!sh || sh.getLastRow() < 2) return map;
  const sMap = spaltenZuordnungHolen_(sh);
  const daten = sh.getRange(2, sMap.VORGANGS_ID, sh.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < daten.length; i++) {
    const vId = textNormalisieren_(daten[i][0]);
    if (!map[vId]) map[vId] = [];
    map[vId].push(i + 2);
  }
  return map;
}

function diagnoseReportNeu_() {
  return {
    erstelltAm: Utilities.formatDate(new Date(), KONFIGURATION.ZOLL_PARAMETER.ZEIT_PARAMETER.ZEITZONE, "dd.MM.yyyy HH:mm:ss"),
    eintraege: []
  };
}

function diagnoseReportEintrag_(report, block, level, blatt, zeile, vId, code, meldung, details) {
  report.eintraege.push([report.erstelltAm, block, level, blatt, zeile, vId, code, meldung, details]);
}

function diagnoseReportSchreiben_(ss, report) {
  const sheetName = "🧪_DIAGNOSE";
  let sh = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
  const header = [["Zeitpunkt", "Block", "Level", "Blatt", "Zeile", "Vorgangs_ID", "Code", "Meldung", "Details"]];
  const zeilen = header.concat(report.eintraege);
  sh.clear().getRange(1, 1, zeilen.length, zeilen[0].length).setValues(zeilen);
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, zeilen[0].length);
}