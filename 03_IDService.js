/**
 * DATEI: 03_IDService.gs
 * ZWECK: ZENTRALE ID-VERWALTUNG IM FORMAT V-YYYY-XXX
 */


/**
 * FUNKTION: Sucht einen offenen ANGELEGT-Vorgang eines Stoffbesitzers.
 * RÜCKGABE: Vorgangs-ID oder leer.
 */
function offeneVorgangsIdDesStoffbesitzersHolen_(stoffbesitzer) {
  const stoff = textNormalisieren_(stoffbesitzer);
  if (!stoff) return "";

  const shReg = tabelleHolen_("ZENTRALREGISTER");
  if (!shReg || shReg.getLastRow() < 2) return "";

  const sMap = spaltenZuordnungHolen_(shReg);
  if (!sMap.VORGANGS_ID || !sMap.STOFFBESITZER || !sMap.STATUS) {
    systemLogSchreiben_("ERROR", "IDService", "Mapping-Fehler im Zentralregister", "", "Pflichtspalten fehlen");
    return "";
  }

  const daten = shReg.getDataRange().getValues();

  for (let i = 1; i < daten.length; i++) {
    const regStoff = textNormalisieren_(daten[i][sMap.STOFFBESITZER - 1]);
    const regStatus = textNormalisieren_(daten[i][sMap.STATUS - 1]);

    if (regStoff === stoff && regStatus === KONFIGURATION.STATUSWERTE.ANGELEGT) {
      return textNormalisieren_(daten[i][sMap.VORGANGS_ID - 1]);
    }
  }

  return "";
}


/**
 * FUNKTION: Ermittelt die nächste freie Vorgangs-ID des laufenden Jahres.
 * FORMAT: V-YYYY-XXX
 */
function naechsteVorgangsIdErmitteln_() {
  const shReg = tabelleHolen_("ZENTRALREGISTER");
  if (!shReg) {
    throw new Error("📂_ZENTRALREGISTER nicht gefunden.");
  }

  const sMap = spaltenZuordnungHolen_(shReg);
  if (!sMap.VORGANGS_ID) {
    throw new Error("Spalte Vorgangs_ID im Zentralregister fehlt.");
  }

  const daten = shReg.getDataRange().getValues();
  const jahr = Utilities.formatDate(
    new Date(),
    KONFIGURATION.ZOLL_PARAMETER.ZEIT_PARAMETER.ZEITZONE,
    "yyyy"
  );
  const praefix = "V-" + jahr + "-";
  let maxNr = 0;

  for (let i = 1; i < daten.length; i++) {
    const id = textNormalisieren_(daten[i][sMap.VORGANGS_ID - 1]);
    if (id.indexOf(praefix) !== 0) continue;

    const teile = id.split("-");
    const nr = parseInt(teile[teile.length - 1], 10);

    if (!isNaN(nr) && nr > maxNr) {
      maxNr = nr;
    }
  }

  return praefix + String(maxNr + 1).padStart(3, "0");
}


/**
 * FUNKTION: Legt einen Registereintrag an oder aktualisiert ihn.
 * LOGIK:
 * - existiert die ID schon -> Stoffbesitzer/Status aktualisieren
 * - existiert sie noch nicht -> neue Registerzeile anlegen
 */
function registereintragSicherstellen_(vId, stoffbesitzer, status) {
  const vorgangsId = textNormalisieren_(vId);
  const stoff = textNormalisieren_(stoffbesitzer);
  const statusWert = textNormalisieren_(status) || KONFIGURATION.STATUSWERTE.ANGELEGT;

  if (!vorgangsId) throw new Error("Vorgangs-ID fehlt.");
  if (!stoff) throw new Error("Stoffbesitzer fehlt.");

  const shReg = tabelleHolen_("ZENTRALREGISTER");
  if (!shReg) throw new Error("📂_ZENTRALREGISTER nicht gefunden.");

  const sMap = spaltenZuordnungHolen_(shReg);
  if (!sMap.VORGANGS_ID || !sMap.STOFFBESITZER) {
    throw new Error("Pflichtspalten im Zentralregister fehlen.");
  }

  const zeile = ersteZeileMitVorgangsIdHolen_(shReg, vorgangsId);

  if (zeile > 1) {
    if (sMap.STOFFBESITZER) {
      shReg.getRange(zeile, sMap.STOFFBESITZER).setValue(stoff);
    }
    if (sMap.STATUS) {
      shReg.getRange(zeile, sMap.STATUS).setValue(statusWert);
    }

    systemLogSchreiben_("INFO", "IDService", "Registereintrag aktualisiert", vorgangsId, "Besitzer: " + stoff);
    return vorgangsId;
  }

  const neueZeile = new Array(shReg.getLastColumn()).fill("");

  if (sMap.VORGANGS_ID) neueZeile[sMap.VORGANGS_ID - 1] = vorgangsId;
  if (sMap.DATUM) neueZeile[sMap.DATUM - 1] = new Date();
  if (sMap.STOFFBESITZER) neueZeile[sMap.STOFFBESITZER - 1] = stoff;
  if (sMap.STATUS) neueZeile[sMap.STATUS - 1] = statusWert;

  shReg.appendRow(neueZeile);

  systemLogSchreiben_("INFO", "IDService", "Registereintrag angelegt", vorgangsId, "Besitzer: " + stoff);
  return vorgangsId;
}


/**
 * FUNKTION: Standardverhalten für Tabellenbearbeitung.
 * LOGIK:
 * - wenn offener ANGELEGT-Vorgang desselben Stoffbesitzers existiert -> wiederverwenden
 * - sonst neue ID anlegen
 */
function vorgangsIdSicherstellen_(stoffbesitzer) {
  const stoff = textNormalisieren_(stoffbesitzer);
  if (!stoff) return "";

  const offeneId = offeneVorgangsIdDesStoffbesitzersHolen_(stoff);
  if (offeneId) {
    return offeneId;
  }

  return vorgangsIdNeuAnlegen_(stoff);
}


/**
 * FUNKTION: Erzwingt immer eine neue Vorgangs-ID.
 * EINSATZ: WebApp-Button „+ Neuer Vorgang“
 */
function vorgangsIdNeuAnlegen_(stoffbesitzer) {
  const stoff = textNormalisieren_(stoffbesitzer);
  if (!stoff) throw new Error("Stoffbesitzer fehlt.");

  const neueId = naechsteVorgangsIdErmitteln_();
  registereintragSicherstellen_(neueId, stoff, KONFIGURATION.STATUSWERTE.ANGELEGT);

  systemLogSchreiben_("INFO", "IDService", "Neue ID generiert", neueId, "Besitzer: " + stoff);
  return neueId;
}


/**
 * FUNKTION: Aktualisiert den Status im Zentralregister.
 */
function registerStatusAktualisieren_(vId, neu) {
  const vorgangsId = textNormalisieren_(vId);
  const neuerStatus = textNormalisieren_(neu);

  if (!vorgangsId) return;

  const sh = tabelleHolen_("ZENTRALREGISTER");
  if (!sh) return;

  const sMap = spaltenZuordnungHolen_(sh);
  if (!sMap.STATUS) return;

  const z = ersteZeileMitVorgangsIdHolen_(sh, vorgangsId);

  if (z > 1) {
    sh.getRange(z, sMap.STATUS).setValue(neuerStatus);
    systemLogSchreiben_("INFO", "IDService", "Status-Update im Register", vorgangsId, "Neuer Status: " + neuerStatus);
  } else {
    systemLogSchreiben_("WARN", "IDService", "Status-Update fehlgeschlagen - ID nicht im Register", vorgangsId, "");
  }
}


/**
 * FUNKTION: Prüft, ob eine Vorgangs-ID im Zentralregister existiert.
 */
function vorgangsIdExistiert_(vId) {
  const vorgangsId = textNormalisieren_(vId);
  if (!vorgangsId) return false;

  const sh = tabelleHolen_("ZENTRALREGISTER");
  if (!sh) return false;

  return ersteZeileMitVorgangsIdHolen_(sh, vorgangsId) > 1;
}