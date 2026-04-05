/**
 * DATEI: 99_RESET.GS
 * REPARATUR-DIENST FÜR DATENBANK-KONSISTENZ
 */

// FUNKTION: Stellt die Übereinstimmung zwischen Register und Datentabellen wieder her | EINGRIFF: Datenbank-Management
function vorgangsIdsSicherReparieren() {
  // FUNKTION: Referenziert die aktive Arbeitsmappe | EINGRIFF: SpreadsheetApp API
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // FUNKTION: Holt das Zentralregister-Blatt via Config-Key | EINGRIFF: 01_CONFIG
  const shReg = tabelleHolen_("ZENTRALREGISTER");
  // CHECK: Existiert das Register-Blatt in der Datei? | FOLGE: Abbruch bei schwerem Fehler
  if (!shReg) {
    // FUNKTION: Meldet das Fehlen des Hauptregisters | EINGRIFF: UI-Dialog
    throw new Error("Register nicht gefunden.");
  }
  
  // FUNKTION: Definiert die physischen Blätter der Datenebene | EINGRIFF: Daten-Struktur
  const datenBlaetter = [
    tabelleHolen_("VORPLANUNG"),
    tabelleHolen_("MAISCHEANNAHME")
  ].filter(Boolean);
  
  // FUNKTION: Ermittelt die Spalten-Mappings für das Register | EINGRIFF: 02_BASISHELPER
  const sMapReg = spaltenZuordnungHolen_(shReg);
  // FUNKTION: Initialisiert eine Sammlung aller real genutzten IDs | EINGRIFF: Speicher-Set
  const aktiveIds = new Set();
  
  // FUNKTION: Scannt die Datenblätter nach tatsächlich vergebenen IDs | EINGRIFF: Daten-Extraktion
  datenBlaetter.forEach(sh => {
    // CHECK: Enthält das Blatt Datenzeilen? | FOLGE: Start des Scans
    if (sh.getLastRow() > 1) {
      // FUNKTION: Holt das Mapping für das aktuelle Blatt | EINGRIFF: 02_BASISHELPER
      const sMap = spaltenZuordnungHolen_(sh);
      // FUNKTION: Liest alle Daten des Blatts ein | EINGRIFF: Physikalische Tabelle
      const daten = sh.getDataRange().getValues();
      // FUNKTION: Iteriert ab Zeile 2 durch die IDs | EINGRIFF: ID-Check
      for (let i = 1; i < daten.length; i++) {
        // FUNKTION: Normalisiert die gefundene ID | EINGRIFF: 02_BASISHELPER
        const vId = textNormalisieren_(daten[i][sMap.VORGANGS_ID - 1]);
        // CHECK: Ist die ID befüllt? | FOLGE: Aufnahme in die Liste der aktiven IDs
        if (vId) aktiveIds.add(vId);
      }
    }
  });

  // FUNKTION: Liest den aktuellen Stand des Zentralregisters ein | EINGRIFF: Physikalische Tabelle
  const regRaw = shReg.getDataRange().getValues();
  // FUNKTION: Behält die Header-Zeile als Basis für die Rekonstruktion | EINGRIFF: Daten-Hygiene
  const bereinigtesRegister = [regRaw[0]];
  // FUNKTION: Initialisiert Set für die Dubletten-Prüfung | EINGRIFF: Speicher-Set
  const gesehen = new Set();
  
  // FUNKTION: Filtert das Register nach Existenz und Eindeutigkeit | EINGRIFF: Filter-Prozess
  for (let k = 1; k < regRaw.length; k++) {
    // FUNKTION: Holt die ID aus der aktuellen Register-Zeile | EINGRIFF: Daten-Mapping
    const idReg = textNormalisieren_(regRaw[k][sMapReg.VORGANGS_ID - 1]);
    // CHECK: Ist die ID aktiv, noch nicht gesehen und nicht leer? | FOLGE: Übernahme in das neue Register
    if (idReg && aktiveIds.has(idReg) && !gesehen.has(idReg)) {
      // FUNKTION: Fügt die valide Zeile dem neuen Register-Array hinzu | EINGRIFF: Array-Push
      bereinigtesRegister.push(regRaw[k]);
      // FUNKTION: Markiert die ID als verarbeitet | EINGRIFF: Dubletten-Schutz
      gesehen.add(idReg);
    }
  }

  // FUNKTION: Löscht den gesamten Inhalt des Registers zur Neuschreibung | EINGRIFF: Physikalische Tabelle
  shReg.clearContents();
  // FUNKTION: Schreibt die bereinigten Daten zeilengetreu zurück | EINGRIFF: Physikalische Tabelle
  shReg.getRange(1, 1, bereinigtesRegister.length, bereinigtesRegister[0].length).setValues(bereinigtesRegister);
  
  // FUNKTION: Protokolliert die Datenbank-Heilung | EINGRIFF: 02_BASISHELPER
  systemLogSchreiben_("WARN", "Reset", "Register-Konsolidierung abgeschlossen", "", "IDs verbleibend: " + gesehen.size);
  // FUNKTION: Informiert den Administrator über das Ergebnis | EINGRIFF: UI-Dialog
  SpreadsheetApp.getUi().alert("✅ REORGANISATION ERFOLGREICH.\n\n" + gesehen.size + " aktive Vorgänge synchronisiert.");
}