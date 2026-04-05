/**
 * DATEI: 02_BASISHELPER.GS
 * ZENTRALE HILFSFUNKTIONEN, LOGGING UND MAPPING
 */

function uiVerfuegbar_() {
  try {
    const ui = SpreadsheetApp.getUi();
    return !!ui;
  } catch (e) {
    return false;
  }
}

function uiHolen_() {
  try {
    return SpreadsheetApp.getUi();
  } catch (e) {
    return null;
  }
}

function systemAlert_(titel, nachricht, level) {
  const l = level || "INFO";
  const ui = uiHolen_();

  if (ui) {
    ui.alert(titel, nachricht, ui.ButtonSet.OK);
  }

  systemLogSchreiben_(l, "System-Alert", titel, "", nachricht);
}

function systemLogSchreiben_(level, modul, aktion, id, details) {
  try {
    const sh = tabelleHolen_("SYSTEM_LOG");
    if (!sh) return;
    sh.appendRow([new Date(), level, modul, aktion, id, details]);
  } catch (e) {
    console.error("KRITISCHER LOG-FEHLER: " + e.toString());
  }
}

function textNormalisieren_(wert) {
  return String(wert == null ? "" : wert).trim();
}

function tabelleHolen_(key) {
  const name = KONFIGURATION.TABELLEN[key];
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

function spaltenZuordnungHolen_(blatt) {
  const map = {};
  if (!blatt) return map;
  if (blatt.getLastColumn() < 1) return map;

  const header = blatt.getRange(1, 1, 1, blatt.getLastColumn()).getValues()[0];

  for (let key in KONFIGURATION.SPALTEN) {
    const headerName = KONFIGURATION.SPALTEN[key];
    const index = header.indexOf(headerName);
    if (index > -1) {
      map[key] = index + 1;
    }
  }

  return map;
}

function alleZeilenMitVorgangsIdHolen_(blatt, vorgangsId) {
  const treffer = [];
  if (!blatt || !vorgangsId || blatt.getLastRow() < 2) return treffer;

  const sMap = spaltenZuordnungHolen_(blatt);
  const idCol = sMap.VORGANGS_ID;
  if (!idCol) return treffer;

  const daten = blatt.getRange(2, idCol, blatt.getLastRow() - 1, 1).getValues();
  const suchId = textNormalisieren_(vorgangsId);

  for (let i = 0; i < daten.length; i++) {
    if (textNormalisieren_(daten[i][0]) === suchId) {
      treffer.push(i + 2);
    }
  }

  return treffer;
}

function ersteZeileMitVorgangsIdHolen_(blatt, vorgangsId) {
  const treffer = alleZeilenMitVorgangsIdHolen_(blatt, vorgangsId);
  return treffer.length > 0 ? treffer[0] : -1;
}

function spaltenDatenHolen_(tabellenname, spaltenIndex) {
  const blatt = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(tabellenname);
  if (!blatt || blatt.getLastRow() < 2) return [];

  const werte = blatt.getRange(2, spaltenIndex, blatt.getLastRow() - 1, 1).getValues();
  return werte.flat().map(textNormalisieren_).filter(String);
}