/**
 * DATEI: 11_MaischeService.gs
 * ZWECK:
 * FACHLOGIK FÜR WEB-VORGANGSBLOCK / MAISCHEANNAHME IN 🍎_MAISCHEANNAHME
 *
 * WICHTIG:
 * - keine neue Tabellenarchitektur
 * - Speicherung strikt in der vorhandenen Tabelle 🍎_MAISCHEANNAHME
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

  maischeannahmeVorgaengeAusVorplanungSammeln_(map);
  maischeannahmeVorgaengeAusBrandplanungSammeln_(map);
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
      const row = blatt.getRange(zeileNr, 1, 1, blatt.getLastColumn()).getValues()[0];
      const slot = maischeZeileAlsWebSlotObjekt_(row, sMap, zeileNr);

      details.slots.push(slot);

      if (!details.stoffbesitzer) details.stoffbesitzer = textNormalisieren_(holeZellenwertAusRawZeile_(row, sMap.STOFFBESITZER));
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
    const registernummer = '';
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
    const dossierLink = textNormalisieren_(payload.dossierLink || vorplanung.dossierLink);

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

function maischeannahmeVorgaengeAusVorplanungSammeln_(zielMap) {
  const sh = tabelleHolen_('VORPLANUNG');
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
    dossierLink: ''
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

  return result;
}

function ladeBrandplanungSlotsFuerMaischeannahme_(vorgangsId) {
  const vId = textNormalisieren_(vorgangsId);
  if (!vId) return [];

  const sh = tabelleHolen_('BRANDTAGE_PLANUNG');
  if (!sh || sh.getLastRow() < 2) return [];

  const sMap = spaltenZuordnungHolen_(sh);
  const daten = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  const liste = [];

  for (let i = 0; i < daten.length; i++) {
    const row = daten[i];
    const rowVId = textNormalisieren_(holeZellenwertAusRawZeile_(row, sMap.VORGANGS_ID));
    if (rowVId !== vId) continue;

    liste.push({
      bestehendeZeile: '',
      terminMaische: datumAlsHtmlInputWertAusRaw_(holeZellenwertAusRawZeile_(row, sMap.DATUM_MAISCHEANNAHME)),
      tagBrand: datumAlsHtmlInputWertAusRaw_(holeZellenwertAusRawZeile_(row, sMap.BRANDTAG)),
      von: zeitAlsHtmlInputWertAusRaw_(holeZellenwertAusRawZeile_(row, sMap.ZEITSLOT_VON)),
      bis: zeitAlsHtmlInputWertAusRaw_(holeZellenwertAusRawZeile_(row, sMap.ZEITSLOT_BIS)),
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

function maischeZeileAlsWebSlotObjekt_(row, sMap, zeileNr) {
  return {
    bestehendeZeile: String(zeileNr || ''),
    terminMaische: datumAlsHtmlInputWertAusRaw_(holeZellenwertAusRawZeile_(row, sMap.TERMIN_MAISCHE)),
    tagBrand: datumAlsHtmlInputWertAusRaw_(holeZellenwertAusRawZeile_(row, sMap.TAG_BRAND)),
    von: zeitAlsHtmlInputWertAusRaw_(holeZellenwertAusRawZeile_(row, sMap.VON)),
    bis: zeitAlsHtmlInputWertAusRaw_(holeZellenwertAusRawZeile_(row, sMap.BIS)),
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
    fassnummern: textNormalisieren_(obj.fassnummern || obj.fassnummer),
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

function zeitAlsHtmlInputWertAusRaw_(wert) {
  if (!wert) return '';

  if (wert instanceof Date) {
    return Utilities.formatDate(wert, holeZeitzone_(), 'HH:mm');
  }

  const text = textNormalisieren_(wert);
  if (!text) return '';

  let m = text.match(/^(\d{2}):(\d{2})$/);
  if (m) return m[1] + ':' + m[2];

  m = text.match(/^(\d{2}):(\d{2}):(\d{2})$/);
  if (m) return m[1] + ':' + m[2];

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

  if (typeof alsReineUhrzeitzelle_ === 'function') {
    return alsReineUhrzeitzelle_(text);
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
    throw new Error('Vorgang ist in 🔥_BRENNFREIGABE nicht vorhanden.');
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
    const row = blatt.getRange(zeileNr, 1, 1, blatt.getLastColumn()).getValues()[0];
    const slot = maischeZeileAlsWebSlotObjekt_(row, sMap, zeileNr);
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
    const dossierLink = textNormalisieren_(payload.dossierLink || vorplanung.dossierLink);

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

    if (zollStatusSet.length === 1 && zollStatusSet[0] === '✅ GENEHMIGT') {
      verschiebeVorgangVonBrennfreigabeNachBrandtagOhneSperre_(vId);
      return { ok: true, archiviert: false, verschobenNachBrandtag: true };
    }

    if (zollStatusSet.length === 1 && zollStatusSet[0] === '❌ ABGELEHNT') {
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
