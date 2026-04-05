/**
 * DATEI: 01_CONFIG.GS
 * DAS ZENTRALE GEHIRN AUF BASIS DES AKTUELLEN IST-STANDS
 */

// FUNKTION: Zentrales Konfigurationsobjekt für das gesamte System | EINGRIFF: System-Gehirn
var KONFIGURATION = {

  // FUNKTION: Identitätsdaten des Brennereibetriebs | EINGRIFF: System-Integrität
  IDENTITAET: {
    // FUNKTION: Typ der Brennerei | EINGRIFF: Zoll-Validierung
    TYP: "Abfindungsbrennerei",
    // FUNKTION: Zuständige Behörde | EINGRIFF: Zoll-Identität
    AUFSICHT: "Hauptzollamt (Zoll-Portal)",
    // FUNKTION: Amtliche Nummer | EINGRIFF: Druck-Service
    BRENNEREI_NUMMER: "1460927",
    // FUNKTION: Maximale Kapazität der Blase | EINGRIFF: Splitting-Logik
    MAX_BLASE: 120,
    // FUNKTION: Vereinsname | EINGRIFF: UI-Design
    BETRIEB: "OGV Breitfurt e.V.",
    // FUNKTION: Dokumentiertes ID-Format laut Leitstand-Architektur | EINGRIFF: ID-Service
    // FUNKTION: Dokumentiertes ID-Format laut Leitstand-Architektur | EINGRIFF: ID-Service
ID_FORMAT: "V-YYYY-XXX"
  },

  // FUNKTION: Zoll-relevante Zeit-Parameter | EINGRIFF: WorkflowService
  ZOLL_PARAMETER: {
    ZEIT_PARAMETER: {
      // FUNKTION: Minuten für Erstbrand | EINGRIFF: Zeit-Kalkulation
      KALTSTART: 150,
      // FUNKTION: Minuten für Folgebrand | EINGRIFF: Zeit-Kalkulation
      FOLGEBRAND: 120,
      // FUNKTION: Minuten für Reinigung / Nachlauf | EINGRIFF: Zeit-Kalkulation
      REINIGUNG: 180,
      // FUNKTION: Zeitzonen-Einstellung | EINGRIFF: Datums-Formatierung
      ZEITZONE: "Europe/Berlin"
    }
  },

  // FUNKTION: Mapping der Tabellenblatt-Namen inkl. Emojis | EINGRIFF: Physikalische Struktur
  // CHECK: Emojis sind Teil des physischen Namens | FOLGE: Exakter Match erforderlich
  TABELLEN: {
    // FUNKTION: Blatt für Register | EINGRIFF: 03_IDSERVICE
    ZENTRALREGISTER: "📂_ZENTRALREGISTER",
    // FUNKTION: Blatt für Einstellungen | EINGRIFF: System-Integrität
    EINSTELLUNGEN: "⚙️_EINSTELLUNGEN",
    // FUNKTION: Blatt für Mitglieder | EINGRIFF: Stammdaten-API
    MITGLIEDER: "👥_MITGLIEDER",
    // FUNKTION: Blatt für Papierkorb | EINGRIFF: 14_BEREINIGUNGSERVICE
    PAPIERKORB: "🗑️_PAPIERKORB",
    // FUNKTION: Blatt für Stammdaten | EINGRIFF: 09_MASKENSERVICE
    STAMMDATEN: "📦_STAMMDATEN",
    // FUNKTION: Blatt für Vorplanung | EINGRIFF: 10_LOGIKSERVICE
    VORPLANUNG: "📅_VORPLANUNG",
    // FUNKTION: Blatt für Maischeannahme | EINGRIFF: 11_MAISCHESERVICE
    MAISCHEANNAHME: "🍎_MAISCHEANNAHME",
    // FUNKTION: Blatt für Archiv | EINGRIFF: System-Historie
    JAHRESARCHIV: "📜_JAHRESARCHIV_2026",
    // FUNKTION: Blatt für Logs | EINGRIFF: 02_BASISHELPER
    SYSTEM_LOG: "System_LOG",
    // FUNKTION: Hilfsblatt Rohform 1 | EINGRIFF: Protokollierung
    ROHFORM_BRENNPROTOKOLL: "ROHFORM_MAISCHE_ANNAHME",
    // FUNKTION: Hilfsblatt Rohform 2 | EINGRIFF: Telefon-Voranmeldung
    ROHFORM_CHECKLISTE: "ROHFORM_TELEFON_VORANMELDUNG"
  },

  // FUNKTION: Definition der exakten Header-Strings aus den Tabellen | EINGRIFF: Daten-Mapping
  SPALTEN: {
    // FUNKTION: Haupt-Identifikator | EINGRIFF: Datenbank-Link
    VORGANGS_ID: "Vorgangs_ID",
    // FUNKTION: Einfaches Datum | EINGRIFF: Daten-Mapping
    DATUM: "Datum",
    // FUNKTION: Erster Kontaktzeitpunkt | EINGRIFF: Historien-Schutz
    ANRUF_DATUM: "Anruf_Datum",
    // FUNKTION: Kundenname | EINGRIFF: UI-Schnittstelle
    STOFFBESITZER: "Stoffbesitzer",
    // FUNKTION: Register-Status | EINGRIFF: 03_IDSERVICE
    STATUS: "Status",
    // FUNKTION: Geplanter Brandtag | EINGRIFF: Zeit-Engine
    TAG_BRAND: "Tag_Brand",
    // FUNKTION: Name des Brenners | EINGRIFF: Disposition
    BRENNER: "Brenner",
    // FUNKTION: Startzeit | EINGRIFF: Zeit-Logik
    VON: "von",
    // FUNKTION: Endzeit | EINGRIFF: Zeit-Logik
    BIS: "bis",
    // FUNKTION: Materialbeschreibung | EINGRIFF: Stammdaten
    MATERIAL: "Material",
    // FUNKTION: Anzahl der Durchgänge | EINGRIFF: Planung
    ANZAHL_BRAENDE: "Anzahl_Brände",
    // FUNKTION: Zusätze/Gewürze | EINGRIFF: Rezeptur
    GEWUERZE: "Gewürze_Zusätze",
    // FUNKTION: Vorplanung Fassgröße | EINGRIFF: WorkflowService
    FASS_VP: "Faßgröße_Anlieferung",
    // FUNKTION: Vorplanung Inhalt | EINGRIFF: WorkflowService
    INH_VP: "Inhalt_Anlieferung",
    // FUNKTION: Maischetermin | EINGRIFF: Terminierung
    TERMIN_MAISCHE: "Termin_Maische",
    // CHECK: Schreibweise mit 'ß' | FOLGE: Konsistenter Grip
    FASS_NR: "Faß-Nr.",
    // CHECK: Schreibweise mit 'ß' | FOLGE: Konsistenter Grip
    FASS_MA: "Faßgröße",
    // FUNKTION: Ist-Inhalt | EINGRIFF: Maischeannahme / Archiv
    INH_MA: "Inhalt",
    // FUNKTION: Zoll-Nummer | EINGRIFF: PrintService
    REGISTER_NR: "Reg.Nr.",
    // FUNKTION: Alias für Reg.Nr. | EINGRIFF: Alt-Kompatibilität
    REGISTERNUMMER: "Reg.Nr.",
    // FUNKTION: Alkoholwert im Maischeblatt | EINGRIFF: 01_WEBAPP
    ALKOHOL: "Alk. % |",
    // FUNKTION: Harmonisierter Key für Alkohol | EINGRIFF: 01_WEBAPP / Archiv
    ALKOHOL_PROZENT: "Alk. %",
    // FUNKTION: Ausbeutewert | EINGRIFF: 01_WEBAPP
    AUSBEUTE: "Ausb.(ltr.)",
    // FUNKTION: Harmonisierter Key für Ausbeute | EINGRIFF: 01_WEBAPP
    AUSBEUTE_LITER: "Ausb.(ltr.)",
    // FUNKTION: Zoll-Status | EINGRIFF: Maischeannahme
    ZOLL_OK: "Zoll_OK",
    // FUNKTION: Link zum Ordner | EINGRIFF: DriveService
    DOSSIER_LINK: "Dossier_Link",
    // FUNKTION: Aktionsstatus | EINGRIFF: Cockpit-Steuerung
    STATUS_AKTION: "Status_Aktion",
    // FUNKTION: Hilfsspalte für UI-Feedback | EINGRIFF: Vorplanung
    INFO_SYSTEM: "Info_System"
  },

  // FUNKTION: Definition der Statuswerte | EINGRIFF: Prozess-Steuerung
  STATUSWERTE: {
    // FUNKTION: Status für Neuaufnahmen | EINGRIFF: 03_IDSERVICE
    GEPLANT: "GEPLANT",
    // FUNKTION: Status nach Daten-Transfer | EINGRIFF: 10_LOGIKSERVICE
    UEBERNOMMEN: "ÜBERNOMMEN",
    // FUNKTION: Status für Löschung / Ablage | EINGRIFF: Bereinigungslogik
    GELOESCHT: "GELÖSCHT"
  },

  DRIVE_ORDNER: {
    WURZEL_ORDNER_ID: "1PKL_9UyXWE01cQCBNJwK-6ESMGDS68dR",
    LOGO_ORDNER_ID: "1W8OO9I6viZYlCqapX2uqcONDES0vySPn",
    FASSBILD_ORDNER_ID: "1W8OO9I6viZYlCqapX2uqcONDES0vySPn"
  },

  // FUNKTION: Kontaktblock für Druck- und Checklistenmodule | EINGRIFF: 12_PRINTSERVICE / 13_CHECKLISTSERVICE
  KONTAKT: {
    // FUNKTION: Ansprechpartnername | EINGRIFF: Checkliste / Druck
    NAME: "Annika Laugg",
    // FUNKTION: Telefonnummer | EINGRIFF: Checkliste / Druck
    TEL: "0172 6741754",
    // FUNKTION: E-Mail-Adresse | EINGRIFF: Checkliste
    MAIL: "obstundgartenbreitfurt@gmail.com"
  }
};