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
  return leitstandEintragInsJahresarchivUebertragenOhneSperre_(vId, statusAktionText, false);
}

function leitstandEintragInsJahresarchivVerschiebenOhneSperre_(vId, statusAktionText) {
  return leitstandEintragInsJahresarchivUebertragenOhneSperre_(vId, statusAktionText, true);
}

function leitstandEintragInsJahresarchivUebertragenOhneSperre_(vId, statusAktionText, quelleLoeschen) {
  const shQuelle = tabelleHolen_('BRANDTAG_UEBERSICHT');
  const shArchiv = tabelleHolen_('JAHRESARCHIV');
  if (!shQuelle || !shArchiv) throw new Error('Tabellen nicht gefunden.');

  const vIdClean = textNormalisieren_(vId);
  if (!vIdClean) throw new Error('Vorgangs_ID fehlt.');

  const zeilen = alleZeilenMitVorgangsIdHolen_(shQuelle, vIdClean);
  if (!zeilen.length) throw new Error('Keine Daten in BRANDTAG_UEBERSICHT gefunden.');

  const headerQuelle = shQuelle.getRange(1, 1, 1, shQuelle.getLastColumn()).getDisplayValues()[0].map(textNormalisieren_);
  const headerArchiv = shArchiv.getRange(1, 1, 1, shArchiv.getLastColumn()).getDisplayValues()[0].map(textNormalisieren_);
  const archivMap = spaltenZuordnungHolen_(shArchiv);
  const statusAktion = textNormalisieren_(statusAktionText) || KONFIGURATION.STATUSWERTE.ERLEDIGT;

  const archivDaten = shArchiv.getDataRange().getValues();
  const archivVIdIndex = headerArchiv.indexOf(textNormalisieren_(KONFIGURATION.SPALTEN.VORGANGS_ID));
  const vorhandeneArchivZeilen = [];
  if (archivVIdIndex > -1) {
    for (let i = 1; i < archivDaten.length; i++) {
      if (textNormalisieren_(archivDaten[i][archivVIdIndex]) === vIdClean) {
        vorhandeneArchivZeilen.push(i + 1);
      }
    }
  }

  const neueArchivZeilen = zeilen.map(function(z) {
    const datenQuelle = shQuelle.getRange(z, 1, 1, shQuelle.getLastColumn()).getValues()[0];
    const kopie = headerArchiv.map(function(h) {
      const idx = headerQuelle.indexOf(h);
      return idx > -1 ? datenQuelle[idx] : '';
    });

    if (archivMap.STATUS) kopie[archivMap.STATUS - 1] = KONFIGURATION.STATUSWERTE.GEBRANNT;
    if (archivMap.STATUS_AKTION) kopie[archivMap.STATUS_AKTION - 1] = statusAktion;
    return kopie;
  });

  if (!neueArchivZeilen.length) {
    throw new Error('Keine Archivdaten erzeugt.');
  }

  if (vorhandeneArchivZeilen.length) {
    vorhandeneArchivZeilen.sort(function(a, b) { return b - a; }).forEach(function(z) {
      shArchiv.deleteRow(z);
    });
  }

  shArchiv.getRange(shArchiv.getLastRow() + 1, 1, neueArchivZeilen.length, headerArchiv.length).setValues(neueArchivZeilen);
  SpreadsheetApp.flush();

  if (quelleLoeschen) {
    zeilen.slice().sort(function(a, b) { return b - a; }).forEach(function(z) {
      shQuelle.deleteRow(z);
    });
    registerStatusAktualisieren_(vIdClean, KONFIGURATION.STATUSWERTE.ARCHIVIERT);
    systemLogSchreiben_('INFO', 'ArchivService', 'Leitstand-Eintrag ins Jahresarchiv verschoben', vIdClean, neueArchivZeilen.length + ' Zeilen verschoben.');
  } else {
    systemLogSchreiben_('INFO', 'ArchivService', 'Leitstand-Eintrag ins Jahresarchiv kopiert', vIdClean, neueArchivZeilen.length + ' Zeilen kopiert.');
  }

  return {
    ok: true,
    archiviert: true,
    verschoben: quelleLoeschen === true,
    statusAktion: statusAktion
  };
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

    const istErledigt = statusAktionUpper.indexOf(KONFIGURATION.STATUSWERTE.ERLEDIGT) === 0 || status === KONFIGURATION.STATUSWERTE.GEBRANNT;
    if (istErledigt) {
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

