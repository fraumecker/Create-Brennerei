/**
 * DATEI: 11_MAISCHESERVICE.GS
 * SERVICEFUNKTIONEN FÜR STATUS, ZOLL UND MESSWERTE DER MAISCHEANNAHME
 */

function maischeannahmeStatusSetzen_(vId, neuerStatus) {
  return mitSperreAusfuehren_(function() {
    const shMA = tabelleHolen_("MAISCHEANNAHME");
    if (!shMA) return;

    const sMA = spaltenZuordnungHolen_(shMA);
    if (!sMA.VORGANGS_ID || !sMA.STATUS) return;

    const zeilen = alleZeilenMitVorgangsIdHolen_(shMA, vId);
    if (zeilen.length === 0) return;

    zeilen.forEach(function(z) {
      shMA.getRange(z, sMA.STATUS).setValue(neuerStatus);
    });

    registerStatusAktualisieren_(vId, neuerStatus);
    systemLogSchreiben_("INFO", "MaischeService", "Status in Maischeannahme gesetzt", vId, "Status: " + neuerStatus + " | Zeilen: " + zeilen.length);
  }, "maischeannahmeStatusSetzen_");
}

function maischeannahmeZollstatusSetzen_(vId, zollOkWert) {
  return mitSperreAusfuehren_(function() {
    const shMA = tabelleHolen_("MAISCHEANNAHME");
    if (!shMA) return;

    const sMA = spaltenZuordnungHolen_(shMA);
    if (!sMA.VORGANGS_ID || !sMA.ZOLL_OK) return;

    const zeilen = alleZeilenMitVorgangsIdHolen_(shMA, vId);
    if (zeilen.length === 0) return;

    zeilen.forEach(function(z) {
      shMA.getRange(z, sMA.ZOLL_OK).setValue(zollOkWert);
    });

    systemLogSchreiben_("INFO", "MaischeService", "Zollstatus gesetzt", vId, "Zoll_OK: " + zollOkWert + " | Zeilen: " + zeilen.length);
  }, "maischeannahmeZollstatusSetzen_");
}

function maischeannahmeMesswerteSpeichern_(zeile, alkoholWert, ausbeuteWert) {
  return mitSperreAusfuehren_(function() {
    const shMA = tabelleHolen_("MAISCHEANNAHME");
    if (!shMA || zeile <= 1) return false;

    const sMA = spaltenZuordnungHolen_(shMA);
    if (sMA.ALKOHOL) {
      shMA.getRange(zeile, sMA.ALKOHOL).setValue(alkoholWert);
    }
    if (sMA.AUSBEUTE) {
      shMA.getRange(zeile, sMA.AUSBEUTE).setValue(ausbeuteWert);
    }

    const vId = sMA.VORGANGS_ID ? textNormalisieren_(shMA.getRange(zeile, sMA.VORGANGS_ID).getValue()) : "";
    systemLogSchreiben_("INFO", "MaischeService", "Messwerte gespeichert", vId, "Zeile: " + zeile + " | Alk: " + alkoholWert + " | Ausbeute: " + ausbeuteWert);
    return true;
  }, "maischeannahmeMesswerteSpeichern_");
}

function maischeannahmeDossierLinkSyncFuerVorgang_(vId) {
  return mitSperreAusfuehren_(function() {
    const shMA = tabelleHolen_("MAISCHEANNAHME");
    if (!shMA) return;

    const sMA = spaltenZuordnungHolen_(shMA);
    if (!sMA.VORGANGS_ID || !sMA.DOSSIER_LINK) return;

    const zeilen = alleZeilenMitVorgangsIdHolen_(shMA, vId);
    if (zeilen.length === 0) return;

    zeilen.forEach(function(z) {
      dossierLinkAktualisieren_(shMA, z, sMA);
    });

    systemLogSchreiben_("INFO", "MaischeService", "Dossier-Link synchronisiert", vId, "Zeilen: " + zeilen.length);
  }, "maischeannahmeDossierLinkSyncFuerVorgang_");
}