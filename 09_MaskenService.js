/**
 * DATEI: 09_MASKENSERVICE.GS
 * SERVERSEITIGE DATENLOGIK FÜR DIE ADMIN-MASKE
 */


function getMaskenStammdaten() {
  const shMitglieder = tabelleHolen_("MITGLIEDER");
  const shStammdaten = tabelleHolen_("STAMMDATEN");
  const shEinstellungen = tabelleHolen_("EINSTELLUNGEN");


  const result = {
    mitglieder: [],
    brenner: [],
    materialien: [],
    gewuerze: [],
    maxBlase: Number(KONFIGURATION.IDENTITAET.MAX_BLASE) || 120
  };


  if (shMitglieder && shMitglieder.getLastRow() > 1) {
    const daten = shMitglieder.getDataRange().getValues();
    const header = daten[0].map(textNormalisieren_);
    const colNameAnzeige = header.indexOf("NameAnzeige");
    const colZuname = header.indexOf("Zuname");
    const colVorname = header.indexOf("Vorname");
    const colStoffNr = header.indexOf("Stoffbesitzernummer");
    const set = {};


    for (let i = 1; i < daten.length; i++) {
      const row = daten[i];
      const nameAnzeige = colNameAnzeige > -1 ? textNormalisieren_(row[colNameAnzeige]) : "";
      const zuname = colZuname > -1 ? textNormalisieren_(row[colZuname]) : "";
      const vorname = colVorname > -1 ? textNormalisieren_(row[colVorname]) : "";
      const stoffNr = colStoffNr > -1 ? textNormalisieren_(row[colStoffNr]) : "";


      const fallbackName = [zuname, vorname].filter(Boolean).join(", ");
      const finalName = nameAnzeige || fallbackName || stoffNr;


      if (finalName) {
        set[finalName] = true;
      }
    }


    result.mitglieder = Object.keys(set).sort(function(a, b) {
      return a.localeCompare(b, "de");
    });
  }


  if (shStammdaten && shStammdaten.getLastRow() > 1) {
    result.materialien = spaltenDatenHolen_(KONFIGURATION.TABELLEN.STAMMDATEN, 1).sort(function(a, b) {
      return a.localeCompare(b, "de");
    });
    result.brenner = spaltenDatenHolen_(KONFIGURATION.TABELLEN.STAMMDATEN, 3).sort(function(a, b) {
      return a.localeCompare(b, "de");
    });
    result.gewuerze = spaltenDatenHolen_(KONFIGURATION.TABELLEN.STAMMDATEN, 4).sort(function(a, b) {
      return a.localeCompare(b, "de");
    });
  }


  if (shEinstellungen) {
    const rawA1 = Number(shEinstellungen.getRange(1, 1).getValue()) || 0;
    const rawB1 = Number(shEinstellungen.getRange(1, 2).getValue()) || 0;
    const rawA2 = Number(shEinstellungen.getRange(2, 1).getValue()) || 0;
    const rawB2 = Number(shEinstellungen.getRange(2, 2).getValue()) || 0;
    const wert = rawA1 || rawB1 || rawA2 || rawB2 || 0;


    if (wert > 0) {
      result.maxBlase = wert;
    }
  }


  return result;
}


function holeVorgangsDatenFuerMaske(vId) {
  const id = textNormalisieren_(vId);
  if (!id) return null;


  const shVP = tabelleHolen_("VORPLANUNG");
  const shMA = tabelleHolen_("MAISCHEANNAHME");
  const shReg = tabelleHolen_("ZENTRALREGISTER");


  if (!shVP) return null;


  const sVP = spaltenZuordnungHolen_(shVP);
  const sMA = shMA ? spaltenZuordnungHolen_(shMA) : {};
  const sReg = shReg ? spaltenZuordnungHolen_(shReg) : {};


  const vpZeilen = alleZeilenMitVorgangsIdHolen_(shVP, id).sort(function(a, b) { return a - b; });
  if (vpZeilen.length === 0) return null;


  const daten = {
    vId: id,
    anruf: "",
    stoff: "",
    terminMaische: "",
    status: KONFIGURATION.STATUSWERTE.GEPLANT,
    faesser: []
  };


  const ersteVP = shVP.getRange(vpZeilen[0], 1, 1, shVP.getLastColumn()).getValues()[0];


  if (sVP.ANRUF_DATUM) daten.anruf = formatForDateInput_(ersteVP[sVP.ANRUF_DATUM - 1]);
  if (sVP.STOFFBESITZER) daten.stoff = textNormalisieren_(ersteVP[sVP.STOFFBESITZER - 1]);
  if (sVP.TERMIN_MAISCHE) daten.terminMaische = formatForDateInput_(ersteVP[sVP.TERMIN_MAISCHE - 1]);
  if (sVP.STATUS) daten.status = textNormalisieren_(ersteVP[sVP.STATUS - 1]) || KONFIGURATION.STATUSWERTE.GEPLANT;


  if (!daten.anruf && shReg) {
    const regZeile = ersteZeileMitVorgangsIdHolen_(shReg, id);
    if (regZeile > 1 && sReg.DATUM) {
      daten.anruf = formatForDateInput_(shReg.getRange(regZeile, sReg.DATUM).getValue());
    }
  }


  const maLookup = {};
  if (shMA) {
    const maZeilen = alleZeilenMitVorgangsIdHolen_(shMA, id).sort(function(a, b) { return a - b; });
    maZeilen.forEach(function(z, index) {
      const row = shMA.getRange(z, 1, 1, shMA.getLastColumn()).getValues()[0];
      maLookup[index] = {
        fassNr: sMA.FASS_NR ? row[sMA.FASS_NR - 1] : "",
        regNr: sMA.REGISTER_NR ? row[sMA.REGISTER_NR - 1] : "",
        zollOk: sMA.ZOLL_OK ? row[sMA.ZOLL_OK - 1] : "",
        ausbeute: sMA.AUSBEUTE ? row[sMA.AUSBEUTE - 1] : "",
        alkohol: sMA.ALKOHOL ? row[sMA.ALKOHOL - 1] : "",
        statusAktion: sMA.STATUS_AKTION ? row[sMA.STATUS_AKTION - 1] : "",
        dossierLink: sMA.DOSSIER_LINK ? row[sMA.DOSSIER_LINK - 1] : ""
      };
    });
  }


  vpZeilen.forEach(function(z, index) {
    const row = shVP.getRange(z, 1, 1, shVP.getLastColumn()).getValues()[0];
    const maAlt = maLookup[index] || {};


    daten.faesser.push({
      tagBrand: sVP.TAG_BRAND ? formatForDateInput_(row[sVP.TAG_BRAND - 1]) : "",
      von: sVP.VON ? textNormalisieren_(row[sVP.VON - 1]) : "",
      bis: sVP.BIS ? textNormalisieren_(row[sVP.BIS - 1]) : "",
      brenner: sVP.BRENNER ? textNormalisieren_(row[sVP.BRENNER - 1]) : "",
      material: sVP.MATERIAL ? textNormalisieren_(row[sVP.MATERIAL - 1]) : "",
      gewuerze: sVP.GEWUERZE ? textNormalisieren_(row[sVP.GEWUERZE - 1]) : "",
      fassgroesse: sVP.FASS_VP ? row[sVP.FASS_VP - 1] : "",
      inhalt: sVP.INH_VP ? row[sVP.INH_VP - 1] : "",
      anzahlBraende: sVP.ANZAHL_BRAENDE ? row[sVP.ANZAHL_BRAENDE - 1] : "",
      info: sVP.INFO_SYSTEM ? textNormalisieren_(row[sVP.INFO_SYSTEM - 1]) : "",
      fassNr: maAlt.fassNr || "",
      regNr: maAlt.regNr || "",
      zollOk: maAlt.zollOk || "",
      ausbeute: maAlt.ausbeute || "",
      alkohol: maAlt.alkohol || "",
      statusAktion: maAlt.statusAktion || "",
      dossierLink: maAlt.dossierLink || ""
    });
  });


  return daten;
}


// FUNKTION: Führt die stabile Nachverarbeitung einer gespeicherten Vorplanung aus | EINGRIFF: 📅_VORPLANUNG
function vorplanungNachverarbeiten_(shVP, sVP, vId) {
  // CHECK: Sind Blatt, Mapping und Vorgangs-ID verwertbar? | FOLGE: Abbruch bei Fehlstruktur
  if (!shVP || !sVP || !vId) return;


  // FUNKTION: Ermittelt alle aktuellen Zeilen des Vorgangs vor der Splittung | EINGRIFF: 02_BASISHELPER
  let zeilenVorSplit = alleZeilenMitVorgangsIdHolen_(shVP, vId);


  // FUNKTION: Sortiert die Zeilen absteigend, damit Splittung keine noch offenen Zeilen verschiebt | EINGRIFF: Zeilenstabilität
  zeilenVorSplit = zeilenVorSplit.sort(function(a, b) { return b - a; });


  // FUNKTION: Führt die mengenbezogene Nachverarbeitung pro Zeile aus | EINGRIFF: 04_WORKFLOWSERVICE
  zeilenVorSplit.forEach(function(z) {
    if (sVP.INH_VP) {
      vorplanungEditVerarbeiten_(z, sVP.INH_VP);
    }
  });


  // FUNKTION: Ermittelt nach möglicher Splittung die realen aktuellen Zeilen des Vorgangs neu | EINGRIFF: 02_BASISHELPER
  let zeilenAktuell = alleZeilenMitVorgangsIdHolen_(shVP, vId);


  // FUNKTION: Sortiert die aktuellen Zeilen aufsteigend für den Zeitnachlauf | EINGRIFF: Zeilenlauf
  zeilenAktuell = zeilenAktuell.sort(function(a, b) { return a - b; });


  // FUNKTION: Führt den zeitlichen Nachlauf auf der realen aktuellen Datenlage aus | EINGRIFF: 04_WORKFLOWSERVICE
  zeilenAktuell.forEach(function(z) {
    if (sVP.TAG_BRAND) {
      vorplanungEditVerarbeiten_(z, sVP.TAG_BRAND);
    }
    if (sVP.VON) {
      vorplanungEditVerarbeiten_(z, sVP.VON);
    }
  });
}


function vorplanungMaskeSpeichern(payload) {
  return mitSperreAusfuehren_(function() {
    const shVP = tabelleHolen_("VORPLANUNG");
    const shMA = tabelleHolen_("MAISCHEANNAHME");


    if (!shVP) {
      throw new Error("Vorplanung nicht gefunden.");
    }


    const sVP = spaltenZuordnungHolen_(shVP);
    const sMA = shMA ? spaltenZuordnungHolen_(shMA) : {};


    const stoff = textNormalisieren_(payload && (payload.stoff || payload.stoffbesitzer));
    if (!stoff) {
      throw new Error("Stoffbesitzer fehlt.");
    }


    const zielStatus = textNormalisieren_(payload && payload.status) || KONFIGURATION.STATUSWERTE.GEPLANT;
    const uebergebeneVId = textNormalisieren_(payload && payload.vId);
    const vId = uebergebeneVId || vorgangsIdSicherstellen_(stoff);


    if (!vId) {
      throw new Error("Vorgangs_ID konnte nicht erzeugt werden.");
    }


    const faesser = Array.isArray(payload && payload.faesser) ? payload.faesser : [];
    if (faesser.length === 0) {
      throw new Error("Es wurden keine Fässer übergeben.");
    }


    const bestehendeMA = shMA ? alleZeilenMitVorgangsIdHolen_(shMA, vId).sort(function(a, b) { return a - b; }) : [];
    const maLookup = {};
    bestehendeMA.forEach(function(z, index) {
      const row = shMA.getRange(z, 1, 1, shMA.getLastColumn()).getValues()[0];
      maLookup[index] = {
        fassNr: sMA.FASS_NR ? row[sMA.FASS_NR - 1] : "",
        regNr: sMA.REGISTER_NR ? row[sMA.REGISTER_NR - 1] : "",
        zollOk: sMA.ZOLL_OK ? row[sMA.ZOLL_OK - 1] : "",
        alkohol: sMA.ALKOHOL ? row[sMA.ALKOHOL - 1] : "",
        ausbeute: sMA.AUSBEUTE ? row[sMA.AUSBEUTE - 1] : "",
        statusAktion: sMA.STATUS_AKTION ? row[sMA.STATUS_AKTION - 1] : "",
        dossierLink: sMA.DOSSIER_LINK ? row[sMA.DOSSIER_LINK - 1] : ""
      };
    });


    const alteVPZeilen = alleZeilenMitVorgangsIdHolen_(shVP, vId);
    if (alteVPZeilen.length > 0) {
      alteVPZeilen.sort(function(a, b) { return b - a; });
      alteVPZeilen.forEach(function(z) {
        shVP.deleteRow(z);
      });
    }


    const neueZeilen = [];


    faesser.forEach(function(fass, index) {
      const maAlt = maLookup[index] || {};
      const zeile = new Array(shVP.getLastColumn()).fill("");


      if (sVP.VORGANGS_ID) zeile[sVP.VORGANGS_ID - 1] = vId;
      if (sVP.ANRUF_DATUM) zeile[sVP.ANRUF_DATUM - 1] = payload.anrufDatum || payload.anruf || new Date();
      if (sVP.TERMIN_MAISCHE) zeile[sVP.TERMIN_MAISCHE - 1] = fass.terminMaische || payload.terminMaische || "";
      if (sVP.STOFFBESITZER) zeile[sVP.STOFFBESITZER - 1] = stoff;
      if (sVP.TAG_BRAND) zeile[sVP.TAG_BRAND - 1] = fass.tagBrand || payload.tagBrand || "";
      if (sVP.VON) zeile[sVP.VON - 1] = textNormalisieren_(fass.von);
      if (sVP.BIS) zeile[sVP.BIS - 1] = textNormalisieren_(fass.bis);
      if (sVP.BRENNER) zeile[sVP.BRENNER - 1] = textNormalisieren_(fass.brenner);
      if (sVP.MATERIAL) zeile[sVP.MATERIAL - 1] = textNormalisieren_(fass.material);
      if (sVP.GEWUERZE) zeile[sVP.GEWUERZE - 1] = textNormalisieren_(fass.gewuerze);
      if (sVP.FASS_VP) zeile[sVP.FASS_VP - 1] = fass.fassgroesse != null ? fass.fassgroesse : "";
      if (sVP.INH_VP) zeile[sVP.INH_VP - 1] = fass.inhalt != null ? fass.inhalt : "";
      if (sVP.ANZAHL_BRAENDE) {
        const inhaltNum = Number(fass.inhalt) || 0;
        const braende = Number(fass.anzahlBraende) || (inhaltNum > 0 ? Math.max(1, Math.ceil(inhaltNum / (Number(KONFIGURATION.IDENTITAET.MAX_BLASE) || 120))) : 1);
        zeile[sVP.ANZAHL_BRAENDE - 1] = braende;
      }
      if (sVP.STATUS) zeile[sVP.STATUS - 1] = zielStatus;
      if (sVP.INFO_SYSTEM) zeile[sVP.INFO_SYSTEM - 1] = "";


      fass.fassNr = textNormalisieren_(fass.fassNr || maAlt.fassNr || "");
      fass.regNr = textNormalisieren_(fass.regNr || maAlt.regNr || "");
      fass.zollOk = textNormalisieren_(fass.zollOk || maAlt.zollOk || "");
      fass.alkohol = fass.alkohol != null && fass.alkohol !== "" ? fass.alkohol : maAlt.alkohol || "";
      fass.ausbeute = fass.ausbeute != null && fass.ausbeute !== "" ? fass.ausbeute : maAlt.ausbeute || "";
      fass.statusAktion = textNormalisieren_(fass.statusAktion || maAlt.statusAktion || "");
      fass.dossierLink = textNormalisieren_(fass.dossierLink || maAlt.dossierLink || "");


      neueZeilen.push(zeile);
    });


    const startZeile = shVP.getLastRow() + 1;
    shVP.getRange(startZeile, 1, neueZeilen.length, shVP.getLastColumn()).setValues(neueZeilen);
    SpreadsheetApp.flush();


    // FUNKTION: Führt die stabile Nachverarbeitung des gespeicherten Vorgangs aus | EINGRIFF: 09_MASKENSERVICE
    vorplanungNachverarbeiten_(shVP, sVP, vId);


    if (zielStatus === KONFIGURATION.STATUSWERTE.UEBERNOMMEN) {
      vorplanungsBlockZuVorgangUmsetzen_(0, vId);


      if (shMA) {
        const zeilenMA = alleZeilenMitVorgangsIdHolen_(shMA, vId).sort(function(a, b) { return a - b; });
        zeilenMA.forEach(function(z, index) {
          const fass = faesser[index] || {};


          if (sMA.FASS_NR && String(fass.fassNr || "") !== "") {
            shMA.getRange(z, sMA.FASS_NR).setValue(fass.fassNr);
          }
          if (sMA.REGISTER_NR && String(fass.regNr || "") !== "") {
            shMA.getRange(z, sMA.REGISTER_NR).setValue(fass.regNr);
          }
          if (sMA.ZOLL_OK && String(fass.zollOk || "") !== "") {
            shMA.getRange(z, sMA.ZOLL_OK).setValue(fass.zollOk);
          }
          if (sMA.ALKOHOL && String(fass.alkohol || "") !== "") {
            shMA.getRange(z, sMA.ALKOHOL).setValue(fass.alkohol);
          }
          if (sMA.AUSBEUTE && String(fass.ausbeute || "") !== "") {
            shMA.getRange(z, sMA.AUSBEUTE).setValue(fass.ausbeute);
          }
          if (sMA.STATUS_AKTION && String(fass.statusAktion || "") !== "") {
            shMA.getRange(z, sMA.STATUS_AKTION).setValue(fass.statusAktion);
          }
          if (sMA.DOSSIER_LINK && String(fass.dossierLink || "") !== "") {
            shMA.getRange(z, sMA.DOSSIER_LINK).setValue(fass.dossierLink);
          }
        });
      }
    } else {
      registerStatusAktualisieren_(vId, KONFIGURATION.STATUSWERTE.GEPLANT);
    }


    systemLogSchreiben_("INFO", "MaskenService", "Vorplanung aus Maske gespeichert", vId, "Fässer: " + faesser.length + " | Status: " + zielStatus);


    return {
      ok: true,
      vId: vId,
      status: zielStatus
    };
  }, "vorplanungMaskeSpeichern");
}


function vorgangSpeichern(payload) {
  return vorplanungMaskeSpeichern(payload);
}/**
 * DATEI: 09_MASKENSERVICE.GS
 * SERVERSEITIGER SELBSTTEST FÜR DIE EINGABEMASKE
 */

// FUNKTION: Führt einen serverseitigen Selbsttest der Maskenlogik aus | EINGRIFF: Tabellen, Stammdaten, Edit-Ladekette
function maskenServerSelbsttest_() {
  // FUNKTION: Initialisiert den Ergebnisbericht | EINGRIFF: Datenstruktur
  const report = {
    ok: true,
    zeitpunkt: Utilities.formatDate(new Date(), KONFIGURATION.ZOLL_PARAMETER.ZEIT_PARAMETER.ZEITZONE, "dd.MM.yyyy HH:mm:ss"),
    testVId: "",
    details: []
  };

  try {
    // FUNKTION: Referenziert die für die Maske relevanten Tabellen | EINGRIFF: 01_CONFIG / Spreadsheet
    const shMitglieder = tabelleHolen_("MITGLIEDER");
    const shStammdaten = tabelleHolen_("STAMMDATEN");
    const shVorplanung = tabelleHolen_("VORPLANUNG");
    const shMaische = tabelleHolen_("MAISCHEANNAHME");

    // CHECK: Existiert das Mitgliederblatt? | FOLGE: Prüfung möglich
    maskenSelbsttestEintrag_(report, !!shMitglieder ? "INFO" : "ERROR", "TABELLEN", !!shMitglieder ? "Mitgliederblatt vorhanden." : "Mitgliederblatt fehlt.");

    // CHECK: Existiert das Stammdatenblatt? | FOLGE: Prüfung möglich
    maskenSelbsttestEintrag_(report, !!shStammdaten ? "INFO" : "ERROR", "TABELLEN", !!shStammdaten ? "Stammdatenblatt vorhanden." : "Stammdatenblatt fehlt.");

    // CHECK: Existiert das Vorplanungsblatt? | FOLGE: Prüfung möglich
    maskenSelbsttestEintrag_(report, !!shVorplanung ? "INFO" : "ERROR", "TABELLEN", !!shVorplanung ? "Vorplanungsblatt vorhanden." : "Vorplanungsblatt fehlt.");

    // CHECK: Existiert das Maischeblatt? | FOLGE: optionale Zusatzprüfung möglich
    maskenSelbsttestEintrag_(report, !!shMaische ? "INFO" : "WARN", "TABELLEN", !!shMaische ? "Maischeannahmeblatt vorhanden." : "Maischeannahmeblatt fehlt oder nicht erreichbar.");

    // CHECK: Ist die Vorplanung vorhanden? | FOLGE: Pflichtabbruch bei Kernfehler
    if (!shVorplanung) {
      throw new Error("Pflichttabelle VORPLANUNG fehlt.");
    }

    // FUNKTION: Prüft die Kernheader des Mitgliederblatts | EINGRIFF: Strukturprüfung
    maskenPflichtspaltenPruefen_(report, shMitglieder, ["NameAnzeige"], "MITGLIEDER");

    // FUNKTION: Prüft die Kernheader des Vorplanungsblatts | EINGRIFF: Strukturprüfung
    maskenPflichtspaltenPruefen_(
      report,
      shVorplanung,
      [
        KONFIGURATION.SPALTEN.VORGANGS_ID,
        KONFIGURATION.SPALTEN.ANRUF_DATUM,
        KONFIGURATION.SPALTEN.STOFFBESITZER,
        KONFIGURATION.SPALTEN.TERMIN_MAISCHE,
        KONFIGURATION.SPALTEN.MATERIAL,
        KONFIGURATION.SPALTEN.INH_VP,
        KONFIGURATION.SPALTEN.STATUS
      ],
      "VORPLANUNG"
    );

    // FUNKTION: Führt die Stammdatenlieferung der Maske aus | EINGRIFF: Serverlogik
    const stammdaten = getMaskenStammdaten();

    // CHECK: Wurden Stammdaten geliefert? | FOLGE: Ergebnisprotokoll
    maskenSelbsttestEintrag_(report, stammdaten ? "INFO" : "ERROR", "STAMMDATEN", stammdaten ? "getMaskenStammdaten() liefert ein Objekt." : "getMaskenStammdaten() liefert kein Objekt.");

    // CHECK: Liegen Stoffbesitzer aus NameAnzeige vor? | FOLGE: Ergebnisprotokoll
    maskenSelbsttestEintrag_(
      report,
      (stammdaten && Array.isArray(stammdaten.mitglieder) && stammdaten.mitglieder.length > 0) ? "INFO" : "ERROR",
      "STAMMDATEN",
      (stammdaten && Array.isArray(stammdaten.mitglieder) && stammdaten.mitglieder.length > 0)
        ? ("Mitgliederliste vorhanden: " + stammdaten.mitglieder.length)
        : "Mitgliederliste leer oder nicht befüllt."
    );

    // CHECK: Liegen Materialstammdaten vor? | FOLGE: Ergebnisprotokoll
    maskenSelbsttestEintrag_(
      report,
      (stammdaten && Array.isArray(stammdaten.materialien) && stammdaten.materialien.length > 0) ? "INFO" : "WARN",
      "STAMMDATEN",
      (stammdaten && Array.isArray(stammdaten.materialien) && stammdaten.materialien.length > 0)
        ? ("Materialien vorhanden: " + stammdaten.materialien.length)
        : "Materialliste leer."
    );

    // CHECK: Liegen Brennerstammdaten vor? | FOLGE: Ergebnisprotokoll
    maskenSelbsttestEintrag_(
      report,
      (stammdaten && Array.isArray(stammdaten.brenner) && stammdaten.brenner.length > 0) ? "INFO" : "WARN",
      "STAMMDATEN",
      (stammdaten && Array.isArray(stammdaten.brenner) && stammdaten.brenner.length > 0)
        ? ("Brenner vorhanden: " + stammdaten.brenner.length)
        : "Brennerliste leer."
    );

    // FUNKTION: Ermittelt eine echte Test-Vorgangs-ID aus der Vorplanung | EINGRIFF: Edit-Ladekette
    const testVId = maskenTestVorgangsIdErmitteln_();
    report.testVId = testVId || "";

    // CHECK: Wurde eine Test-ID gefunden? | FOLGE: Edit-Ladekette ausführen
    if (testVId) {
      // FUNKTION: Führt das serverseitige Laden eines bestehenden Vorgangs aus | EINGRIFF: Masken-Edit-Logik
      const daten = holeVorgangsDatenFuerMaske(testVId);

      // CHECK: Liefert der Edit-Lader ein Objekt? | FOLGE: Ergebnisprotokoll
      maskenSelbsttestEintrag_(report, daten ? "INFO" : "ERROR", "EDIT-LADEN", daten ? "holeVorgangsDatenFuerMaske() liefert ein Objekt." : "holeVorgangsDatenFuerMaske() liefert kein Objekt.");

      // CHECK: Enthält das Objekt die erwartete Vorgangs-ID? | FOLGE: Ergebnisprotokoll
      maskenSelbsttestEintrag_(
        report,
        (daten && textNormalisieren_(daten.vId) === textNormalisieren_(testVId)) ? "INFO" : "ERROR",
        "EDIT-LADEN",
        (daten && textNormalisieren_(daten.vId) === textNormalisieren_(testVId))
          ? "Vorgangs-ID der Edit-Ladung stimmt."
          : "Vorgangs-ID der Edit-Ladung stimmt nicht."
      );

      // CHECK: Enthält das Objekt einen Stoffbesitzer? | FOLGE: Ergebnisprotokoll
      maskenSelbsttestEintrag_(
        report,
        (daten && textNormalisieren_(daten.stoff)) ? "INFO" : "ERROR",
        "EDIT-LADEN",
        (daten && textNormalisieren_(daten.stoff))
          ? ("Stoffbesitzer geladen: " + textNormalisieren_(daten.stoff))
          : "Stoffbesitzer fehlt in der Edit-Ladung."
      );

      // CHECK: Enthält das Objekt eine Fassliste? | FOLGE: Ergebnisprotokoll
      maskenSelbsttestEintrag_(
        report,
        (daten && Array.isArray(daten.faesser) && daten.faesser.length > 0) ? "INFO" : "ERROR",
        "EDIT-LADEN",
        (daten && Array.isArray(daten.faesser) && daten.faesser.length > 0)
          ? ("Fässer geladen: " + daten.faesser.length)
          : "Fassliste leer oder nicht vorhanden."
      );
    } else {
      // FUNKTION: Meldet das Fehlen einer Test-ID als Warnung | EINGRIFF: Ergebnisprotokoll
      maskenSelbsttestEintrag_(report, "WARN", "EDIT-LADEN", "Keine echte Vorgangs-ID in der Vorplanung gefunden. Edit-Ladetest wurde übersprungen.");
    }

    // FUNKTION: Prüft den Payload-Aufbau syntaktisch serverseitig | EINGRIFF: Masken-Speicherlogik
    const payloadTest = {
      vId: "",
      anrufDatum: Utilities.formatDate(new Date(), KONFIGURATION.ZOLL_PARAMETER.ZEIT_PARAMETER.ZEITZONE, "yyyy-MM-dd"),
      stoff: (stammdaten && Array.isArray(stammdaten.mitglieder) && stammdaten.mitglieder.length > 0) ? stammdaten.mitglieder[0] : "",
      terminMaische: "",
      status: KONFIGURATION.STATUSWERTE.GEPLANT,
      faesser: [
        {
          tagBrand: "",
          von: "",
          bis: "",
          brenner: "",
          material: (stammdaten && Array.isArray(stammdaten.materialien) && stammdaten.materialien.length > 0) ? stammdaten.materialien[0] : "",
          gewuerze: "",
          fassgroesse: 120,
          inhalt: 100,
          anzahlBraende: 1,
          info: "",
          fassNr: "",
          regNr: "",
          zollOk: "",
          ausbeute: "",
          alkohol: "",
          statusAktion: "",
          dossierLink: ""
        }
      ]
    };

    // FUNKTION: Validiert den Test-Payload ohne zu speichern | EINGRIFF: Vorprüfung
    maskenPayloadVorpruefen_(report, payloadTest);

  } catch (e) {
    // FUNKTION: Protokolliert den Gesamtfehler im Bericht | EINGRIFF: Fehlerbehandlung
    maskenSelbsttestEintrag_(report, "ERROR", "SELBSTTEST", String(e));
  }

  // FUNKTION: Verdichtet das Berichtsergebnis auf einen Gesamtstatus | EINGRIFF: Ergebnislogik
  report.ok = !report.details.some(function(eintrag) { return eintrag.level === "ERROR"; });

  // FUNKTION: Gibt den vollständigen Bericht zurück | EINGRIFF: API-Rückgabe
  return report;
}


// FUNKTION: Prüft erforderliche Header in einem Tabellenblatt | EINGRIFF: Strukturprüfung
function maskenPflichtspaltenPruefen_(report, blatt, erwarteteHeader, modul) {
  // CHECK: Ist das Blatt vorhanden? | FOLGE: Abbruch bei fehlender Tabelle
  if (!blatt) {
    maskenSelbsttestEintrag_(report, "ERROR", modul, "Pflichtblatt fehlt.");
    return;
  }

  // FUNKTION: Liest die Headerzeile des Blatts | EINGRIFF: Tabellenstruktur
  const header = blatt.getRange(1, 1, 1, Math.max(blatt.getLastColumn(), 1)).getValues()[0].map(textNormalisieren_);

  // FUNKTION: Iteriert über alle erwarteten Header | EINGRIFF: Strukturvergleich
  erwarteteHeader.forEach(function(h) {
    // CHECK: Ist der erwartete Header vorhanden? | FOLGE: Ergebnisprotokoll
    maskenSelbsttestEintrag_(
      report,
      header.indexOf(textNormalisieren_(h)) > -1 ? "INFO" : "ERROR",
      modul,
      header.indexOf(textNormalisieren_(h)) > -1 ? ('Pflichtspalte vorhanden: "' + h + '"') : ('Pflichtspalte fehlt: "' + h + '"')
    );
  });
}


// FUNKTION: Ermittelt eine echte Test-Vorgangs-ID aus der Vorplanung | EINGRIFF: Edit-Ladekette
function maskenTestVorgangsIdErmitteln_() {
  // FUNKTION: Referenziert die Vorplanung | EINGRIFF: 01_CONFIG
  const shVP = tabelleHolen_("VORPLANUNG");
  // CHECK: Ist das Blatt vorhanden und hat Datenzeilen? | FOLGE: Suche möglich
  if (!shVP || shVP.getLastRow() < 2) return "";

  // FUNKTION: Liest das Spalten-Mapping | EINGRIFF: 02_BASISHELPER
  const sVP = spaltenZuordnungHolen_(shVP);
  // CHECK: Gibt es eine ID-Spalte? | FOLGE: Suche möglich
  if (!sVP.VORGANGS_ID) return "";

  // FUNKTION: Liest alle ID-Werte der Vorplanung | EINGRIFF: Tabellenzugriff
  const ids = shVP.getRange(2, sVP.VORGANGS_ID, shVP.getLastRow() - 1, 1).getValues();

  // FUNKTION: Sucht die erste verwertbare ID | EINGRIFF: Suchlogik
  for (let i = 0; i < ids.length; i++) {
    const id = textNormalisieren_(ids[i][0]);
    if (id) return id;
  }

  // FUNKTION: Gibt bei fehlender ID einen Leerwert zurück | EINGRIFF: API-Rückgabe
  return "";
}


// FUNKTION: Prüft einen Masken-Payload syntaktisch ohne Speichern | EINGRIFF: Vorprüfung
function maskenPayloadVorpruefen_(report, payload) {
  // FUNKTION: Normalisiert den Stoffbesitzer | EINGRIFF: String-Prüfung
  const stoff = textNormalisieren_(payload && (payload.stoff || payload.stoffbesitzer));
  // FUNKTION: Normalisiert die Fassliste | EINGRIFF: Strukturprüfung
  const faesser = Array.isArray(payload && payload.faesser) ? payload.faesser : [];

  // CHECK: Ist ein Stoffbesitzer enthalten? | FOLGE: Ergebnisprotokoll
  maskenSelbsttestEintrag_(report, stoff ? "INFO" : "ERROR", "PAYLOAD", stoff ? "Payload enthält Stoffbesitzer." : "Payload enthält keinen Stoffbesitzer.");

  // CHECK: Ist mindestens ein Fass enthalten? | FOLGE: Ergebnisprotokoll
  maskenSelbsttestEintrag_(report, faesser.length > 0 ? "INFO" : "ERROR", "PAYLOAD", faesser.length > 0 ? ("Payload enthält Fässer: " + faesser.length) : "Payload enthält keine Fässer.");

  // CHECK: Enthält das erste Fass Material oder Inhalt? | FOLGE: Ergebnisprotokoll
  if (faesser.length > 0) {
    const erstes = faesser[0] || {};
    const material = textNormalisieren_(erstes.material);
    const inhalt = Number(erstes.inhalt) || 0;

    maskenSelbsttestEintrag_(report, material ? "INFO" : "WARN", "PAYLOAD", material ? ("Erstes Fass enthält Material: " + material) : "Erstes Fass enthält kein Material.");
    maskenSelbsttestEintrag_(report, inhalt > 0 ? "INFO" : "WARN", "PAYLOAD", inhalt > 0 ? ("Erstes Fass enthält Inhalt: " + inhalt) : "Erstes Fass enthält keinen positiven Inhalt.");
  }
}


// FUNKTION: Fügt dem Bericht einen Eintrag hinzu und schreibt ihn direkt ins Systemlog | EINGRIFF: Bericht / Log
function maskenSelbsttestEintrag_(report, level, modul, text) {
  // FUNKTION: Baut den Berichtseintrag | EINGRIFF: Datenstruktur
  const eintrag = {
    level: level,
    modul: modul,
    text: text
  };

  // FUNKTION: Hängt den Eintrag an den Bericht an | EINGRIFF: Datenstruktur
  report.details.push(eintrag);

  // FUNKTION: Schreibt jeden Berichtseintrag sofort zusätzlich ins Systemlog | EINGRIFF: SYSTEM_LOG
  systemLogSchreiben_(level, "MaskenSelbsttest", modul, report.testVId || "", text);
}