/**
 * DATEI: 10_LOGIKSERVICE.GS
 * TRANSFERLOGIK VON VORPLANUNG NACH MAISCHEANNAHME
 */

// FUNKTION: Überführt alle Zeilen einer Vorgangs_ID aus der Vorplanung in die Maischeannahme | EINGRIFF: 📅_VORPLANUNG -> 🍎_MAISCHEANNAHME
function vorplanungsBlockZuVorgangUmsetzen_(zeileVP, optionaleVId) {
  // FUNKTION: Führt den Transfer unter Sperre aus | EINGRIFF: 00_LOCKSYSTEM
  return mitSperreAusfuehren_(function() {
    // FUNKTION: Referenziert die aktive Arbeitsmappe | EINGRIFF: SpreadsheetApp
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    // FUNKTION: Referenziert das Blatt der Vorplanung | EINGRIFF: 01_CONFIG
    const shVP = ss.getSheetByName(KONFIGURATION.TABELLEN.VORPLANUNG);
    // FUNKTION: Referenziert das Blatt der Maischeannahme | EINGRIFF: 01_CONFIG
    const shMA = ss.getSheetByName(KONFIGURATION.TABELLEN.MAISCHEANNAHME);

    // CHECK: Sind beide Tabellenblätter vorhanden? | FOLGE: Abbruch bei Strukturfehler
    if (!shVP || !shMA) return;

    // FUNKTION: Ermittelt die Spaltenzuordnung der Vorplanung | EINGRIFF: 02_BASISHELPER
    const sVP = spaltenZuordnungHolen_(shVP);
    // FUNKTION: Ermittelt die Spaltenzuordnung der Maischeannahme | EINGRIFF: 02_BASISHELPER
    const sMA = spaltenZuordnungHolen_(shMA);

    // CHECK: Ist die ID-Spalte in beiden Blättern vorhanden? | FOLGE: Abbruch bei Fehlstruktur
    if (!sVP.VORGANGS_ID || !sMA.VORGANGS_ID) return;

    // FUNKTION: Ermittelt die zu verarbeitende Vorgangs_ID | EINGRIFF: Prozess-Steuerung
    let vId = textNormalisieren_(optionaleVId || "");

    // CHECK: Wurde keine optionale ID übergeben? | FOLGE: Lesen aus der Quellzeile
    if (!vId && zeileVP > 1) {
      // FUNKTION: Liest die ID aus der Vorplanungszeile | EINGRIFF: Physikalische Tabelle
      vId = textNormalisieren_(shVP.getRange(zeileVP, sVP.VORGANGS_ID).getValue());
    }

    // CHECK: Liegt eine gültige Vorgangs_ID vor? | FOLGE: Abbruch bei fehlendem Anker
    if (!vId) return;

    // FUNKTION: Ermittelt alle Vorplanungszeilen dieser ID | EINGRIFF: 02_BASISHELPER
    const vpZeilen = alleZeilenMitVorgangsIdHolen_(shVP, vId);
    // CHECK: Gibt es Quellzeilen zur ID? | FOLGE: Abbruch bei leerem Vorgang
    if (vpZeilen.length === 0) return;

    // FUNKTION: Ermittelt bestehende Zielzeilen dieser ID in der Maischeannahme | EINGRIFF: 02_BASISHELPER
    const maAltZeilen = alleZeilenMitVorgangsIdHolen_(shMA, vId);
    // CHECK: Existieren bereits Zielzeilen? | FOLGE: Bereinigung vor Neuaufbau
    if (maAltZeilen.length > 0) {
      // FUNKTION: Sortiert Zielzeilen absteigend für sicheres Löschen | EINGRIFF: Array-Manipulation
      maAltZeilen.sort(function(a, b) { return b - a; });
      // FUNKTION: Entfernt alte Zielzeilen | EINGRIFF: Physikalische Tabelle
      maAltZeilen.forEach(function(z) { shMA.deleteRow(z); });
    }

    // FUNKTION: Liest die Header-Zeile des Zielblatts | EINGRIFF: Physikalische Tabelle
    const headerMA = shMA.getRange(1, 1, 1, shMA.getLastColumn()).getValues()[0];
    // FUNKTION: Initialisiert die Liste neuer Zielzeilen | EINGRIFF: Datenstruktur
    const neueZeilen = [];

    // FUNKTION: Iteriert über alle Quellzeilen des Vorgangs | EINGRIFF: Transfer-Loop
    vpZeilen.forEach(function(zVP, index) {
      // FUNKTION: Liest die komplette Quellzeile | EINGRIFF: Physikalische Tabelle
      const rowVP = shVP.getRange(zVP, 1, 1, shVP.getLastColumn()).getValues()[0];
      // FUNKTION: Baut die Zielzeile anhand der Zielheader auf | EINGRIFF: Mapping-Engine
      const zielZeile = headerMA.map(function(header) {
        // FUNKTION: Normalisiert den Zielheader | EINGRIFF: String-Cleaning
        const h = textNormalisieren_(header);

        // CHECK: Zielspalte ist Vorgangs_ID? | FOLGE: Übernahme des Vorgangsankers
        if (h === KONFIGURATION.SPALTEN.VORGANGS_ID) return vId;
        // CHECK: Zielspalte ist Termin_Maische? | FOLGE: Übernahme aus Vorplanung
        if (h === KONFIGURATION.SPALTEN.TERMIN_MAISCHE) return sVP.TERMIN_MAISCHE ? rowVP[sVP.TERMIN_MAISCHE - 1] : "";
        // CHECK: Zielspalte ist Tag_Brand? | FOLGE: Übernahme aus Vorplanung
        if (h === KONFIGURATION.SPALTEN.TAG_BRAND) return sVP.TAG_BRAND ? rowVP[sVP.TAG_BRAND - 1] : "";
        // CHECK: Zielspalte ist von? | FOLGE: Übernahme aus Vorplanung
        if (h === KONFIGURATION.SPALTEN.VON) return sVP.VON ? rowVP[sVP.VON - 1] : "";
        // CHECK: Zielspalte ist bis? | FOLGE: Übernahme aus Vorplanung
        if (h === KONFIGURATION.SPALTEN.BIS) return sVP.BIS ? rowVP[sVP.BIS - 1] : "";
        // CHECK: Zielspalte ist Stoffbesitzer? | FOLGE: Übernahme aus Vorplanung
        if (h === KONFIGURATION.SPALTEN.STOFFBESITZER) return sVP.STOFFBESITZER ? rowVP[sVP.STOFFBESITZER - 1] : "";
        // CHECK: Zielspalte ist Brenner? | FOLGE: Übernahme aus Vorplanung
        if (h === KONFIGURATION.SPALTEN.BRENNER) return sVP.BRENNER ? rowVP[sVP.BRENNER - 1] : "";
        // CHECK: Zielspalte ist Material? | FOLGE: Übernahme aus Vorplanung
        if (h === KONFIGURATION.SPALTEN.MATERIAL) return sVP.MATERIAL ? rowVP[sVP.MATERIAL - 1] : "";
        // CHECK: Zielspalte ist Gewürze_Zusätze? | FOLGE: Übernahme aus Vorplanung
        if (h === KONFIGURATION.SPALTEN.GEWUERZE) return sVP.GEWUERZE ? rowVP[sVP.GEWUERZE - 1] : "";
        // CHECK: Zielspalte ist Faßgröße? | FOLGE: Übernahme aus Faßgröße_Anlieferung
        if (h === KONFIGURATION.SPALTEN.FASS_MA) return sVP.FASS_VP ? rowVP[sVP.FASS_VP - 1] : "";
        // CHECK: Zielspalte ist Inhalt? | FOLGE: Übernahme aus Inhalt_Anlieferung
        if (h === KONFIGURATION.SPALTEN.INH_MA) return sVP.INH_VP ? rowVP[sVP.INH_VP - 1] : "";
        // CHECK: Zielspalte ist Anzahl_Brände? | FOLGE: Übernahme oder Fallback auf 1
        if (h === KONFIGURATION.SPALTEN.ANZAHL_BRAENDE) return sVP.ANZAHL_BRAENDE ? rowVP[sVP.ANZAHL_BRAENDE - 1] : 1;
        // CHECK: Zielspalte ist Faß-Nr.? | FOLGE: Initial leer, da erst vor Ort
        if (h === KONFIGURATION.SPALTEN.FASS_NR) return "";
        // CHECK: Zielspalte ist Reg.Nr.? | FOLGE: Initial leer, da Zollwert später
        if (h === KONFIGURATION.SPALTEN.REGISTER_NR) return "";
        // CHECK: Zielspalte ist Zoll_OK? | FOLGE: Initial leer
        if (h === KONFIGURATION.SPALTEN.ZOLL_OK) return "";
        // CHECK: Zielspalte ist Ausb.(ltr.)? | FOLGE: Initial leer
        if (h === KONFIGURATION.SPALTEN.AUSBEUTE) return "";
        // CHECK: Zielspalte ist Alk. % |? | FOLGE: Initial leer
        if (h === KONFIGURATION.SPALTEN.ALKOHOL) return "";
        // CHECK: Zielspalte ist Status_Aktion? | FOLGE: Initialstatus setzen
        if (h === KONFIGURATION.SPALTEN.STATUS_AKTION) return "angenommen";
        // CHECK: Zielspalte ist Dossier_Link? | FOLGE: Initial leer bis Link-Sync
        if (h === KONFIGURATION.SPALTEN.DOSSIER_LINK) return "";
        // CHECK: Zielspalte ist Status? | FOLGE: Harmonisierung auf ÜBERNOMMEN
        if (h === KONFIGURATION.SPALTEN.STATUS) return KONFIGURATION.STATUSWERTE.UEBERNOMMEN;

        // FUNKTION: Liefert für nicht gemappte Zielspalten einen Leerwert | EINGRIFF: Fallback-Logik
        return "";
      });

      // CHECK: Existiert die Faß-Nr.-Spalte? | FOLGE: Vergabe einer laufenden Fassnummer
      if (sMA.FASS_NR) {
        // FUNKTION: Setzt eine laufende Fassnummer im Zielarray | EINGRIFF: Zieldaten-Aufbau
        zielZeile[sMA.FASS_NR - 1] = index + 1;
      }

      // CHECK: Existiert die Status-Spalte? | FOLGE: Sicherung des Statuswerts im Zielarray
      if (sMA.STATUS) {
        // FUNKTION: Schreibt den übernommenen Status in das Zielarray | EINGRIFF: Zieldaten-Aufbau
        zielZeile[sMA.STATUS - 1] = KONFIGURATION.STATUSWERTE.UEBERNOMMEN;
      }

      // FUNKTION: Übernimmt die fertige Zielzeile in die Sammelliste | EINGRIFF: Datenstruktur
      neueZeilen.push(zielZeile);
    });

    // CHECK: Wurden neue Zielzeilen erzeugt? | FOLGE: Physisches Schreiben in das Zielblatt
    if (neueZeilen.length > 0) {
      // FUNKTION: Ermittelt die erste freie Zielzeile | EINGRIFF: Physikalische Tabelle
      const startZeile = shMA.getLastRow() + 1;
      // FUNKTION: Schreibt alle Zielzeilen gesammelt in die Maischeannahme | EINGRIFF: Physikalische Tabelle
      shMA.getRange(startZeile, 1, neueZeilen.length, shMA.getLastColumn()).setValues(neueZeilen);

      // FUNKTION: Erzwingt die Synchronisation der Schreibvorgänge | EINGRIFF: SpreadsheetApp
      SpreadsheetApp.flush();

      // FUNKTION: Ermittelt die neu geschriebenen Zielzeilen erneut über die ID | EINGRIFF: 02_BASISHELPER
      const maNeuZeilen = alleZeilenMitVorgangsIdHolen_(shMA, vId);

      // FUNKTION: Iteriert über alle neu geschriebenen Zielzeilen | EINGRIFF: Link-Sync
      maNeuZeilen.forEach(function(z) {
        // FUNKTION: Aktualisiert je Zeile den Dossier-Link | EINGRIFF: 05_DRIVESERVICE
        dossierLinkAktualisieren_(shMA, z, sMA);
      });
    }

    // FUNKTION: Aktualisiert den Registerstatus des Vorgangs | EINGRIFF: 03_IDSERVICE
    registerStatusAktualisieren_(vId, KONFIGURATION.STATUSWERTE.UEBERNOMMEN);

    // CHECK: Existiert eine Status-Spalte in der Vorplanung? | FOLGE: Rückschreiben des übernommenen Status
    if (sVP.STATUS) {
      // FUNKTION: Iteriert über alle Quellzeilen des Vorgangs | EINGRIFF: Rückschreib-Loop
      vpZeilen.forEach(function(z) {
        // FUNKTION: Setzt den Status in der Vorplanung auf übernommen | EINGRIFF: Physikalische Tabelle
        shVP.getRange(z, sVP.STATUS).setValue(KONFIGURATION.STATUSWERTE.UEBERNOMMEN);
      });
    }

    // FUNKTION: Dokumentiert den Transfer im Systemlog | EINGRIFF: SYSTEM_LOG
    systemLogSchreiben_("INFO", "LogikService", "Transfer VP -> MA abgeschlossen", vId, "Zeilen: " + vpZeilen.length);
  }, "vorplanungsBlockZuVorgangUmsetzen_");
}