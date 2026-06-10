/**
 * DATEI: 11_MaischeService.gs
 * ZWECK:
 * FACHLOGIK FÜR WEB-VORGANGSBLOCK IN 🔥_BRANDTAG_UEBERSICHT
 *
 * WICHTIG:
 * - keine neue Tabellenarchitektur
 * - Operative Speicherung der WebApp direkt in 🔥_BRANDTAG_UEBERSICHT
 * - Vorgangs_ID bleibt technischer Schlüssel
 * - Stoffbesitzer bleibt operativer Bezug
 * - Brandplanung liefert Vorbelegung
 * - Maischeannahme konkretisiert
 * - vorhandene echte Fachzeilen werden nicht blind gelöscht
 */


/* ========================================================================
 * ALTE WEBAPP-KOMPATIBILITÄT
 * ====================================================================== */

/**
 * FUNKTION:
 * Liefert Dropdowns für die alte Web-Vorgangserfassung.
 */
function ladeWebAppDropdowns() {
  return {
    stoffbesitzer: holeDropdownListeMaische_('STOFFBESITZER'),
    fassgroessen: holeDropdownListeMaische_("FASS_VP"),
    materialien: holeDropdownListeMaische_("MATERIAL"),
    gewuerze: holeDropdownListeMaische_("GEWUERZE"),
    brenner: (typeof getBrandplanungBrennerListe === 'function' ? getBrandplanungBrennerListe() : []),
    zollStatus: (
      KONFIGURATION &&
      KONFIGURATION.FESTWERTE &&
      Array.isArray(KONFIGURATION.FESTWERTE.ZOLL_OK)
    ) ? KONFIGURATION.FESTWERTE.ZOLL_OK.slice() : [],
    statusWerte: (
      KONFIGURATION &&
      KONFIGURATION.FESTWERTE &&
      Array.isArray(KONFIGURATION.FESTWERTE.STATUS)
    ) ? KONFIGURATION.FESTWERTE.STATUS.slice() : []
  };
}

/**
 * FUNKTION:
 * Alias für ältere Aufrufer.
 */
function speichereWebVorgang(payload) {
  return webVorgangBlockSpeichern_(payload);
}

/**
 * FUNKTION:
 * Alias für ältere Aufrufer.
 */
function ladeWebVorgang(vorgangsId) {
  return webVorgangBlockLaden_(vorgangsId);
}

/**
 * FUNKTION:
 * Alte Block-Speicherlogik bleibt als Hülle erhalten und nutzt intern
 * die neue Maischeannahme-Speicherlogik.
 */
function webVorgangBlockSpeichern_(payload) {
  const neuPayload = legacyPayloadNachMaischePayload_(payload);
  return speichereMaischeannahmeWebVorgang_(neuPayload);
}

/**
 * FUNKTION:
 * Alte Block-Ladelogik bleibt als Hülle erhalten.
 */
function webVorgangBlockLaden_(vorgangsId) {
  const details = ladeMaischeannahmeWebVorgang_(vorgangsId);

  return {
    vorgangsId: details.vorgangsId || '',
    stoffbesitzer: details.stoffbesitzer || '',
    terminMaische: details.terminMaische || '',
    tagBrand: details.tagBrand || '',
    von: details.von || '',
    bis: details.bis || '',
    brenner: details.brenner || '',
    zollOk: details.zollOk || '',
    status: details.status || '',
    registernummer: details.registernummer || '',
    infoSystem: details.infoSystem || details.bemerkungVorplanung || '',
    faesser: (details.slots || []).map(function(slot) {
      return {
        fassnummer: slot.fassnummern || '',
        fassgroesse: slot.fassgroesse || '',
        inhalt: slot.inhalt || '',
        rohstoffe: materialStringNachListe_(slot.material),
        gewuerze: slot.gewuerze || '',
        anzahlBraende: slot.anzahlBraende || '1',
        ausbeute: slot.ausbeute || '',
        alkohol: slot.alkohol || '',
        statusAktion: slot.statusAktion || ''
      };
    })
  };
}


/* ========================================================================
 * WEBAPP: VORGANGSLISTE / DETAILS
 * ====================================================================== */

function ladeMaischeannahmeWebVorgaenge_() {
  const map = {};

  // Performance-Fix:
  // Die operative Eingabemaske braucht keine vollständige Auswertung der Brandtageplanung.
  // Brandtageplanung kann groß werden und hat das Laden der Maischeannahme sichtbar verlangsamt.
  maischeannahmeVorgaengeAusVorplanungSammeln_(map);
  maischeannahmeVorgaengeAusMaischeblattSammeln_(map);

  return Object.keys(map)
    .map(function(vId) {
      const item = map[vId] || {};
      const stoff = textNormalisieren_(item.stoffbesitzer);
      return {
        vorgangsId: vId,
        stoffbesitzer: stoff,
        bemerkungVorplanung: textNormalisieren_(item.bemerkungVorplanung),
        anzeige: stoff ? stoff + ' | ' + vId : vId
      };
    })
    .sort(function(a, b) {
      const stoffA = String(a.stoffbesitzer || '');
      const stoffB = String(b.stoffbesitzer || '');
      const cmp = stoffA.localeCompare(stoffB, 'de');
      if (cmp !== 0) return cmp;
      return String(a.vorgangsId || '').localeCompare(String(b.vorgangsId || ''));
    });
}

function ladeMaischeannahmeWebVorgang_(vorgangsId) {
  const vId = textNormalisieren_(vorgangsId);
  if (!vId) throw new Error('Vorgangs_ID fehlt.');

  const vorplanung = holeVorplanungDatensatzNachVorgangsId_(vId);
  const brandplanungSlots = ladeBrandplanungSlotsFuerMaischeannahme_(vId);

  const details = {
    vorgangsId: vId,
    stoffbesitzer: textNormalisieren_(vorplanung.stoffbesitzer),
    bemerkungVorplanung: textNormalisieren_(vorplanung.bemerkungVorplanung),
    dossierLink: textNormalisieren_(vorplanung.dossierLink),
    infoSystem: textNormalisieren_(vorplanung.bemerkungVorplanung),
    registernummer: textNormalisieren_(vorplanung.registernummer),
    status: holeMaischeannahmeStatusStandard_(),
    terminMaische: '',
    tagBrand: '',
    von: '',
    bis: '',
    brenner: '',
    zollOk: '',
    slots: []
  };

  const blatt = tabelleHolen_('MAISCHEANNAHME');
  if (!blatt) throw new Error('Tabelle 🍎_MAISCHEANNAHME nicht gefunden.');

  const sMap = spaltenZuordnungHolen_(blatt);
  const zeilen = alleZeilenMitVorgangsIdHolen_(blatt, vId);

  if (zeilen.length > 0) {
    for (let i = 0; i < zeilen.length; i++) {
      const zeileNr = zeilen[i];
      const range = blatt.getRange(zeileNr, 1, 1, blatt.getLastColumn());
      const row = range.getValues()[0];
      const displayRow = range.getDisplayValues()[0];
      const slot = maischeZeileAlsWebSlotObjekt_(row, sMap, zeileNr, displayRow);

      details.slots.push(slot);

      if (!details.stoffbesitzer) details.stoffbesitzer = textNormalisieren_(holeZellenwertAusRawZeile_(row, sMap.STOFFBESITZER));
      if (!details.dossierLink) details.dossierLink = textNormalisieren_(holeZellenwertAusRawZeile_(row, sMap.DOSSIER_LINK));
      if (!details.registernummer) details.registernummer = textNormalisieren_(holeZellenwertAusRawZeile_(row, sMap.REGISTERNUMMER));
      if (!details.infoSystem) details.infoSystem = textNormalisieren_(holeZellenwertAusRawZeile_(row, sMap.INFO_SYSTEM));
      if (!details.terminMaische) details.terminMaische = slot.terminMaische || '';
      if (!details.tagBrand) details.tagBrand = slot.tagBrand || '';
      if (!details.von) details.von = slot.von || '';
      if (!details.bis) details.bis = slot.bis || '';
      if (!details.brenner) details.brenner = slot.brenner || '';
      if (!details.zollOk) details.zollOk = slot.zollOk || '';
      const statusAusZeile = textNormalisieren_(holeZellenwertAusRawZeile_(row, sMap.STATUS));
      if (statusAusZeile) details.status = statusAusZeile;
    }
  } else {
    details.slots = brandplanungSlots.slice();
    if (details.slots.length > 0) {
      details.terminMaische = details.slots[0].terminMaische || '';
      details.tagBrand = details.slots[0].tagBrand || '';
      details.von = details.slots[0].von || '';
      details.bis = details.slots[0].bis || '';
      details.brenner = details.slots[0].brenner || '';
      details.zollOk = details.slots[0].zollOk || '';
    }
  }

  if (!details.slots.length) {
    details.slots.push(leererMaischeSlot_());
  }

  return details;
}


/* ========================================================================
 * WEBAPP: SPEICHERN
 * ====================================================================== */

function speichereMaischeannahmeWebVorgang_(payload) {
  return mitSperreAusfuehren_(function() {
    if (!payload) throw new Error('Payload fehlt.');

    const vId = textNormalisieren_(payload.vorgangsId);
    const stoffbesitzer = textNormalisieren_(payload.stoffbesitzer);
    const bemerkungVorplanung = textNormalisieren_(payload.bemerkungVorplanung || payload.infoSystem);
    const registernummer = textNormalisieren_(payload.registernummer);
    const status = holeMaischeannahmeStatusStandard_();
    const slots = Array.isArray(payload.slots) ? payload.slots : [];

    if (!vId) throw new Error('Vorgangs_ID fehlt.');
    if (!stoffbesitzer) throw new Error('Stoffbesitzer fehlt.');
    if (!slots.length) throw new Error('Es ist kein Zeitslot vorhanden.');

    const blatt = tabelleHolen_('MAISCHEANNAHME');
    if (!blatt) throw new Error('Tabelle 🍎_MAISCHEANNAHME nicht gefunden.');

    const sMap = spaltenZuordnungHolen_(blatt);
    const anzahlSpalten = blatt.getLastColumn();

    maischeMehrfachauswahlValidierungEntschaerfen_(blatt, sMap);

    registereintragSicherstellen_(vId, stoffbesitzer, status);

    const vorplanung = holeVorplanungDatensatzNachVorgangsId_(vId);
    let dossierLink = textNormalisieren_(payload.dossierLink || vorplanung.dossierLink);
    if (!dossierLink && typeof dossierGrundstrukturInitialAnlegen_ === 'function') {
      try {
        const ordner = dossierGrundstrukturInitialAnlegen_(vId, stoffbesitzer, payload.terminMaische || new Date());
        dossierLink = ordner && ordner.getUrl ? ordner.getUrl() : dossierLink;
      } catch (e) {
        systemLogSchreiben_('WARN', 'MaischeService', 'Drive-Grundstruktur konnte beim Speichern nicht angelegt werden', vId, String(e));
      }
    }

    const bestehendeZeilen = alleZeilenMitVorgangsIdHolen_(blatt, vId);
    const bestehendeDatenNachZeile = {};
    const uebermittelteBestehendeZeilen = {};
    const neueZeilen = [];
    const aktualisierteZeilen = [];
    const zuLoeschendeZeilen = [];

    for (let i = 0; i < bestehendeZeilen.length; i++) {
      const zeileNr = bestehendeZeilen[i];
      bestehendeDatenNachZeile[zeileNr] = blatt.getRange(zeileNr, 1, 1, anzahlSpalten).getValues()[0];
    }

    slots.forEach(function(slot, index) {
      const s = normalisiereMaischeSlotPayload_(slot);

      if (!s.terminMaische) {
        s.terminMaische = textNormalisieren_(payload.terminMaische);
      }

      validiereMaischeSlot_(s, index + 1);

      const bestehendeZeile = parseInt(s.bestehendeZeile, 10);
      const basisZeile = (bestehendeZeile && bestehendeDatenNachZeile[bestehendeZeile])
        ? bestehendeDatenNachZeile[bestehendeZeile].slice()
        : new Array(anzahlSpalten).fill('');

      const speicherZeile = baueMaischeWebSpeicherzeile_(basisZeile, sMap, {
        vorgangsId: vId,
        stoffbesitzer: stoffbesitzer,
        status: status,
        bemerkungVorplanung: bemerkungVorplanung,
        dossierLink: dossierLink,
        registernummer: registernummer,
        slot: s
      }, anzahlSpalten);

      if (bestehendeZeile && bestehendeDatenNachZeile[bestehendeZeile]) {
        maischeMehrfachauswahlValidierungInZeileEntfernen_(blatt, sMap, bestehendeZeile);
        blatt.getRange(bestehendeZeile, 1, 1, anzahlSpalten).setValues([speicherZeile]);
        aktualisiereMaischeannahmeFormatierung_(blatt, sMap, bestehendeZeile);
        uebermittelteBestehendeZeilen[bestehendeZeile] = true;
        aktualisierteZeilen.push(bestehendeZeile);
      } else {
        neueZeilen.push(speicherZeile);
      }
    });

    for (let i = 0; i < bestehendeZeilen.length; i++) {
      const zeileNr = bestehendeZeilen[i];
      if (uebermittelteBestehendeZeilen[zeileNr]) continue;

      const row = bestehendeDatenNachZeile[zeileNr];
      if (istNurPlanungszeileInMaischeannahme_(row, sMap)) {
        zuLoeschendeZeilen.push(zeileNr);
      }
    }

    if (zuLoeschendeZeilen.length > 0) {
      loescheZeilenRueckwaerts_(blatt, zuLoeschendeZeilen);
    }

    if (neueZeilen.length > 0) {
      const startZeile = blatt.getLastRow() + 1;
      for (let i = 0; i < neueZeilen.length; i++) {
        maischeMehrfachauswahlValidierungInZeileEntfernen_(blatt, sMap, startZeile + i);
      }
      blatt.getRange(startZeile, 1, neueZeilen.length, anzahlSpalten).setValues(neueZeilen);

      for (let i = 0; i < neueZeilen.length; i++) {
        aktualisiereMaischeannahmeFormatierung_(blatt, sMap, startZeile + i);
      }
    }

    if (textNormalisieren_(dossierLink) && sMap.DOSSIER_LINK) {
      const vorgangsZeilen = alleZeilenMitVorgangsIdHolen_(blatt, vId);
      vorgangsZeilen.forEach(function(zeileNr) {
        blatt.getRange(zeileNr, sMap.DOSSIER_LINK).setValue(dossierLink);
      });
    } else {
      try {
        dossierLinkFuerGesamtenVorgangAktualisieren_(blatt, vId);
      } catch (e) {
        systemLogSchreiben_(
          'WARN',
          'MaischeService',
          'Vorhandener Dossier-Link konnte nach WebApp-Speichern nicht übernommen werden',
          vId,
          e && e.message ? e.message : String(e)
        );
      }
    }

    registerStatusAktualisieren_(vId, status);

    const archiviert = false;

    systemLogSchreiben_(
      'INFO',
      'MaischeService',
      'Maischeannahme in WebApp gespeichert',
      vId,
      'Aktualisiert: ' + aktualisierteZeilen.length +
        ' | Neu: ' + neueZeilen.length +
        ' | Gelöscht: ' + zuLoeschendeZeilen.length +
        ' | Archiviert: ' + archiviert
    );

    return {
      ok: true,
      vorgangsId: vId,
      aktualisiert: aktualisierteZeilen.length,
      neu: neueZeilen.length,
      geloescht: zuLoeschendeZeilen.length,
      archiviert: archiviert
    };
  }, 'speichereMaischeannahmeWebVorgang_');
}


function istVorgangArchiviert_(vorgangsId) {
  const vId = textNormalisieren_(vorgangsId);
  if (!vId) return false;

  const sh = tabelleHolen_("ZENTRALREGISTER");
  if (!sh || sh.getLastRow() < 2) return false;

  const sMap = spaltenZuordnungHolen_(sh);
  if (!sMap.VORGANGS_ID || !sMap.STATUS) return false;

  const zeile = ersteZeileMitVorgangsIdHolen_(sh, vId);
  if (zeile < 2) return false;

  const status = textNormalisieren_(sh.getRange(zeile, sMap.STATUS).getDisplayValue());
  return status === KONFIGURATION.STATUSWERTE.ARCHIVIERT;
}


/* ========================================================================
 * VORGANGSQUELLEN
 * ====================================================================== */

function maischeannahmeVorgaengeAusVorplanungSammeln_(zielMap, filterCache) {
  const sh = tabelleHolen_('VORPLANUNG');
  if (!sh || sh.getLastRow() < 2) return;

  const sMap = spaltenZuordnungHolen_(sh);
  const daten = sh.getDataRange().getDisplayValues();

  for (let i = 1; i < daten.length; i++) {
    const row = daten[i];
    const vId = textNormalisieren_(sMap.VORGANGS_ID ? row[sMap.VORGANGS_ID - 1] : '');
    if (!vId) continue;
    if (!vorgangsbearbeitungDarfAngezeigtWerden_(vId, filterCache)) continue;

    if (!zielMap[vId]) {
      zielMap[vId] = {
        vorgangsId: vId,
        anzeige: vId + ' – ' + textNormalisieren_(sMap.STOFFBESITZER ? row[sMap.STOFFBESITZER - 1] : ''),
        stoffbesitzer: textNormalisieren_(sMap.STOFFBESITZER ? row[sMap.STOFFBESITZER - 1] : ''),
        bemerkungVorplanung: textNormalisieren_(sMap.BEMERKUNG ? row[sMap.BEMERKUNG - 1] : '')
      };
    }
  }
}

function maischeannahmeVorgaengeAusBrandplanungSammeln_(zielMap) {
  const sh = tabelleHolen_('BRANDTAGE_PLANUNG');
  if (!sh || sh.getLastRow() < 2) return;

  const sMap = spaltenZuordnungHolen_(sh);
  const daten = sh.getDataRange().getDisplayValues();

  for (let i = 1; i < daten.length; i++) {
    const row = daten[i];
    const vId = textNormalisieren_(sMap.VORGANGS_ID ? row[sMap.VORGANGS_ID - 1] : '');
    if (!vId) continue;
    if (istVorgangArchiviert_(vId)) continue;

    if (!zielMap[vId]) {
      zielMap[vId] = {
        vorgangsId: vId,
        anzeige: vId + ' – ' + textNormalisieren_(sMap.STOFFBESITZER ? row[sMap.STOFFBESITZER - 1] : ''),
        stoffbesitzer: textNormalisieren_(sMap.STOFFBESITZER ? row[sMap.STOFFBESITZER - 1] : ''),
        bemerkungVorplanung: textNormalisieren_(sMap.BEMERKUNG_VORPLANUNG ? row[sMap.BEMERKUNG_VORPLANUNG - 1] : '')
      };
    }
  }
}

function maischeannahmeVorgaengeAusMaischeblattSammeln_(zielMap) {
  const sh = tabelleHolen_('MAISCHEANNAHME');
  if (!sh || sh.getLastRow() < 2) return;

  const sMap = spaltenZuordnungHolen_(sh);
  const daten = sh.getDataRange().getDisplayValues();

  for (let i = 1; i < daten.length; i++) {
    const row = daten[i];
    const vId = textNormalisieren_(sMap.VORGANGS_ID ? row[sMap.VORGANGS_ID - 1] : '');
    if (!vId) continue;
    if (istVorgangArchiviert_(vId)) continue;

    if (!zielMap[vId]) {
      zielMap[vId] = {
        vorgangsId: vId,
        anzeige: vId + ' – ' + textNormalisieren_(sMap.STOFFBESITZER ? row[sMap.STOFFBESITZER - 1] : ''),
        stoffbesitzer: textNormalisieren_(sMap.STOFFBESITZER ? row[sMap.STOFFBESITZER - 1] : ''),
        bemerkungVorplanung: textNormalisieren_(sMap.INFO_SYSTEM ? row[sMap.INFO_SYSTEM - 1] : '')
      };
    }
  }
}


/* ========================================================================
 * VORPLANUNG / BRANDPLANUNG LADEN
 * ====================================================================== */

function holeVorplanungDatensatzNachVorgangsId_(vorgangsId) {
  const result = {
    stoffbesitzer: '',
    bemerkungVorplanung: '',
    dossierLink: '',
    registernummer: ''
  };

  const vId = textNormalisieren_(vorgangsId);
  if (!vId) return result;

  const sh = tabelleHolen_('VORPLANUNG');
  if (!sh || sh.getLastRow() < 2) return result;

  const sMap = spaltenZuordnungHolen_(sh);
  const zeile = ersteZeileMitVorgangsIdHolen_(sh, vId);
  if (zeile < 2) return result;

  result.stoffbesitzer = textNormalisieren_(sMap.STOFFBESITZER ? sh.getRange(zeile, sMap.STOFFBESITZER).getDisplayValue() : '');
  result.bemerkungVorplanung = textNormalisieren_(sMap.BEMERKUNG ? sh.getRange(zeile, sMap.BEMERKUNG).getDisplayValue() : '');
  result.dossierLink = textNormalisieren_(sMap.DOSSIER_LINK ? sh.getRange(zeile, sMap.DOSSIER_LINK).getDisplayValue() : '');
  result.registernummer = textNormalisieren_(sMap.REGISTERNUMMER ? sh.getRange(zeile, sMap.REGISTERNUMMER).getDisplayValue() : '');

  return result;
}

function ladeBrandplanungSlotsFuerMaischeannahme_(vorgangsId) {
  const vId = textNormalisieren_(vorgangsId);
  if (!vId) return [];

  const sh = tabelleHolen_('BRANDTAGE_PLANUNG');
  if (!sh || sh.getLastRow() < 2) return [];

  const sMap = spaltenZuordnungHolen_(sh);
  const range = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn());
  const daten = range.getValues();
  const displayDaten = range.getDisplayValues();
  const liste = [];

  for (let i = 0; i < daten.length; i++) {
    const row = daten[i];
    const displayRow = displayDaten[i] || [];
    const rowVId = textNormalisieren_(holeZellenwertAusRawZeile_(row, sMap.VORGANGS_ID));
    if (rowVId !== vId) continue;

    liste.push({
      bestehendeZeile: '',
      terminMaische: datumAlsHtmlInputWertAusRaw_(holeZellenwertAusRawZeile_(row, sMap.DATUM_MAISCHEANNAHME)),
      tagBrand: datumAlsHtmlInputWertAusRaw_(holeZellenwertAusRawZeile_(row, sMap.BRANDTAG)),
      von: zeitAlsHtmlInputWertAusRaw_(holeZellenwertAusRawZeile_(row, sMap.ZEITSLOT_VON), holeZellenwertAusRawZeile_(displayRow, sMap.ZEITSLOT_VON)),
      bis: zeitAlsHtmlInputWertAusRaw_(holeZellenwertAusRawZeile_(row, sMap.ZEITSLOT_BIS), holeZellenwertAusRawZeile_(displayRow, sMap.ZEITSLOT_BIS)),
      brenner: textNormalisieren_(holeZellenwertAusRawZeile_(row, sMap.BRENNER)),
      fassnummern: '',
      fassgroesse: '',
      inhalt: '',
      material: '',
      gewuerze: '',
      anzahlBraende: textNormalisieren_(holeZellenwertAusRawZeile_(row, sMap.ANZAHL_BRAENDE)) || '1',
      zollOk: '',
      statusAktion: '',
      ausbeute: '',
      alkohol: ''
    });
  }

  return liste;
}


/* ========================================================================
 * SLOT ↔ ZEILE
 * ====================================================================== */

function maischeZeileAlsWebSlotObjekt_(row, sMap, zeileNr, displayRow) {
  const display = displayRow || [];
  return {
    bestehendeZeile: String(zeileNr || ''),
    terminMaische: datumAlsHtmlInputWertAusRaw_(holeZellenwertAusRawZeile_(row, sMap.TERMIN_MAISCHE)),
    tagBrand: datumAlsHtmlInputWertAusRaw_(holeZellenwertAusRawZeile_(row, sMap.TAG_BRAND)),
    von: zeitAlsHtmlInputWertAusRaw_(holeZellenwertAusRawZeile_(row, sMap.VON), holeZellenwertAusRawZeile_(display, sMap.VON)),
    bis: zeitAlsHtmlInputWertAusRaw_(holeZellenwertAusRawZeile_(row, sMap.BIS), holeZellenwertAusRawZeile_(display, sMap.BIS)),
    brenner: textNormalisieren_(holeZellenwertAusRawZeile_(row, sMap.BRENNER)),
    fassnummern: textNormalisieren_(holeZellenwertAusRawZeile_(row, sMap.FASS_NR)),
    fassgroesse: textNormalisieren_(holeZellenwertAusRawZeile_(row, sMap.FASS_VP)),
    inhalt: textNormalisieren_(holeZellenwertAusRawZeile_(row, sMap.INH_VP)),
    material: materialRawNachFrontendText_(holeZellenwertAusRawZeile_(row, sMap.MATERIAL)),
    gewuerze: textNormalisieren_(holeZellenwertAusRawZeile_(row, sMap.GEWUERZE)),
    anzahlBraende: textNormalisieren_(holeZellenwertAusRawZeile_(row, sMap.ANZAHL_BRAENDE)) || '1',
    zollOk: textNormalisieren_(holeZellenwertAusRawZeile_(row, sMap.ZOLL_OK)),
  };
}

function baueMaischeWebSpeicherzeile_(basisZeile, sMap, data, anzahlSpalten) {
  const zeile = Array.isArray(basisZeile) ? basisZeile.slice(0, anzahlSpalten) : [];
  while (zeile.length < anzahlSpalten) {
    zeile.push('');
  }

  const slot = data.slot || {};

  setZellenwertInZeile_(zeile, sMap.VORGANGS_ID, data.vorgangsId);
  setZellenwertInZeile_(zeile, sMap.STOFFBESITZER, data.stoffbesitzer);
  setZellenwertInZeile_(zeile, sMap.TERMIN_MAISCHE, alsReineDatumzelleSicher_(slot.terminMaische));
  setZellenwertInZeile_(zeile, sMap.FASS_VP, slot.fassgroesse);
  setZellenwertInZeile_(zeile, sMap.INH_VP, slot.inhalt);
  setZellenwertInZeile_(zeile, sMap.MATERIAL, materialFrontendNachSpeicherwert_(slot.material));
  setZellenwertInZeile_(zeile, sMap.GEWUERZE, materialFrontendNachSpeicherwert_(slot.gewuerze));
  setZellenwertInZeile_(zeile, sMap.TAG_BRAND, alsReineDatumzelleSicher_(slot.tagBrand));
  setZellenwertInZeile_(zeile, sMap.FASS_NR, slot.fassnummern);
  setZellenwertInZeile_(zeile, sMap.VON, alsReineUhrzeitzelleSicher_(slot.von));
  setZellenwertInZeile_(zeile, sMap.BIS, alsReineUhrzeitzelleSicher_(slot.bis));
  setZellenwertInZeile_(zeile, sMap.BRENNER, slot.brenner);
  setZellenwertInZeile_(zeile, sMap.ANZAHL_BRAENDE, slot.anzahlBraende || '1');
  setZellenwertInZeile_(zeile, sMap.REGISTERNUMMER, data.registernummer);
  setZellenwertInZeile_(zeile, sMap.ZOLL_OK, slot.zollOk);
  setZellenwertInZeile_(zeile, sMap.DOSSIER_LINK, data.dossierLink);
  setZellenwertInZeile_(zeile, sMap.STATUS, data.status);
  setZellenwertInZeile_(zeile, sMap.INFO_SYSTEM, data.bemerkungVorplanung);

  return zeile;
}


/* ========================================================================
 * VALIDIERUNG / NORMALISIERUNG
 * ====================================================================== */


function normalisiereFassnummernText_(wert) {
  return textNormalisieren_(wert)
    .replace(/\s*(?:und|\+|&|,|;)\s*/gi, ' / ')
    .replace(/\s*\/\s*/g, ' / ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function normalisiereMaischeSlotPayload_(slot) {
  const obj = slot || {};

  let material = obj.material;
  if (Array.isArray(material)) {
    material = material
      .map(function(v) { return textNormalisieren_(v); })
      .filter(String)
      .join(' | ');
  }

  if (!material && Array.isArray(obj.materialien)) {
    material = obj.materialien
      .map(function(v) { return textNormalisieren_(v); })
      .filter(String)
      .join(' | ');
  }

  let gewuerze = obj.gewuerze;
  if (Array.isArray(gewuerze)) {
    gewuerze = gewuerze
      .map(function(v) { return textNormalisieren_(v); })
      .filter(String)
      .join(' | ');
  }

  return {
    bestehendeZeile: textNormalisieren_(obj.bestehendeZeile || obj.rowNr),
    terminMaische: textNormalisieren_(obj.terminMaische),
    tagBrand: textNormalisieren_(obj.tagBrand),
    von: textNormalisieren_(obj.von),
    bis: textNormalisieren_(obj.bis),
    brenner: textNormalisieren_(obj.brenner),
    fassnummern: normalisiereFassnummernText_(obj.fassnummern || obj.fassnummer),
    fassgroesse: textNormalisieren_(obj.fassgroesse),
    inhalt: textNormalisieren_(obj.inhalt),
    material: textNormalisieren_(material),
    gewuerze: textNormalisieren_(gewuerze),
    anzahlBraende: textNormalisieren_(obj.anzahlBraende) || '1',
    zollOk: textNormalisieren_(obj.zollOk)
  };
}

function validiereMaischeSlot_(slot, slotNummer) {
  if (!slot.fassnummern) {
    throw new Error('Faßnummern fehlen in Slot ' + slotNummer + '.');
  }
  if (!slot.tagBrand) {
    throw new Error('Brandtag fehlt in Slot ' + slotNummer + '.');
  }
  if (!slot.von || !slot.bis) {
    throw new Error('von/bis fehlt in Slot ' + slotNummer + '.');
  }
  if (!slot.brenner) {
    throw new Error('Brenner fehlt in Slot ' + slotNummer + '.');
  }
}

function leererMaischeSlot_() {
  return {
    bestehendeZeile: '',
    terminMaische: '',
    tagBrand: '',
    von: '',
    bis: '',
    brenner: '',
    fassnummern: '',
    fassgroesse: '',
    inhalt: '',
    material: '',
    gewuerze: '',
    anzahlBraende: '1',
    zollOk: ''
  };
}


/* ========================================================================
 * FACHZEILEN / PLANUNGSZEILEN
 * ====================================================================== */

function istNurPlanungszeileInMaischeannahme_(row, sMap) {
  if (!row || !sMap) return true;

  const fachfelder = [
    'FASS_NR',
    'FASS_VP',
    'INH_VP',
    'MATERIAL',
    'GEWUERZE',
    'REGISTERNUMMER',
    'ZOLL_OK',
    'AUSBEUTE',
    'ALKOHOL',
    'STATUS_AKTION'
  ];

  for (let i = 0; i < fachfelder.length; i++) {
    const key = fachfelder[i];
    const idx = sMap[key];
    if (!idx) continue;

    const wert = textNormalisieren_(row[idx - 1]);
    if (wert) return false;
  }

  return true;
}


/* ========================================================================
 * HILFSFUNKTIONEN
 * ====================================================================== */


/**
 * FUNKTION:
 * Entschärft die Tabellenvalidierung für Mehrfachauswahl-Spalten.
 * Hintergrund: Material und Gewürze werden fachlich als Mehrfachwerte gespeichert,
 * z. B. "ÄPFEL | BIRNEN". Harte Google-Sheets-Dropdowns blockieren solche Werte.
 */
function maischeMehrfachauswahlValidierungEntschaerfen_(blatt, sMap) {
  if (!blatt || !sMap) return;

  const letzteZeile = Math.max(blatt.getMaxRows(), 2);
  const spalten = [sMap.STOFFBESITZER, sMap.MATERIAL, sMap.GEWUERZE, sMap.STATUS].filter(function(spalte) {
    return !!spalte;
  });

  spalten.forEach(function(spalte) {
    blatt.getRange(2, spalte, letzteZeile - 1, 1).clearDataValidations();
  });
}

function maischeMehrfachauswahlValidierungInZeileEntfernen_(blatt, sMap, zeile) {
  if (!blatt || !sMap || !zeile) return;
  [sMap.STOFFBESITZER, sMap.MATERIAL, sMap.GEWUERZE, sMap.STATUS].forEach(function(spalte) {
    if (spalte) blatt.getRange(zeile, spalte).clearDataValidations();
  });
}

function aktualisiereMaischeannahmeFormatierung_(blatt, sMap, zeile) {
  if (sMap.TERMIN_MAISCHE) blatt.getRange(zeile, sMap.TERMIN_MAISCHE).setNumberFormat('dd.MM.yyyy');
  if (sMap.TAG_BRAND) blatt.getRange(zeile, sMap.TAG_BRAND).setNumberFormat('dd.MM.yyyy');
  if (sMap.VON) blatt.getRange(zeile, sMap.VON).setNumberFormat('HH:mm');
  if (sMap.BIS) blatt.getRange(zeile, sMap.BIS).setNumberFormat('HH:mm');
}

function loescheZeilenRueckwaerts_(blatt, zeilenListe) {
  const sortiert = zeilenListe.slice().sort(function(a, b) { return b - a; });
  sortiert.forEach(function(zeile) {
    blatt.deleteRow(zeile);
  });
}

function holeWertAusZeile_(zeile, spalteIndex) {
  if (!spalteIndex) return '';
  return textNormalisieren_(zeile[spalteIndex - 1]);
}

function holeDatumAlsHtmlWertAusZeile_(zeile, spalteIndex) {
  const text = holeWertAusZeile_(zeile, spalteIndex);
  if (!text) return '';

  const treffer = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!treffer) return '';

  return treffer[3] + '-' + treffer[2] + '-' + treffer[1];
}

function datumAlsHtmlInputWertAusRaw_(wert) {
  if (!wert) return '';

  if (wert instanceof Date) {
    return Utilities.formatDate(wert, holeZeitzone_(), 'yyyy-MM-dd');
  }

  const text = textNormalisieren_(wert);
  if (!text) return '';

  let m = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return text;

  m = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (m) return m[3] + '-' + m[2] + '-' + m[1];

  return '';
}

function zeitAlsHtmlInputWertAusRaw_(wert, displayWert) {
  const displayText = textNormalisieren_(displayWert);
  let m = displayText.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (m) {
    return ('0' + Number(m[1])).slice(-2) + ':' + ('0' + Number(m[2])).slice(-2);
  }

  m = displayText.match(/(?:^|\s)(\d{1,2}):(\d{2})(?::\d{2})?(?:$|\s)/);
  if (m) {
    return ('0' + Number(m[1])).slice(-2) + ':' + ('0' + Number(m[2])).slice(-2);
  }

  if (!wert) return '';

  if (wert instanceof Date) {
    if (wert.getFullYear() < 1901) {
      return ('0' + wert.getHours()).slice(-2) + ':' + ('0' + wert.getMinutes()).slice(-2);
    }
    return Utilities.formatDate(wert, holeZeitzone_(), 'HH:mm');
  }

  const text = textNormalisieren_(wert);
  if (!text) return '';

  m = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (m) return ('0' + Number(m[1])).slice(-2) + ':' + ('0' + Number(m[2])).slice(-2);

  m = text.match(/^(\d{4})$/);
  if (m) return text.substring(0, 2) + ':' + text.substring(2, 4);

  return text.length >= 5 ? text.substring(0, 5) : text;
}

function setZellenwertInZeile_(zeile, spaltenIndex, wert) {
  if (!spaltenIndex) return;
  zeile[spaltenIndex - 1] = wert;
}

function holeZellenwertAusRawZeile_(row, spaltenIndex) {
  if (!spaltenIndex || !row || row.length < spaltenIndex) return '';
  return row[spaltenIndex - 1];
}

function alsReineDatumzelleSicher_(wert) {
  const text = textNormalisieren_(wert);
  if (!text) return '';

  if (typeof alsReineDatumzelle_ === 'function') {
    return alsReineDatumzelle_(text);
  }

  const m = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return text;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
}

function alsReineUhrzeitzelleSicher_(wert) {
  const text = textNormalisieren_(wert);
  if (!text) return '';

  let match = text.match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    return ('0' + Number(match[1])).slice(-2) + ':' + ('0' + Number(match[2])).slice(-2);
  }

  match = text.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (match) {
    return ('0' + Number(match[1])).slice(-2) + ':' + ('0' + Number(match[2])).slice(-2);
  }

  match = text.match(/^(\d{4})$/);
  if (match) {
    return text.substring(0, 2) + ':' + text.substring(2, 4);
  }

  return text;
}

function materialFrontendNachSpeicherwert_(materialText) {
  return textNormalisieren_(materialText)
    .replace(/\s*,\s*/g, ' | ')
    .replace(/\s*\|\s*/g, ' | ');
}

function materialRawNachFrontendText_(wert) {
  return textNormalisieren_(wert).replace(/\s*\|\s*/g, ', ');
}

function materialStringNachListe_(text) {
  const normal = textNormalisieren_(text);
  if (!normal) return [''];

  return normal
    .split(/\s*\|\s*|\s*,\s*/)
    .map(function(v) { return textNormalisieren_(v); })
    .filter(String);
}

function holeMaischeannahmeStatusStandard_() {
  if (KONFIGURATION && KONFIGURATION.STATUSWERTE && KONFIGURATION.STATUSWERTE.AN_ZOLL_GESENDET) {
    return KONFIGURATION.STATUSWERTE.AN_ZOLL_GESENDET;
  }
  return 'AN ZOLL GESENDET';
}

function holeBrennfreigabeStatusStandard_() {
  if (KONFIGURATION && KONFIGURATION.STATUSWERTE && KONFIGURATION.STATUSWERTE.IN_BRENNFREIGABE) {
    return KONFIGURATION.STATUSWERTE.IN_BRENNFREIGABE;
  }
  return 'IN BRENNFREIGABE';
}

function holeDropdownListeMaische_(key) {
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
  const kopf = daten[0].map(function(v) { return textNormalisieren_(v); });
  const idx = kopf.indexOf(spaltenName);
  if (idx < 0) return [];

  const gesehen = {};
  const liste = [];

  for (let i = 1; i < daten.length; i++) {
    const wert = textNormalisieren_(daten[i][idx]);
    if (!wert || gesehen[wert]) continue;
    gesehen[wert] = true;
    liste.push(wert);
  }

  liste.sort(function(a, b) {
    return String(a).localeCompare(String(b), 'de');
  });

  return liste;
}



/* ========================================================================
 * BRENNFREIGABE
 * ====================================================================== */

function ladeBrennfreigabeWebVorgaenge_() {
  const map = {};

  maischeannahmeVorgaengeAusMaischeblattSammeln_(map);
  brennfreigabeVorgaengeAusBrennfreigabeSammeln_(map);

  return Object.keys(map)
    .map(function(vId) {
      const item = map[vId] || {};
      const stoff = textNormalisieren_(item.stoffbesitzer);
      return {
        vorgangsId: vId,
        stoffbesitzer: stoff,
        bemerkungVorplanung: textNormalisieren_(item.bemerkungVorplanung),
        anzeige: stoff ? stoff + ' | ' + vId : vId
      };
    })
    .sort(function(a, b) {
      const stoffA = String(a.stoffbesitzer || '');
      const stoffB = String(b.stoffbesitzer || '');
      const cmp = stoffA.localeCompare(stoffB, 'de');
      if (cmp !== 0) return cmp;
      return String(a.vorgangsId || '').localeCompare(String(b.vorgangsId || ''));
    });
}

function ladeBrennfreigabeWebVorgang_(vorgangsId) {
  const vId = textNormalisieren_(vorgangsId);
  if (!vId) throw new Error('Vorgangs_ID fehlt.');

  const blatt = tabelleHolen_('BRENNFREIGABE');
  if (!blatt) throw new Error('Tabelle 🔥_BRENNFREIGABE nicht gefunden.');

  const sMap = spaltenZuordnungHolen_(blatt);
  const zeilen = alleZeilenMitVorgangsIdHolen_(blatt, vId);

  if (zeilen.length === 0) {
    return ladeBrennfreigabeWebVorgangAusMaischeannahme_(vId);
  }

  const details = {
    vorgangsId: vId,
    stoffbesitzer: '',
    bemerkungVorplanung: '',
    dossierLink: '',
    infoSystem: '',
    registernummer: '',
    status: holeBrennfreigabeStatusStandard_(),
    terminMaische: '',
    tagBrand: '',
    von: '',
    bis: '',
    brenner: '',
    zollOk: '',
    slots: []
  };

  for (let i = 0; i < zeilen.length; i++) {
    const zeileNr = zeilen[i];
    const range = blatt.getRange(zeileNr, 1, 1, blatt.getLastColumn());
    const row = range.getValues()[0];
    const displayRow = range.getDisplayValues()[0];
    const slot = maischeZeileAlsWebSlotObjekt_(row, sMap, zeileNr, displayRow);
    slot.statusAktion = textNormalisieren_(holeZellenwertAusRawZeile_(row, sMap.STATUS_AKTION));
    slot.ausbeute = textNormalisieren_(holeZellenwertAusRawZeile_(row, sMap.AUSBEUTE));
    slot.alkohol = textNormalisieren_(holeZellenwertAusRawZeile_(row, sMap.ALKOHOL));
    details.slots.push(slot);

    if (!details.stoffbesitzer) details.stoffbesitzer = textNormalisieren_(holeZellenwertAusRawZeile_(row, sMap.STOFFBESITZER));
    if (!details.registernummer) details.registernummer = textNormalisieren_(holeZellenwertAusRawZeile_(row, sMap.REGISTERNUMMER));
    if (!details.dossierLink) details.dossierLink = textNormalisieren_(holeZellenwertAusRawZeile_(row, sMap.DOSSIER_LINK));
    if (!details.infoSystem) details.infoSystem = textNormalisieren_(holeZellenwertAusRawZeile_(row, sMap.INFO_SYSTEM));
    if (!details.terminMaische) details.terminMaische = slot.terminMaische || '';
    if (!details.tagBrand) details.tagBrand = slot.tagBrand || '';
    if (!details.von) details.von = slot.von || '';
    if (!details.bis) details.bis = slot.bis || '';
    if (!details.brenner) details.brenner = slot.brenner || '';
    if (!details.zollOk) details.zollOk = slot.zollOk || '';
    const statusAusZeile = textNormalisieren_(holeZellenwertAusRawZeile_(row, sMap.STATUS));
    if (statusAusZeile) details.status = statusAusZeile;
  }

  if (!details.slots.length) details.slots.push(leererMaischeSlot_());

  return details;
}

function ladeBrennfreigabeWebVorgangAusMaischeannahme_(vorgangsId) {
  const vId = textNormalisieren_(vorgangsId);
  const blatt = tabelleHolen_('MAISCHEANNAHME');
  if (!blatt) throw new Error('Tabelle 🍎_MAISCHEANNAHME nicht gefunden.');

  const sMap = spaltenZuordnungHolen_(blatt);
  const zeilen = alleZeilenMitVorgangsIdHolen_(blatt, vId);

  if (zeilen.length === 0) {
    throw new Error('Vorgang ist weder in 🔥_BRENNFREIGABE noch in 🍎_MAISCHEANNAHME vorhanden.');
  }

  const details = {
    vorgangsId: vId,
    stoffbesitzer: '',
    bemerkungVorplanung: '',
    dossierLink: '',
    infoSystem: '',
    registernummer: '',
    status: holeBrennfreigabeStatusStandard_(),
    terminMaische: '',
    tagBrand: '',
    von: '',
    bis: '',
    brenner: '',
    zollOk: '',
    slots: []
  };

  for (let i = 0; i < zeilen.length; i++) {
    const zeileNr = zeilen[i];
    const range = blatt.getRange(zeileNr, 1, 1, blatt.getLastColumn());
    const row = range.getValues()[0];
    const displayRow = range.getDisplayValues()[0];
    const slot = maischeZeileAlsWebSlotObjekt_(row, sMap, '', displayRow);
    slot.zollOk = '';
    slot.statusAktion = '';
    slot.ausbeute = '';
    slot.alkohol = '';
    details.slots.push(slot);

    if (!details.stoffbesitzer) details.stoffbesitzer = textNormalisieren_(holeZellenwertAusRawZeile_(row, sMap.STOFFBESITZER));
    if (!details.dossierLink) details.dossierLink = textNormalisieren_(holeZellenwertAusRawZeile_(row, sMap.DOSSIER_LINK));
    if (!details.registernummer) details.registernummer = textNormalisieren_(holeZellenwertAusRawZeile_(row, sMap.REGISTERNUMMER));
    if (!details.infoSystem) details.infoSystem = textNormalisieren_(holeZellenwertAusRawZeile_(row, sMap.INFO_SYSTEM));
    if (!details.terminMaische) details.terminMaische = slot.terminMaische || '';
    if (!details.tagBrand) details.tagBrand = slot.tagBrand || '';
    if (!details.von) details.von = slot.von || '';
    if (!details.bis) details.bis = slot.bis || '';
    if (!details.brenner) details.brenner = slot.brenner || '';
  }

  if (!details.slots.length) details.slots.push(leererMaischeSlot_());

  return details;
}



function ladeVorgangsbearbeitungWebVorgaenge_() {
  const map = {};
  const filterCache = vorgangsbearbeitungFilterCacheErstellen_();

  // Operative Quelle: Vorplanung als Einstieg + BRANDTAG_UEBERSICHT als Haupttabelle.
  // Bereits gebrannte / archivierte / vom Zoll entschiedene Vorgänge werden hier ausgeschlossen.
  // Ausnahme: Status "BEIM ZOLL" bleibt sichtbar, solange keine Genehmigung/Ablehnung vorliegt.
  maischeannahmeVorgaengeAusVorplanungSammeln_(map, filterCache);
  vorgangsbearbeitungVorgaengeAusBrandtagSammeln_(map, filterCache);

  return Object.keys(map)
    .map(function(vId) { return map[vId]; })
    .sort(function(a, b) {
      const stoffA = String((a && a.stoffbesitzer) || '');
      const stoffB = String((b && b.stoffbesitzer) || '');
      const cmp = stoffA.localeCompare(stoffB, 'de');
      if (cmp !== 0) return cmp;
      return String((a && a.vorgangsId) || '').localeCompare(String((b && b.vorgangsId) || ''));
    });
}

function vorgangsbearbeitungFilterCacheErstellen_() {
  const cache = {
    archiviert: {},
    jahresarchiv: {},
    entschiedenOderGebrannt: {},
    beimZoll: {}
  };

  vorgangsbearbeitungIdsAusBlattMarkieren_(cache.jahresarchiv, 'JAHRESARCHIV');

  const shZentral = tabelleHolen_('ZENTRALREGISTER');
  if (shZentral && shZentral.getLastRow() >= 2) {
    const zMap = spaltenZuordnungHolen_(shZentral);
    const daten = shZentral.getDataRange().getDisplayValues();
    for (let i = 1; i < daten.length; i++) {
      const row = daten[i];
      const vId = textNormalisieren_(zMap.VORGANGS_ID ? row[zMap.VORGANGS_ID - 1] : '');
      if (!vId) continue;
      const status = textNormalisieren_(zMap.STATUS ? row[zMap.STATUS - 1] : '').toUpperCase();
      if (status === KONFIGURATION.STATUSWERTE.ARCHIVIERT) cache.archiviert[vId] = true;
    }
  }

  const shBrandtag = tabelleHolen_('BRANDTAG_UEBERSICHT');
  if (shBrandtag && shBrandtag.getLastRow() >= 2) {
    const bMap = spaltenZuordnungHolen_(shBrandtag);
    const daten = shBrandtag.getDataRange().getDisplayValues();

    for (let i = 1; i < daten.length; i++) {
      const row = daten[i];
      const vId = textNormalisieren_(bMap.VORGANGS_ID ? row[bMap.VORGANGS_ID - 1] : '');
      if (!vId) continue;

      const status = textNormalisieren_(bMap.STATUS ? row[bMap.STATUS - 1] : '');
      const statusAktion = textNormalisieren_(bMap.STATUS_AKTION ? row[bMap.STATUS_AKTION - 1] : '');
      const zollOk = textNormalisieren_(bMap.ZOLL_OK ? row[bMap.ZOLL_OK - 1] : '');
      const statusUpper = status.toUpperCase();
      const aktionUpper = statusAktion.toUpperCase();

      if (istZollstatusBeimZoll_(status) || istZollstatusBeimZoll_(statusAktion) || istZollstatusBeimZoll_(zollOk)) {
        cache.beimZoll[vId] = true;
      }

      if (
        istZollstatusGenehmigt_(status) ||
        istZollstatusGenehmigt_(statusAktion) ||
        istZollstatusGenehmigt_(zollOk) ||
        istZollstatusAbgelehnt_(status) ||
        istZollstatusAbgelehnt_(statusAktion) ||
        istZollstatusAbgelehnt_(zollOk) ||
        statusUpper === KONFIGURATION.STATUSWERTE.GEBRANNT ||
        statusUpper === KONFIGURATION.STATUSWERTE.ARCHIVIERT ||
        aktionUpper.indexOf(KONFIGURATION.STATUSWERTE.ERLEDIGT) === 0 ||
        aktionUpper === KONFIGURATION.STATUSWERTE.ARCHIVIERT
      ) {
        cache.entschiedenOderGebrannt[vId] = true;
      }
    }
  }

  return cache;
}

function vorgangsbearbeitungIdsAusBlattMarkieren_(ziel, tabellenKey) {
  const sh = tabelleHolen_(tabellenKey);
  if (!sh || sh.getLastRow() < 2) return;

  const sMap = spaltenZuordnungHolen_(sh);
  if (!sMap.VORGANGS_ID) return;

  const daten = sh.getRange(2, sMap.VORGANGS_ID, sh.getLastRow() - 1, 1).getDisplayValues();
  for (let i = 0; i < daten.length; i++) {
    const vId = textNormalisieren_(daten[i][0]);
    if (vId) ziel[vId] = true;
  }
}

function vorgangsbearbeitungDarfAngezeigtWerden_(vId, filterCache) {
  const id = textNormalisieren_(vId);
  if (!id) return false;
  const cache = filterCache || vorgangsbearbeitungFilterCacheErstellen_();

  if (cache.jahresarchiv[id]) return false;
  if (cache.archiviert[id]) return false;

  // Nach gebrannt/erledigt bleibt der Vorgang nur noch in dieser Maske,
  // solange er tatsächlich beim Zoll liegt. Genehmigt/abgelehnt bleibt ausgeschlossen.
  if (cache.entschiedenOderGebrannt[id] && !cache.beimZoll[id]) return false;

  return true;
}

function vorgangsbearbeitungVorgaengeAusBrandtagSammeln_(zielMap, filterCache) {
  const sh = tabelleHolen_('BRANDTAG_UEBERSICHT');
  if (!sh || sh.getLastRow() < 2) return;

  const sMap = spaltenZuordnungHolen_(sh);
  const daten = sh.getDataRange().getDisplayValues();

  for (let i = 1; i < daten.length; i++) {
    const row = daten[i];
    const vId = textNormalisieren_(sMap.VORGANGS_ID ? row[sMap.VORGANGS_ID - 1] : '');
    if (!vId) continue;
    if (!vorgangsbearbeitungDarfAngezeigtWerden_(vId, filterCache)) continue;

    zielMap[vId] = {
      vorgangsId: vId,
      anzeige: vId + ' – ' + textNormalisieren_(sMap.STOFFBESITZER ? row[sMap.STOFFBESITZER - 1] : ''),
      stoffbesitzer: textNormalisieren_(sMap.STOFFBESITZER ? row[sMap.STOFFBESITZER - 1] : ''),
      bemerkungVorplanung: textNormalisieren_(sMap.INFO_SYSTEM ? row[sMap.INFO_SYSTEM - 1] : '')
    };
  }
}

function ladeVorgangsbearbeitungWebVorgang_(vorgangsId) {
  const ausBrandtag = ladeVorgangsbearbeitungAusBrandtag_(vorgangsId);
  if (ausBrandtag) return ausBrandtag;

  return ladeVorgangsbearbeitungAusVorplanung_(vorgangsId);
}

function ladeVorgangsbearbeitungAusBrandtag_(vorgangsId) {
  const vId = textNormalisieren_(vorgangsId);
  if (!vId) throw new Error('Vorgangs_ID fehlt.');

  const blatt = tabelleHolen_('BRANDTAG_UEBERSICHT');
  if (!blatt || blatt.getLastRow() < 2) return null;

  const sMap = spaltenZuordnungHolen_(blatt);
  const zeilen = alleZeilenMitVorgangsIdHolen_(blatt, vId);
  if (!zeilen.length) return null;

  const vorplanung = holeVorplanungDatensatzNachVorgangsId_(vId);
  const details = {
    vorgangsId: vId,
    stoffbesitzer: vorplanung.stoffbesitzer || '',
    status: '',
    terminMaische: '',
    bemerkungVorplanung: vorplanung.bemerkungVorplanung || '',
    infoSystem: vorplanung.bemerkungVorplanung || '',
    dossierLink: vorplanung.dossierLink || '',
    registernummer: vorplanung.registernummer || '',
    anzahlBraende: '',
    zollOk: '',
    tagBrand: '',
    von: '',
    bis: '',
    brenner: '',
    slots: []
  };

  zeilen.forEach(function(zeileNr) {
    const row = blatt.getRange(zeileNr, 1, 1, blatt.getLastColumn()).getValues()[0];
    const displayRow = blatt.getRange(zeileNr, 1, 1, blatt.getLastColumn()).getDisplayValues()[0];
    const slot = maischeZeileAlsWebSlotObjekt_(row, sMap, zeileNr, displayRow);
    details.slots.push(slot);

    if (!details.stoffbesitzer) details.stoffbesitzer = textNormalisieren_(sMap.STOFFBESITZER ? row[sMap.STOFFBESITZER - 1] : '');
    if (!details.status) details.status = textNormalisieren_(sMap.STATUS ? row[sMap.STATUS - 1] : '');
    if (!details.terminMaische) details.terminMaische = slot.terminMaische || '';
    if (!details.bemerkungVorplanung) details.bemerkungVorplanung = textNormalisieren_(sMap.INFO_SYSTEM ? row[sMap.INFO_SYSTEM - 1] : '');
    if (!details.infoSystem) details.infoSystem = details.bemerkungVorplanung;
    if (!details.dossierLink) details.dossierLink = textNormalisieren_(sMap.DOSSIER_LINK ? row[sMap.DOSSIER_LINK - 1] : '');
    if (!details.registernummer) details.registernummer = textNormalisieren_(sMap.REGISTERNUMMER ? row[sMap.REGISTERNUMMER - 1] : '');
    if (!details.anzahlBraende) details.anzahlBraende = slot.anzahlBraende || '';
    if (!details.zollOk) details.zollOk = slot.zollOk || '';
    if (!details.tagBrand) details.tagBrand = slot.tagBrand || '';
    if (!details.von) details.von = slot.von || '';
    if (!details.bis) details.bis = slot.bis || '';
    if (!details.brenner) details.brenner = slot.brenner || '';
  });

  if (!details.slots.length) details.slots.push(leererMaischeSlot_());
  return details;
}

function ladeVorgangsbearbeitungAusVorplanung_(vorgangsId) {
  const vId = textNormalisieren_(vorgangsId);
  if (!vId) throw new Error('Vorgangs_ID fehlt.');

  const vorplanung = holeVorplanungDatensatzNachVorgangsId_(vId);
  if (!vorplanung.stoffbesitzer && !vorplanung.bemerkungVorplanung && !vorplanung.dossierLink) {
    throw new Error('Vorgang ist weder in BRANDTAG_UEBERSICHT noch in VORPLANUNG vorhanden.');
  }

  return {
    vorgangsId: vId,
    stoffbesitzer: vorplanung.stoffbesitzer || '',
    status: 'OFFEN',
    terminMaische: '',
    bemerkungVorplanung: vorplanung.bemerkungVorplanung || '',
    infoSystem: vorplanung.bemerkungVorplanung || '',
    dossierLink: vorplanung.dossierLink || '',
    registernummer: vorplanung.registernummer || '',
    anzahlBraende: '',
    zollOk: '',
    tagBrand: '',
    von: '',
    bis: '',
    brenner: '',
    slots: [leererMaischeSlot_()]
  };
}

function speichereVorgangsbearbeitungWebVorgang_(payload) {
  return mitSperreAusfuehren_(function() {
    if (!payload) throw new Error('Payload fehlt.');

    const daten = payload || {};
    const vId = textNormalisieren_(daten.vorgangsId);
    const stoffbesitzer = textNormalisieren_(daten.stoffbesitzer);
    const bemerkungVorplanung = textNormalisieren_(daten.bemerkungVorplanung || daten.infoSystem);
    const registernummer = textNormalisieren_(daten.registernummer);
    const slots = Array.isArray(daten.slots) ? daten.slots : [];
    const zollAbgelehntAusPayload = daten.zollAbgelehnt === true || daten.zollAbgelehnt === 'true' || daten.zollAbgelehnt === 1 || daten.zollAbgelehnt === '1';
    const zollAbgelehntAusStatus = slots.some(function(slot) {
      return istZollstatusAbgelehnt_(slot && slot.zollOk);
    });
    const zollAbgelehnt = zollAbgelehntAusPayload || zollAbgelehntAusStatus || istZollstatusAbgelehnt_(daten.zollOk || daten.status);
    const zollGenehmigt = daten.zollGenehmigt === true || daten.zollGenehmigt === 'true' || slots.some(function(slot) {
      return istZollstatusGenehmigt_(slot && slot.zollOk);
    }) || istZollstatusGenehmigt_(daten.zollOk || daten.status);
    const ablehnungBemerkung = textNormalisieren_(daten.ablehnungBemerkung);

    if (!vId) throw new Error('Vorgangs_ID fehlt.');
    if (!stoffbesitzer) throw new Error('Stoffbesitzer fehlt.');
    if (!slots.length) throw new Error('Es ist kein Zeitslot vorhanden.');
    if (zollAbgelehnt && !ablehnungBemerkung) throw new Error('Bemerkung zur Zoll-Ablehnung fehlt.');
    if (zollGenehmigt && !registernummer) throw new Error('Bei Genehmigung muss die Registernummer gefüllt sein.');

    const blatt = tabelleHolen_('BRANDTAG_UEBERSICHT');
    if (!blatt) throw new Error('Tabelle 🔥_BRANDTAG_UEBERSICHT nicht gefunden.');

    const sMap = spaltenZuordnungHolen_(blatt);
    const anzahlSpalten = blatt.getLastColumn();

    let dossierLink = textNormalisieren_(daten.dossierLink);
    const vorplanung = holeVorplanungDatensatzNachVorgangsId_(vId);
    if (!dossierLink) dossierLink = textNormalisieren_(vorplanung.dossierLink);

    if (!dossierLink && typeof dossierGrundstrukturInitialAnlegen_ === 'function') {
      try {
        const ordner = dossierGrundstrukturInitialAnlegen_(vId, stoffbesitzer, daten.terminMaische || new Date());
        dossierLink = ordner && ordner.getUrl ? ordner.getUrl() : dossierLink;
      } catch (e) {
        systemLogSchreiben_('WARN', 'Vorgangsbearbeitung', 'Drive-Grundstruktur konnte beim Speichern nicht angelegt werden', vId, String(e));
      }
    }

    const bestehendeZeilen = alleZeilenMitVorgangsIdHolen_(blatt, vId);
    const bestehendeDatenNachZeile = {};
    const uebermittelteBestehendeZeilen = {};
    const neueZeilen = [];
    const aktualisierteZeilen = [];
    const zuLoeschendeZeilen = [];

    for (let i = 0; i < bestehendeZeilen.length; i++) {
      const zeileNr = bestehendeZeilen[i];
      bestehendeDatenNachZeile[zeileNr] = blatt.getRange(zeileNr, 1, 1, anzahlSpalten).getValues()[0];
    }

    slots.forEach(function(slot, index) {
      const s = normalisiereMaischeSlotPayload_(slot);
      if (!s.terminMaische) s.terminMaische = textNormalisieren_(daten.terminMaische);
      validiereMaischeSlot_(s, index + 1);

      const bestehendeZeile = parseInt(s.bestehendeZeile, 10);
      const basisZeile = (bestehendeZeile && bestehendeDatenNachZeile[bestehendeZeile])
        ? bestehendeDatenNachZeile[bestehendeZeile].slice()
        : new Array(anzahlSpalten).fill('');

      if (zollAbgelehnt) {
        s.zollOk = '❌ ABGELEHNT';
        s.ausbeute = '';
        s.alkohol = '';
        s.statusAktion = '❌ ABGELEHNT';
      }

      const slotGenehmigt = istZollstatusGenehmigt_(s.zollOk);
      const slotAbgelehnt = istZollstatusAbgelehnt_(s.zollOk);
      const slotBeimZoll = istZollstatusBeimZoll_(s.zollOk);
      const status = slotAbgelehnt
        ? '❌ ABGELEHNT'
        : (slotGenehmigt ? '✅ GENEHMIGT' : (slotBeimZoll ? '🛂 BEIM ZOLL' : (textNormalisieren_(daten.status) || 'OFFEN')));

      const speicherZeile = baueMaischeWebSpeicherzeile_(basisZeile, sMap, {
        vorgangsId: vId,
        stoffbesitzer: stoffbesitzer,
        status: status,
        bemerkungVorplanung: zollAbgelehnt ? ablehnungBemerkung : bemerkungVorplanung,
        dossierLink: dossierLink,
        registernummer: registernummer,
        slot: s
      }, anzahlSpalten);

      setZellenwertInZeile_(speicherZeile, sMap.AUSBEUTE, zollAbgelehnt ? '' : textNormalisieren_(slot.ausbeute));
      setZellenwertInZeile_(speicherZeile, sMap.ALKOHOL, zollAbgelehnt ? '' : textNormalisieren_(slot.alkohol));
      setZellenwertInZeile_(speicherZeile, sMap.STATUS_AKTION, zollAbgelehnt ? '❌ ABGELEHNT' : (slotGenehmigt ? '✅ GENEHMIGT' : (slotBeimZoll ? '🛂 BEIM ZOLL' : (textNormalisieren_(slot.statusAktion) || 'OFFEN'))));

      if (bestehendeZeile && bestehendeDatenNachZeile[bestehendeZeile]) {
        aktualisierteZeilen.push({ zeile: bestehendeZeile, daten: speicherZeile });
        uebermittelteBestehendeZeilen[bestehendeZeile] = true;
      } else {
        neueZeilen.push(speicherZeile);
      }
    });

    bestehendeZeilen.forEach(function(zeileNr) {
      if (!uebermittelteBestehendeZeilen[zeileNr]) zuLoeschendeZeilen.push(zeileNr);
    });

    aktualisierteZeilen.forEach(function(item) {
      blatt.getRange(item.zeile, 1, 1, anzahlSpalten).setValues([item.daten]);
      aktualisiereBrandtagUebersichtFormatierung_(blatt, sMap, item.zeile, 1);
    });

    if (neueZeilen.length > 0) {
      const startZeile = blatt.getLastRow() + 1;
      blatt.getRange(startZeile, 1, neueZeilen.length, anzahlSpalten).setValues(neueZeilen);
      aktualisiereBrandtagUebersichtFormatierung_(blatt, sMap, startZeile, neueZeilen.length);
    }

    if (zuLoeschendeZeilen.length > 0) loescheZeilenRueckwaerts_(blatt, zuLoeschendeZeilen);

    SpreadsheetApp.flush();

    try {
      dossierLinkFuerGesamtenVorgangAktualisieren_(blatt, vId);
    } catch (e) {
      systemLogSchreiben_('WARN', 'Vorgangsbearbeitung', 'Dossier-Link Nachzug BRANDTAG_UEBERSICHT fehlgeschlagen', vId, String(e));
    }

    const alleSlotsAbgelehnt = zollAbgelehnt || (slots.length > 0 && slots.every(function(slot) {
      return istZollstatusAbgelehnt_(slot && slot.zollOk);
    }));

    if (alleSlotsAbgelehnt) {
      return brandtagVorgangAlsAbgelehntArchivierenOhneSperre_(vId);
    }

    const alleSlotsGenehmigt = slots.length > 0 && slots.every(function(slot) {
      return istZollstatusGenehmigt_(slot && slot.zollOk);
    });
    const mindestensEinSlotBeimZoll = slots.some(function(slot) {
      return istZollstatusBeimZoll_(slot && slot.zollOk);
    });
    const zielStatusRegister = alleSlotsGenehmigt
      ? '✅ GENEHMIGT'
      : (mindestensEinSlotBeimZoll ? '🛂 BEIM ZOLL' : 'IN BRANDTAG_UEBERSICHT');

    registerStatusAktualisieren_(vId, zielStatusRegister);
    systemLogSchreiben_('INFO', 'Vorgangsbearbeitung', 'Vorgang direkt in BRANDTAG_UEBERSICHT gespeichert', vId, String(slots.length) + ' | Status: ' + zielStatusRegister);

    return { ok: true, archiviert: false, verschobenNachBrandtag: false, direktInBrandtag: true, status: zielStatusRegister };
  }, 'speichereVorgangsbearbeitungWebVorgang_');
}


function speichereBrennfreigabeWebVorgang_(payload) {
  return mitSperreAusfuehren_(function() {
    if (!payload) throw new Error('Payload fehlt.');

    const vId = textNormalisieren_(payload.vorgangsId);
    const stoffbesitzer = textNormalisieren_(payload.stoffbesitzer);
    const bemerkungVorplanung = textNormalisieren_(payload.bemerkungVorplanung || payload.infoSystem);
    const registernummer = textNormalisieren_(payload.registernummer);
    const status = textNormalisieren_(payload.status) || holeBrennfreigabeStatusStandard_();
    const slots = Array.isArray(payload.slots) ? payload.slots : [];

    if (!vId) throw new Error('Vorgangs_ID fehlt.');
    if (!stoffbesitzer) throw new Error('Stoffbesitzer fehlt.');
    if (!slots.length) throw new Error('Es ist kein Zeitslot vorhanden.');

    const blatt = tabelleHolen_('BRENNFREIGABE');
    if (!blatt) throw new Error('Tabelle 🔥_BRENNFREIGABE nicht gefunden.');

    const sMap = spaltenZuordnungHolen_(blatt);
    const anzahlSpalten = blatt.getLastColumn();

    maischeMehrfachauswahlValidierungEntschaerfen_(blatt, sMap);
    registereintragSicherstellen_(vId, stoffbesitzer, status);

    const vorplanung = holeVorplanungDatensatzNachVorgangsId_(vId);
    let dossierLink = textNormalisieren_(payload.dossierLink || vorplanung.dossierLink);
    if (!dossierLink && typeof dossierGrundstrukturInitialAnlegen_ === 'function') {
      try {
        const ordner = dossierGrundstrukturInitialAnlegen_(vId, stoffbesitzer, payload.terminMaische || new Date());
        dossierLink = ordner && ordner.getUrl ? ordner.getUrl() : dossierLink;
      } catch (e) {
        systemLogSchreiben_('WARN', 'MaischeService', 'Drive-Grundstruktur konnte beim Speichern nicht angelegt werden', vId, String(e));
      }
    }

    const bestehendeZeilen = alleZeilenMitVorgangsIdHolen_(blatt, vId);
    const bestehendeDatenNachZeile = {};
    const uebermittelteBestehendeZeilen = {};
    const neueZeilen = [];
    const aktualisierteZeilen = [];
    const zuLoeschendeZeilen = [];

    for (let i = 0; i < bestehendeZeilen.length; i++) {
      const zeileNr = bestehendeZeilen[i];
      bestehendeDatenNachZeile[zeileNr] = blatt.getRange(zeileNr, 1, 1, anzahlSpalten).getValues()[0];
    }

    slots.forEach(function(slot, index) {
      const s = normalisiereMaischeSlotPayload_(slot);
      if (!s.terminMaische) s.terminMaische = textNormalisieren_(payload.terminMaische);
      validiereMaischeSlot_(s, index + 1);

      const bestehendeZeile = parseInt(s.bestehendeZeile, 10);
      const basisZeile = (bestehendeZeile && bestehendeDatenNachZeile[bestehendeZeile])
        ? bestehendeDatenNachZeile[bestehendeZeile].slice()
        : new Array(anzahlSpalten).fill('');

      const speicherZeile = baueMaischeWebSpeicherzeile_(basisZeile, sMap, {
        vorgangsId: vId,
        stoffbesitzer: stoffbesitzer,
        status: status,
        bemerkungVorplanung: bemerkungVorplanung,
        dossierLink: dossierLink,
        registernummer: registernummer,
        slot: s
      }, anzahlSpalten);

      setZellenwertInZeile_(speicherZeile, sMap.AUSBEUTE, textNormalisieren_(slot.ausbeute));
      setZellenwertInZeile_(speicherZeile, sMap.ALKOHOL, textNormalisieren_(slot.alkohol));
      setZellenwertInZeile_(speicherZeile, sMap.STATUS_AKTION, textNormalisieren_(slot.statusAktion));

      if (bestehendeZeile && bestehendeDatenNachZeile[bestehendeZeile]) {
        aktualisierteZeilen.push({ zeile: bestehendeZeile, daten: speicherZeile });
        uebermittelteBestehendeZeilen[bestehendeZeile] = true;
      } else {
        neueZeilen.push(speicherZeile);
      }
    });

    bestehendeZeilen.forEach(function(zeileNr) {
      if (!uebermittelteBestehendeZeilen[zeileNr]) zuLoeschendeZeilen.push(zeileNr);
    });

    aktualisierteZeilen.forEach(function(item) {
      blatt.getRange(item.zeile, 1, 1, anzahlSpalten).setValues([item.daten]);
      maischeMehrfachauswahlValidierungInZeileEntfernen_(blatt, sMap, item.zeile);
      aktualisiereMaischeannahmeFormatierung_(blatt, sMap, item.zeile);
    });

    if (neueZeilen.length > 0) {
      const startZeile = blatt.getLastRow() + 1;
      blatt.getRange(startZeile, 1, neueZeilen.length, anzahlSpalten).setValues(neueZeilen);
      for (let i = 0; i < neueZeilen.length; i++) {
        const zeile = startZeile + i;
        maischeMehrfachauswahlValidierungInZeileEntfernen_(blatt, sMap, zeile);
        aktualisiereMaischeannahmeFormatierung_(blatt, sMap, zeile);
      }
    }

    if (zuLoeschendeZeilen.length > 0) loescheZeilenRueckwaerts_(blatt, zuLoeschendeZeilen);

    SpreadsheetApp.flush();

    const zollStatusSet = Array.from(new Set(slots.map(function(slot) {
      return textNormalisieren_(slot && slot.zollOk);
    }).filter(String)));

    const alleSlotsGenehmigt = slots.length > 0 && slots.every(function(slot) {
      return istZollstatusGenehmigt_(slot && slot.zollOk);
    });

    const alleSlotsAbgelehnt = slots.length > 0 && slots.every(function(slot) {
      return istZollstatusAbgelehnt_(slot && slot.zollOk);
    });

    if (alleSlotsGenehmigt) {
      verschiebeVorgangVonBrennfreigabeNachBrandtagOhneSperre_(vId);
      return { ok: true, archiviert: false, verschobenNachBrandtag: true };
    }

    if (alleSlotsAbgelehnt) {
      return brennfreigabeVorgangAlsAbgelehntArchivierenOhneSperre_(vId);
    }

    return { ok: true, archiviert: false };
  }, 'speichereBrennfreigabeWebVorgang_');
}

function verschiebeVorgangVonBrennfreigabeNachBrandtagOhneSperre_(vId) {
  const shQuelle = tabelleHolen_('BRENNFREIGABE');
  const shZiel = tabelleHolen_('BRANDTAG_UEBERSICHT');
  if (!shQuelle) throw new Error('Tabelle 🔥_BRENNFREIGABE nicht gefunden.');
  if (!shZiel) throw new Error('Tabelle 🔥_BRANDTAG_UEBERSICHT nicht gefunden.');

  const vIdClean = textNormalisieren_(vId);
  const zeilenQuelle = alleZeilenMitVorgangsIdHolen_(shQuelle, vIdClean);
  if (!zeilenQuelle.length) throw new Error('Keine Daten in 🔥_BRENNFREIGABE gefunden.');

  const headerQuelle = shQuelle.getRange(1, 1, 1, shQuelle.getLastColumn()).getDisplayValues()[0].map(textNormalisieren_);
  const headerZiel = shZiel.getRange(1, 1, 1, shZiel.getLastColumn()).getDisplayValues()[0].map(textNormalisieren_);
  const zielMap = spaltenZuordnungHolen_(shZiel);

  const bestehendeZielZeilen = alleZeilenMitVorgangsIdHolen_(shZiel, vIdClean);
  if (bestehendeZielZeilen.length > 0) {
    loescheZeilenRueckwaerts_(shZiel, bestehendeZielZeilen);
  }

  const neueZeilen = zeilenQuelle.map(function(zeileNr) {
    const datenQuelle = shQuelle.getRange(zeileNr, 1, 1, shQuelle.getLastColumn()).getValues()[0];
    const datenZiel = headerZiel.map(function(h) {
      const idx = headerQuelle.indexOf(h);
      return idx > -1 ? datenQuelle[idx] : '';
    });
    if (zielMap.STATUS) datenZiel[zielMap.STATUS - 1] = '✅ GENEHMIGT';
    if (zielMap.STATUS_AKTION) datenZiel[zielMap.STATUS_AKTION - 1] = 'OFFEN';
    return datenZiel;
  });

  const startZielZeile = shZiel.getLastRow() + 1;
  shZiel.getRange(startZielZeile, 1, neueZeilen.length, headerZiel.length).setValues(neueZeilen);
  aktualisiereBrandtagUebersichtFormatierung_(shZiel, zielMap, startZielZeile, neueZeilen.length);
  zeilenQuelle.slice().sort(function(a, b) { return b - a; }).forEach(function(z) { shQuelle.deleteRow(z); });

  registerStatusAktualisieren_(vIdClean, '✅ GENEHMIGT');
  systemLogSchreiben_('INFO', 'MaischeService', 'Vorgang nach BRANDTAG_UEBERSICHT verschoben', vIdClean, String(neueZeilen.length));
}

function istZollstatusGenehmigt_(wert) {
  const status = textNormalisieren_(wert).toUpperCase();
  return status === '✅ GENEHMIGT' || status === 'GENEHMIGT' || status.indexOf('GENEHMIGT') !== -1;
}

function istZollstatusAbgelehnt_(wert) {
  const status = textNormalisieren_(wert).toUpperCase();
  return status === '❌ ABGELEHNT' || status === 'ABGELEHNT' || status.indexOf('ABGELEHNT') !== -1;
}

function istZollstatusBeimZoll_(wert) {
  const status = textNormalisieren_(wert).toUpperCase();
  return status === '🛂 BEIM ZOLL' || status === 'BEIM ZOLL' || status.indexOf('BEIM ZOLL') !== -1;
}


function aktualisiereBrandtagUebersichtFormatierung_(blatt, sMap, startZeile, anzahlZeilen) {
  if (!blatt || !sMap || !startZeile || !anzahlZeilen) return;

  if (sMap.TERMIN_MAISCHE) blatt.getRange(startZeile, sMap.TERMIN_MAISCHE, anzahlZeilen, 1).setNumberFormat('dd.MM.yyyy');
  if (sMap.TAG_BRAND) blatt.getRange(startZeile, sMap.TAG_BRAND, anzahlZeilen, 1).setNumberFormat('dd.MM.yyyy');
  if (sMap.VON) blatt.getRange(startZeile, sMap.VON, anzahlZeilen, 1).setNumberFormat('HH:mm');
  if (sMap.BIS) blatt.getRange(startZeile, sMap.BIS, anzahlZeilen, 1).setNumberFormat('HH:mm');
}

function brennfreigabeVorgaengeAusBrennfreigabeSammeln_(zielMap) {
  const sh = tabelleHolen_('BRENNFREIGABE');
  if (!sh || sh.getLastRow() < 2) return;

  const sMap = spaltenZuordnungHolen_(sh);
  const daten = sh.getDataRange().getDisplayValues();

  for (let i = 1; i < daten.length; i++) {
    const row = daten[i];
    const vId = textNormalisieren_(sMap.VORGANGS_ID ? row[sMap.VORGANGS_ID - 1] : '');
    if (!vId) continue;
    if (istVorgangArchiviert_(vId)) continue;

    zielMap[vId] = {
      vorgangsId: vId,
      anzeige: vId + ' – ' + textNormalisieren_(sMap.STOFFBESITZER ? row[sMap.STOFFBESITZER - 1] : ''),
      stoffbesitzer: textNormalisieren_(sMap.STOFFBESITZER ? row[sMap.STOFFBESITZER - 1] : ''),
      bemerkungVorplanung: textNormalisieren_(sMap.INFO_SYSTEM ? row[sMap.INFO_SYSTEM - 1] : '')
    };
  }
}

/* ========================================================================
 * LEGACY-UMSETZUNG
 * ====================================================================== */

function legacyPayloadNachMaischePayload_(payload) {
  const obj = payload || {};
  const faesser = Array.isArray(obj.faesser) ? obj.faesser : [];

  const slots = faesser.map(function(fass) {
    const rohstoffe = Array.isArray(fass.rohstoffe) ? fass.rohstoffe : [];
    return {
      bestehendeZeile: '',
      terminMaische: textNormalisieren_(obj.terminMaische),
      tagBrand: textNormalisieren_(obj.tagBrand),
      von: textNormalisieren_(obj.von),
      bis: textNormalisieren_(obj.bis),
      brenner: textNormalisieren_(obj.brenner),
      fassnummern: textNormalisieren_(fass.fassnummer),
      fassgroesse: textNormalisieren_(fass.fassgroesse),
      inhalt: textNormalisieren_(fass.inhalt),
      material: rohstoffe
        .map(function(v) { return textNormalisieren_(v); })
        .filter(String)
        .join(' | '),
      gewuerze: textNormalisieren_(fass.gewuerze),
      anzahlBraende: textNormalisieren_(fass.anzahlBraende) || '1',
      zollOk: textNormalisieren_(obj.zollOk),
      statusAktion: textNormalisieren_(fass.statusAktion),
      ausbeute: textNormalisieren_(fass.ausbeute),
      alkohol: textNormalisieren_(fass.alkohol)
    };
  });

  return {
    vorgangsId: textNormalisieren_(obj.vorgangsId),
    stoffbesitzer: textNormalisieren_(obj.stoffbesitzer),
    terminMaische: textNormalisieren_(obj.terminMaische),
    bemerkungVorplanung: textNormalisieren_(obj.infoSystem),
    infoSystem: textNormalisieren_(obj.infoSystem),
    registernummer: textNormalisieren_(obj.registernummer),
    status: textNormalisieren_(obj.status) || holeMaischeannahmeStatusStandard_(),
    slots: slots
  };
}
