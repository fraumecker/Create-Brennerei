/**
 * DATEI: 05_DriveService.gs
 * ZWECK: DOSSIER-ORDNER / STOFFBESITZER-ORDNER / LINK-AKTUALISIERUNG
 * LOGIK:
 * - Wurzelordner ist fest in KONFIGURATION hinterlegt
 * - pro Stoffbesitzer ein Hauptordner
 * - pro Vorgang ein Unterordner
 * - Vorgangsordner enthält immer [VORGANGS_ID] als festen Anker
 * - sichtbarer Name: Stoffbesitzer + Brandtag
 * - sobald Registernummer vorhanden ist, wird der Ordner umbenannt und ergänzt
 */


/**
 * FUNKTION: Baut einen belastbaren Drive-Fehlertext.
 */
function driveFehlertextBauen_(fehler) {
  return fehler && fehler.message ? fehler.message : String(fehler || 'Unbekannter Drive-Fehler');
}


/**
 * FUNKTION: Führt kritische Drive-Operationen mit Retry aus.
 */
function driveMitRetry_(aktion, vorgangsId, callback, maxVersuche, wartezeitMs) {
  const label = textNormalisieren_(aktion) || 'Drive-Operation';
  const vId = textNormalisieren_(vorgangsId);
  const versuche = Number(maxVersuche) > 0 ? Number(maxVersuche) : 3;
  const basisWartezeit = Number(wartezeitMs) > 0 ? Number(wartezeitMs) : 350;
  let letzterFehler = null;

  for (let versuch = 1; versuch <= versuche; versuch++) {
    try {
      return callback();
    } catch (e) {
      letzterFehler = e;

      systemLogSchreiben_(
        versuch < versuche ? 'WARN' : 'ERROR',
        'DriveService',
        label + (versuch < versuche ? ' fehlgeschlagen, Retry folgt' : ' endgültig fehlgeschlagen'),
        vId,
        'Versuch ' + versuch + '/' + versuche + ' | Fehler: ' + driveFehlertextBauen_(e)
      );

      if (versuch < versuche) {
        Utilities.sleep(basisWartezeit * versuch);
      }
    }
  }

  throw new Error(label + ' fehlgeschlagen: ' + driveFehlertextBauen_(letzterFehler));
}


/**
 * FUNKTION: Holt den konfigurierten Drive-Wurzelordner.
 */
function driveWurzelOrdnerHolen_() {
  const rootId = KONFIGURATION &&
    KONFIGURATION.DRIVE_ORDNER &&
    KONFIGURATION.DRIVE_ORDNER.WURZEL_ORDNER_ID
      ? textNormalisieren_(KONFIGURATION.DRIVE_ORDNER.WURZEL_ORDNER_ID)
      : '';

  if (!rootId) {
    throw new Error('Drive-Wurzelordner fehlt in KONFIGURATION.DRIVE_ORDNER.WURZEL_ORDNER_ID.');
  }

  return driveMitRetry_('Drive-Wurzelordner laden', '', function() {
    return DriveApp.getFolderById(rootId);
  }, 3, 400);
}


/**
 * FUNKTION: Bereinigt Text für Drive-Ordnernamen.
 */
function driveNameBereinigen_(wert) {
  return textNormalisieren_(wert)
    .replace(/[\/:*?"<>|#]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
}


/**
 * FUNKTION: Formatiert Datum robust für Ordnernamen.
 * RÜCKGABE: yyyy-MM-dd
 */
function driveDatumFuerOrdnername_(wert) {
  if (!wert) return '0000-00-00';

  if (wert instanceof Date) {
    return Utilities.formatDate(wert, holeZeitzone_(), 'yyyy-MM-dd');
  }

  const text = textNormalisieren_(wert);
  if (!text) return '0000-00-00';

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return text;

  const de = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (de) return de[3] + '-' + de[2] + '-' + de[1];

  return '0000-00-00';
}


/**
 * FUNKTION: Prüft, ob eine Registernummer belastbar ist.
 */
function registernummerVerwertbar_(regNr) {
  const text = textNormalisieren_(regNr);
  if (!text) return false;
  if (text === '-') return false;
  if (text.toLowerCase().indexOf('ausstehend') !== -1) return false;
  return true;
}


/**
 * FUNKTION: Baut den Namen des Stoffbesitzer-Hauptordners.
 */
function stoffbesitzerOrdnerNameBauen_(stoffbesitzer) {
  return driveNameBereinigen_(stoffbesitzer);
}


/**
 * FUNKTION: Baut den Namen des Vorgangsordners.
 * OHNE REGISTERNUMMER:
 * [V-2026-001] Max Mustermann - 2026-04-21
 *
 * MIT REGISTERNUMMER:
 * [V-2026-001] Max Mustermann - 2026-04-21 - 1460927/2026
 */
function vorgangsOrdnerNameBauen_(vId, stoffbesitzer, regNr, brandDatum) {
  const id = textNormalisieren_(vId);
  const stoff = driveNameBereinigen_(stoffbesitzer);
  const datum = driveDatumFuerOrdnername_(brandDatum);
  const teile = [];

  if (datum !== '0000-00-00') {
    teile.push(datum);
  }

  if (stoff) {
    teile.push(stoff);
  }

  teile.push('[' + id + ']');

  if (registernummerVerwertbar_(regNr)) {
    teile.push('RegNr ' + driveNameBereinigen_(regNr));
  }

  return teile.join(' - ');
}


/**
 * FUNKTION: Holt oder erstellt den Hauptordner des Stoffbesitzers.
 */
function getStoffbesitzerHauptOrdner_(stoffbesitzer) {
  const stoff = textNormalisieren_(stoffbesitzer);
  if (!stoff) {
    throw new Error('Stoffbesitzer fehlt für Ordneranlage.');
  }

  const root = driveWurzelOrdnerHolen_();
  const ordnerName = stoffbesitzerOrdnerNameBauen_(stoff);
  const bestehend = driveMitRetry_('Stoffbesitzer-Hauptordner suchen', '', function() {
    const iter = root.getFoldersByName(ordnerName);
    return iter.hasNext() ? iter.next() : null;
  }, 3, 350);

  if (bestehend) {
    return bestehend;
  }

  const neu = driveMitRetry_('Stoffbesitzer-Hauptordner erstellen', '', function() {
    return root.createFolder(ordnerName);
  }, 3, 500);

  systemLogSchreiben_(
    'INFO',
    'DriveService',
    'Stoffbesitzer-Hauptordner erstellt',
    '',
    ordnerName
  );

  return neu;
}


/**
 * FUNKTION: Sucht vorhandenen Vorgangsordner anhand der festen Vorgangs-ID.
 */
function vorhandenenVorgangsOrdnerSuchen_(parentFolder, vId) {
  const anker = '[' + textNormalisieren_(vId) + ']';

  return driveMitRetry_('Vorgangsordner suchen', textNormalisieren_(vId), function() {
    const iter = parentFolder.getFolders();

    while (iter.hasNext()) {
      const ordner = iter.next();
      const name = textNormalisieren_(ordner.getName());

      if (name.indexOf(anker) > -1) {
        return ordner;
      }
    }

    return null;
  }, 3, 350);
}


/**
 * FUNKTION: Holt den vorhandenen Vorgangsordner ohne Neuanlage.
 */
function vorhandenenDossierOrdnerHolen_(vId, stoffbesitzer) {
  const vorgangsId = textNormalisieren_(vId);
  const stoff = textNormalisieren_(stoffbesitzer);

  if (!vorgangsId || !stoff) {
    return null;
  }

  const root = driveWurzelOrdnerHolen_();
  const stoffOrdnerName = stoffbesitzerOrdnerNameBauen_(stoff);
  const stoffOrdner = driveMitRetry_('Stoffbesitzer-Ordner laden', vorgangsId, function() {
    const stoffIter = root.getFoldersByName(stoffOrdnerName);
    return stoffIter.hasNext() ? stoffIter.next() : null;
  }, 3, 350);

  if (!stoffOrdner) {
    return null;
  }

  return vorhandenenVorgangsOrdnerSuchen_(stoffOrdner, vorgangsId);
}


/**
 * FUNKTION: Legt die Dossier-Grundstruktur genau einmal in der Vorplanung an.
 * LOGIK:
 * - erstellt bei Bedarf Stoffbesitzer-Hauptordner
 * - erstellt bei Bedarf Vorgangsordner ohne Registernummer
 * - benennt vorhandene Vorgangsordner in dieser Phase nicht um
 */
function dossierGrundstrukturInitialAnlegen_(vId, stoffbesitzer, planDatum) {
  const vorgangsId = textNormalisieren_(vId);
  const stoff = textNormalisieren_(stoffbesitzer);

  if (!vorgangsId) {
    throw new Error('Vorgangs-ID fehlt für Dossier-Ordner.');
  }

  if (!stoff) {
    throw new Error('Stoffbesitzer fehlt für Dossier-Ordner.');
  }

  const parent = getStoffbesitzerHauptOrdner_(stoff);
  let caseOrdner = vorhandenenVorgangsOrdnerSuchen_(parent, vorgangsId);

  if (caseOrdner) {
    return caseOrdner;
  }

  const zielName = vorgangsOrdnerNameBauen_(vorgangsId, stoff, '', planDatum);
  caseOrdner = driveMitRetry_('Vorgangsordner initial erstellen', vorgangsId, function() {
    return parent.createFolder(zielName);
  }, 3, 500);

  systemLogSchreiben_(
    'INFO',
    'DriveService',
    'Vorgangsordner initial erstellt',
    vorgangsId,
    zielName
  );

  return caseOrdner;
}


/**
 * FUNKTION: Ergänzt oder benennt einen vorhandenen Vorgangsordner erst dann um,
 * wenn eine belastbare Registernummer vorliegt.
 * LOGIK:
 * - keine Neuanlage außerhalb der Vorplanung
 * - keine Umbenennung ohne verwertbare Registernummer
 */
function dossierOrdnerMitRegisternummerNachziehen_(vId, stoffbesitzer, regNr, brandDatum) {
  const vorgangsId = textNormalisieren_(vId);
  const stoff = textNormalisieren_(stoffbesitzer);
  const reg = textNormalisieren_(regNr);

  if (!vorgangsId || !stoff) {
    return null;
  }

  const caseOrdner = vorhandenenDossierOrdnerHolen_(vorgangsId, stoff);
  if (!caseOrdner) {
    return null;
  }

  if (!registernummerVerwertbar_(reg)) {
    return caseOrdner;
  }

  const zielName = vorgangsOrdnerNameBauen_(vorgangsId, stoff, reg, brandDatum);

  if (textNormalisieren_(caseOrdner.getName()) !== zielName) {
    driveMitRetry_('Vorgangsordner umbenennen', vorgangsId, function() {
      caseOrdner.setName(zielName);
      return true;
    }, 3, 500);

    systemLogSchreiben_(
      'INFO',
      'DriveService',
      'Vorgangsordner nach Registernummer nachgezogen',
      vorgangsId,
      zielName
    );
  }

  return caseOrdner;
}


/**
 * FUNKTION: Holt die vorhandene Dossier-URL für eine Zeile.
 * LOGIK:
 * - erstellt keine neue Drive-Struktur
 * - benennt nur bei belastbarer Registernummer nach
 */
function dossierUrlAusBestandFuerZeileHolen_(blatt, zeile, sMap) {
  if (!blatt || !sMap || zeile <= 1) return '';
  if (!sMap.VORGANGS_ID || !sMap.STOFFBESITZER) return '';

  const vId = textNormalisieren_(blatt.getRange(zeile, sMap.VORGANGS_ID).getValue());
  const stoff = textNormalisieren_(blatt.getRange(zeile, sMap.STOFFBESITZER).getValue());

  if (!vId || !stoff) return '';

  const regNr = sMap.REGISTERNUMMER
    ? blatt.getRange(zeile, sMap.REGISTERNUMMER).getValue()
    : '';

  const datum = sMap.TAG_BRAND
    ? blatt.getRange(zeile, sMap.TAG_BRAND).getValue()
    : (sMap.TERMIN_MAISCHE ? blatt.getRange(zeile, sMap.TERMIN_MAISCHE).getValue() : '');

  const ordner = registernummerVerwertbar_(regNr)
    ? dossierOrdnerMitRegisternummerNachziehen_(vId, stoff, regNr, datum)
    : vorhandenenDossierOrdnerHolen_(vId, stoff);

  return ordner ? driveMitRetry_('Dossier-URL lesen', vId, function() {
    return ordner.getUrl();
  }, 3, 250) : '';
}


/**
 * FUNKTION: Aktualisiert den Dossier-Link in einer Zeile rein aus vorhandenem Bestand.
 */
function dossierLinkAktualisieren_(blatt, zeile, sMap) {
  if (!blatt || !sMap || zeile <= 1) return;
  if (!sMap.DOSSIER_LINK) return;

  const url = dossierUrlAusBestandFuerZeileHolen_(blatt, zeile, sMap);
  if (!url) return;

  blatt.getRange(zeile, sMap.DOSSIER_LINK).setValue(url);
}


/**
 * FUNKTION: Aktualisiert den Dossier-Link für alle Zeilen eines Vorgangs rein aus vorhandenem Bestand.
 */
function dossierLinkFuerGesamtenVorgangAktualisieren_(blatt, vorgangsId) {
  if (!blatt) return;
  if (!textNormalisieren_(vorgangsId)) return;

  const sMap = spaltenZuordnungHolen_(blatt);
  const zeilen = alleZeilenMitVorgangsIdHolen_(blatt, vorgangsId);

  zeilen.forEach(function(zeile) {
    dossierLinkAktualisieren_(blatt, zeile, sMap);
  });
}


/**
 * FUNKTION: Aktualisiert den Dossier-Link der aktiven Zeile.
 */
function aktivenDossierLinkAktualisieren() {
  const sh = SpreadsheetApp.getActiveSheet();
  const zeile = sh.getActiveRange() ? sh.getActiveRange().getRow() : 0;

  if (!sh || zeile <= 1) {
    systemAlert_('Hinweis', 'Keine gültige Datenzeile markiert.');
    return;
  }

  const sMap = spaltenZuordnungHolen_(sh);
  dossierLinkAktualisieren_(sh, zeile, sMap);

  systemAlert_('ERFOLG', 'Dossier-Link wurde aktualisiert.');
}


/**
 * FUNKTION: Baut alle Dossier-Links in der Maischeannahme neu auf.
 */
function alleDossierLinksNeuAufbauen() {
  const sh = tabelleHolen_('MAISCHEANNAHME');
  if (!sh || sh.getLastRow() < 2) {
    systemAlert_('Hinweis', 'Keine Daten in 🍎_MAISCHEANNAHME vorhanden.');
    return;
  }

  const sMap = spaltenZuordnungHolen_(sh);
  let count = 0;

  for (let zeile = 2; zeile <= sh.getLastRow(); zeile++) {
    const vId = sMap.VORGANGS_ID ? textNormalisieren_(sh.getRange(zeile, sMap.VORGANGS_ID).getValue()) : '';
    const stoff = sMap.STOFFBESITZER ? textNormalisieren_(sh.getRange(zeile, sMap.STOFFBESITZER).getValue()) : '';

    if (!vId || !stoff) continue;

    dossierLinkAktualisieren_(sh, zeile, sMap);
    count++;
  }

  systemLogSchreiben_(
    'INFO',
    'DriveService',
    'Alle Dossier-Links neu aufgebaut',
    '',
    'Zeilen: ' + count
  );

  systemAlert_('ERFOLG', 'Dossier-Links neu aufgebaut: ' + count);
}

/**
 * FUNKTION: Verschiebt vorhandene Drive-Vorgangsordner zu einer Vorgangs-ID in den Drive-Papierkorb.
 * SUCHREIHENFOLGE:
 * 1. Dossier_Link aus Tabellenzeilen
 * 2. Stoffbesitzer-Hauptordner aus gefundenen Fachzeilen
 * 3. alle Stoffbesitzer-Hauptordner im Drive-Wurzelordner als Fallback
 */
function dossierOrdnerFuerVorgangInPapierkorbVerschieben_(vId, stoffbesitzerListe, dossierLinks) {
  const vorgangsId = textNormalisieren_(vId);
  if (!vorgangsId) {
    return { verschoben: 0, hinweis: 'Keine Vorgangs-ID übergeben.' };
  }

  const gefundeneOrdner = {};
  const hinweise = [];

  (dossierLinks || []).forEach(function(link) {
    const folderId = driveOrdnerIdAusUrl_(link);
    if (!folderId) return;

    try {
      const ordner = driveMitRetry_('Dossier-Ordner über Link laden', vorgangsId, function() {
        return DriveApp.getFolderById(folderId);
      }, 3, 350);

      if (ordner && textNormalisieren_(ordner.getName()).indexOf('[' + vorgangsId + ']') > -1) {
        gefundeneOrdner[ordner.getId()] = ordner;
      }
    } catch (e) {
      hinweise.push('Dossier-Link nicht ladbar: ' + driveFehlertextBauen_(e));
    }
  });

  const eindeutigeStoffbesitzer = Array.from(new Set((stoffbesitzerListe || []).map(textNormalisieren_).filter(String)));
  eindeutigeStoffbesitzer.forEach(function(stoff) {
    try {
      const ordner = vorhandenenDossierOrdnerHolen_(vorgangsId, stoff);
      if (ordner) gefundeneOrdner[ordner.getId()] = ordner;
    } catch (e) {
      hinweise.push('Suche über Stoffbesitzer fehlgeschlagen (' + stoff + '): ' + driveFehlertextBauen_(e));
    }
  });

  if (Object.keys(gefundeneOrdner).length === 0) {
    try {
      const fallbackOrdner = vorgangsOrdnerImDriveWurzelbaumSuchen_(vorgangsId);
      fallbackOrdner.forEach(function(ordner) {
        gefundeneOrdner[ordner.getId()] = ordner;
      });
    } catch (e) {
      hinweise.push('Fallback-Suche im Drive-Wurzelbaum fehlgeschlagen: ' + driveFehlertextBauen_(e));
    }
  }

  let verschoben = 0;
  Object.keys(gefundeneOrdner).forEach(function(id) {
    const ordner = gefundeneOrdner[id];
    try {
      driveMitRetry_('Dossier-Ordner in Papierkorb verschieben', vorgangsId, function() {
        ordner.setTrashed(true);
        return true;
      }, 3, 500);
      verschoben++;
    } catch (e) {
      hinweise.push('Ordner konnte nicht in den Papierkorb verschoben werden (' + ordner.getName() + '): ' + driveFehlertextBauen_(e));
    }
  });

  if (verschoben === 0 && hinweise.length === 0) {
    hinweise.push('Kein Drive-Vorgangsordner mit [' + vorgangsId + '] gefunden.');
  }

  return {
    verschoben: verschoben,
    hinweis: hinweise.join(' | ')
  };
}

/**
 * FUNKTION: Extrahiert eine Google-Drive-Ordner-ID aus üblichen Folder-URLs.
 */
function driveOrdnerIdAusUrl_(url) {
  const text = textNormalisieren_(url);
  if (!text) return '';

  const folderMatch = text.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch && folderMatch[1]) return folderMatch[1];

  const idMatch = text.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) return idMatch[1];

  return '';
}

/**
 * FUNKTION: Fallback-Suche im Drive-Wurzelbaum genau eine Ebene unter den Stoffbesitzer-Ordnern.
 */
function vorgangsOrdnerImDriveWurzelbaumSuchen_(vId) {
  const vorgangsId = textNormalisieren_(vId);
  const anker = '[' + vorgangsId + ']';
  const treffer = [];

  if (!vorgangsId) return treffer;

  const root = driveWurzelOrdnerHolen_();

  return driveMitRetry_('Vorgangsordner im Drive-Wurzelbaum suchen', vorgangsId, function() {
    const stoffOrdnerIter = root.getFolders();

    while (stoffOrdnerIter.hasNext()) {
      const stoffOrdner = stoffOrdnerIter.next();
      const vorgangsOrdnerIter = stoffOrdner.getFolders();

      while (vorgangsOrdnerIter.hasNext()) {
        const vorgangsOrdner = vorgangsOrdnerIter.next();
        const name = textNormalisieren_(vorgangsOrdner.getName());
        if (name.indexOf(anker) > -1) {
          treffer.push(vorgangsOrdner);
        }
      }
    }

    return treffer;
  }, 3, 500);
}
