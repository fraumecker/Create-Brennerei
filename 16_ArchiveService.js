/**
 * DATEI: 16_ARCHIVSERVICE.GS
 * STATUS: BRENNFREIGABE -> JAHRESARCHIV NUR NACH ABSCHLUSS
 */

function vorgangInArchivVerschieben(vId) {
  return mitSperreAusfuehren_(function() {
    return vorgangInArchivVerschiebenOhneSperre_(vId);
  }, "vorgangInArchivVerschieben");
}

function vorgangInArchivVerschiebenOhneSperre_(vId) {
  const shQuelle = tabelleHolen_("BRENNFREIGABE");
  const shArchiv = tabelleHolen_("JAHRESARCHIV");
  if (!shQuelle || !shArchiv) return "Fehler: Tabellen nicht gefunden";

  const vIdClean = textNormalisieren_(vId);
  if (!vIdClean) return "Fehler: Vorgangs_ID fehlt.";

  const zeilen = alleZeilenMitVorgangsIdHolen_(shQuelle, vIdClean);
  if (zeilen.length === 0) {
    return "Keine Daten in Brennfreigabe gefunden.";
  }

  const sMapQuelle = spaltenZuordnungHolen_(shQuelle);
  const quelleDaten = zeilen.map(function(z) {
    return shQuelle.getRange(z, 1, 1, shQuelle.getLastColumn()).getValues()[0];
  });

  const bereitZurArchivierung = quelleDaten.every(function(row) {
    const statusAktion = textNormalisieren_(sMapQuelle.STATUS_AKTION ? row[sMapQuelle.STATUS_AKTION - 1] : '');
    const status = textNormalisieren_(sMapQuelle.STATUS ? row[sMapQuelle.STATUS - 1] : '');
    return statusAktion === KONFIGURATION.STATUSWERTE.ERLEDIGT || status === KONFIGURATION.STATUSWERTE.GEBRANNT;
  });

  if (!bereitZurArchivierung) {
    return "Fehler: Archivierung erst nach Status_Aktion ERLEDIGT oder Status GEBRANNT erlaubt.";
  }

  const headerQuelle = shQuelle.getRange(1, 1, 1, shQuelle.getLastColumn()).getDisplayValues()[0].map(textNormalisieren_);
  const headerArchiv = shArchiv.getRange(1, 1, 1, shArchiv.getLastColumn()).getDisplayValues()[0].map(textNormalisieren_);

  const neueArchivZeilen = quelleDaten.map(function(datenQuelle) {
    return headerArchiv.map(function(h) {
      const idx = headerQuelle.indexOf(h);
      return idx > -1 ? datenQuelle[idx] : "";
    });
  });

  if (neueArchivZeilen.length > 0) {
    shArchiv
      .getRange(shArchiv.getLastRow() + 1, 1, neueArchivZeilen.length, headerArchiv.length)
      .setValues(neueArchivZeilen);
    SpreadsheetApp.flush();
  }

  zeilen.slice().sort(function(a, b) { return b - a; }).forEach(function(z) {
    shQuelle.deleteRow(z);
  });

  registerStatusAktualisieren_(vIdClean, KONFIGURATION.STATUSWERTE.ARCHIVIERT);
  systemLogSchreiben_("INFO", "ArchivService", "Vorgang archiviert", vIdClean, neueArchivZeilen.length + " Zeilen aus Brennfreigabe.");

  return "OK";
}


function verschiebeVorgangAusQuelleInsArchivOhneSperre_(quellenKey, vId, zielStatus, erlaubtePruefung) {
  const shQuelle = tabelleHolen_(quellenKey);
  const shArchiv = tabelleHolen_("JAHRESARCHIV");
  if (!shQuelle || !shArchiv) throw new Error('Tabellen nicht gefunden.');

  const vIdClean = textNormalisieren_(vId);
  if (!vIdClean) throw new Error('Vorgangs_ID fehlt.');

  const zeilen = alleZeilenMitVorgangsIdHolen_(shQuelle, vIdClean);
  if (!zeilen.length) throw new Error('Keine Daten in ' + quellenKey + ' gefunden.');

  const sMapQuelle = spaltenZuordnungHolen_(shQuelle);
  const quelleDaten = zeilen.map(function(z) {
    return shQuelle.getRange(z, 1, 1, shQuelle.getLastColumn()).getValues()[0];
  });

  if (typeof erlaubtePruefung === 'function') {
    const ok = quelleDaten.every(function(row) {
      return erlaubtePruefung(row, sMapQuelle);
    });
    if (!ok) throw new Error('Archivierungsvoraussetzung nicht erfüllt.');
  }

  const headerQuelle = shQuelle.getRange(1, 1, 1, shQuelle.getLastColumn()).getDisplayValues()[0].map(textNormalisieren_);
  const headerArchiv = shArchiv.getRange(1, 1, 1, shArchiv.getLastColumn()).getDisplayValues()[0].map(textNormalisieren_);

  const neueArchivZeilen = quelleDaten.map(function(datenQuelle) {
    const kopie = headerArchiv.map(function(h) {
      const idx = headerQuelle.indexOf(h);
      return idx > -1 ? datenQuelle[idx] : '';
    });

    const archivMap = spaltenZuordnungHolen_(shArchiv);
    if (archivMap.STATUS) kopie[archivMap.STATUS - 1] = zielStatus;
    if (archivMap.STATUS_AKTION) kopie[archivMap.STATUS_AKTION - 1] = zielStatus;
    return kopie;
  });

  if (neueArchivZeilen.length > 0) {
    shArchiv
      .getRange(shArchiv.getLastRow() + 1, 1, neueArchivZeilen.length, headerArchiv.length)
      .setValues(neueArchivZeilen);
    SpreadsheetApp.flush();
  }

  zeilen.slice().sort(function(a, b) { return b - a; }).forEach(function(z) {
    shQuelle.deleteRow(z);
  });

  registerStatusAktualisieren_(vIdClean, zielStatus);
  systemLogSchreiben_('INFO', 'ArchivService', 'Vorgang archiviert', vIdClean, neueArchivZeilen.length + ' Zeilen aus ' + quellenKey + '.');

  return { ok: true, archiviert: true, status: zielStatus };
}

function brennfreigabeVorgangAlsAbgelehntArchivierenOhneSperre_(vId) {
  return verschiebeVorgangAusQuelleInsArchivOhneSperre_('BRENNFREIGABE', vId, '❌ ABGELEHNT', null);
}

function brandtagVorgangAlsAbgelehntArchivierenOhneSperre_(vId) {
  return verschiebeVorgangAusQuelleInsArchivOhneSperre_('BRANDTAG_UEBERSICHT', vId, '❌ ABGELEHNT', function(row, sMapQuelle) {
    const zollOk = textNormalisieren_(sMapQuelle.ZOLL_OK ? row[sMapQuelle.ZOLL_OK - 1] : '');
    const statusAktion = textNormalisieren_(sMapQuelle.STATUS_AKTION ? row[sMapQuelle.STATUS_AKTION - 1] : '');
    const status = textNormalisieren_(sMapQuelle.STATUS ? row[sMapQuelle.STATUS - 1] : '');
    return istZollstatusAbgelehnt_(zollOk) || istZollstatusAbgelehnt_(statusAktion) || istZollstatusAbgelehnt_(status);
  });
}

function brandtagVorgangAlsErledigtArchivierenOhneSperre_(vId) {
  return verschiebeVorgangAusQuelleInsArchivOhneSperre_(
    'BRANDTAG_UEBERSICHT',
    vId,
    KONFIGURATION.STATUSWERTE.GEBRANNT,
    function(row, sMapQuelle) {
      const statusAktion = textNormalisieren_(sMapQuelle.STATUS_AKTION ? row[sMapQuelle.STATUS_AKTION - 1] : '');
      const status = textNormalisieren_(sMapQuelle.STATUS ? row[sMapQuelle.STATUS - 1] : '');
      return statusAktion === KONFIGURATION.STATUSWERTE.ERLEDIGT || status === KONFIGURATION.STATUSWERTE.GEBRANNT;
    }
  );
}


function leitstandEintragInsJahresarchivKopierenOhneSperre_(vId, statusAktionText) {
  return leitstandEintragInsJahresarchivUebertragenOhneSperre_(vId, statusAktionText, false, null);
}

function leitstandEintragInsJahresarchivVerschiebenOhneSperre_(vId, statusAktionText) {
  return leitstandEintragInsJahresarchivUebertragenOhneSperre_(vId, statusAktionText, true, null);
}

function leitstandEintragInsJahresarchivVerschiebenZeilenOhneSperre_(vId, statusAktionText, zielZeilen) {
  return leitstandEintragInsJahresarchivUebertragenOhneSperre_(vId, statusAktionText, true, zielZeilen);
}

function leitstandEintragInsJahresarchivUebertragenOhneSperre_(vId, statusAktionText, quelleLoeschen, zielZeilen) {
  const shQuelle = tabelleHolen_('BRANDTAG_UEBERSICHT');
  const shArchiv = tabelleHolen_('JAHRESARCHIV');
  if (!shQuelle || !shArchiv) throw new Error('Tabellen nicht gefunden.');

  const vIdClean = textNormalisieren_(vId);
  if (!vIdClean) throw new Error('Vorgangs_ID fehlt.');

  const alleZeilen = alleZeilenMitVorgangsIdHolen_(shQuelle, vIdClean);
  if (!alleZeilen.length) throw new Error('Keine Daten in BRANDTAG_UEBERSICHT gefunden.');

  const headerQuelle = shQuelle.getRange(1, 1, 1, shQuelle.getLastColumn()).getDisplayValues()[0].map(textNormalisieren_);
  const headerArchiv = shArchiv.getRange(1, 1, 1, shArchiv.getLastColumn()).getDisplayValues()[0].map(textNormalisieren_);
  const archivMap = spaltenZuordnungHolen_(shArchiv);
  const sMapQuelle = spaltenZuordnungHolen_(shQuelle);
  const statusAktion = textNormalisieren_(statusAktionText) || KONFIGURATION.STATUSWERTE.ERLEDIGT;

  const zielZeilenSet = Array.isArray(zielZeilen) && zielZeilen.length
    ? zielZeilen.reduce(function(acc, z) {
        const zeileNummer = Number(z);
        if (zeileNummer && zeileNummer > 1) acc[zeileNummer] = true;
        return acc;
      }, {})
    : null;

  const zeilen = alleZeilen.filter(function(z) {
    if (zielZeilenSet && zielZeilenSet[Number(z)] !== true) return false;
    const row = shQuelle.getRange(z, 1, 1, shQuelle.getLastColumn()).getValues()[0];
    return leitstandZeileIstArchivfaehig_(row, sMapQuelle);
  });

  if (!zeilen.length) {
    systemLogSchreiben_('INFO', 'ArchivService', 'Keine archivfähigen Leitstand-Zeilen gefunden', vIdClean, 'Offene oder unvollständige Brände bleiben im Leitstand.');
    return {
      ok: true,
      archiviert: false,
      verschoben: false,
      statusAktion: statusAktion,
      grund: 'KEINE_ARCHIVFAEHIGE_ZEILE'
    };
  }

  const neueArchivZeilen = zeilen.map(function(z) {
    const datenQuelle = shQuelle.getRange(z, 1, 1, shQuelle.getLastColumn()).getValues()[0];
    const displayQuelle = shQuelle.getRange(z, 1, 1, shQuelle.getLastColumn()).getDisplayValues()[0];
    const kopie = headerArchiv.map(function(h) {
      const idx = headerQuelle.indexOf(h);
      if (idx < 0) return '';

      if (archivHeaderIstUhrzeitSpalte_(h)) {
        return archivUhrzeitAlsText_(datenQuelle[idx], displayQuelle[idx]);
      }

      return datenQuelle[idx];
    });

    const quellStatusAktion = textNormalisieren_(sMapQuelle.STATUS_AKTION ? datenQuelle[sMapQuelle.STATUS_AKTION - 1] : '');
    const quellStatus = textNormalisieren_(sMapQuelle.STATUS ? datenQuelle[sMapQuelle.STATUS - 1] : '');
    const zielIstAbgelehnt = istZollstatusAbgelehnt_(quellStatusAktion) || istZollstatusAbgelehnt_(quellStatus) || istZollstatusAbgelehnt_(sMapQuelle.ZOLL_OK ? datenQuelle[sMapQuelle.ZOLL_OK - 1] : '');

    if (archivMap.VON) kopie[archivMap.VON - 1] = archivUhrzeitAlsText_(kopie[archivMap.VON - 1], kopie[archivMap.VON - 1]);
    if (archivMap.BIS) kopie[archivMap.BIS - 1] = archivUhrzeitAlsText_(kopie[archivMap.BIS - 1], kopie[archivMap.BIS - 1]);
    if (archivMap.STATUS) kopie[archivMap.STATUS - 1] = zielIstAbgelehnt ? '❌ ABGELEHNT' : KONFIGURATION.STATUSWERTE.GEBRANNT;
    if (archivMap.STATUS_AKTION) kopie[archivMap.STATUS_AKTION - 1] = zielIstAbgelehnt ? '❌ ABGELEHNT' : statusAktion;
    return kopie;
  });

  if (!neueArchivZeilen.length) {
    throw new Error('Keine Archivdaten erzeugt.');
  }

  const upsertResult = leitstandArchivZeilenUpsert_(shArchiv, archivMap, neueArchivZeilen);
  const abgelehnteArchivZeilen = [];
  const minderausbeuteArchivZeilen = [];

  for (let i = 0; i < neueArchivZeilen.length; i++) {
    const archivRow = neueArchivZeilen[i];
    const archivStatusAktion = textNormalisieren_(archivMap.STATUS_AKTION ? archivRow[archivMap.STATUS_AKTION - 1] : '');
    const archivStatus = textNormalisieren_(archivMap.STATUS ? archivRow[archivMap.STATUS - 1] : '');
    const archivZollOk = textNormalisieren_(archivMap.ZOLL_OK ? archivRow[archivMap.ZOLL_OK - 1] : '');
    if (istZollstatusAbgelehnt_(archivStatusAktion) || istZollstatusAbgelehnt_(archivStatus) || istZollstatusAbgelehnt_(archivZollOk)) {
      abgelehnteArchivZeilen.push(upsertResult.zeilen[i]);
    } else if (archivStatusAktion.toUpperCase().indexOf('MINDERAUSBEUTE BRAND ZOLL INFORMIERT') !== -1) {
      minderausbeuteArchivZeilen.push(upsertResult.zeilen[i]);
    }
  }

  leitstandAbgelehnteNummernMarkieren_(shArchiv, archivMap, abgelehnteArchivZeilen);
  if (typeof leitstandMinderausbeuteNummernMarkieren_ === 'function') {
    leitstandMinderausbeuteNummernMarkieren_(shArchiv, archivMap, minderausbeuteArchivZeilen);
  }
  SpreadsheetApp.flush();

  if (quelleLoeschen) {
    zeilen.slice().sort(function(a, b) { return b - a; }).forEach(function(z) {
      shQuelle.deleteRow(z);
    });

    if (!alleZeilenMitVorgangsIdHolen_(shQuelle, vIdClean).length) {
      registerStatusAktualisieren_(vIdClean, KONFIGURATION.STATUSWERTE.ARCHIVIERT);
    }

    systemLogSchreiben_('INFO', 'ArchivService', 'Archivfähige Leitstand-Zeilen ins Jahresarchiv verschoben', vIdClean, neueArchivZeilen.length + ' Zeilen verschoben/aktualisiert. Neu: ' + upsertResult.neu + ' | Aktualisiert: ' + upsertResult.aktualisiert + '. Offene Zeilen bleiben im Leitstand.');
  } else {
    systemLogSchreiben_('INFO', 'ArchivService', 'Archivfähige Leitstand-Zeilen ins Jahresarchiv kopiert', vIdClean, neueArchivZeilen.length + ' Zeilen kopiert/aktualisiert. Neu: ' + upsertResult.neu + ' | Aktualisiert: ' + upsertResult.aktualisiert + '. Offene Zeilen bleiben im Leitstand.');
  }

  return {
    ok: true,
    archiviert: true,
    verschoben: quelleLoeschen === true,
    statusAktion: statusAktion,
    zeilen: neueArchivZeilen.length,
    neu: upsertResult.neu,
    aktualisiert: upsertResult.aktualisiert
  };
}

function leitstandZeileIstArchivfaehig_(row, sMapQuelle) {
  const statusAktion = textNormalisieren_(sMapQuelle.STATUS_AKTION ? row[sMapQuelle.STATUS_AKTION - 1] : '').toUpperCase();
  const status = textNormalisieren_(sMapQuelle.STATUS ? row[sMapQuelle.STATUS - 1] : '').toUpperCase();
  const zollOk = textNormalisieren_(sMapQuelle.ZOLL_OK ? row[sMapQuelle.ZOLL_OK - 1] : '').toUpperCase();
  const istAbgelehnt = istZollstatusAbgelehnt_(zollOk) || istZollstatusAbgelehnt_(statusAktion) || istZollstatusAbgelehnt_(status);

  if (istAbgelehnt) return true;

  const istMinderausbeute = statusAktion.indexOf('MINDERAUSBEUTE BRAND ZOLL INFORMIERT') !== -1;
  const istErledigt = statusAktion.indexOf(KONFIGURATION.STATUSWERTE.ERLEDIGT) === 0 || status === KONFIGURATION.STATUSWERTE.GEBRANNT;
  if (!istErledigt) return false;

  if (istMinderausbeute) {
    if (sMapQuelle.AUSBEUTE && !textNormalisieren_(row[sMapQuelle.AUSBEUTE - 1])) return false;
    return true;
  }

  if (sMapQuelle.ALKOHOL && !textNormalisieren_(row[sMapQuelle.ALKOHOL - 1])) return false;
  if (sMapQuelle.AUSBEUTE && !textNormalisieren_(row[sMapQuelle.AUSBEUTE - 1])) return false;

  return true;
}

function leitstandErledigteEintraegeMitternachtArchivieren() {
  return mitSperreAusfuehren_(function() {
    return leitstandErledigteEintraegeMitternachtArchivierenOhneSperre_();
  }, 'leitstandErledigteEintraegeMitternachtArchivieren');
}

function leitstandErledigteEintraegeMitternachtArchivierenOhneSperre_() {
  const shQuelle = tabelleHolen_('BRANDTAG_UEBERSICHT');
  if (!shQuelle || shQuelle.getLastRow() <= 1) {
    return {
      ok: true,
      geprueft: 0,
      archiviert: 0,
      fehler: []
    };
  }

  const sMap = spaltenZuordnungHolen_(shQuelle);
  if (!sMap.VORGANGS_ID) throw new Error('Spalte VORGANGS_ID fehlt in BRANDTAG_UEBERSICHT.');

  const daten = shQuelle.getDataRange().getValues();
  const vorgaenge = {};

  for (let i = 1; i < daten.length; i++) {
    const row = daten[i];
    const vId = textNormalisieren_(row[sMap.VORGANGS_ID - 1]);
    if (!vId) continue;

    const statusAktion = textNormalisieren_(sMap.STATUS_AKTION ? row[sMap.STATUS_AKTION - 1] : '');
    const statusAktionUpper = statusAktion.toUpperCase();
    const status = textNormalisieren_(sMap.STATUS ? row[sMap.STATUS - 1] : '');
    const statusUpper = status.toUpperCase();
    const zollOk = textNormalisieren_(sMap.ZOLL_OK ? row[sMap.ZOLL_OK - 1] : '');
    const zollOkUpper = zollOk.toUpperCase();

    const istAbgelehnt = istZollstatusAbgelehnt_(zollOkUpper) || istZollstatusAbgelehnt_(statusAktionUpper) || istZollstatusAbgelehnt_(statusUpper);
    const istErledigt = statusAktionUpper.indexOf(KONFIGURATION.STATUSWERTE.ERLEDIGT) === 0 || statusUpper === KONFIGURATION.STATUSWERTE.GEBRANNT;

    if (istAbgelehnt) {
      vorgaenge[vId] = '❌ ABGELEHNT';
    } else if (istErledigt) {
      vorgaenge[vId] = statusAktion || KONFIGURATION.STATUSWERTE.ERLEDIGT;
    }
  }

  const ids = Object.keys(vorgaenge);
  const fehler = [];
  let archiviert = 0;

  ids.forEach(function(vId) {
    try {
      const res = leitstandEintragInsJahresarchivVerschiebenOhneSperre_(vId, vorgaenge[vId]);
      if (res && res.archiviert === true) archiviert++;
    } catch (e) {
      fehler.push(vId + ': ' + String(e));
      systemLogSchreiben_('ERROR', 'ArchivService', 'Mitternachtsarchivierung Leitstand fehlgeschlagen', vId, String(e));
    }
  });

  systemLogSchreiben_(
    fehler.length ? 'WARN' : 'INFO',
    'ArchivService',
    'Mitternachtsarchivierung Leitstand abgeschlossen',
    '',
    'Geprüft: ' + ids.length + ' | Archiviert: ' + archiviert + ' | Fehler: ' + fehler.length
  );

  return {
    ok: fehler.length === 0,
    geprueft: ids.length,
    archiviert: archiviert,
    fehler: fehler
  };
}


// FUNKTION: Erkennt reine Uhrzeitspalten beim Archivieren | EINGRIFF: Jahresarchiv-Datenbereinigung
function archivHeaderIstUhrzeitSpalte_(headerNorm) {
  const h = textNormalisieren_(headerNorm).toLowerCase();
  return h === textNormalisieren_(KONFIGURATION.SPALTEN.VON).toLowerCase() ||
    h === textNormalisieren_(KONFIGURATION.SPALTEN.BIS).toLowerCase() ||
    h === textNormalisieren_(KONFIGURATION.SPALTEN.ZEITSLOT_VON).toLowerCase() ||
    h === textNormalisieren_(KONFIGURATION.SPALTEN.ZEITSLOT_BIS).toLowerCase();
}

// FUNKTION: Schreibt Uhrzeiten im Jahresarchiv stabil als HH:mm, ohne 1899/1900-Datum | EINGRIFF: Jahresarchiv-Datenbereinigung
function archivUhrzeitAlsText_(wert, displayWert) {
  const displayText = textNormalisieren_(displayWert);
  const displayZeit = archivZeitAusText_(displayText);
  if (displayZeit) return displayZeit;

  if (wert instanceof Date && !isNaN(wert.getTime())) {
    const jahr = wert.getFullYear();
    if (jahr < 1901) {
      return ('0' + wert.getHours()).slice(-2) + ':' + ('0' + wert.getMinutes()).slice(-2);
    }
    return Utilities.formatDate(
      wert,
      KONFIGURATION.ZOLL_PARAMETER.ZEIT_PARAMETER.ZEITZONE,
      'HH:mm'
    );
  }

  const wertText = textNormalisieren_(wert);
  const wertZeit = archivZeitAusText_(wertText);
  return wertZeit || wertText;
}

// FUNKTION: Extrahiert Uhrzeit aus Textwerten | EINGRIFF: Jahresarchiv-Datenbereinigung
function archivZeitAusText_(text) {
  const t = textNormalisieren_(text);
  if (!t) return '';

  const kurz = t.match(/^(\d{1,2}):(\d{2})$/);
  if (kurz) return ('0' + kurz[1]).slice(-2) + ':' + kurz[2];

  const lang = t.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (lang) return ('0' + lang[1]).slice(-2) + ':' + lang[2];

  const datumZeit = t.match(/(?:^|\s|T)(\d{1,2}):(\d{2})(?::\d{2})?(?:\s|$)/);
  if (datumZeit) return ('0' + datumZeit[1]).slice(-2) + ':' + datumZeit[2];

  return '';
}


// FUNKTION: Jahresarchiv-Zeilen aktualisieren statt Duplikate anzuhängen | EINGRIFF: Leitstand Markierte speichern
function leitstandArchivZeilenUpsert_(shArchiv, archivMap, neueArchivZeilen) {
  if (!neueArchivZeilen || !neueArchivZeilen.length) {
    return { neu: 0, aktualisiert: 0, zeilen: [] };
  }

  const letzteZeile = shArchiv.getLastRow();
  const letzteSpalte = shArchiv.getLastColumn();
  const index = {};

  if (letzteZeile > 1) {
    const daten = shArchiv.getRange(2, 1, letzteZeile - 1, letzteSpalte).getValues();
    for (let i = 0; i < daten.length; i++) {
      const key = leitstandArchivZeilenKey_(daten[i], archivMap);
      if (key && !index[key]) index[key] = i + 2;
    }
  }

  const zielZeilen = [];
  let neu = 0;
  let aktualisiert = 0;

  for (let i = 0; i < neueArchivZeilen.length; i++) {
    const row = neueArchivZeilen[i];
    const key = leitstandArchivZeilenKey_(row, archivMap);
    let zielZeile = key ? index[key] : 0;

    if (zielZeile) {
      shArchiv.getRange(zielZeile, 1, 1, letzteSpalte).setValues([row]);
      aktualisiert++;
    } else {
      zielZeile = shArchiv.getLastRow() + 1;
      shArchiv.getRange(zielZeile, 1, 1, letzteSpalte).setValues([row]);
      if (key) index[key] = zielZeile;
      neu++;
    }

    zielZeilen.push(zielZeile);
  }

  return {
    neu: neu,
    aktualisiert: aktualisiert,
    zeilen: zielZeilen
  };
}

// FUNKTION: Eindeutiger Schlüssel für einen Brand im Jahresarchiv
function leitstandArchivZeilenKey_(row, map) {
  if (!map || !map.VORGANGS_ID) return '';

  const vId = textNormalisieren_(row[map.VORGANGS_ID - 1]);
  if (!vId) return '';

  const tag = map.TAG_BRAND ? datumAlsIsoString_(row[map.TAG_BRAND - 1]) : '';
  const von = map.VON ? archivUhrzeitAlsText_(row[map.VON - 1], row[map.VON - 1]) : '';
  const bis = map.BIS ? archivUhrzeitAlsText_(row[map.BIS - 1], row[map.BIS - 1]) : '';
  const fass = map.FASS_NR ? textNormalisieren_(row[map.FASS_NR - 1]) : '';
  const regNr = map.REGISTERNUMMER ? textNormalisieren_(row[map.REGISTERNUMMER - 1]) : '';

  return [vId, tag, von, bis, fass, regNr].join('|').toUpperCase();
}
