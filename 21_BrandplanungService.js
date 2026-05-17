/**
 * DATEI: 21_BrandplanungService.gs
 * ZWECK:
 * Fachlogik für 🗓️_BRANDTAGE_PLANUNG
 *
 * UMFANG:
 * - offene Vorgänge aus 📆_VORPLANUNG laden
 * - Anzeige mit vollständigem Namen plus Vorgangs_ID
 * - Bemerkung aus Vorplanung übernehmen
 * - bestehende Brandplanung eines Vorgangs laden
 * - Datum_Maischeannahme, Brandtag, Brenner, Zeitslots speichern
 * - mehrere Brandtage pro Vorgang in einem Speichervorgang
 * - vorhandene Planung dieses Vorgangs überschreiben
 * - Übergabe nach 🍎_MAISCHEANNAHME
 * - Dossier_Link aus 📆_VORPLANUNG in 🍎_MAISCHEANNAHME übernehmen
 * - Uhrzeiten in 🍎_MAISCHEANNAHME als reine Uhrzeit schreiben
 * - STATUS der 🍎_MAISCHEANNAHME bei Übergabe bewusst nicht setzen
 * - optional Checklistenversand direkt nach erfolgreicher Speicherung anstoßen
 */


/* =========================
   HAUPTFUNKTIONEN
   ========================= */

function ladeOffeneVorplanungFuerBrandplanung() {
  const shVor = tabelleHolen_("VORPLANUNG");
  if (!shVor) {
    throw new Error("Tabelle 📆_VORPLANUNG nicht gefunden.");
  }

  const pruefungVor = pruefePflichtspalten_(shVor, [
    "VORGANGS_ID",
    "STOFFBESITZER",
    "BEMERKUNG",
    "STATUS"
  ]);

  if (!pruefungVor.ok) {
    throw new Error("Pflichtspalten in 📆_VORPLANUNG fehlen: " + pruefungVor.missing.join(", "));
  }

  const sVor = pruefungVor.map;
  const datenVor = shVor.getDataRange().getValues();
  const vorgaenge = [];

  for (let i = 1; i < datenVor.length; i++) {
    const row = datenVor[i];

    const vorgangsId = textNormalisieren_(row[sVor.VORGANGS_ID - 1]);
    const stoffbesitzer = textNormalisieren_(row[sVor.STOFFBESITZER - 1]);
    const bemerkungVorplanung = textNormalisieren_(row[sVor.BEMERKUNG - 1]);
    const status = textNormalisieren_(row[sVor.STATUS - 1]);

    if (!vorgangsId) continue;
    if (!stoffbesitzer) continue;
    if (!istOffenerVorplanungStatusFuerBrandplanung_(status)) continue;

    vorgaenge.push({
      vorgangsId: vorgangsId,
      stoffbesitzer: stoffbesitzer,
      bemerkungVorplanung: bemerkungVorplanung,
      status: status,
      anzeige: stoffbesitzer + " | " + vorgangsId
    });
  }

  vorgaenge.sort(function(a, b) {
    return String(a.anzeige).localeCompare(String(b.anzeige), "de");
  });

  systemLogSchreibenSicher_(
    "INFO",
    "BrandplanungService",
    "Offene Vorplanung geladen",
    "",
    "Treffer: " + vorgaenge.length
  );

  return {
    vorgaenge: vorgaenge
  };
}

function ladeVorplanungFuerBrandplanung(vorgangsId) {
  const vId = textNormalisieren_(vorgangsId);
  if (!vId) {
    throw new Error("Vorgangs-ID fehlt.");
  }

  const vorplanung = vorplanungNachVorgangsIdHolen_(vId);
  if (!vorplanung) {
    throw new Error("Vorplanung zu Vorgangs-ID nicht gefunden: " + vId);
  }

  const details = holeBrandplanungDetailsFuerVorgang_(vId);

  if (details) {
    return {
      vorgangsId: vorplanung.vorgangsId,
      stoffbesitzer: vorplanung.stoffbesitzer,
      bemerkungVorplanung: vorplanung.bemerkungVorplanung,
      status: vorplanung.status,
      anzeige: vorplanung.stoffbesitzer + " | " + vorplanung.vorgangsId,
      datumMaischeannahmeGlobal: details.datumMaischeannahmeGlobal,
      anzahlBraendeGlobal: details.anzahlBraendeGlobal,
      statusGlobal: details.statusGlobal,
      planungen: details.planungen
    };
  }

  return {
    vorgangsId: vorplanung.vorgangsId,
    stoffbesitzer: vorplanung.stoffbesitzer,
    bemerkungVorplanung: vorplanung.bemerkungVorplanung,
    status: vorplanung.status,
    anzeige: vorplanung.stoffbesitzer + " | " + vorplanung.vorgangsId,
    datumMaischeannahmeGlobal: "",
    anzahlBraendeGlobal: "1",
    statusGlobal: KONFIGURATION.STATUSWERTE.TERMINIERT,
    planungen: []
  };
}

/**
 * Erwartetes payload:
 * {
 *   vorgangsId,
 *   planungen: [
 *     {
 *       datumMaischeannahme,
 *       brandtag,
 *       brenner,
 *       zeitslotVon,
 *       zeitslotBis,
 *       bemerkungIntern,
 *       status
 *     }
 *   ]
 * }
 */
function speichereBrandplanung(payload) {
  return mitSperreAusfuehren_(function() {
    if (!payload) {
      throw new Error("Payload fehlt.");
    }

    const vorgangsId = textNormalisieren_(payload.vorgangsId);
    const planungenRaw = Array.isArray(payload.planungen) ? payload.planungen : [];
    const checklisteVersenden = payload.checklisteVersenden === true;

    if (!vorgangsId) {
      throw new Error("Vorgangs-ID fehlt.");
    }

    if (!planungenRaw.length) {
      throw new Error("Es wurden keine Brandtage übergeben.");
    }

    const vorplanung = vorplanungNachVorgangsIdHolen_(vorgangsId);
    if (!vorplanung) {
      throw new Error("Vorplanung zu Vorgangs-ID nicht gefunden: " + vorgangsId);
    }

    const sh = tabelleHolen_("BRANDTAGE_PLANUNG");
    if (!sh) {
      throw new Error("Tabelle 🗓️_BRANDTAGE_PLANUNG nicht gefunden.");
    }

    const pruefung = pruefePflichtspalten_(sh, [
      "PLANUNG_ID",
      "VORGANGS_ID",
      "STOFFBESITZER",
      "BEMERKUNG_VORPLANUNG",
      "STATUS",
      "DATUM_MAISCHEANNAHME",
      "BRANDTAG",
      "BRENNER",
      "ZEITSLOT_VON",
      "ZEITSLOT_BIS",
      "BEMERKUNG_INTERN",
      "ERSTELLT_AM",
      "GEAENDERT_AM"
    ]);

    if (!pruefung.ok) {
      throw new Error("Pflichtspalten in 🗓️_BRANDTAGE_PLANUNG fehlen: " + pruefung.missing.join(", "));
    }

    const sMap = pruefung.map;

    if (brandplanungExistiertFuerVorgang_(sh, sMap, vorgangsId)) {
      loescheBrandplanungFuerVorgang_(sh, sMap, vorgangsId);
    }

    const planungen = planungenRaw.map(function(item, index) {
      return normalisiereBrandplanungsEintrag_(item, index + 1);
    });

    pruefeDoppelteBrandplanungseintraege_(planungen);

    const jetzt = new Date();
    const startZeile = sh.getLastRow() + 1;
    const zeilen = [];
    const planungIds = [];

    for (let i = 0; i < planungen.length; i++) {
      const eintrag = planungen[i];
      const planungId = neueBrandplanungId_();
      const zeile = new Array(sh.getLastColumn()).fill("");

      zeile[sMap.PLANUNG_ID - 1] = planungId;
      zeile[sMap.VORGANGS_ID - 1] = vorplanung.vorgangsId;
      zeile[sMap.STOFFBESITZER - 1] = vorplanung.stoffbesitzer;
      zeile[sMap.BEMERKUNG_VORPLANUNG - 1] = vorplanung.bemerkungVorplanung;
      zeile[sMap.STATUS - 1] = eintrag.status;
      zeile[sMap.DATUM_MAISCHEANNAHME - 1] = eintrag.datumMaischeannahme;
      zeile[sMap.BRANDTAG - 1] = eintrag.brandtag;
      zeile[sMap.BRENNER - 1] = eintrag.brenner;
      zeile[sMap.ZEITSLOT_VON - 1] = eintrag.zeitslotVon;
      zeile[sMap.ZEITSLOT_BIS - 1] = eintrag.zeitslotBis;
      if (sMap.ANZAHL_BRAENDE) zeile[sMap.ANZAHL_BRAENDE - 1] = eintrag.anzahlBraende;
      zeile[sMap.BEMERKUNG_INTERN - 1] = eintrag.bemerkungIntern;
      zeile[sMap.ERSTELLT_AM - 1] = jetzt;
      zeile[sMap.GEAENDERT_AM - 1] = jetzt;

      zeilen.push(zeile);
      planungIds.push(planungId);
    }

    sh.getRange(startZeile, 1, zeilen.length, sh.getLastColumn()).setValues(zeilen);

    for (let i = 0; i < zeilen.length; i++) {
      const z = startZeile + i;
      sh.getRange(z, sMap.DATUM_MAISCHEANNAHME).setNumberFormat("dd.MM.yyyy");
      sh.getRange(z, sMap.BRANDTAG).setNumberFormat("dd.MM.yyyy");
      sh.getRange(z, sMap.ZEITSLOT_VON).setNumberFormat("HH:mm");
      sh.getRange(z, sMap.ZEITSLOT_BIS).setNumberFormat("HH:mm");
      sh.getRange(z, sMap.ERSTELLT_AM).setNumberFormat("dd.MM.yyyy HH:mm");
      sh.getRange(z, sMap.GEAENDERT_AM).setNumberFormat("dd.MM.yyyy HH:mm");
    }

    const letzterStatus = planungen[planungen.length - 1].status;

    if (letzterStatus === KONFIGURATION.STATUSWERTE.IN_MAISCHEANNAHME_UEBERGEBEN) {
      uebertrageBrandplanungNachMaischeannahme_(vorplanung, planungen);
    }

    aktualisiereVorplanungStatusNachBrandplanung_(vorplanung.zeile, letzterStatus);

    if (typeof registereintragSicherstellen_ === "function") {
      registereintragSicherstellen_(vorgangsId, vorplanung.stoffbesitzer, letzterStatus);
    }

    if (typeof registerStatusAktualisieren_ === "function") {
      registerStatusAktualisieren_(vorgangsId, letzterStatus);
    }

    let checklistenErgebnis = {
      ok: false,
      versendet: false,
      kanal: "",
      empfaenger: "",
      hinweis: ""
    };

    if (checklisteVersenden && typeof pruefeUndVersendeChecklisteNachBrandplanung === "function") {
      try {
        checklistenErgebnis = pruefeUndVersendeChecklisteNachBrandplanung(vorgangsId);
      } catch (e) {
        checklistenErgebnis = {
          ok: false,
          versendet: false,
          kanal: "",
          empfaenger: "",
          hinweis: "Brandplanung gespeichert. Checkliste konnte nicht erzeugt oder versendet werden: " + String(e)
        };

        systemLogSchreibenSicher_(
          "WARN",
          "BrandplanungService",
          "Checkliste nach Brandplanung fehlgeschlagen",
          vorgangsId,
          String(e)
        );
      }
    }

    systemLogSchreibenSicher_(
      "INFO",
      "BrandplanungService",
      "Brandplanung gespeichert",
      vorgangsId,
      "Anzahl Datensätze: " + planungen.length + " | Planung_IDs: " + planungIds.join(", ")
    );

    return {
      ok: true,
      planungIds: planungIds,
      anzahl: planungen.length,
      vorgangsId: vorplanung.vorgangsId,
      stoffbesitzer: vorplanung.stoffbesitzer,
      bemerkungVorplanung: vorplanung.bemerkungVorplanung,
      status: letzterStatus,
      checkliste: checklistenErgebnis
    };
  }, "speichereBrandplanung");
}


/* =========================
   NORMALISIERUNG / VALIDIERUNG
   ========================= */

function normalisiereBrandplanungsEintrag_(payload, nummer) {
  if (!payload) {
    throw new Error("Brandplanungseintrag " + nummer + " fehlt.");
  }

  const datumMaischeannahme = datumFuerBrandplanung_(payload.datumMaischeannahme, "Datum_Maischeannahme in Zeile " + nummer);
  const brandtag = datumFuerBrandplanung_(payload.brandtag, "Brandtag in Zeile " + nummer);
  const brenner = textNormalisieren_(payload.brenner);
  const zeitslotVon = zeitFuerBrandplanung_(payload.zeitslotVon, "Zeitslot_von in Zeile " + nummer);
  const zeitslotBis = zeitFuerBrandplanung_(payload.zeitslotBis, "Zeitslot_bis in Zeile " + nummer);
  const bemerkungIntern = textNormalisieren_(payload.bemerkungIntern);
  const anzahlBraende = textNormalisieren_(payload.anzahlBraende) || "1";
  const status = textNormalisieren_(payload.status) || KONFIGURATION.STATUSWERTE.TERMINIERT;

  if (!datumMaischeannahme) throw new Error("Datum_Maischeannahme fehlt in Zeile " + nummer + ".");
  if (!brandtag) throw new Error("Brandtag fehlt in Zeile " + nummer + ".");
  if (!brenner) throw new Error("Brenner fehlt in Zeile " + nummer + ".");
  if (!zeitslotVon) throw new Error("Zeitslot_von fehlt in Zeile " + nummer + ".");
  if (!zeitslotBis) throw new Error("Zeitslot_bis fehlt in Zeile " + nummer + ".");
  if (!istGueltigerBrandplanungStatus_(status)) throw new Error("Ungültiger Status in Zeile " + nummer + ": " + status);
  if (!istZeitslotReihenfolgeGueltig_(zeitslotVon, zeitslotBis)) throw new Error("Zeitslot_bis muss nach Zeitslot_von liegen. Fehler in Zeile " + nummer + ".");

  return {
    datumMaischeannahme: datumMaischeannahme,
    brandtag: brandtag,
    brenner: brenner,
    zeitslotVon: zeitslotVon,
    zeitslotBis: zeitslotBis,
    anzahlBraende: anzahlBraende,
    bemerkungIntern: bemerkungIntern,
    status: status
  };
}

function pruefeDoppelteBrandplanungseintraege_(planungen) {
  const lookup = {};

  for (let i = 0; i < planungen.length; i++) {
    const item = planungen[i];
    const key = [
      datumAlsVergleichsschluessel_(item.brandtag),
      item.brenner,
      zeitAlsVergleichsschluessel_(item.zeitslotVon),
      zeitAlsVergleichsschluessel_(item.zeitslotBis)
    ].join("|");

    if (lookup[key]) {
      throw new Error("Doppelter Brandplanungseintrag im Speichervorgang erkannt. Brandtag, Brenner und Zeitslot sind mindestens zweimal identisch.");
    }

    lookup[key] = true;
  }
}


/* =========================
   DETAILS LADEN
   ========================= */

function holeBrandplanungDetailsFuerVorgang_(vorgangsId) {
  const vId = textNormalisieren_(vorgangsId);
  if (!vId) return null;

  const sh = tabelleHolen_("BRANDTAGE_PLANUNG");
  if (!sh || sh.getLastRow() < 2) {
    return null;
  }

  const pruefung = pruefePflichtspalten_(sh, [
    "VORGANGS_ID",
    "STATUS",
    "DATUM_MAISCHEANNAHME",
    "BRANDTAG",
    "BRENNER",
    "ZEITSLOT_VON",
    "ZEITSLOT_BIS",
    "BEMERKUNG_INTERN"
  ]);

  if (!pruefung.ok) {
    throw new Error("Pflichtspalten in 🗓️_BRANDTAGE_PLANUNG fehlen: " + pruefung.missing.join(", "));
  }

  const sMap = pruefung.map;
  const zeilen = alleZeilenMitVorgangsIdHolen_(sh, vId);
  if (!zeilen.length) {
    return null;
  }

  const daten = sh.getDataRange().getValues();
  const planungen = [];

  for (let i = 0; i < zeilen.length; i++) {
    const row = daten[zeilen[i] - 1];

    planungen.push({
      datumMaischeannahme: datumAlsHtmlWertBrandplanung_(row[sMap.DATUM_MAISCHEANNAHME - 1]),
      brandtag: datumAlsHtmlWertBrandplanung_(row[sMap.BRANDTAG - 1]),
      brenner: textNormalisieren_(row[sMap.BRENNER - 1]),
      zeitslotVon: zeitAlsHtmlWertBrandplanung_(row[sMap.ZEITSLOT_VON - 1]),
      zeitslotBis: zeitAlsHtmlWertBrandplanung_(row[sMap.ZEITSLOT_BIS - 1]),
      anzahlBraende: textNormalisieren_(sMap.ANZAHL_BRAENDE ? row[sMap.ANZAHL_BRAENDE - 1] : "") || "1",
      bemerkungIntern: textNormalisieren_(row[sMap.BEMERKUNG_INTERN - 1]),
      status: textNormalisieren_(row[sMap.STATUS - 1]) || KONFIGURATION.STATUSWERTE.TERMINIERT
    });
  }

  planungen.sort(function(a, b) {
    const keyA = (a.brandtag || "") + "|" + (a.zeitslotVon || "") + "|" + (a.brenner || "");
    const keyB = (b.brandtag || "") + "|" + (b.zeitslotVon || "") + "|" + (b.brenner || "");
    return keyA.localeCompare(keyB, "de");
  });

  return {
    datumMaischeannahmeGlobal: planungen[0].datumMaischeannahme || "",
    anzahlBraendeGlobal: planungen[0].anzahlBraende || "1",
    statusGlobal: planungen[0].status || KONFIGURATION.STATUSWERTE.TERMINIERT,
    planungen: planungen.map(function(item) {
      return {
        brandtag: item.brandtag,
        brenner: item.brenner,
        zeitslotVon: item.zeitslotVon,
        zeitslotBis: item.zeitslotBis,
        anzahlBraende: item.anzahlBraende,
        bemerkungIntern: item.bemerkungIntern
      };
    })
  };
}


/* =========================
   VORHANDENE PLANUNG LÖSCHEN
   ========================= */

function loescheBrandplanungFuerVorgang_(sh, sMap, vorgangsId) {
  const zeilen = alleZeilenMitVorgangsIdHolen_(sh, vorgangsId);
  if (!zeilen.length) return;

  const sortiert = zeilen.slice().sort(function(a, b) { return b - a; });
  for (let i = 0; i < sortiert.length; i++) {
    sh.deleteRow(sortiert[i]);
  }

  systemLogSchreibenSicher_(
    "INFO",
    "BrandplanungService",
    "Bestehende Brandplanung gelöscht",
    textNormalisieren_(vorgangsId),
    "Zeilen: " + zeilen.join(", ")
  );
}


/* =========================
   STATUS / ZUGRIFF
   ========================= */

function aktualisiereVorplanungStatusNachBrandplanung_(zeile, status) {
  if (!zeile || zeile < 2) return;

  const sh = tabelleHolen_("VORPLANUNG");
  if (!sh) return;

  const sMap = spaltenZuordnungHolen_(sh);
  if (!sMap.STATUS) return;

  sh.getRange(zeile, sMap.STATUS).setValue(status || KONFIGURATION.STATUSWERTE.TERMINIERT);
}

function istOffenerVorplanungStatusFuerBrandplanung_(status) {
  const wert = textNormalisieren_(status);

  if (!wert) return true;
  if (wert === KONFIGURATION.STATUSWERTE.ERLEDIGT) return false;
  if (wert === KONFIGURATION.STATUSWERTE.ARCHIVIERT) return false;
  if (wert === KONFIGURATION.STATUSWERTE.GELOESCHT) return false;
  if (wert === KONFIGURATION.STATUSWERTE.IN_MAISCHEANNAHME_UEBERGEBEN) return false;

  return true;
}

function istGueltigerBrandplanungStatus_(status) {
  const wert = textNormalisieren_(status);
  const liste =
    KONFIGURATION &&
    KONFIGURATION.FESTWERTE &&
    Array.isArray(KONFIGURATION.FESTWERTE.BRANDPLANUNG_STATUS)
      ? KONFIGURATION.FESTWERTE.BRANDPLANUNG_STATUS
      : [];

  return liste.indexOf(wert) > -1;
}


/* =========================
   VORPLANUNG HOLEN
   ========================= */

function vorplanungNachVorgangsIdHolen_(vorgangsId) {
  const vId = textNormalisieren_(vorgangsId);
  if (!vId) return null;

  const sh = tabelleHolen_("VORPLANUNG");
  if (!sh) {
    throw new Error("Tabelle 📆_VORPLANUNG nicht gefunden.");
  }
  if (sh.getLastRow() < 2) {
    return null;
  }

  const pruefung = pruefePflichtspalten_(sh, [
    "VORGANGS_ID",
    "STOFFBESITZER",
    "BEMERKUNG",
    "STATUS"
  ]);

  if (!pruefung.ok) {
    throw new Error("Pflichtspalten in 📆_VORPLANUNG fehlen: " + pruefung.missing.join(", "));
  }

  const sMap = pruefung.map;
  const daten = sh.getDataRange().getValues();

  for (let i = 1; i < daten.length; i++) {
    const row = daten[i];
    const rowVId = textNormalisieren_(row[sMap.VORGANGS_ID - 1]);

    if (rowVId !== vId) continue;

    return {
      vorgangsId: rowVId,
      stoffbesitzer: textNormalisieren_(row[sMap.STOFFBESITZER - 1]),
      bemerkungVorplanung: textNormalisieren_(row[sMap.BEMERKUNG - 1]),
      status: textNormalisieren_(row[sMap.STATUS - 1]),
      zeile: i + 1
    };
  }

  return null;
}

function holeDossierLinkAusVorplanung_(vorgangsId) {
  const vId = textNormalisieren_(vorgangsId);
  if (!vId) return "";

  const sh = tabelleHolen_("VORPLANUNG");
  if (!sh || sh.getLastRow() < 2) {
    return "";
  }

  const sMap = spaltenZuordnungHolen_(sh);
  if (!sMap.VORGANGS_ID || !sMap.DOSSIER_LINK) {
    return "";
  }

  const daten = sh.getDataRange().getValues();

  for (let i = 1; i < daten.length; i++) {
    const row = daten[i];
    if (textNormalisieren_(row[sMap.VORGANGS_ID - 1]) !== vId) continue;
    return textNormalisieren_(row[sMap.DOSSIER_LINK - 1]);
  }

  return "";
}


/* =========================
   PRÜFEN AUF BESTEHENDE PLANUNG
   ========================= */

function brandplanungExistiertFuerVorgang_(sh, sMap, vorgangsId) {
  const vId = textNormalisieren_(vorgangsId);
  if (!vId) return false;
  if (!sh || sh.getLastRow() < 2 || !sMap.VORGANGS_ID) return false;

  const daten = sh.getRange(2, sMap.VORGANGS_ID, sh.getLastRow() - 1, 1).getDisplayValues();

  for (let i = 0; i < daten.length; i++) {
    if (textNormalisieren_(daten[i][0]) === vId) {
      return true;
    }
  }

  return false;
}


/* =========================
   ID / DATUM / ZEIT
   ========================= */

function neueBrandplanungId_() {
  return "PLAN-" + Utilities.getUuid();
}

function datumFuerBrandplanung_(wert, feldname) {
  if (Object.prototype.toString.call(wert) === "[object Date]" && !isNaN(wert)) {
    return new Date(
      wert.getFullYear(),
      wert.getMonth(),
      wert.getDate(),
      0,
      0,
      0,
      0
    );
  }

  const text = textNormalisieren_(wert);
  if (!text) return "";

  if (/^\d{2}\.\d{2}\.\d{4}$/.test(text)) {
    const teile = text.split(".");
    const datumDe = new Date(
      Number(teile[2]),
      Number(teile[1]) - 1,
      Number(teile[0]),
      0,
      0,
      0,
      0
    );
    if (!isNaN(datumDe)) {
      return datumDe;
    }
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const teileIso = text.split("-");
    const datumIso = new Date(
      Number(teileIso[0]),
      Number(teileIso[1]) - 1,
      Number(teileIso[2]),
      0,
      0,
      0,
      0
    );
    if (!isNaN(datumIso)) {
      return datumIso;
    }
  }

  const datum = new Date(text);
  if (isNaN(datum)) {
    throw new Error("Ungültiger Wert für " + feldname + ": " + text);
  }

  return new Date(datum.getFullYear(), datum.getMonth(), datum.getDate(), 0, 0, 0, 0);
}

function zeitFuerBrandplanung_(wert, feldname) {
  if (Object.prototype.toString.call(wert) === "[object Date]" && !isNaN(wert)) {
    return new Date(1899, 11, 30, wert.getHours(), wert.getMinutes(), 0, 0);
  }

  const text = textNormalisieren_(wert);
  if (!text) return "";

  if (/^\d{1,2}:\d{2}$/.test(text)) {
    const teile = text.split(":");
    return new Date(1899, 11, 30, Number(teile[0]), Number(teile[1]), 0, 0);
  }

  if (/^\d{1,2}:\d{2}:\d{2}$/.test(text)) {
    const teileLang = text.split(":");
    return new Date(1899, 11, 30, Number(teileLang[0]), Number(teileLang[1]), Number(teileLang[2]), 0);
  }

  const datum = new Date(text);
  if (isNaN(datum)) {
    throw new Error("Ungültiger Wert für " + feldname + ": " + text);
  }

  return new Date(1899, 11, 30, datum.getHours(), datum.getMinutes(), 0, 0);
}

function alsReineDatumzelle_(wert) {
  if (wert instanceof Date && !isNaN(wert.getTime())) {
    return new Date(wert.getFullYear(), wert.getMonth(), wert.getDate(), 12, 0, 0, 0);
  }

  const text = textNormalisieren_(wert);
  if (!text) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const teile = text.split("-");
    return new Date(Number(teile[0]), Number(teile[1]) - 1, Number(teile[2]), 12, 0, 0, 0);
  }

  if (/^\d{2}\.\d{2}\.\d{4}$/.test(text)) {
    const teile = text.split(".");
    return new Date(Number(teile[2]), Number(teile[1]) - 1, Number(teile[0]), 12, 0, 0, 0);
  }

  const d = new Date(text);
  if (isNaN(d.getTime())) return "";
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
}

function alsReineUhrzeitzelle_(wert) {
  if (wert instanceof Date && !isNaN(wert.getTime())) {
    return new Date(1899, 11, 30, wert.getHours(), wert.getMinutes(), 0, 0);
  }

  const text = textNormalisieren_(wert);
  if (!text) return "";

  let match = text.match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    return new Date(1899, 11, 30, Number(match[1]), Number(match[2]), 0, 0);
  }

  match = text.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (match) {
    return new Date(1899, 11, 30, Number(match[1]), Number(match[2]), 0, 0);
  }

  const d = new Date(text);
  if (isNaN(d.getTime())) return "";
  return new Date(1899, 11, 30, d.getHours(), d.getMinutes(), 0, 0);
}

function istZeitslotReihenfolgeGueltig_(von, bis) {
  if (!von || !bis) return false;
  return bis.getTime() > von.getTime();
}


/* =========================
   ÜBERGABE NACH MAISCHEANNAHME
   ========================= */

function uebertrageBrandplanungNachMaischeannahme_(vorplanung, planungen) {
  if (!vorplanung || !vorplanung.vorgangsId) {
    throw new Error("Vorplanung für Übergabe nach Maischeannahme fehlt.");
  }

  if (!Array.isArray(planungen) || !planungen.length) {
    throw new Error("Es liegen keine Brandplanungsdaten für die Übergabe vor.");
  }

  const sh = tabelleHolen_("MAISCHEANNAHME");
  if (!sh) {
    throw new Error("Tabelle 🍎_MAISCHEANNAHME nicht gefunden.");
  }

  const sMap = spaltenZuordnungHolen_(sh);
  if (!sMap.VORGANGS_ID || !sMap.STOFFBESITZER) {
    throw new Error("Pflichtspalten in 🍎_MAISCHEANNAHME fehlen.");
  }

  const vorgangsId = textNormalisieren_(vorplanung.vorgangsId);
  const stoffbesitzer = textNormalisieren_(vorplanung.stoffbesitzer);
  const bemerkungVorplanung = textNormalisieren_(vorplanung.bemerkungVorplanung);
  const dossierLink = holeDossierLinkAusVorplanung_(vorgangsId);

  const vorhandeneZeilen = alleZeilenMitVorgangsIdHolen_(sh, vorgangsId);
  const daten = sh.getDataRange().getValues();

  const loeschKandidaten = [];
  const fachZeilen = [];

  for (let i = 0; i < vorhandeneZeilen.length; i++) {
    const zeileNr = vorhandeneZeilen[i];
    const row = daten[zeileNr - 1];

    if (istNurPlanungszeileInMaischeannahme_(row, sMap)) {
      loeschKandidaten.push(zeileNr);
    } else {
      fachZeilen.push(zeileNr);
    }
  }

  if (loeschKandidaten.length) {
    loescheZeilenRueckwaertsBrandplanung_(sh, loeschKandidaten);
  }

  const fachZeilenAktuell = alleZeilenMitVorgangsIdHolen_(sh, vorgangsId).filter(function(zeileNr) {
    const row = sh.getRange(zeileNr, 1, 1, sh.getLastColumn()).getValues()[0];
    return !istNurPlanungszeileInMaischeannahme_(row, sMap);
  });

  const planungNachKey = {};
  const keyListe = [];

  for (let i = 0; i < planungen.length; i++) {
    const key = brandplanungZuordnungsschluessel_(planungen[i]);
    planungNachKey[key] = planungen[i];
    keyListe.push(key);
  }

  const verbrauchteKeys = {};

  if (fachZeilenAktuell.length) {
    for (let i = 0; i < fachZeilenAktuell.length; i++) {
      const zeileNr = fachZeilenAktuell[i];
      const row = sh.getRange(zeileNr, 1, 1, sh.getLastColumn()).getValues()[0];
      const key = maischeZuordnungsschluessel_(row, sMap);

      if (key && planungNachKey[key]) {
        entferneBlockierendeMaischeValidierungInZeile_(sh, sMap, zeileNr);
        schreibePlanungsfelderInMaischezeile_(
          sh,
          zeileNr,
          sMap,
          vorgangsId,
          stoffbesitzer,
          bemerkungVorplanung,
          dossierLink,
          planungNachKey[key]
        );
        verbrauchteKeys[key] = true;
      }
    }

    if (planungen.length === 1) {
      const einzigePlanung = planungen[0];
      for (let i = 0; i < fachZeilenAktuell.length; i++) {
        const zeileNr = fachZeilenAktuell[i];
        entferneBlockierendeMaischeValidierungInZeile_(sh, sMap, zeileNr);
        schreibePlanungsfelderInMaischezeile_(
          sh,
          zeileNr,
          sMap,
          vorgangsId,
          stoffbesitzer,
          bemerkungVorplanung,
          dossierLink,
          einzigePlanung
        );
      }
      verbrauchteKeys[brandplanungZuordnungsschluessel_(einzigePlanung)] = true;
    }
  }

  const neueZeilen = [];

  for (let i = 0; i < keyListe.length; i++) {
    const key = keyListe[i];
    if (verbrauchteKeys[key]) continue;

    const p = planungNachKey[key];
    const zeile = new Array(sh.getLastColumn()).fill("");

    if (sMap.VORGANGS_ID) zeile[sMap.VORGANGS_ID - 1] = vorgangsId;
    if (sMap.STOFFBESITZER) zeile[sMap.STOFFBESITZER - 1] = stoffbesitzer;
    if (sMap.TERMIN_MAISCHE) zeile[sMap.TERMIN_MAISCHE - 1] = alsReineDatumzelle_(p.datumMaischeannahme);
    if (sMap.TAG_BRAND) zeile[sMap.TAG_BRAND - 1] = alsReineDatumzelle_(p.brandtag);
    if (sMap.VON) zeile[sMap.VON - 1] = alsReineUhrzeitzelle_(p.zeitslotVon);
    if (sMap.BIS) zeile[sMap.BIS - 1] = alsReineUhrzeitzelle_(p.zeitslotBis);
    if (sMap.BRENNER) zeile[sMap.BRENNER - 1] = p.brenner;
    if (sMap.ANZAHL_BRAENDE) zeile[sMap.ANZAHL_BRAENDE - 1] = p.anzahlBraende || "1";
    if (sMap.DOSSIER_LINK) zeile[sMap.DOSSIER_LINK - 1] = dossierLink;
    if (sMap.INFO_SYSTEM) zeile[sMap.INFO_SYSTEM - 1] = bemerkungVorplanung;

    neueZeilen.push(zeile);
  }

  if (neueZeilen.length) {
    const startZeile = sh.getLastRow() + 1;
    entferneBlockierendeMaischeValidierungImBereich_(sh, sMap, startZeile, neueZeilen.length);
    sh.getRange(startZeile, 1, neueZeilen.length, sh.getLastColumn()).setValues(neueZeilen);

    for (let i = 0; i < neueZeilen.length; i++) {
      const z = startZeile + i;
      if (sMap.TERMIN_MAISCHE) sh.getRange(z, sMap.TERMIN_MAISCHE).setNumberFormat("dd.MM.yyyy");
      if (sMap.TAG_BRAND) sh.getRange(z, sMap.TAG_BRAND).setNumberFormat("dd.MM.yyyy");
      if (sMap.VON) sh.getRange(z, sMap.VON).setNumberFormat("HH:mm");
      if (sMap.BIS) sh.getRange(z, sMap.BIS).setNumberFormat("HH:mm");
    }
  }

  SpreadsheetApp.flush();

  pruefeBrandplanungUebergabeNachMaischeannahme_(sh, sMap, vorgangsId, planungen.length);

  systemLogSchreibenSicher_(
    "INFO",
    "BrandplanungService",
    "Übergabe nach Maischeannahme durchgeführt",
    vorgangsId,
    "Planungen: " + planungen.length
  );
}


function entferneBlockierendeMaischeValidierungInZeile_(sh, sMap, zeileNr) {
  if (!sh || !sMap || !zeileNr) return;

  [sMap.STOFFBESITZER].forEach(function(spalte) {
    if (spalte) sh.getRange(zeileNr, spalte).clearDataValidations();
  });
}

function entferneBlockierendeMaischeValidierungImBereich_(sh, sMap, startZeile, anzahlZeilen) {
  if (!sh || !sMap || !startZeile || !anzahlZeilen) return;

  if (sMap.STOFFBESITZER) {
    sh.getRange(startZeile, sMap.STOFFBESITZER, anzahlZeilen, 1).clearDataValidations();
  }
}

function pruefeBrandplanungUebergabeNachMaischeannahme_(sh, sMap, vorgangsId, erwartetePlanungen) {
  const zeilen = alleZeilenMitVorgangsIdHolen_(sh, vorgangsId);
  if (!zeilen.length) {
    throw new Error("Übergabe nach 🍎_MAISCHEANNAHME fehlgeschlagen: Keine Zeile zur Vorgangs_ID geschrieben.");
  }

  let vollstaendigePlanungszeilen = 0;

  for (let i = 0; i < zeilen.length; i++) {
    const zeileNr = zeilen[i];
    const row = sh.getRange(zeileNr, 1, 1, sh.getLastColumn()).getValues()[0];

    const hatTermin = !sMap.TERMIN_MAISCHE || !!textNormalisieren_(row[sMap.TERMIN_MAISCHE - 1]);
    const hatBrandtag = !sMap.TAG_BRAND || !!textNormalisieren_(row[sMap.TAG_BRAND - 1]);
    const hatVon = !sMap.VON || !!textNormalisieren_(row[sMap.VON - 1]);
    const hatBis = !sMap.BIS || !!textNormalisieren_(row[sMap.BIS - 1]);
    const hatBrenner = !sMap.BRENNER || !!textNormalisieren_(row[sMap.BRENNER - 1]);
    const hatAnzahl = !sMap.ANZAHL_BRAENDE || !!textNormalisieren_(row[sMap.ANZAHL_BRAENDE - 1]);
    const hatStoffbesitzer = !sMap.STOFFBESITZER || !!textNormalisieren_(row[sMap.STOFFBESITZER - 1]);

    if (hatTermin && hatBrandtag && hatVon && hatBis && hatBrenner && hatAnzahl && hatStoffbesitzer) {
      vollstaendigePlanungszeilen += 1;
    }
  }

  if (vollstaendigePlanungszeilen < Math.max(1, Number(erwartetePlanungen || 0))) {
    throw new Error("Übergabe nach 🍎_MAISCHEANNAHME unvollständig: Planungsdaten wurden nicht vollständig geschrieben.");
  }
}

function schreibePlanungsfelderInMaischezeile_(sh, zeileNr, sMap, vorgangsId, stoffbesitzer, bemerkungVorplanung, dossierLink, planung) {
  if (sMap.VORGANGS_ID) sh.getRange(zeileNr, sMap.VORGANGS_ID).setValue(vorgangsId);
  if (sMap.STOFFBESITZER) sh.getRange(zeileNr, sMap.STOFFBESITZER).setValue(stoffbesitzer);

  if (sMap.TERMIN_MAISCHE) {
    sh.getRange(zeileNr, sMap.TERMIN_MAISCHE).setValue(alsReineDatumzelle_(planung.datumMaischeannahme));
    sh.getRange(zeileNr, sMap.TERMIN_MAISCHE).setNumberFormat("dd.MM.yyyy");
  }

  if (sMap.TAG_BRAND) {
    sh.getRange(zeileNr, sMap.TAG_BRAND).setValue(alsReineDatumzelle_(planung.brandtag));
    sh.getRange(zeileNr, sMap.TAG_BRAND).setNumberFormat("dd.MM.yyyy");
  }

  if (sMap.VON) {
    sh.getRange(zeileNr, sMap.VON).setValue(alsReineUhrzeitzelle_(planung.zeitslotVon));
    sh.getRange(zeileNr, sMap.VON).setNumberFormat("HH:mm");
  }

  if (sMap.BIS) {
    sh.getRange(zeileNr, sMap.BIS).setValue(alsReineUhrzeitzelle_(planung.zeitslotBis));
    sh.getRange(zeileNr, sMap.BIS).setNumberFormat("HH:mm");
  }

  if (sMap.BRENNER) sh.getRange(zeileNr, sMap.BRENNER).setValue(planung.brenner);
  if (sMap.ANZAHL_BRAENDE) sh.getRange(zeileNr, sMap.ANZAHL_BRAENDE).setValue(planung.anzahlBraende || "1");
  if (sMap.DOSSIER_LINK) sh.getRange(zeileNr, sMap.DOSSIER_LINK).setValue(dossierLink);

  if (sMap.INFO_SYSTEM) {
    const alt = textNormalisieren_(sh.getRange(zeileNr, sMap.INFO_SYSTEM).getValue());
    if (!alt) {
      sh.getRange(zeileNr, sMap.INFO_SYSTEM).setValue(bemerkungVorplanung);
    }
  }

  // STATUS in der Maischeannahme hier bewusst NICHT setzen.
}

function istNurPlanungszeileInMaischeannahme_(row, sMap) {
  const pruefKeys = [
    "FASS_NR",
    "FASS_VP",
    "INH_VP",
    "MATERIAL",
    "GEWUERZE",
    "REGISTERNUMMER",
    "ZOLL_OK",
    "AUSBEUTE",
    "ALKOHOL",
    "STATUS_AKTION"
  ];

  for (let i = 0; i < pruefKeys.length; i++) {
    const key = pruefKeys[i];
    if (sMap[key] && textNormalisieren_(row[sMap[key] - 1])) {
      return false;
    }
  }

  return true;
}

function brandplanungZuordnungsschluessel_(planung) {
  return [
    datumAlsVergleichsschluessel_(planung.datumMaischeannahme),
    datumAlsVergleichsschluessel_(planung.brandtag),
    zeitAlsVergleichsschluessel_(planung.zeitslotVon),
    zeitAlsVergleichsschluessel_(planung.zeitslotBis),
    textNormalisieren_(planung.brenner)
  ].join("|");
}

function maischeZuordnungsschluessel_(row, sMap) {
  return [
    datumAlsVergleichsschluessel_(sMap.TERMIN_MAISCHE ? row[sMap.TERMIN_MAISCHE - 1] : ""),
    datumAlsVergleichsschluessel_(sMap.TAG_BRAND ? row[sMap.TAG_BRAND - 1] : ""),
    zeitAlsVergleichsschluessel_(sMap.VON ? row[sMap.VON - 1] : ""),
    zeitAlsVergleichsschluessel_(sMap.BIS ? row[sMap.BIS - 1] : ""),
    textNormalisieren_(sMap.BRENNER ? row[sMap.BRENNER - 1] : "")
  ].join("|");
}

function loescheZeilenRueckwaertsBrandplanung_(blatt, zeilenListe) {
  const sortiert = zeilenListe.slice().sort(function(a, b) { return b - a; });
  for (let i = 0; i < sortiert.length; i++) {
    blatt.deleteRow(sortiert[i]);
  }
}


/* =========================
   HTML / VERGLEICHSSCHLÜSSEL
   ========================= */

function datumAlsHtmlWertBrandplanung_(wert) {
  if (wert instanceof Date && !isNaN(wert.getTime())) {
    return Utilities.formatDate(
      wert,
      KONFIGURATION.ZOLL_PARAMETER.ZEIT_PARAMETER.ZEITZONE,
      "yyyy-MM-dd"
    );
  }

  const text = textNormalisieren_(wert);
  if (!text) return "";

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    return iso[1] + "-" + iso[2] + "-" + iso[3];
  }

  const de = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (de) {
    return de[3] + "-" + de[2] + "-" + de[1];
  }

  return "";
}

function zeitAlsHtmlWertBrandplanung_(wert) {
  if (wert instanceof Date && !isNaN(wert.getTime())) {
    return Utilities.formatDate(
      wert,
      KONFIGURATION.ZOLL_PARAMETER.ZEIT_PARAMETER.ZEITZONE,
      "HH:mm"
    );
  }

  const text = textNormalisieren_(wert);
  if (!text) return "";

  const kurz = text.match(/^(\d{2}):(\d{2})$/);
  if (kurz) {
    return kurz[1] + ":" + kurz[2];
  }

  const lang = text.match(/^(\d{2}):(\d{2}):(\d{2})$/);
  if (lang) {
    return lang[1] + ":" + lang[2];
  }

  return "";
}

function datumAlsVergleichsschluessel_(wert) {
  if (wert instanceof Date && !isNaN(wert.getTime())) {
    return Utilities.formatDate(
      wert,
      KONFIGURATION.ZOLL_PARAMETER.ZEIT_PARAMETER.ZEITZONE,
      "yyyy-MM-dd"
    );
  }

  const text = textNormalisieren_(wert);
  if (!text) return "";

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    return iso[1] + "-" + iso[2] + "-" + iso[3];
  }

  const de = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (de) {
    return de[3] + "-" + de[2] + "-" + de[1];
  }

  return text;
}

function zeitAlsVergleichsschluessel_(wert) {
  if (wert instanceof Date && !isNaN(wert.getTime())) {
    return Utilities.formatDate(
      wert,
      KONFIGURATION.ZOLL_PARAMETER.ZEIT_PARAMETER.ZEITZONE,
      "HH:mm"
    );
  }

  const text = textNormalisieren_(wert);
  if (!text) return "";

  const kurz = text.match(/^(\d{2}):(\d{2})$/);
  if (kurz) {
    return kurz[1] + ":" + kurz[2];
  }

  const lang = text.match(/^(\d{2}):(\d{2}):(\d{2})$/);
  if (lang) {
    return lang[1] + ":" + lang[2];
  }

  return text;
}


/* =========================
   LOG
   ========================= */

function systemLogSchreibenSicher_(level, quelle, meldung, vorgangsId, details) {
  if (typeof systemLogSchreiben_ === "function") {
    systemLogSchreiben_(level, quelle, meldung, vorgangsId, details);
  }
}