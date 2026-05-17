
/**
 * FUNKTIONSABHÄNGIGKEITS-ANALYSE FÜR APPS SCRIPT
 * STAND: 2026-04-05
 * ZIEL:
 * - QUELLCODE DES AKTUELLEN PROJEKTS HOLEN
 * - KLASSISCHE FUNKTIONEN FINDEN
 * - AUFRUFBEZIEHUNGEN ZWISCHEN DIESEN FUNKTIONEN ERMITTELN
 * - ERGEBNIS IN EIN TABELLENBLATT SCHREIBEN
 */

/**
 * FUNKTION: Startet die komplette Analyse und schreibt die Ergebnistabelle.
 * EINGRIFF: Apps Script API + Spreadsheet
 */
function analysiereFunktionsAbhaengigkeiten() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const projektInhalt = holeProjektInhalt_();
  const serverDateien = filtereServerDateien_(projektInhalt.files || []);
  const funktionen = sammleAlleFunktionen_(serverDateien);
  const funktionsNamen = funktionen.map(f => f.name);
  const aufrufMap = ermittleAufrufbeziehungen_(funktionen, funktionsNamen);
  const rueckrufMap = ermittleRueckrufbeziehungen_(aufrufMap);
  const zeilen = baueAusgabezeilen_(funktionen, aufrufMap, rueckrufMap);

  schreibeAbhaengigkeitenNachSheet_(ss, zeilen);

  SpreadsheetApp.getUi().alert(
    "Analyse abgeschlossen.\nBlatt: 🔎_FUNKTIONSABHÄNGIGKEITEN\nGefundene Funktionen: " + funktionen.length
  );
}

/**
 * FUNKTION: Holt den vollständigen Inhalt des aktuellen Skriptprojekts per REST API.
 * EINGRIFF: ScriptApp + UrlFetchApp
 */
function holeProjektInhalt_() {
  const scriptId = ScriptApp.getScriptId();
  const url = "https://script.googleapis.com/v1/projects/" + encodeURIComponent(scriptId) + "/content";
  const response = UrlFetchApp.fetch(url, {
    method: "get",
    muteHttpExceptions: true,
    headers: {
      Authorization: "Bearer " + ScriptApp.getOAuthToken()
    }
  });

  const code = response.getResponseCode();
  const text = response.getContentText();

  if (code < 200 || code >= 300) {
    throw new Error("Apps Script API Fehler " + code + ": " + text);
  }

  return JSON.parse(text);
}

/**
 * FUNKTION: Filtert nur SERVER_JS-Dateien aus dem API-Ergebnis.
 * EINGRIFF: API-Antwort
 */
function filtereServerDateien_(files) {
  return files.filter(function(file) {
    return file && file.type === "SERVER_JS" && typeof file.source === "string";
  });
}

/**
 * FUNKTION: Sammelt aus allen SERVER_JS-Dateien klassische Funktionsdefinitionen.
 * EINGRIFF: Quelltext-Parsing
 */
function sammleAlleFunktionen_(serverDateien) {
  const ergebnis = [];

  serverDateien.forEach(function(datei) {
    const source = String(datei.source || "");
    const dateiName = String(datei.name || "OHNE_NAME");
    const funde = findeKlassischeFunktionenInDatei_(source, dateiName);

    funde.forEach(function(f) {
      ergebnis.push(f);
    });
  });

  return ergebnis;
}

/**
 * FUNKTION: Findet klassische Funktionen der Form "function name(...) { ... }".
 * EINGRIFF: Quelltext einer Datei
 */
function findeKlassischeFunktionenInDatei_(source, dateiName) {
  const funktionen = [];
  const regex = /function\s+([A-Za-z0-9_.$]+)\s*\(/g;
  let match;

  while ((match = regex.exec(source)) !== null) {
    const funktionsName = match[1];
    const funktionsStart = match.index;
    const klammerStart = source.indexOf("{", regex.lastIndex);

    if (klammerStart === -1) {
      continue;
    }

    const klammerEnde = findePassendeGeschweifteKlammer_(source, klammerStart);

    if (klammerEnde === -1) {
      continue;
    }

    const volltext = source.substring(funktionsStart, klammerEnde + 1);
    const body = source.substring(klammerStart + 1, klammerEnde);
    const startZeile = ermittleZeilennummerAusIndex_(source, funktionsStart);
    const endeZeile = ermittleZeilennummerAusIndex_(source, klammerEnde);

    funktionen.push({
      fileName: dateiName,
      name: funktionsName,
      startIndex: funktionsStart,
      endIndex: klammerEnde,
      startLine: startZeile,
      endLine: endeZeile,
      fullText: volltext,
      body: body
    });

    regex.lastIndex = klammerEnde + 1;
  }

  return funktionen;
}

/**
 * FUNKTION: Findet die schließende geschweifte Klammer zu einer öffnenden.
 * EINGRIFF: String-Scan mit Schutz vor Strings und Kommentaren
 */
function findePassendeGeschweifteKlammer_(source, openIndex) {
  let tiefe = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;
  let escaped = false;

  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i];
    const next = i + 1 < source.length ? source[i + 1] : "";

    if (inLineComment) {
      if (ch === "\n") {
        inLineComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (inSingle) {
      if (!escaped && ch === "\\") {
        escaped = true;
        continue;
      }
      if (!escaped && ch === "'") {
        inSingle = false;
      }
      escaped = false;
      continue;
    }

    if (inDouble) {
      if (!escaped && ch === "\\") {
        escaped = true;
        continue;
      }
      if (!escaped && ch === '"') {
        inDouble = false;
      }
      escaped = false;
      continue;
    }

    if (inTemplate) {
      if (!escaped && ch === "\\") {
        escaped = true;
        continue;
      }
      if (!escaped && ch === "`") {
        inTemplate = false;
      }
      escaped = false;
      continue;
    }

    if (ch === "/" && next === "/") {
      inLineComment = true;
      i++;
      continue;
    }

    if (ch === "/" && next === "*") {
      inBlockComment = true;
      i++;
      continue;
    }

    if (ch === "'") {
      inSingle = true;
      continue;
    }

    if (ch === '"') {
      inDouble = true;
      continue;
    }

    if (ch === "`") {
      inTemplate = true;
      continue;
    }

    if (ch === "{") {
      tiefe++;
      continue;
    }

    if (ch === "}") {
      tiefe--;
      if (tiefe === 0) {
        return i;
      }
    }
  }

  return -1;
}

/**
 * FUNKTION: Ermittelt aus einem String-Index die Zeilennummer.
 * EINGRIFF: Textauswertung
 */
function ermittleZeilennummerAusIndex_(source, index) {
  return source.substring(0, index).split("\n").length;
}

/**
 * FUNKTION: Ermittelt für jede Funktion, welche bekannten Funktionen sie aufruft.
 * EINGRIFF: Funktionskörper-Scan
 */
function ermittleAufrufbeziehungen_(funktionen, funktionsNamen) {
  const map = {};

  funktionen.forEach(function(fn) {
    const bodyOhneKommentare = entferneKommentare_(fn.body);
    const bodyOhneStrings = entferneStrings_(bodyOhneKommentare);
    const aufrufe = [];

    funktionsNamen.forEach(function(zielName) {
      const regex = new RegExp("(^|[^A-Za-z0-9_.$])" + escapeRegex_(zielName) + "\\s*\\(", "g");
      if (regex.test(bodyOhneStrings)) {
        aufrufe.push(zielName);
      }
    });

    map[fn.name] = uniqueSort_(aufrufe);
  });

  return map;
}

/**
 * FUNKTION: Baut die inverse Beziehung "wird aufgerufen von" auf.
 * EINGRIFF: Abhängigkeitsmatrix
 */
function ermittleRueckrufbeziehungen_(aufrufMap) {
  const rueck = {};

  Object.keys(aufrufMap).forEach(function(quellName) {
    if (!rueck[quellName]) {
      rueck[quellName] = [];
    }

    (aufrufMap[quellName] || []).forEach(function(zielName) {
      if (!rueck[zielName]) {
        rueck[zielName] = [];
      }
      rueck[zielName].push(quellName);
    });
  });

  Object.keys(rueck).forEach(function(key) {
    rueck[key] = uniqueSort_(rueck[key]);
  });

  return rueck;
}

/**
 * FUNKTION: Baut die Ausgabezeilen für das Ergebnisblatt.
 * EINGRIFF: Tabellenaufbereitung
 */
function baueAusgabezeilen_(funktionen, aufrufMap, rueckrufMap) {
  const kopf = [[
    "Datei",
    "Funktion",
    "Startzeile",
    "Endzeile",
    "Ruft auf",
    "Anzahl aufgerufene Funktionen",
    "Wird aufgerufen von",
    "Anzahl eingehende Aufrufe",
    "Rekursiv",
    "Status"
  ]];

  const daten = funktionen.map(function(fn) {
    const ausgehend = aufrufMap[fn.name] || [];
    const eingehend = rueckrufMap[fn.name] || [];
    const rekursiv = ausgehend.indexOf(fn.name) !== -1 ? "JA" : "NEIN";
    const status = eingehend.length === 0 ? "OHNE INTERNEN AUFRUFER" : "VERKNÜPFT";

    return [
      fn.fileName,
      fn.name,
      fn.startLine,
      fn.endLine,
      ausgehend.join(", "),
      ausgehend.length,
      eingehend.join(", "),
      eingehend.length,
      rekursiv,
      status
    ];
  });

  daten.sort(function(a, b) {
    if (a[0] !== b[0]) {
      return a[0].localeCompare(b[0], "de");
    }
    return a[1].localeCompare(b[1], "de");
  });

  return kopf.concat(daten);
}

/**
 * FUNKTION: Schreibt das Ergebnis in das Blatt 🔎_FUNKTIONSABHÄNGIGKEITEN.
 * EINGRIFF: Spreadsheet
 */
function schreibeAbhaengigkeitenNachSheet_(ss, zeilen) {
  const sheetName = "🔎_FUNKTIONSABHÄNGIGKEITEN";
  let sh = ss.getSheetByName(sheetName);

  if (!sh) {
    sh = ss.insertSheet(sheetName);
  }

  sh.clearContents();
  sh.clearFormats();

  sh.getRange(1, 1, zeilen.length, zeilen[0].length).setValues(zeilen);
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, zeilen[0].length);

  const headerRange = sh.getRange(1, 1, 1, zeilen[0].length);
  headerRange.setFontWeight("bold");
  headerRange.setWrap(true);

  if (zeilen.length > 1) {
    sh.getRange(2, 1, zeilen.length - 1, zeilen[0].length).setVerticalAlignment("top");
    sh.getRange(2, 5, zeilen.length - 1, 1).setWrap(true);
    sh.getRange(2, 7, zeilen.length - 1, 1).setWrap(true);
  }

  const filterRange = sh.getRange(1, 1, zeilen.length, zeilen[0].length);
  if (sh.getFilter()) {
    sh.getFilter().remove();
  }
  filterRange.createFilter();
}

/**
 * FUNKTION: Entfernt Line- und Block-Kommentare aus einem Quelltext.
 * EINGRIFF: Textbereinigung
 */
function entferneKommentare_(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/.*$/gm, " ");
}

/**
 * FUNKTION: Entfernt einfache, doppelte und Template-Strings grob aus einem Quelltext.
 * EINGRIFF: Textbereinigung
 */
function entferneStrings_(text) {
  return text
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/`(?:\\.|[^`\\])*`/g, "``");
}

/**
 * FUNKTION: Escaped Sonderzeichen für RegExp.
 * EINGRIFF: Regex-Sicherheit
 */
function escapeRegex_(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * FUNKTION: Entfernt Duplikate und sortiert alphabetisch.
 * EINGRIFF: Array-Normalisierung
 */
function uniqueSort_(arr) {
  return Array.from(new Set(arr)).sort(function(a, b) {
    return String(a).localeCompare(String(b), "de");
  });
}

/**
 * FUNKTION: Optionaler Menüeintrag-Startpunkt.
 * EINGRIFF: Manuelle Ausführung
 */
function menue_FunktionsabhaengigkeitenAnalysieren() {
  analysiereFunktionsAbhaengigkeiten();
}