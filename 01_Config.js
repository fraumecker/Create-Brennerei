var KONFIGURATION = {

  SPREADSHEET: {
    ID: "16TOhm2k9e3TVdhKwLovBHT542ZjqIlYVctw3xLYzswE"
  },

  ADMIN: {
    MITGLIEDER_PIN: "2468"
  },

  IDENTITAET: {
    TYP: "Abfindungsbrennerei",
    AUFSICHT: "Hauptzollamt (Zoll-Portal)",
    BRENNEREI_NUMMER: "1460927",
    MAX_BLASE: 120,
    BETRIEB: "OGV Breitfurt e.V.",
    ID_FORMAT: "V-YYYY-XXX"
  },

  ZOLL_PARAMETER: {
    ZEIT_PARAMETER: {
      KALTSTART: 150,
      FOLGEBRAND: 120,
      REINIGUNG: 180,
      ZEITZONE: "Europe/Berlin"
    }
  },

  ZOLL_KONTAKTLISTE: {
    TITEL: "Hauptzollamt Saarbrücken",
    UNTERTITEL: "Telefonliste Steueraufsicht Abfindungsbrennereien",
    STAND: "19. Januar 2026",
    FAX_ALLE_STANDORTE: "0681/8308-0901",
    ZENTRALE_EMAIL: "poststelle.hza-saarbruecken@zoll.bund.de",

    KONTAKTE: [
      {
        NAME: "Benedum",
        DIENSTSITZ: "KL",
        TELEFON: "0681 8308-0953",
        MOBIL: "0151-20482069",
        EMAIL: "florian.benedum@zoll.bund.de"
      },
      {
        NAME: "Saxler",
        DIENSTSITZ: "SB",
        TELEFON: "0681/8308-0954",
        MOBIL: "0171-5410791",
        EMAIL: "hans-ulrich.saxler@zoll.bund.de"
      },
      {
        NAME: "Bethge",
        DIENSTSITZ: "SB",
        TELEFON: "0681/8308-0934",
        MOBIL: "0171-5574045",
        EMAIL: "dariusz.bethge@zoll.bund.de"
      },
      {
        NAME: "Enzweiler",
        DIENSTSITZ: "SB",
        TELEFON: "0681/8308-0940",
        MOBIL: "0151-46212125",
        EMAIL: "andreas.enzweiler@zoll.bund.de"
      },
      {
        NAME: "Letzelter",
        DIENSTSITZ: "SB",
        TELEFON: "0681/8308-0908",
        MOBIL: "0160-98019895",
        EMAIL: "fabian.letzelter@zoll.bund.de"
      },
      {
        NAME: "Müller",
        DIENSTSITZ: "SB",
        TELEFON: "0681/8308-0670",
        MOBIL: "0175-1168740",
        EMAIL: "leon.mueller@zoll.bund.de"
      },
      {
        NAME: "Becker",
        DIENSTSITZ: "KL",
        TELEFON: "",
        MOBIL: "0160-98033505",
        EMAIL: "tobias.becker@zoll.bund.de"
      },
      {
        NAME: "Ludwig",
        DIENSTSITZ: "KL",
        TELEFON: "",
        MOBIL: "0171-5416871",
        EMAIL: "elias.ludwig@zoll.bund.de"
      },
      {
        NAME: "Weber",
        DIENSTSITZ: "PS",
        TELEFON: "06331/5538-17",
        MOBIL: "0171-5418967",
        EMAIL: "jens.weber@zoll.bund.de"
      }
    ]
  },

  TABELLEN: {
    ZENTRALREGISTER: "📂_ZENTRALREGISTER",
    EINSTELLUNGEN: "⚙️_EINSTELLUNGEN",
    MITGLIEDER: "👥_MITGLIEDER",
    PAPIERKORB: "🗑️_PAPIERKORB",
    STAMMDATEN: "📦_STAMMDATEN",
    VORPLANUNG: "📆_VORPLANUNG",
    BRANDTAGE_PLANUNG: "🗓️_BRANDTAGE_PLANUNG",
    MAISCHEANNAHME: "🍎_MAISCHEANNAHME",
    BRENNFREIGABE: "🔥_BRENNFREIGABE",
    BRANDTAG_UEBERSICHT: "🔥_BRANDTAG_UEBERSICHT",
    JAHRESARCHIV: "📜_JAHRESARCHIV_2026",
    SYSTEM_LOG: "System_LOG",
    ROHFORM_BRENNPROTOKOLL: "ROHFORM_MAISCHE_ANNAHME",
    ROHFORM_CHECKLISTE: "ROHFORM_TELEFON_VORANMELDUNG"
  },

  SPALTEN: {
    VORGANGS_ID: "Vorgangs_ID",
    DATUM: "Datum",
    ANRUF_DATUM: "Anruf_Datum",
    STOFFBESITZER: "Stoffbesitzer",
    BEMERKUNG: "Bemerkung",
    STATUS: "Status",
    DOSSIER_LINK: "Dossier_Link",
    INFO_SYSTEM: "Info_System",

    TERMIN_MAISCHE: "Termin_Maische",
    FASS_VP: "Faßgröße",
    INH_VP: "Inhalt",
    MATERIAL: "Material",
    GEWUERZE: "Gewürze",
    TAG_BRAND: "Tag_Brand",
    FASS_NR: "Faßnummer",
    VON: "von",
    BIS: "bis",
    BRENNER: "Brenner",
    ANZAHL_BRAENDE: "Anzahl_Brände",
    REGISTERNUMMER: "Registernummer",
    ZOLL_OK: "Zoll_OK",
    AUSBEUTE: "Ausbeute",
    ALKOHOL: "Alkohol %",
    STATUS_AKTION: "Status_Aktion",

    PLANUNG_ID: "Planung_ID",
    BEMERKUNG_VORPLANUNG: "Bemerkung_Vorplanung",
    DATUM_MAISCHEANNAHME: "Datum_Maischeannahme",
    BRANDTAG: "Brandtag",
    ZEITSLOT_VON: "Zeitslot_von",
    ZEITSLOT_BIS: "Zeitslot_bis",
    BEMERKUNG_INTERN: "Bemerkung_Intern",
    ERSTELLT_AM: "Erstellt_am",
    GEAENDERT_AM: "Geändert_am"
  },

  STATUSWERTE: {
    GEPLANT: "GEPLANT",
    UEBERNOMMEN: "✅ ÜBERNOMMEN",
    ERLEDIGT: "ERLEDIGT",
    ARCHIVIERT: "ARCHIVIERT",
    GELOESCHT: "GELÖSCHT",
    ANGELEGT: "ANGELEGT",
    IN_ORGA: "IN ORGA",
    TERMINIERT: "TERMINIERT",
    IN_MAISCHEANNAHME_UEBERGEBEN: "IN MAISCHEANNAHME ÜBERGEBEN",
    AN_ZOLL_GESENDET: "AN ZOLL GESENDET",
    IN_BRENNFREIGABE: "IN BRENNFREIGABE",
    GEBRANNT: "GEBRANNT"
  },

  DROPDOWN_QUELLEN: {
    STOFFBESITZER: {
      tabelle: "MITGLIEDER",
      spalte: "NameAnzeige"
    },
    FASS_VP: {
      tabelle: "STAMMDATEN",
      spalte: "Fassgrößen_L"
    },
    MATERIAL: {
      tabelle: "STAMMDATEN",
      spalte: "Rohstoffe"
    },
    GEWUERZE: {
      tabelle: "STAMMDATEN",
      spalte: "Gewürze_Zusätze"
    },
    BRENNER: {
      tabelle: "STAMMDATEN",
      spalte: "Brenner_Namen"
    }
  },

  FESTWERTE: {
    ZOLL_OK: [
      "",
      "🛂 BEIM ZOLL",
      "✅ GENEHMIGT",
      "❌ ABGELEHNT"
    ],

    STATUS: [
      "GEPLANT",
      "ANGELEGT",
      "IN ORGA",
      "TERMINIERT",
      "IN MAISCHEANNAHME ÜBERGEBEN",
      "AN ZOLL GESENDET",
      "IN BRENNFREIGABE",
      "✅ ÜBERNOMMEN",
      "GEBRANNT",
      "ERLEDIGT",
      "ARCHIVIERT",
      "GELÖSCHT"
    ],

    BRANDPLANUNG_STATUS: [
      "IN ORGA",
      "TERMINIERT",
      "IN MAISCHEANNAHME ÜBERGEBEN"
    ],

    STATUS_AKTION: [
      "OFFEN",
      "RÜCKFRAGE",
      "WARTET AUF ZOLL",
      "ZOLL_OK",
      "BEREIT ZUM BRENNEN",
      "ERLEDIGT"
    ]
  },

  BENACHRICHTIGUNG: {
    NEUER_VORGANG_EMPFAENGER: "fraumecker@gmail.com",
    HINWEIS_KEINE_EMAIL_CHECKLISTE: "Keine E-Mail-Adresse hinterlegt. Checkliste per Post versenden."
  },

  DRIVE_ORDNER: {
    WURZEL_ORDNER_ID: "1PKL_9UyXWE01cQCBNJwK-6ESMGDS68dR",
    LOGO_ORDNER_ID: "1W8OO9I6viZYlCqapX2uqcONDES0vySPn",
    FASSBILD_ORDNER_ID: "1bn0vIBM37DTyl2iHMIOP-tA7ir5U543K"
  },

  KONTAKT: {
    NAME: "Annika Laugg",
    TEL: "0172 6741754",
    MAIL: "obstundgartenbreitfurt@gmail.com"
  }
};