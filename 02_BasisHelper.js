/**
 * DATEI: 02_BasisHelper.gs
 * ZWECK: BASISFUNKTIONEN / MAPPING / TABELLENZUGRIFF / LOGGING / STANDARD-HILFSFUNKTIONEN
 * WICHTIG:
 * - holeDropdownWerteAusQuelle_ bleibt in 18_DropdownService.gs
 * - keine doppelten globalen Funktionsnamen anlegen
 */


function maskenMonitorLog_(level, aktion, details) {
  try {
    if (!KONFIGURATION || !KONFIGURATION.TABELLEN || !KONFIGURATION.TABELLEN.MASKENMONITOR) return;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(KONFIGURATION.TABELLEN.MASKENMONITOR);
    if (!sh) return;

    const zeit = Utilities.formatDate(
      new Date(),
      holeZeitzone_(),
      "dd.MM.yyyy HH:mm:ss"
    );

    sh.appendRow([zeit, String(level || "INFO"), String(aktion || ""), String(details || "")]);

    if (sh.getLastRow() > 1000) {
      sh.deleteRows(2, Math.min(500, sh.getLastRow() - 1));
    }
  } catch (e) {
    Logger.log("Monitor-Log fehlgeschlagen: " + e.message);
  }
}


/**
 * FUNKTION: Liefert die konfigurierte Zeitzone.
 */
function holeZeitzone_() {
  try {
    return KONFIGURATION.ZOLL_PARAMETER.ZEIT_PARAMETER.ZEITZONE || "Europe/Berlin";
  } catch (e) {
    return "Europe/Berlin";
  }
}


/**
 * FUNKTION: Normalisiert beliebige Eingaben in sauberen Text.
 */
function textNormalisieren_(wert) {
  return String(wert == null ? "" : wert).trim();
}


/**
 * FUNKTION: Wandelt beliebige Leerwerte in Standardtext.
 */
function leerwertOder_(wert, fallback) {
  const text = textNormalisieren_(wert);
  return text || String(fallback == null ? "" : fallback);
}


/**
 * FUNKTION: Liefert das aktive Spreadsheet.
 */
function spreadsheetHolen_() {
  try {
    const aktiv = SpreadsheetApp.getActiveSpreadsheet();
    if (aktiv) return aktiv;
  } catch (e) {}

  const id = KONFIGURATION && KONFIGURATION.SPREADSHEET
    ? textNormalisieren_(KONFIGURATION.SPREADSHEET.ID)
    : "";

  if (!id) return null;

  try {
    return SpreadsheetApp.openById(id);
  } catch (e) {
    systemLogSchreiben_("ERROR", "BasisHelper", "Spreadsheet konnte nicht geöffnet werden", "", e.message || String(e));
    return null;
  }
}


/**
 * FUNKTION: Holt eine Tabelle über KONFIGURATION.TABELLEN.KEY.
 */
function tabelleHolen_(key) {
  const ss = spreadsheetHolen_();
  if (!ss) return null;

  const name = KONFIGURATION && KONFIGURATION.TABELLEN
    ? KONFIGURATION.TABELLEN[key]
    : "";

  if (!name) return null;
  return ss.getSheetByName(name);
}


/**
 * FUNKTION: Holt die UI, wenn verfügbar.
 */
function uiHolen_() {
  try {
    return SpreadsheetApp.getUi();
  } catch (e) {
    return null;
  }
}


/**
 * FUNKTION: Zeigt Alert oder Toast.
 */
function systemAlert_(titel, nachricht) {
  const ui = uiHolen_();
  if (ui) {
    ui.alert(String(titel || "Hinweis"), String(nachricht || ""), ui.ButtonSet.OK);
    return;
  }

  spreadsheetHolen_().toast(String(nachricht || ""), String(titel || "Hinweis"), 5);
}


/**
 * FUNKTION: Baut aus der Headerzeile ein Mapping anhand KONFIGURATION.SPALTEN.
 * RÜCKGABE: { KEY: spaltennummer }
 */
function spaltenZuordnungHolen_(sh) {
  const map = {};
  if (!sh) return map;
  if (sh.getLastColumn() < 1) return map;

  const header = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0];

  Object.keys(KONFIGURATION.SPALTEN || {}).forEach(function(key) {
    const sollName = KONFIGURATION.SPALTEN[key];
    const idx = header.indexOf(sollName);
    if (idx > -1) {
      map[key] = idx + 1;
    }
  });

  return map;
}


/**
 * FUNKTION: Prüft Pflichtspalten auf einem Blatt.
 * RÜCKGABE: Objekt mit ok/missing/map
 */
function pruefePflichtspalten_(sh, keys) {
  const map = spaltenZuordnungHolen_(sh);
  const fehlend = [];

  (keys || []).forEach(function(key) {
    if (!map[key]) {
      fehlend.push(key);
    }
  });

  return {
    ok: fehlend.length === 0,
    missing: fehlend,
    map: map
  };
}


/**
 * FUNKTION: Liefert alle Zeilennummern mit passender Vorgangs-ID.
 */
function alleZeilenMitVorgangsIdHolen_(sh, vId) {
  if (!sh || !vId || sh.getLastRow() < 2) return [];

  const sMap = spaltenZuordnungHolen_(sh);
  if (!sMap.VORGANGS_ID) return [];

  const daten = sh.getRange(2, sMap.VORGANGS_ID, sh.getLastRow() - 1, 1).getDisplayValues();
  const suchId = textNormalisieren_(vId);
  const treffer = [];

  for (let i = 0; i < daten.length; i++) {
    if (textNormalisieren_(daten[i][0]) === suchId) {
      treffer.push(i + 2);
    }
  }

  return treffer;
}


/**
 * FUNKTION: Liefert die erste Zeile mit passender Vorgangs-ID.
 * RÜCKGABE: Zeilennummer oder -1
 */
function ersteZeileMitVorgangsIdHolen_(sh, vId) {
  const treffer = alleZeilenMitVorgangsIdHolen_(sh, vId);
  return treffer.length ? treffer[0] : -1;
}


/**
 * FUNKTION: Liefert alle Werte einer Spalte aus einer konfigurierten Tabelle.
 */
function spaltenDatenHolen_(tabKey, colIdx) {
  const sh = tabelleHolen_(tabKey);
  if (!sh || sh.getLastRow() < 2 || !colIdx) return [];

  return sh.getRange(2, colIdx, sh.getLastRow() - 1, 1)
    .getDisplayValues()
    .flat()
    .map(textNormalisieren_)
    .filter(String);
}


/**
 * FUNKTION: Liefert eindeutige Werte einer Spalte.
 */
function spaltenDatenEindeutigHolen_(tabKey, colIdx) {
  return Array.from(new Set(spaltenDatenHolen_(tabKey, colIdx))).sort();
}


/**
 * FUNKTION: Liest eine komplette Datenzeile als Objekt anhand Mapping.
 */
function zeileAlsObjektHolen_(sh, zeile, sMap) {
  if (!sh || !zeile || zeile < 2) return {};

  const map = sMap || spaltenZuordnungHolen_(sh);
  const row = sh.getRange(zeile, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
  const obj = {};

  Object.keys(map).forEach(function(key) {
    obj[key] = row[map[key] - 1];
  });

  return obj;
}


/**
 * FUNKTION: Liefert Rohwerte einer Zeile.
 */
function zeileAlsArrayHolen_(sh, zeile) {
  if (!sh || !zeile || zeile < 1) return [];
  return sh.getRange(zeile, 1, 1, sh.getLastColumn()).getValues()[0];
}


/**
 * FUNKTION: Schreibt System-Log.
 */
function systemLogSchreiben_(level, modul, aktion, vId, details) {
  try {
    const sh = tabelleHolen_("SYSTEM_LOG");
    if (!sh) return;

    const zeit = Utilities.formatDate(
      new Date(),
      holeZeitzone_(),
      "dd.MM.yyyy HH:mm:ss"
    );

    sh.appendRow([
      zeit,
      String(level || "INFO").toUpperCase(),
      String(modul || ""),
      String(aktion || ""),
      String(vId || ""),
      String(details || "")
    ]);
  } catch (e) {
    Logger.log("Log-Fehler: " + e.message);
  }
}


/**
 * FUNKTION: Schreibt Fehler ins Log und wirft optional weiter.
 */
function fehlerLoggen_(modul, aktion, err, vId, weiterwerfen) {
  const text = err && err.message ? err.message : String(err || "Unbekannter Fehler");

  systemLogSchreiben_(
    "ERROR",
    String(modul || "Unbekannt"),
    String(aktion || "Fehler"),
    String(vId || ""),
    text
  );

  if (weiterwerfen) {
    throw err;
  }
}


/**
 * FUNKTION: Formatiert Date oder Text als dd.MM.yyyy.
 */
function datumDeutschFormatieren_(wert) {
  if (!wert) return "";

  if (wert instanceof Date) {
    return Utilities.formatDate(wert, holeZeitzone_(), "dd.MM.yyyy");
  }

  const text = textNormalisieren_(wert);
  if (!text) return "";

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    return iso[3] + "." + iso[2] + "." + iso[1];
  }

  return text;
}


/**
 * FUNKTION: Formatiert Date oder Text als yyyy-MM-dd.
 */
function datumIsoFormatieren_(wert) {
  if (!wert) return "";

  if (wert instanceof Date) {
    return Utilities.formatDate(wert, holeZeitzone_(), "yyyy-MM-dd");
  }

  const text = textNormalisieren_(wert);
  if (!text) return "";

  const de = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (de) {
    return de[3] + "-" + de[2] + "-" + de[1];
  }

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    return text;
  }

  return "";
}


/**
 * FUNKTION: Normalisiert Uhrzeiten auf HH:mm.
 */
function zeitFormatieren_(wert) {
  if (!wert) return "";

  if (wert instanceof Date) {
    return Utilities.formatDate(wert, holeZeitzone_(), "HH:mm");
  }

  const text = textNormalisieren_(wert);
  if (!text) return "";

  if (/^\d{4}$/.test(text)) {
    return text.substring(0, 2) + ":" + text.substring(2, 4);
  }

  if (/^\d{2}:\d{2}$/.test(text)) {
    return text;
  }

  return text;
}


/**
 * FUNKTION: Prüft, ob ein Blatt existiert.
 */
function tabellenExistenzPruefen_(tabKey) {
  return !!tabelleHolen_(tabKey);
}


/**
 * FUNKTION: Erstellt eine leere Zeile passend zur Blattbreite.
 */
function leereZeileMitSpaltenanzahl_(sh) {
  return new Array(sh.getLastColumn()).fill("");
}


/**
 * FUNKTION: Setzt einen Wert anhand Mapping-Key in ein Zeilenarray.
 */
function arrayWertPerKeySetzen_(zeileArray, sMap, key, wert) {
  if (!zeileArray || !sMap || !sMap[key]) return;
  zeileArray[sMap[key] - 1] = wert == null ? "" : wert;
}


/**
 * FUNKTION: Liest einen Wert anhand Mapping-Key aus einem Zeilenarray.
 */
function arrayWertPerKeyHolen_(zeileArray, sMap, key) {
  if (!zeileArray || !sMap || !sMap[key]) return "";
  return zeileArray[sMap[key] - 1];
}


/**
 * FUNKTION: Findet Spaltenindex in einer beliebigen Tabelle über Headertext.
 * RÜCKGABE: 1-basiert oder 0
 */
function spaltePerHeaderHolen_(sh, headerText) {
  if (!sh || !headerText || sh.getLastColumn() < 1) return 0;

  const header = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
  const idx = header.indexOf(headerText);
  return idx === -1 ? 0 : idx + 1;
}


/**
 * FUNKTION: Gibt eindeutige, leereintragsfreie Liste zurück.
 */
function listeBereinigen_(werte) {
  return Array.from(
    new Set(
      (werte || [])
        .map(textNormalisieren_)
        .filter(String)
    )
  ).sort();
}