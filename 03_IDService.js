/**
 * DATEI: 03_IDSERVICE.GS
 * ZENTRALE VORGANGS-ID VERWALTUNG (DUBLETTEN-SCHUTZ & AUTO-INCREMENT)
 */


// FUNKTION: Erzeugt oder findet eine eindeutige Vorgangs_ID | EINGRIFF: Zentralregister
// CHECK: Existenz eines "GEPLANT"-Eintrags für Stoffbesitzer | FOLGE: Rückgabe bestehende ID oder Generierung
function vorgangsIdSicherstellen_(stoffbesitzer) {
  // FUNKTION: Normalisiert den Stoffbesitzer | EINGRIFF: String-Cleaning
  const stoff = textNormalisieren_(stoffbesitzer);
  // CHECK: Liegt ein Stoffbesitzer vor? | FOLGE: Abbruch bei Leerwert
  if (!stoff) return "";


  // FUNKTION: Referenziert das Zentralregister | EINGRIFF: 01_CONFIG
  const shReg = tabelleHolen_("ZENTRALREGISTER");
  // CHECK: Ist das Zentralregister vorhanden? | FOLGE: Abbruch bei Strukturfehler
  if (!shReg) return "";


  // FUNKTION: Liest das Spalten-Mapping des Registers | EINGRIFF: 02_BASISHELPER
  const sMap = spaltenZuordnungHolen_(shReg);
  // CHECK: Sind die Kernspalten vorhanden? | FOLGE: Abbruch bei Fehlstruktur
  if (!sMap.VORGANGS_ID || !sMap.DATUM || !sMap.STOFFBESITZER || !sMap.STATUS) return "";


  // FUNKTION: Liest alle Registerdaten | EINGRIFF: Physikalische Tabelle
  const daten = shReg.getDataRange().getValues();


  // FUNKTION: Prüft auf bestehenden offenen Vorgang des Stoffbesitzers | EINGRIFF: Dubletten-Prüfung
  for (let i = 1; i < daten.length; i++) {
    // FUNKTION: Liest Stoffbesitzer der Registerzeile | EINGRIFF: Mapping
    const regStoff = textNormalisieren_(daten[i][sMap.STOFFBESITZER - 1]);
    // FUNKTION: Liest Status der Registerzeile | EINGRIFF: Mapping
    const regStatus = textNormalisieren_(daten[i][sMap.STATUS - 1]);


    // CHECK: Gleicher Besitzer und Status GEPLANT? | FOLGE: Wiederverwendung der bestehenden ID
    if (regStoff === stoff && regStatus === textNormalisieren_(KONFIGURATION.STATUSWERTE.GEPLANT)) {
      return textNormalisieren_(daten[i][sMap.VORGANGS_ID - 1]);
    }
  }


  // FUNKTION: Liest die konfigurierte Zeitzone | EINGRIFF: 01_CONFIG
  const zeitzone = KONFIGURATION.ZOLL_PARAMETER.ZEIT_PARAMETER.ZEITZONE || "Europe/Berlin";
  // FUNKTION: Ermittelt das Jahressegment der ID | EINGRIFF: Datumslogik
  const jahr = Utilities.formatDate(new Date(), zeitzone, "yyyy");
  // FUNKTION: Baut das Präfix der neuen ID im verbindlichen V-Format | EINGRIFF: ID-Logik
  const praefix = "V-" + jahr + "-";
  // FUNKTION: Baut das exakte Prüfregex für gültige IDs des laufenden Jahres | EINGRIFF: ID-Validierung
  const regex = new RegExp("^" + praefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(\\d{3})$");


  // FUNKTION: Initialisiert den höchsten gefundenen Zähler | EINGRIFF: Laufnummernlogik
  let maxNr = 0;


  // FUNKTION: Durchsucht das Register nach der höchsten bestehenden Nummer zum V-Präfix | EINGRIFF: Suffix-Logik
  for (let i = 1; i < daten.length; i++) {
    // FUNKTION: Liest die bestehende ID der Registerzeile | EINGRIFF: Mapping
    const id = textNormalisieren_(daten[i][sMap.VORGANGS_ID - 1]);
    // FUNKTION: Prüft die ID streng gegen das Sollformat des laufenden Jahres | EINGRIFF: ID-Validierung
    const match = id.match(regex);


    // CHECK: Entspricht die ID exakt dem erwarteten Format? | FOLGE: Extraktion der laufenden Nummer
    if (match) {
      // FUNKTION: Ermittelt die numerische Endung der ID aus der Regex-Gruppe | EINGRIFF: String-Auswertung
      const nr = parseInt(match[1], 10);
      // CHECK: Ist die Nummer gültig und größer als der aktuelle Maximalwert? | FOLGE: Aktualisierung des Zählers
      if (!isNaN(nr) && nr > maxNr) maxNr = nr;
    }
  }


  // FUNKTION: Baut die neue eindeutige Vorgangs-ID | EINGRIFF: ID-Generierung
  const neueId = praefix + (maxNr + 1).toString().padStart(3, "0");


  // FUNKTION: Erstellt eine leere Zielzeile in Registerbreite | EINGRIFF: Datenstruktur
  const nZ = new Array(shReg.getLastColumn()).fill("");
  // FUNKTION: Schreibt die neue ID in die Zielzeile | EINGRIFF: Registeraufbau
  nZ[sMap.VORGANGS_ID - 1] = neueId;
  // FUNKTION: Schreibt das aktuelle Datum in die Zielzeile | EINGRIFF: Registeraufbau
  nZ[sMap.DATUM - 1] = new Date();
  // FUNKTION: Schreibt den Stoffbesitzer in die Zielzeile | EINGRIFF: Registeraufbau
  nZ[sMap.STOFFBESITZER - 1] = stoff;
  // FUNKTION: Schreibt den Startstatus in die Zielzeile | EINGRIFF: Registeraufbau
  nZ[sMap.STATUS - 1] = KONFIGURATION.STATUSWERTE.GEPLANT;


  // FUNKTION: Hängt die neue Registerzeile an | EINGRIFF: Physikalische Tabelle
  shReg.appendRow(nZ);
  // FUNKTION: Protokolliert die ID-Neuanlage | EINGRIFF: SYSTEM_LOG
  systemLogSchreiben_("INFO", "IDService", "Neue ID registriert", neueId, stoff);


  // FUNKTION: Liefert die neue Vorgangs-ID zurück | EINGRIFF: API-Rückgabe
  return neueId;
}


// FUNKTION: Erzeugt ein 2-stelliges Kürzel aus dem Namen | EINGRIFF: Alt-Kompatibilität
function kuerzelGenerieren_(name) {
  // FUNKTION: Normalisiert den Namen auf Großbuchstaben A-Z | EINGRIFF: String-Cleaning
  const clean = String(name == null ? "" : name).toUpperCase().replace(/[^A-Z]/g, "");
  // FUNKTION: Liefert zwei Zeichen mit Fallback X | EINGRIFF: API-Rückgabe
  return (clean.length >= 2) ? clean.substring(0, 2) : (clean + "X").substring(0, 2);
}


// FUNKTION: Aktualisiert den Status einer ID im Register | EINGRIFF: Zentralregister
// CHECK: Übereinstimmung der Vorgangs_ID | FOLGE: Status-Update
function registerStatusAktualisieren_(vId, neuerStatus) {
  // FUNKTION: Normalisiert die Eingangs-ID | EINGRIFF: String-Cleaning
  const id = textNormalisieren_(vId);
  // CHECK: Liegt eine Vorgangs-ID vor? | FOLGE: Abbruch bei Leerwert
  if (!id) return;


  // FUNKTION: Referenziert das Register | EINGRIFF: 01_CONFIG
  const sh = tabelleHolen_("ZENTRALREGISTER");
  // CHECK: Ist das Register vorhanden? | FOLGE: Abbruch bei Fehlstruktur
  if (!sh) return;


  // FUNKTION: Liest das Register-Mapping | EINGRIFF: 02_BASISHELPER
  const sMap = spaltenZuordnungHolen_(sh);
  // CHECK: Sind ID- und Statusspalte vorhanden? | FOLGE: Abbruch bei Fehlstruktur
  if (!sMap.VORGANGS_ID || !sMap.STATUS) return;


  // FUNKTION: Ermittelt die Registerzeile zur Vorgangs-ID | EINGRIFF: 02_BASISHELPER
  const zeile = ersteZeileMitVorgangsIdHolen_(sh, id);


  // CHECK: Wurde eine gültige Datenzeile gefunden? | FOLGE: Schreiben des neuen Status
  if (zeile > 1) {
    // FUNKTION: Schreibt den neuen Status in das Register | EINGRIFF: Physikalische Tabelle
    sh.getRange(zeile, sMap.STATUS).setValue(neuerStatus);
  }
}