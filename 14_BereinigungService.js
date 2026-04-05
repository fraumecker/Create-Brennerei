/**
 * DATEI: 14_BEREINIGUNGSERVICE.GS
 * WERKZEUGE ZUR DATEN-BEREINIGUNG UND ARCHIVIERUNG
 */

// FUNKTION: Löscht markierte Zeilen ohne Umweg über den Papierkorb | EINGRIFF: Tabellen-Management
function markierteZeilenLoeschenDirekt() {
  // FUNKTION: Referenziert das aktuell sichtbare Tabellenblatt | EINGRIFF: SpreadsheetApp
  const blatt = SpreadsheetApp.getActiveSheet();
  // FUNKTION: Identifiziert alle vom Nutzer markierten Bereiche | EINGRIFF: UI-Interaktion
  const bereiche = blatt.getActiveRangeList().getRanges();
  // FUNKTION: Extrahiert die Zeilennummern und filtert den Header aus | EINGRIFF: markierteZeilenAusBereichenHolen_
  const zeilen = markierteZeilenAusBereichenHolen_(bereiche).filter(z => z > 1).sort((a, b) => b - a);
  // CHECK: Wurden überhaupt gültige Datenzeilen markiert? | FOLGE: Abbruch bei fehlender Auswahl
  if (zeilen.length === 0) {
    // FUNKTION: Informiert den Nutzer über die fehlende Auswahl | EINGRIFF: UI-Dialog
    SpreadsheetApp.getUi().alert("HINWEIS: Bitte markieren Sie zuerst die zu löschenden Zeilen.");
    return;
  }
  // FUNKTION: Erfragt eine finale Bestätigung vom Anwender | EINGRIFF: UI-Sicherheitsabfrage
  const antwort = SpreadsheetApp.getUi().alert("⚠️ UNWIDERRUFLICH LÖSCHEN?", "Sollen die " + zeilen.length + " markierten Zeilen endgültig gelöscht werden?", SpreadsheetApp.getUi().ButtonSet.YES_NO);
  // CHECK: Hat der Nutzer mit JA bestätigt? | FOLGE: Physische Löschung der Daten
  if (antwort === SpreadsheetApp.getUi().Button.YES) {
    // FUNKTION: Iteriert durch die Zeilenliste und löscht diese | EINGRIFF: Physikalische Tabelle
    zeilen.forEach(z => blatt.deleteRow(z));
    // FUNKTION: Dokumentiert den Löschvorgang | EINGRIFF: 02_BASISHELPER
    systemLogSchreiben_("INFO", "Bereinigung", "Direkt-Löschung", "", zeilen.length + " Zeilen entfernt");
  }
}

// FUNKTION: Verschiebt markierte Zeilen in den Papierkorb und löscht sie im Quellblatt | EINGRIFF: Archivierung
function markierteZeilenInPapierkorbSichernUndLoeschen() {
  // FUNKTION: Referenziert das aktive Blatt | EINGRIFF: SpreadsheetApp
  const blatt = SpreadsheetApp.getActiveSheet();
  // FUNKTION: Holt das Papierkorb-Blatt via Config-Key | EINGRIFF: 01_CONFIG
  const papierkorb = tabelleHolen_("PAPIERKORB");
  // CHECK: Ist der Papierkorb in der Config definiert und vorhanden? | FOLGE: Fehler bei Fehlen
  if (!papierkorb) {
    // FUNKTION: Meldet das Fehlen des Archivs | EINGRIFF: UI-Dialog
    SpreadsheetApp.getUi().alert("FEHLER: Papierkorb-Blatt wurde nicht gefunden.");
    return;
  }
  // FUNKTION: Ermittelt die Zeilennummern der aktuellen Markierung | EINGRIFF: markierteZeilenAusBereichenHolen_
  const bereiche = blatt.getActiveRangeList().getRanges();
  const zeilen = markierteZeilenAusBereichenHolen_(bereiche).filter(z => z > 1).sort((a, b) => b - a);
  // CHECK: Liegt eine valide Zeilenauswahl vor? | FOLGE: Abbruch bei Leer-Markierung
  if (zeilen.length === 0) {
    SpreadsheetApp.getUi().alert("HINWEIS: Keine gültigen Datenzeilen zum Verschieben markiert.");
    return;
  }
  // FUNKTION: Kopiert die Daten in den Papierkorb und entfernt sie im Original | EINGRIFF: Daten-Transfer
  zeilen.forEach(z => {
    // FUNKTION: Liest den Inhalt der kompletten Zeile aus | EINGRIFF: Physikalische Tabelle
    const werte = blatt.getRange(z, 1, 1, blatt.getLastColumn()).getValues()[0];
    // FUNKTION: Hängt die Rohdaten an den Papierkorb an | EINGRIFF: Physikalische Tabelle
    papierkorb.appendRow(werte);
    // FUNKTION: Entfernt die Zeile im Quellblatt | EINGRIFF: Physikalische Tabelle
    blatt.deleteRow(z);
  });
  // FUNKTION: Protokolliert die erfolgreiche Archivierung | EINGRIFF: 02_BASISHELPER
  systemLogSchreiben_("INFO", "Bereinigung", "In Papierkorb verschoben", "", zeilen.length + " Zeilen");
}

// FUNKTION: Entfernt alle komplett leeren Zeilen im aktuellen Blatt | EINGRIFF: Tabellen-Pflege
function leereZeilenImAktivenBlattLoeschen() {
  const blatt = SpreadsheetApp.getActiveSheet();
  const daten = blatt.getDataRange().getValues();
  let zaehler = 0;
  // FUNKTION: Scannt die Tabelle von unten nach oben | EINGRIFF: Such-Loop
  for (let i = daten.length - 1; i >= 1; i--) {
    // CHECK: Ist die Zeile nach dem Zusammenfügen aller Spalten leer? | FOLGE: Löschvorgang
    if (daten[i].join("").trim() === "") {
      blatt.deleteRow(i + 1);
      zaehler++;
    }
  }
  // CHECK: Wurden leere Zeilen gefunden und entfernt? | FOLGE: Feedback an Nutzer
  if (zaehler > 0) {
    systemLogSchreiben_("INFO", "Bereinigung", "Leere Zeilen entfernt", "", zaehler + " Zeilen");
    SpreadsheetApp.getUi().alert(zaehler + " leere Zeilen wurden erfolgreich entfernt.");
  }
}

// HELPER: Wandelt komplexe Markierungs-Bereiche in eine flache Zeilenliste um | EINGRIFF: UI-Helper
function markierteZeilenAusBereichenHolen_(ranges) {
  const zeilenSet = {};
  // FUNKTION: Iteriert durch jeden markierten Block | EINGRIFF: Range-Loop
  ranges.forEach(r => {
    const start = r.getRow();
    const anzahl = r.getNumRows();
    // FUNKTION: Fügt jede Zeile des Blocks dem Set hinzu | EINGRIFF: Set-Building
    for (let i = 0; i < anzahl; i++) {
      zeilenSet[start + i] = true;
    }
  });
  // FUNKTION: Konvertiert das Set zurück in ein numerisches Array | EINGRIFF: Daten-Cleaning
  return Object.keys(zeilenSet).map(Number);
}