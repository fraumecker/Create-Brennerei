/**
 * DATEI: 01_WebApp.gs
 * ZWECK: SERVERSEITIGE API FÜR WEBAPP, BRANDPLANUNG UND COCKPIT
 * HINWEIS:
 * - doGet() liegt in 00_Hauptsystem.gs
 * - diese Datei enthält nur API-Funktionen für HTML-Oberflächen
 */


/**
 * FUNKTION: Liefert die Tagesdaten für das Brenner-Cockpit.
 * EINGABE: dateStr im Format yyyy-MM-dd
 * RÜCKGABE: jobs[] + stats{}
 */
function getLeitstandData(dateStr) {
  const shBrandtag = tabelleHolen_("BRANDTAG_UEBERSICHT");
  if (!shBrandtag) {
    return {
      jobs: [],
      stats: {
        total: 0,
        date: dateStr || "",
        gefunden: 0
      }
    };
  }

  const sMap = spaltenZuordnungHolen_(shBrandtag);
  const range = shBrandtag.getDataRange();
  const daten = range.getValues();
  const displayDaten = range.getDisplayValues();
  const jobs = [];
  let totalBraende = 0;

  for (let i = 1; i < daten.length; i++) {
    const row = daten[i];
    const displayRow = displayDaten[i] || [];
    const brandTagRaw = sMap.TAG_BRAND ? row[sMap.TAG_BRAND - 1] : "";
    const rowDate = datumAlsIsoString_(brandTagRaw);

    if (rowDate !== textNormalisieren_(dateStr)) continue;

    const statusAktionRoh = sMap.STATUS_AKTION ? row[sMap.STATUS_AKTION - 1] : "";
    const statusAktion = textNormalisieren_(statusAktionRoh);
    const statusAktionUpper = statusAktion.toUpperCase();
    const istErledigt = statusAktionUpper.indexOf(KONFIGURATION.STATUSWERTE.ERLEDIGT) === 0;
    const istMinderausbeute = statusAktionUpper.indexOf('MINDERAUSBEUTE BRAND ZOLL INFORMIERT') !== -1;

    const anzahlBraendeRoh = sMap.ANZAHL_BRAENDE ? row[sMap.ANZAHL_BRAENDE - 1] : "";
    const anzahlBraende = parseInt(textNormalisieren_(anzahlBraendeRoh), 10);
    totalBraende += isNaN(anzahlBraende) || anzahlBraende < 1 ? 1 : anzahlBraende;

    jobs.push({
      row: i + 1,
      vId: sMap.VORGANGS_ID ? row[sMap.VORGANGS_ID - 1] : "",
      owner: sMap.STOFFBESITZER ? row[sMap.STOFFBESITZER - 1] : "",
      brenner: sMap.BRENNER ? row[sMap.BRENNER - 1] : "",
      material: sMap.MATERIAL ? row[sMap.MATERIAL - 1] : "",
      gewuerze: sMap.GEWUERZE ? row[sMap.GEWUERZE - 1] : "",
      fassNr: sMap.FASS_NR ? row[sMap.FASS_NR - 1] : "",
      fassgroesse: sMap.FASS_VP ? row[sMap.FASS_VP - 1] : "",
      inhalt: sMap.INH_VP ? row[sMap.INH_VP - 1] : "",
      regNr: sMap.REGISTERNUMMER ? row[sMap.REGISTERNUMMER - 1] : "",
      von: wertAlsZeitText_(sMap.VON ? row[sMap.VON - 1] : "", sMap.VON ? displayRow[sMap.VON - 1] : ""),
      bis: wertAlsZeitText_(sMap.BIS ? row[sMap.BIS - 1] : "", sMap.BIS ? displayRow[sMap.BIS - 1] : ""),
      alk: sMap.ALKOHOL ? row[sMap.ALKOHOL - 1] : "",
      ausbeute: sMap.AUSBEUTE ? row[sMap.AUSBEUTE - 1] : "",
      anzahlBraende: sMap.ANZAHL_BRAENDE ? row[sMap.ANZAHL_BRAENDE - 1] : "",
      zollOk: sMap.ZOLL_OK ? row[sMap.ZOLL_OK - 1] : "",
      status: sMap.STATUS ? row[sMap.STATUS - 1] : "",
      statusAktion: statusAktion,
      istErledigt: istErledigt,
      istMinderausbeute: istMinderausbeute,
      infoSystem: sMap.INFO_SYSTEM ? row[sMap.INFO_SYSTEM - 1] : "",
      link: sMap.DOSSIER_LINK ? row[sMap.DOSSIER_LINK - 1] : ""
    });
  }

  jobs.sort(function(a, b) {
    return String(a.von || "").localeCompare(String(b.von || ""));
  });

  return {
    jobs: jobs,
    stats: {
      total: totalBraende,
      date: textNormalisieren_(dateStr),
      gefunden: jobs.length
    }
  };
}


/**
 * FUNKTION: Liefert alle geplanten Brandtage für die Leitstand-Kalender-Markierung.
 * RÜCKGABE: Array mit ISO-Datum yyyy-MM-dd
 */
function getLeitstandGeplanteBrandtage() {
  const shBrandtag = tabelleHolen_("BRANDTAG_UEBERSICHT");
  if (!shBrandtag) return [];

  const sMap = spaltenZuordnungHolen_(shBrandtag);
  if (!sMap.TAG_BRAND) return [];

  const letzteZeile = shBrandtag.getLastRow();
  if (letzteZeile <= 1) return [];

  const werte = shBrandtag.getRange(2, sMap.TAG_BRAND, letzteZeile - 1, 1).getValues();
  const gesehen = {};

  werte.forEach(function(row) {
    const iso = datumAlsIsoString_(row[0]);
    if (iso) gesehen[iso] = true;
  });

  return Object.keys(gesehen).sort();
}


/**
 * FUNKTION: Speichert ein einzelnes Feld aus dem Cockpit in 🔥_BRENNFREIGABE.
 * EINGABE: Tabellenzeile, Feld-Key aus KONFIGURATION.SPALTEN, neuer Wert
 * RÜCKGABE: true/false
 */
function saveLeitstandField(row, fieldKey, val) {
  const sh = tabelleHolen_("BRANDTAG_UEBERSICHT");
  if (!sh) {
    systemLogSchreiben_("ERROR", "WebApp", "Blatt BRANDTAG_UEBERSICHT nicht gefunden", "", fieldKey);
    return false;
  }

  const zeile = Number(row);
  if (!zeile || zeile <= 1) {
    systemLogSchreiben_("WARN", "WebApp", "Ungültige Zeile im saveLeitstandField", "", String(row));
    return false;
  }

  const sMap = spaltenZuordnungHolen_(sh);
  const colIndex = sMap[fieldKey];

  if (!colIndex) {
    systemLogSchreiben_("WARN", "WebApp", "Unbekannter Feld-Key", "", String(fieldKey));
    return false;
  }

  const alterWert = sh.getRange(zeile, colIndex).getValue();
  const neuerWert = webAppFeldwertNormalisieren_(fieldKey, val);

  sh.getRange(zeile, colIndex).setValue(neuerWert);

  if (fieldKey === "TERMIN_MAISCHE" || fieldKey === "TAG_BRAND") {
    sh.getRange(zeile, colIndex).setNumberFormat("dd.MM.yyyy");
  }

  if (istDossierRelevantesFeld_(fieldKey)) {
    try {
      dossierLinkAktualisieren_(sh, zeile, sMap);
    } catch (e) {
      systemLogSchreiben_("WARN", "WebApp", "Dossier-Link konnte nicht aktualisiert werden", "", String(e));
    }
  }

  const vId = sMap.VORGANGS_ID ? textNormalisieren_(sh.getRange(zeile, sMap.VORGANGS_ID).getValue()) : "";

  if (fieldKey === "STATUS" && vId) {
    registerStatusAktualisieren_(vId, textNormalisieren_(neuerWert));
  }

  systemLogSchreiben_(
    "INFO",
    "WebApp",
    "Feld aktualisiert",
    vId,
    "Zeile: " + zeile + " | Feld: " + fieldKey + " | Alt: " + alterWert + " | Neu: " + neuerWert
  );

  return true;
}



function markLeitstandVorgangErledigt(vorgangsId) {
  const vId = textNormalisieren_(vorgangsId);
  if (!vId) throw new Error('Vorgangs_ID fehlt.');

  return mitSperreAusfuehren_(function() {
    const sh = tabelleHolen_('BRANDTAG_UEBERSICHT');
    if (!sh) throw new Error('Blatt BRANDTAG_UEBERSICHT nicht gefunden.');

    const sMap = spaltenZuordnungHolen_(sh);
    const zeilen = alleZeilenMitVorgangsIdHolen_(sh, vId);
    if (!zeilen.length) throw new Error('Keine Daten in BRANDTAG_UEBERSICHT gefunden.');

    zeilen.forEach(function(zeile) {
      if (sMap.STATUS_AKTION) sh.getRange(zeile, sMap.STATUS_AKTION).setValue(KONFIGURATION.STATUSWERTE.ERLEDIGT);
      if (sMap.STATUS) sh.getRange(zeile, sMap.STATUS).setValue(KONFIGURATION.STATUSWERTE.GEBRANNT);
    });

    SpreadsheetApp.flush();

    systemLogSchreiben_(
      'INFO',
      'WebApp',
      'Leitstand-Vorgang als erledigt vorgemerkt',
      vId,
      'Archivierung erfolgt über Mitternachtslauf.'
    );

    return {
      ok: true,
      erledigt: true,
      archiviert: false,
      verschoben: false,
      archivierung: 'MITTERNACHTSLAUF'
    };
  }, 'markLeitstandVorgangErledigt');
}

function saveLeitstandEintrag(payload) {
  return mitSperreAusfuehren_(function() {
    const daten = payload || {};
    const zeile = Number(daten.row);
    if (!zeile || zeile <= 1) throw new Error('Ungültige Tabellenzeile.');

    const sh = tabelleHolen_('BRANDTAG_UEBERSICHT');
    if (!sh) throw new Error('Blatt BRANDTAG_UEBERSICHT nicht gefunden.');

    const sMap = spaltenZuordnungHolen_(sh);
    const vId = textNormalisieren_(daten.vId || (sMap.VORGANGS_ID ? sh.getRange(zeile, sMap.VORGANGS_ID).getValue() : ''));
    if (!vId) throw new Error('Vorgangs_ID fehlt.');

    if (sMap.ALKOHOL) {
      sh.getRange(zeile, sMap.ALKOHOL).setValue(webAppFeldwertNormalisieren_('ALKOHOL', daten.alkohol));
    }

    if (sMap.AUSBEUTE) {
      sh.getRange(zeile, sMap.AUSBEUTE).setValue(webAppFeldwertNormalisieren_('AUSBEUTE', daten.ausbeute));
    }

    const erledigt = true;
    const minderausbeute = daten.minderausbeute === true || daten.minderausbeute === 'true' || daten.minderausbeute === 1 || daten.minderausbeute === '1';

    const statusAktion = minderausbeute
      ? 'ERLEDIGT | Minderausbeute Brand Zoll informiert'
      : KONFIGURATION.STATUSWERTE.ERLEDIGT;

    if (sMap.STATUS_AKTION) {
      sh.getRange(zeile, sMap.STATUS_AKTION).setValue(statusAktion);
    }

    if (sMap.STATUS) {
      sh.getRange(zeile, sMap.STATUS).setValue(KONFIGURATION.STATUSWERTE.GEBRANNT);
    }

    SpreadsheetApp.flush();

    systemLogSchreiben_(
      'INFO',
      'WebApp',
      'Leitstand-Eintrag gespeichert',
      vId,
      'Zeile: ' + zeile + ' | Alkohol: ' + daten.alkohol + ' | Ausbeute: ' + daten.ausbeute + ' | Status_Aktion: ' + statusAktion + ' | Archivierung: Mitternachtslauf'
    );

    return {
      ok: true,
      erledigt: erledigt,
      minderausbeute: minderausbeute,
      archiviert: false,
      verschoben: false,
      archivierung: erledigt ? 'MITTERNACHTSLAUF' : 'KEINE',
      statusAktion: statusAktion
    };
  }, 'saveLeitstandEintrag');
}

/**
 * FUNKTION: Liefert alle Dropdown-Daten für die Web-Vorgangserfassung.
 * RÜCKGABE: Objekt mit Arrays
 */
function getVorgangserfassungDropdowns() {
  return ladeWebAppDropdowns();
}


/**
 * FUNKTION: Alias für ältere Frontend-Aufrufe.
 * RÜCKGABE: Objekt mit Arrays
 */
function getWebAppDropdowns() {
  return ladeWebAppDropdowns();
}


/**
 * FUNKTION: Speichert einen kompletten Web-Vorgang.
 * RÜCKGABE: Ergebnisobjekt aus MaischeService
 */
function saveWebVorgang(payload) {
  return speichereWebVorgang(payload);
}


/**
 * FUNKTION: Alias für bestehende Frontend-Aufrufe.
 */
function speichereWebAppVorgang(payload) {
  return speichereWebVorgang(payload);
}


/**
 * FUNKTION: Lädt einen kompletten Web-Vorgang.
 * RÜCKGABE: Payload für Index.html
 */
function loadWebVorgang(vorgangsId) {
  return ladeWebVorgang(vorgangsId);
}


/**
 * FUNKTION: Alias für bestehende Frontend-Aufrufe.
 */
function ladeWebAppVorgang(vorgangsId) {
  return ladeWebVorgang(vorgangsId);
}


/**
 * FUNKTION: Liefert eine reduzierte Übersicht aller vorhandenen Vorgänge.
 * ZWECK: spätere Such-/Auswahlliste in der WebApp
 */
function listeVorhandeneVorgaenge_() {
  const sh = tabelleHolen_("MAISCHEANNAHME");
  if (!sh || sh.getLastRow() < 2) return [];

  const sMap = spaltenZuordnungHolen_(sh);
  if (!sMap.VORGANGS_ID) return [];

  const daten = sh.getDataRange().getDisplayValues();
  const gesehen = {};
  const liste = [];

  for (let i = 1; i < daten.length; i++) {
    const row = daten[i];
    const vId = textNormalisieren_(row[sMap.VORGANGS_ID - 1]);
    if (!vId || gesehen[vId]) continue;

    gesehen[vId] = true;

    liste.push({
      vorgangsId: vId,
      stoffbesitzer: sMap.STOFFBESITZER ? textNormalisieren_(row[sMap.STOFFBESITZER - 1]) : "",
      tagBrand: sMap.TAG_BRAND ? textNormalisieren_(row[sMap.TAG_BRAND - 1]) : "",
      terminMaische: sMap.TERMIN_MAISCHE ? textNormalisieren_(row[sMap.TERMIN_MAISCHE - 1]) : "",
      registernummer: sMap.REGISTERNUMMER ? textNormalisieren_(row[sMap.REGISTERNUMMER - 1]) : "",
      status: sMap.STATUS ? textNormalisieren_(row[sMap.STATUS - 1]) : ""
    });
  }

  liste.sort(function(a, b) {
    return String(a.vorgangsId).localeCompare(String(b.vorgangsId));
  });

  return liste;
}


/**
 * FUNKTION: Öffentliche Suchfunktion für spätere WebApp-Auswahlfelder.
 * FILTER: einfache Textsuche über Vorgangs-ID, Stoffbesitzer, Registernummer
 */
function sucheVorgaenge(suchtext) {
  const text = textNormalisieren_(suchtext).toLowerCase();
  const liste = listeVorhandeneVorgaenge_();

  if (!text) return liste;

  return liste.filter(function(eintrag) {
    return (
      String(eintrag.vorgangsId || "").toLowerCase().indexOf(text) !== -1 ||
      String(eintrag.stoffbesitzer || "").toLowerCase().indexOf(text) !== -1 ||
      String(eintrag.registernummer || "").toLowerCase().indexOf(text) !== -1
    );
  });
}


/**
 * FUNKTION: Erzeugt im System eine neue Vorgangs-ID für die WebApp.
 * HINWEIS: Nur verwenden, wenn der Stoffbesitzer bereits bekannt ist.
 */
function createNeueWebVorgangsId(stoffbesitzer) {
  return vorgangsIdNeuAnlegen_(stoffbesitzer);
}


/**
 * FUNKTION: Prüft, ob eine Vorgangs-ID vorhanden ist.
 * RÜCKGABE: true/false
 */
function checkVorgangsIdExistiert(vorgangsId) {
  return vorgangsIdExistiert_(vorgangsId);
}


/**
 * FUNKTION: Liefert Meta-Informationen für die WebApp.
 * ZWECK: Anzeige von Systemdaten im Frontend
 */
function getWebAppMeta() {
  return {
    betrieb: KONFIGURATION.IDENTITAET.BETRIEB,
    brennereiNummer: KONFIGURATION.IDENTITAET.BRENNEREI_NUMMER,
    maxBlase: KONFIGURATION.IDENTITAET.MAX_BLASE,
    zeitZone: KONFIGURATION.ZOLL_PARAMETER.ZEIT_PARAMETER.ZEITZONE,
    idFormat: KONFIGURATION.IDENTITAET.ID_FORMAT
  };
}


/**
 * =========================================================
 * BRANDPLANUNG – API FÜR Brandplanung.html
 * =========================================================
 */


/**
 * FUNKTION: Liefert offene Vorplanungs-Vorgänge für die interne Brandplanung.
 * RÜCKGABE: Ergebnis aus 21_BrandplanungService.gs
 */
function getBrandplanungOffeneVorgaenge() {
  return ladeOffeneVorplanungFuerBrandplanung();
}


/**
 * FUNKTION: Liefert Details eines einzelnen Vorplanungs-Vorgangs
 * für die interne Brandplanung.
 */
function getBrandplanungDetails(vorgangsId) {
  return ladeVorplanungFuerBrandplanung(vorgangsId);
}


/**
 * FUNKTION: Speichert die interne Brandplanung.
 * RÜCKGABE: Ergebnis aus 21_BrandplanungService.gs
 */
function saveBrandplanung(payload) {
  return speichereBrandplanung(payload);
}


/**
 * FUNKTION: Liefert alle Meta-Daten für Brandplanung.html.
 * ENTHÄLT:
 * - Statuswerte für Brandplanung
 * - Brennerliste
 * - Basis-Metadaten
 */
function getBrandplanungMeta() {
  return {
    betrieb: KONFIGURATION.IDENTITAET.BETRIEB,
    brennereiNummer: KONFIGURATION.IDENTITAET.BRENNEREI_NUMMER,
    maxBlase: KONFIGURATION.IDENTITAET.MAX_BLASE,
    zeitZone: KONFIGURATION.ZOLL_PARAMETER.ZEIT_PARAMETER.ZEITZONE,
    statusWerte: (
      KONFIGURATION &&
      KONFIGURATION.FESTWERTE &&
      Array.isArray(KONFIGURATION.FESTWERTE.BRANDPLANUNG_STATUS)
    ) ? KONFIGURATION.FESTWERTE.BRANDPLANUNG_STATUS.slice() : [],
    brennerListe: getBrandplanungBrennerListe()
  };
}


/**
 * FUNKTION: Liefert die Brennerliste für die interne Brandplanung
 * direkt aus der konfigurierten Dropdown-Quelle.
 */
function getBrandplanungBrennerListe() {
  const cfg = KONFIGURATION &&
    KONFIGURATION.DROPDOWN_QUELLEN &&
    KONFIGURATION.DROPDOWN_QUELLEN.BRENNER
      ? KONFIGURATION.DROPDOWN_QUELLEN.BRENNER
      : null;

  if (!cfg) return [];

  const tabellenKey = textNormalisieren_(cfg.tabelle);
  const spaltenName = textNormalisieren_(cfg.spalte);

  if (!tabellenKey || !spaltenName) return [];

  const sh = tabelleHolen_(tabellenKey);
  if (!sh || sh.getLastRow() < 2) return [];

  const daten = sh.getDataRange().getDisplayValues();
  const kopf = daten[0].map(function(v) {
    return textNormalisieren_(v);
  });

  const spaltenIndex = kopf.indexOf(spaltenName);
  if (spaltenIndex < 0) {
    systemLogSchreiben_(
      "WARN",
      "WebApp",
      "Brenner-Spalte nicht gefunden",
      "",
      tabellenKey + " | " + spaltenName
    );
    return [];
  }

  const gesehen = {};
  const liste = [];

  for (let i = 1; i < daten.length; i++) {
    const wert = textNormalisieren_(daten[i][spaltenIndex]);
    if (!wert) continue;
    if (gesehen[wert]) continue;

    gesehen[wert] = true;
    liste.push(wert);
  }

  liste.sort(function(a, b) {
    return String(a).localeCompare(String(b), "de");
  });

  return liste;
}



/**
 * FUNKTION:
 * Findet Dropdown-Spalten robust, damit kleine Abweichungen in Umlauten,
 * Leerzeichen oder Trennzeichen nicht sofort zu leeren WebApp-Dropdowns führen.
 */
function findeDropdownSpaltenIndexFuerWebApp_(kopf, spaltenName) {
  const gesucht = textNormalisieren_(spaltenName);
  const direkt = kopf.indexOf(gesucht);
  if (direkt >= 0) return direkt;

  const gesuchtNorm = dropdownHeaderVergleichswert_(gesucht);
  for (let i = 0; i < kopf.length; i++) {
    if (dropdownHeaderVergleichswert_(kopf[i]) === gesuchtNorm) return i;
  }

  return -1;
}


/**
 * FUNKTION:
 * Vergleichswert für Dropdown-Header.
 */
function dropdownHeaderVergleichswert_(wert) {
  return textNormalisieren_(wert)
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '');
}
/**
 * FUNKTION: Normalisiert eingehende Werte je nach Feldtyp.
 */
function webAppFeldwertNormalisieren_(fieldKey, val) {
  const key = textNormalisieren_(fieldKey);
  const wert = val == null ? "" : val;

  if (key === "TAG_BRAND" || key === "TERMIN_MAISCHE") {
    return datumWebAppNachTabellenwert_(wert);
  }

  if (key === "VON" || key === "BIS") {
    return zeitWebAppNachTabellenwert_(wert);
  }

  return textNormalisieren_(wert);
}


/**
 * FUNKTION: Prüft, ob ein Feld die Dossier-Link-Berechnung beeinflusst.
 */
function istDossierRelevantesFeld_(fieldKey) {
  const key = textNormalisieren_(fieldKey);

  return [
    "VORGANGS_ID",
    "STOFFBESITZER",
    "TERMIN_MAISCHE",
    "TAG_BRAND",
    "REGISTERNUMMER"
  ].indexOf(key) !== -1;
}


/**
 * FUNKTION: Wandelt HTML-Datum yyyy-mm-dd in Tabellenwert.
 */
function datumWebAppNachTabellenwert_(wert) {
  const text = textNormalisieren_(wert);
  if (!text) return "";

  const m = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return text;

  return new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    12, 0, 0, 0
  );
}


/**
 * FUNKTION: Wandelt Zeitwert 0800 oder 08:00 in Tabellenformat.
 */
function zeitWebAppNachTabellenwert_(wert) {
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
 * FUNKTION: Formatiert einen Date-Wert zu yyyy-MM-dd.
 */
function datumAlsIsoString_(wert) {
  if (wert instanceof Date) {
    return Utilities.formatDate(
      wert,
      KONFIGURATION.ZOLL_PARAMETER.ZEIT_PARAMETER.ZEITZONE,
      "yyyy-MM-dd"
    );
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
 * FUNKTION: Formatiert Uhrzeitwerte für das Cockpit.
 */
function wertAlsZeitText_(wert, displayWert) {
  if (wert instanceof Date) {
    return Utilities.formatDate(
      wert,
      KONFIGURATION.ZOLL_PARAMETER.ZEIT_PARAMETER.ZEITZONE,
      "HH:mm"
    );
  }

  const displayText = textNormalisieren_(displayWert);
  if (/^\d{2}:\d{2}$/.test(displayText)) {
    return displayText;
  }

  const text = textNormalisieren_(wert);
  if (!text) return displayText || "";

  if (/^\d{4}$/.test(text)) {
    return text.substring(0, 2) + ":" + text.substring(2, 4);
  }

  const hhmm = text.match(/(?:^|\s)(\d{1,2}):(\d{2})(?::\d{2})?(?:$|\s)/);
  if (hhmm) {
    return ('0' + hhmm[1]).slice(-2) + ':' + hhmm[2];
  }

  const isoDateTime = text.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (isoDateTime) {
    return isoDateTime[4] + ':' + isoDateTime[5];
  }

  const deDateTime = text.match(/^(\d{2})\.(\d{2})\.(\d{4})[ ,]+(\d{2}):(\d{2})/);
  if (deDateTime) {
    return deDateTime[4] + ':' + deDateTime[5];
  }

  if (/^\d{2}:\d{2}$/.test(text)) {
    return text;
  }

  return displayText || text;
}

/**
 * =========================================================
 * MAISCHEANNAHME – API FÜR Index.html
 * =========================================================
 */


/**
 * FUNKTION:
 * Liefert Vorgänge und Dropdown-Stammdaten für die Maischeannahme-WebApp.
 */
function getMaischeannahmeDropdowns() {
  return {
    vorgaenge: ladeMaischeannahmeWebVorgaenge_(),
    brennerListe: getBrandplanungBrennerListe(),
    zollStatusListe: (
      KONFIGURATION &&
      KONFIGURATION.FESTWERTE &&
      Array.isArray(KONFIGURATION.FESTWERTE.ZOLL_OK)
    ) ? KONFIGURATION.FESTWERTE.ZOLL_OK.slice() : [],
    fassgroessenListe: holeDropdownWerteAusQuelleFuerWebApp_("FASS_VP"),
    materialListe: holeDropdownWerteAusQuelleFuerWebApp_("MATERIAL"),
    gewuerzeListe: holeDropdownWerteAusQuelleFuerWebApp_("GEWUERZE")
  };
}


/**
 * FUNKTION:
 * Lädt einen Vorgang für die Maischeannahme-WebApp.
 */
function getMaischeannahmeDetails(vorgangsId) {
  return ladeMaischeannahmeWebVorgang_(vorgangsId);
}


/**
 * FUNKTION:
 * Speichert die Maischeannahme aus der WebApp.
 */
function saveMaischeannahme(payload) {
  return speichereMaischeannahmeWebVorgang_(payload);
}




function getBrennfreigabeDropdowns() {
  return {
    vorgaenge: ladeBrennfreigabeWebVorgaenge_(),
    brennerListe: getBrandplanungBrennerListe(),
    zollStatusListe: [
      '✅ GENEHMIGT',
      '❌ ABGELEHNT'
    ],
    fassgroessenListe: holeDropdownWerteAusQuelleFuerWebApp_("FASS_VP"),
    materialListe: holeDropdownWerteAusQuelleFuerWebApp_("MATERIAL"),
    gewuerzeListe: holeDropdownWerteAusQuelleFuerWebApp_("GEWUERZE")
  };
}

function getBrennfreigabeDetails(vorgangsId) {
  return ladeBrennfreigabeWebVorgang_(vorgangsId);
}

function saveBrennfreigabe(payload) {
  return speichereBrennfreigabeWebVorgang_(payload);
}

/**
 * FUNKTION:
 * Liest Dropdownwerte aus den konfigurierten Quellen.
 */
function holeDropdownWerteAusQuelleFuerWebApp_(key) {
  if (
    !KONFIGURATION ||
    !KONFIGURATION.DROPDOWN_QUELLEN ||
    !KONFIGURATION.DROPDOWN_QUELLEN[key]
  ) {
    return [];
  }

  const quelle = KONFIGURATION.DROPDOWN_QUELLEN[key];
  const tKey = textNormalisieren_(quelle.tabelle);
  const spaltenName = textNormalisieren_(quelle.spalte);

  if (!tKey || !spaltenName) return [];

  const sh = tabelleHolen_(tKey);
  if (!sh || sh.getLastRow() < 2) return [];

  const daten = sh.getDataRange().getDisplayValues();
  const kopf = daten[0].map(function(v) {
    return textNormalisieren_(v);
  });

  const idx = findeDropdownSpaltenIndexFuerWebApp_(kopf, spaltenName);
  if (idx < 0) {
    systemLogSchreiben_(
      "WARN",
      "WebApp",
      "Dropdown-Spalte nicht gefunden",
      "",
      tKey + " | " + spaltenName
    );
    return [];
  }

  const gesehen = {};
  const liste = [];

  for (let i = 1; i < daten.length; i++) {
    const wert = textNormalisieren_(daten[i][idx]);
    if (!wert) continue;
    if (gesehen[wert]) continue;
    gesehen[wert] = true;
    liste.push(wert);
  }

  liste.sort(function(a, b) {
    return String(a).localeCompare(String(b), "de");
  });

  return liste;
}

/**
 * FUNKTION: Liefert die Zollkontaktliste aus der zentralen KONFIGURATION.
 * ZWECK:
 * - Anzeige im Leitstand
 * - keine automatische Mail
 * - keine automatische Benachrichtigung
 * - keine hart codierten Kontaktdaten im Leitstand
 * QUELLE:
 * - KONFIGURATION.ZOLL_KONTAKTLISTE
 */
function getZollNotfallKontaktliste() {
  var quelle = KONFIGURATION.ZOLL_KONTAKTLISTE;

  if (!quelle || !Array.isArray(quelle.KONTAKTE)) {
    throw new Error("ZOLL_KONTAKTLISTE ist in 01_Config.gs nicht korrekt gepflegt.");
  }

  return {
    titel: quelle.TITEL || "Hauptzollamt Saarbrücken",
    untertitel: quelle.UNTERTITEL || "Telefonliste Steueraufsicht Abfindungsbrennereien",
    stand: quelle.STAND || "",
    faxAlleStandorte: quelle.FAX_ALLE_STANDORTE || "",
    zentraleEmail: quelle.ZENTRALE_EMAIL || "",
    kontakte: quelle.KONTAKTE.map(function(kontakt) {
      return {
        name: kontakt.NAME || "",
        dienstsitz: kontakt.DIENSTSITZ || "",
        telefon: kontakt.TELEFON || "",
        mobil: kontakt.MOBIL || "",
        email: kontakt.EMAIL || ""
      };
    })
  };
}


/**
 * FUNKTION: Prüft die Admin-PIN für die geschützte Mitgliederverwaltung.
 * HINWEIS: Bei Linkzugang ohne Google-Anmeldung ersetzt diese PIN keine echte Nutzeridentität.
 */
function adminMitgliederPinPruefen(pin) {
  pruefeAdminMitgliederPin_(pin);
  return { ok: true };
}

/**
 * FUNKTION: Lädt Mitglieder für die Admin-Mitgliederverwaltung.
 * RÜCKGABE: Vollständige sichtbare Kontaktdaten aus 👥_MITGLIEDER.
 */
function adminMitgliederListeLaden(pin, suchtext) {
  pruefeAdminMitgliederPin_(pin);

  const sh = tabelleHolen_('MITGLIEDER');
  if (!sh) throw new Error('Blatt MITGLIEDER nicht gefunden.');

  const letzteZeile = sh.getLastRow();
  const letzteSpalte = sh.getLastColumn();
  if (letzteZeile < 2 || letzteSpalte < 1) return { ok: true, mitglieder: [] };

  const header = sh.getRange(1, 1, 1, letzteSpalte).getDisplayValues()[0].map(function(h) {
    return textNormalisieren_(h);
  });
  const daten = sh.getRange(2, 1, letzteZeile - 1, letzteSpalte).getDisplayValues();
  const suche = textNormalisieren_(suchtext).toLowerCase();
  const relevanteHeader = adminMitgliederHeader_();
  const liste = [];

  daten.forEach(function(row, index) {
    const objekt = { _zeile: index + 2 };

    relevanteHeader.forEach(function(name) {
      const idx = header.indexOf(name);
      objekt[name] = idx > -1 ? textNormalisieren_(row[idx]) : '';
    });

    if (!objekt.NameAnzeige && (objekt.Zuname || objekt.Vorname)) {
      objekt.NameAnzeige = adminNameAnzeigeBilden_(objekt.Zuname, objekt.Vorname);
    }

    if (suche && !adminMitgliedPasstZurSuche_(objekt, suche)) return;
    liste.push(objekt);
  });

  liste.sort(function(a, b) {
    return String(a.NameAnzeige || '').localeCompare(String(b.NameAnzeige || ''), 'de');
  });

  return {
    ok: true,
    mitglieder: liste
  };
}

/**
 * FUNKTION: Speichert ein bestehendes Mitglied oder legt ein neues Mitglied an.
 */
function adminMitgliedSpeichern(pin, payload) {
  pruefeAdminMitgliederPin_(pin);

  return mitSperreAusfuehren_(function() {
    const sh = tabelleHolen_('MITGLIEDER');
    if (!sh) throw new Error('Blatt MITGLIEDER nicht gefunden.');

    const letzteSpalte = sh.getLastColumn();
    if (letzteSpalte < 1) throw new Error('Mitgliederblatt hat keine Headerzeile.');

    const header = sh.getRange(1, 1, 1, letzteSpalte).getDisplayValues()[0].map(function(h) {
      return textNormalisieren_(h);
    });

    adminPflichtHeaderPruefen_(header, ['MitgliederID', 'Stoffbesitzernummer', 'Zuname', 'Vorname', 'PLZ', 'Wohnort', 'Straße', 'Nr.', 'Geb.datum', 'Eintritt', 'Telefon', 'E-Mail', 'NameAnzeige', 'Vereinsmitglied']);

    const daten = payload || {};
    let zeile = Number(daten._zeile || 0);
    const neu = !zeile || zeile <= 1;

    if (neu) {
      zeile = sh.getLastRow() + 1;
    }

    const aktuelleWerte = neu
      ? new Array(letzteSpalte).fill('')
      : sh.getRange(zeile, 1, 1, letzteSpalte).getValues()[0];

    const relevanteHeader = adminMitgliederHeader_();
    relevanteHeader.forEach(function(name) {
      const idx = header.indexOf(name);
      if (idx < 0) return;
      let wert = textNormalisieren_(daten[name]);

      if (name === 'MitgliederID' && !wert) {
        wert = adminNaechsteMitgliederId_(sh, header);
      }

      if (name === 'NameAnzeige' && !wert) {
        wert = adminNameAnzeigeBilden_(daten.Zuname, daten.Vorname);
      }

      if (name === 'Vereinsmitglied') {
        wert = adminVereinsmitgliedWert_(wert);
      }

      aktuelleWerte[idx] = wert;
    });

    if (!textNormalisieren_(aktuelleWerte[header.indexOf('NameAnzeige')])) {
      throw new Error('NameAnzeige konnte nicht gebildet werden. Zuname oder Vorname fehlt.');
    }

    sh.getRange(zeile, 1, 1, letzteSpalte).setValues([aktuelleWerte]);
    SpreadsheetApp.flush();

    if (typeof dropdownsMaischeannahmeNeuAufbauen === 'function') {
      try {
        dropdownsMaischeannahmeNeuAufbauen(true);
      } catch (e) {
        systemLogSchreiben_('WARN', 'AdminMitglieder', 'Dropdown-Neuaufbau nach Mitgliederspeicherung fehlgeschlagen', '', String(e));
      }
    }

    systemLogSchreiben_(
      'INFO',
      'AdminMitglieder',
      neu ? 'Mitglied neu angelegt' : 'Mitglied geändert',
      '',
      'Zeile: ' + zeile + ' | NameAnzeige: ' + aktuelleWerte[header.indexOf('NameAnzeige')]
    );

    return {
      ok: true,
      neu: neu,
      zeile: zeile
    };
  }, 'adminMitgliedSpeichern');
}



/**
 * FUNKTION: Erstellt oder öffnet den Hauptordner des Stoffbesitzers unter dem konfigurierten Drive-Wurzelordner.
 * HINWEIS: Die eigentliche Ordnerlogik liegt in 05_DriveService.gs.
 */
function adminStoffbesitzerOrdnerSicherstellen(pin, payload) {
  pruefeAdminMitgliederPin_(pin);

  const daten = payload || {};
  let stoffbesitzer = textNormalisieren_(daten.NameAnzeige);
  if (!stoffbesitzer) {
    stoffbesitzer = adminNameAnzeigeBilden_(daten.Zuname, daten.Vorname);
  }
  if (!stoffbesitzer) {
    throw new Error('Name fehlt für Drive-Ordner.');
  }

  if (typeof getStoffbesitzerHauptOrdner_ !== 'function') {
    throw new Error('Drive-Funktion getStoffbesitzerHauptOrdner_ ist nicht verfügbar.');
  }

  const ordner = getStoffbesitzerHauptOrdner_(stoffbesitzer);
  const url = ordner && typeof ordner.getUrl === 'function' ? ordner.getUrl() : '';

  if (!url) {
    throw new Error('Drive-Ordner konnte nicht geöffnet oder angelegt werden.');
  }

  systemLogSchreiben_(
    'INFO',
    'AdminMitglieder',
    'Stoffbesitzer-Drive-Ordner geöffnet oder angelegt',
    '',
    stoffbesitzer + ' | ' + url
  );

  return {
    ok: true,
    stoffbesitzer: stoffbesitzer,
    url: url
  };
}

function pruefeAdminMitgliederPin_(pin) {
  const eingabe = textNormalisieren_(pin);
  const scriptPin = textNormalisieren_(PropertiesService.getScriptProperties().getProperty('MITGLIEDER_ADMIN_PIN'));
  const configPin = KONFIGURATION && KONFIGURATION.ADMIN
    ? textNormalisieren_(KONFIGURATION.ADMIN.MITGLIEDER_PIN)
    : '';
  const gueltigePin = scriptPin || configPin;

  if (!gueltigePin) {
    throw new Error('Admin-PIN ist nicht konfiguriert.');
  }

  if (!eingabe || eingabe !== gueltigePin) {
    systemLogSchreiben_('WARN', 'AdminMitglieder', 'Ungültige Admin-PIN', '', 'Zugriff verweigert');
    throw new Error('Admin-PIN ungültig.');
  }
}


function adminVereinsmitgliedWert_(wert) {
  const v = textNormalisieren_(wert).toLowerCase();
  if (v === 'x' || v === 'ja' || v === 'j' || v === 'true' || v === '1') return 'x';
  return '';
}

function adminMitgliedPasstZurSuche_(mitglied, suche) {
  const q = textNormalisieren_(suche).toLowerCase();
  if (!q) return true;

  const nameFelder = [
    mitglied.NameAnzeige,
    mitglied.Zuname,
    mitglied.Vorname
  ].map(function(wert) {
    return textNormalisieren_(wert).toLowerCase();
  }).filter(Boolean);

  const nummerFelder = [
    mitglied.Stoffbesitzernummer,
    mitglied.Telefon
  ].map(function(wert) {
    return textNormalisieren_(wert).toLowerCase();
  }).filter(Boolean);

  const kontaktFelder = [
    mitglied.Wohnort,
    mitglied.PLZ,
    mitglied['E-Mail']
  ].map(function(wert) {
    return textNormalisieren_(wert).toLowerCase();
  }).filter(Boolean);

  if (/\d/.test(q)) {
    return nummerFelder.some(function(wert) { return wert.indexOf(q) !== -1; });
  }

  if (q.indexOf('@') !== -1 || q.indexOf('.') !== -1) {
    return String(mitglied['E-Mail'] || '').toLowerCase().indexOf(q) !== -1;
  }

  const tokens = q.split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;

  return tokens.every(function(token) {
    if (token.length < 3) {
      return nameFelder.some(function(wert) {
        return adminTextHatWortanfang_(wert, token);
      });
    }

    return nameFelder.some(function(wert) {
      return wert.indexOf(token) !== -1 || adminTextHatWortanfang_(wert, token);
    }) || kontaktFelder.some(function(wert) {
      return adminTextHatWortanfang_(wert, token);
    });
  });
}

function adminTextHatWortanfang_(text, token) {
  const t = textNormalisieren_(text).toLowerCase();
  const q = textNormalisieren_(token).toLowerCase();
  if (!t || !q) return false;
  return t.split(/[^a-z0-9äöüß]+/i).some(function(wort) {
    return wort.indexOf(q) === 0;
  });
}

function adminMitgliederHeader_() {
  return [
    'MitgliederID',
    'Stoffbesitzernummer',
    'Zuname',
    'Vorname',
    'PLZ',
    'Wohnort',
    'Straße',
    'Nr.',
    'Geb.datum',
    'Eintritt',
    'Telefon',
    'E-Mail',
    'NameAnzeige',
    'Vereinsmitglied'
  ];
}

function adminPflichtHeaderPruefen_(header, pflichtHeader) {
  const fehlend = [];
  (pflichtHeader || []).forEach(function(name) {
    if (header.indexOf(name) < 0) fehlend.push(name);
  });
  if (fehlend.length) {
    throw new Error('Pflichtspalten im Mitgliederblatt fehlen: ' + fehlend.join(', '));
  }
}

function adminNameAnzeigeBilden_(zuname, vorname) {
  const z = textNormalisieren_(zuname);
  const v = textNormalisieren_(vorname);
  if (z && v) return z + ', ' + v;
  return z || v || '';
}

function adminNaechsteMitgliederId_(sh, header) {
  const idx = header.indexOf('MitgliederID');
  if (idx < 0) return 'M-' + Utilities.formatDate(new Date(), holeZeitzone_(), 'yyyyMMddHHmmss');

  const letzteZeile = sh.getLastRow();
  if (letzteZeile < 2) return 'M-0001';

  const werte = sh.getRange(2, idx + 1, letzteZeile - 1, 1).getDisplayValues();
  let max = 0;

  werte.forEach(function(row) {
    const text = textNormalisieren_(row[0]);
    const match = text.match(/(\d+)$/);
    if (!match) return;
    const nummer = Number(match[1]);
    if (!isNaN(nummer) && nummer > max) max = nummer;
  });

  if (max > 0) {
    return 'M-' + String(max + 1).padStart(4, '0');
  }

  return 'M-' + Utilities.formatDate(new Date(), holeZeitzone_(), 'yyyyMMddHHmmss');
}
