/**
 * DATEI: 18_DropdownService.gs
 * ZWECK: DROPDOWNS UND DATUMSVALIDIERUNG FÜR 🍎_MAISCHEANNAHME
 */

function dropdownsMaischeannahmeNeuAufbauen(silent) {
  const keys = ['MAISCHEANNAHME', 'BRENNFREIGABE'];

  keys.forEach(function(tabellenKey) {
    const blatt = tabelleHolen_(tabellenKey);
    if (!blatt) return;

    const sMap = spaltenZuordnungHolen_(blatt);
    const letzteZeile = Math.max(blatt.getMaxRows(), 2);

    dropdownAusQuellspalteAufSpalteAnwenden_(blatt, sMap.STOFFBESITZER, KONFIGURATION.DROPDOWN_QUELLEN.STOFFBESITZER.tabelle, KONFIGURATION.DROPDOWN_QUELLEN.STOFFBESITZER.spalte, letzteZeile, true);
    dropdownAusQuellspalteAufSpalteAnwenden_(blatt, sMap.FASS_VP, KONFIGURATION.DROPDOWN_QUELLEN.FASS_VP.tabelle, KONFIGURATION.DROPDOWN_QUELLEN.FASS_VP.spalte, letzteZeile, false);
    dropdownAusQuellspalteAufSpalteAnwenden_(blatt, sMap.MATERIAL, KONFIGURATION.DROPDOWN_QUELLEN.MATERIAL.tabelle, KONFIGURATION.DROPDOWN_QUELLEN.MATERIAL.spalte, letzteZeile, true);
    dropdownAusQuellspalteAufSpalteAnwenden_(blatt, sMap.GEWUERZE, KONFIGURATION.DROPDOWN_QUELLEN.GEWUERZE.tabelle, KONFIGURATION.DROPDOWN_QUELLEN.GEWUERZE.spalte, letzteZeile, true);
    dropdownAusQuellspalteAufSpalteAnwenden_(blatt, sMap.BRENNER, KONFIGURATION.DROPDOWN_QUELLEN.BRENNER.tabelle, KONFIGURATION.DROPDOWN_QUELLEN.BRENNER.spalte, letzteZeile, false);
    dropdownAusListeAufSpalteAnwenden_(blatt, sMap.ZOLL_OK, KONFIGURATION.FESTWERTE.ZOLL_OK, letzteZeile);
    dropdownAusListeAufSpalteAnwendenMitWarnung_(blatt, sMap.STATUS, KONFIGURATION.FESTWERTE.STATUS, letzteZeile);
    datumValidierungAufSpalteAnwenden_(blatt, sMap.TERMIN_MAISCHE, letzteZeile);
    datumValidierungAufSpalteAnwenden_(blatt, sMap.TAG_BRAND, letzteZeile);
  });

  systemLogSchreiben_("INFO", "DropdownService", "Dropdowns und Datumsfelder in Maischeannahme und Brennfreigabe aufgebaut", "", "OK");

  if (!silent) {
    systemAlert_("ERFOLG", "Dropdowns und Kalenderfelder in 🍎_MAISCHEANNAHME und 🔥_BRENNFREIGABE wurden aufgebaut.");
  }
}




function dropdownAusQuellspalteAufSpalteAnwenden_(blatt, zielSpalte, tabellenKey, spaltenName, letzteZeile, allowInvalid) {
  if (!blatt || !zielSpalte || !tabellenKey || !spaltenName) return;
  if (letzteZeile < 2) letzteZeile = 2;

  const quellenBlatt = tabelleHolen_(tabellenKey);
  if (!quellenBlatt) {
    throw new Error('Dropdown-Tabelle nicht gefunden: ' + tabellenKey);
  }

  const header = quellenBlatt.getRange(1, 1, 1, quellenBlatt.getLastColumn()).getDisplayValues()[0];
  const quellSpaltenIndex = header.indexOf(spaltenName);
  if (quellSpaltenIndex === -1) {
    throw new Error('Dropdown-Spalte nicht gefunden: ' + spaltenName + ' in ' + tabellenKey);
  }

  const zielRange = blatt.getRange(2, zielSpalte, letzteZeile - 1, 1);
  zielRange.clearDataValidations();

  if (quellenBlatt.getLastRow() < 2) return;

  const quellenRange = quellenBlatt.getRange(2, quellSpaltenIndex + 1, quellenBlatt.getLastRow() - 1, 1);
  const regel = SpreadsheetApp.newDataValidation()
    .requireValueInRange(quellenRange, true)
    .setAllowInvalid(!!allowInvalid)
    .build();

  zielRange.setDataValidation(regel);
}

function synchronisiereStoffbesitzerNameInProzessblaettern_(alterName, neuerName) {
  const alt = textNormalisieren_(alterName);
  const neu = textNormalisieren_(neuerName);

  if (!alt || !neu || alt === neu) {
    return {
      geaenderteZellen: 0,
      betroffeneBlaetter: 0
    };
  }

  const tabellenKeys = ['VORPLANUNG', 'BRANDTAGE_PLANUNG', 'MAISCHEANNAHME', 'ZENTRALREGISTER'];
  let geaenderteZellen = 0;
  let betroffeneBlaetter = 0;

  tabellenKeys.forEach(function(tabellenKey) {
    const sh = tabelleHolen_(tabellenKey);
    if (!sh || sh.getLastRow() < 2) return;

    const sMap = spaltenZuordnungHolen_(sh);
    const stoffSpalte = sMap.STOFFBESITZER || 0;
    if (!stoffSpalte) return;

    const range = sh.getRange(2, stoffSpalte, sh.getLastRow() - 1, 1);
    const werte = range.getDisplayValues();
    let hatAenderung = false;

    for (let i = 0; i < werte.length; i++) {
      if (textNormalisieren_(werte[i][0]) !== alt) continue;
      werte[i][0] = neu;
      geaenderteZellen += 1;
      hatAenderung = true;
    }

    if (hatAenderung) {
      range.setValues(werte);
      betroffeneBlaetter += 1;
    }
  });

  return {
    geaenderteZellen: geaenderteZellen,
    betroffeneBlaetter: betroffeneBlaetter
  };
}

function holeDropdownWerteAusQuelle_(tabellenKey, spaltenName) {
  const sh = tabelleHolen_(tabellenKey);
  if (!sh) {
    throw new Error('Dropdown-Tabelle nicht gefunden: ' + tabellenKey);
  }

  const header = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
  const colIndex = header.indexOf(spaltenName);

  if (colIndex === -1) {
    throw new Error('Dropdown-Spalte nicht gefunden: ' + spaltenName + ' in ' + tabellenKey);
  }

  if (sh.getLastRow() < 2) {
    return [];
  }

  const werte = sh.getRange(2, colIndex + 1, sh.getLastRow() - 1, 1)
    .getDisplayValues()
    .flat()
    .map(function(v) { return String(v || '').trim(); })
    .filter(function(v) { return v !== ''; });

  return Array.from(new Set(werte)).sort();
}


function dropdownAusListeAufSpalteAnwenden_(blatt, spalte, liste, letzteZeile) {
  if (!spalte || !liste || liste.length === 0) return;
  if (letzteZeile < 2) letzteZeile = 2;

  const range = blatt.getRange(2, spalte, letzteZeile - 1, 1);

  const regel = SpreadsheetApp.newDataValidation()
    .requireValueInList(liste, true)
    .setAllowInvalid(false)
    .build();

  range.clearDataValidations();
  range.setDataValidation(regel);
}


function dropdownAusListeAufSpalteAnwendenMitWarnung_(blatt, spalte, liste, letzteZeile) {
  if (!spalte) return;
  if (letzteZeile < 2) letzteZeile = 2;

  const range = blatt.getRange(2, spalte, letzteZeile - 1, 1);
  range.clearDataValidations();

  if (!liste || liste.length === 0) return;

  const regel = SpreadsheetApp.newDataValidation()
    .requireValueInList(liste, true)
    .setAllowInvalid(true)
    .build();

  range.setDataValidation(regel);
}

function datumValidierungAufSpalteAnwenden_(blatt, spalte, letzteZeile) {
  if (!spalte) return;
  if (letzteZeile < 2) letzteZeile = 2;

  const range = blatt.getRange(2, spalte, letzteZeile - 1, 1);

  const regel = SpreadsheetApp.newDataValidation()
    .requireDate()
    .setAllowInvalid(false)
    .build();

  range.clearDataValidations();
  range.setDataValidation(regel);
  range.setNumberFormat("dd.MM.yyyy");
}