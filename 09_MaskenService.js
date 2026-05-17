/**
 * DATEI: 09_MaskenService.gs
 * ZWECK: WEBAPP-DATEN FÜR VORPLANUNG
 */


/**
 * FUNKTION: Lädt die Stoffbesitzer direkt aus 👥_MITGLIEDER / NameAnzeige.
 */
function ladeVorplanungDropdowns() {
  const sh = tabelleHolen_("MITGLIEDER");
  if (!sh) {
    throw new Error("Tabelle 👥_MITGLIEDER nicht gefunden.");
  }

  if (sh.getLastColumn() < 1) {
    return { stoffbesitzer: [] };
  }

  const header = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
  const colIndex = header.indexOf("NameAnzeige");

  if (colIndex === -1) {
    throw new Error("Spalte NameAnzeige in 👥_MITGLIEDER nicht gefunden.");
  }

  if (sh.getLastRow() < 2) {
    return { stoffbesitzer: [] };
  }

  const werte = sh.getRange(2, colIndex + 1, sh.getLastRow() - 1, 1)
    .getDisplayValues()
    .flat()
    .map(function(v) { return textNormalisieren_(v); })
    .filter(function(v) { return v !== ""; });

  const eindeutigSortiert = Array.from(new Set(werte)).sort();

  return {
    stoffbesitzer: eindeutigSortiert
  };
}


/**
 * FUNKTION: Speichert die Vorplanung direkt in 📆_VORPLANUNG.
 * LOGIK:
 * - erzeugt bei Bedarf neue Vorgangs-ID
 * - setzt Status auf ANGELEGT
 * - schreibt exakt in die reduzierte Vorplanung
 * - legt die Drive-Grundstruktur einmalig an
 * - pflegt den Dossier-Link aus der initial angelegten Struktur
 * - sendet bei neu angelegtem Vorgang eine E-Mail-Benachrichtigung
 */
function speichereVorplanung(payload) {
  return mitSperreAusfuehren_(function() {
    if (!payload) {
      throw new Error("Payload fehlt.");
    }

    const stoffbesitzer = textNormalisieren_(payload.stoffbesitzer);
    const bemerkung = textNormalisieren_(payload.bemerkung);
    const status = KONFIGURATION.STATUSWERTE.ANGELEGT;

    if (!stoffbesitzer) {
      throw new Error("Stoffbesitzer fehlt.");
    }

    if (!bemerkung) {
      throw new Error("Bemerkung fehlt.");
    }

    const anrufDatum = datumFuerVorplanung_(payload.anrufDatum);
    let vorgangsId = textNormalisieren_(payload.vorgangsId);
    const istNeuerVorgang = !vorgangsId;

    if (!vorgangsId) {
      vorgangsId = vorgangsIdNeuAnlegen_(stoffbesitzer);
    } else {
      registereintragSicherstellen_(vorgangsId, stoffbesitzer, status);
    }

    const sh = tabelleHolen_("VORPLANUNG");
    if (!sh) {
      throw new Error("Tabelle 📆_VORPLANUNG nicht gefunden.");
    }

    const sMap = spaltenZuordnungHolen_(sh);

    if (!sMap.VORGANGS_ID || !sMap.ANRUF_DATUM || !sMap.STOFFBESITZER || !sMap.BEMERKUNG || !sMap.STATUS) {
      throw new Error("Pflichtspalten in 📆_VORPLANUNG fehlen.");
    }

    let dossierLink = '';
    const bestehendeZeileVorhanden = ersteZeileMitVorgangsIdHolen_(sh, vorgangsId);

    if (bestehendeZeileVorhanden >= 2 && sMap.DOSSIER_LINK) {
      dossierLink = textNormalisieren_(sh.getRange(bestehendeZeileVorhanden, sMap.DOSSIER_LINK).getDisplayValue());
    }

    if (!dossierLink) {
      const dossierOrdner = dossierGrundstrukturInitialAnlegen_(vorgangsId, stoffbesitzer, anrufDatum);
      dossierLink = driveMitRetry_('Dossier-Link lesen', vorgangsId, function() {
        return dossierOrdner.getUrl();
      }, 3, 250);
    }

    let zielZeile = bestehendeZeileVorhanden;
    if (zielZeile < 2) {
      zielZeile = sh.getLastRow() + 1;
    }

    const zeile = new Array(sh.getLastColumn()).fill("");

    if (sMap.VORGANGS_ID) zeile[sMap.VORGANGS_ID - 1] = vorgangsId;
    if (sMap.ANRUF_DATUM) zeile[sMap.ANRUF_DATUM - 1] = anrufDatum;
    if (sMap.STOFFBESITZER) zeile[sMap.STOFFBESITZER - 1] = stoffbesitzer;
    if (sMap.BEMERKUNG) zeile[sMap.BEMERKUNG - 1] = bemerkung;
    if (sMap.STATUS) zeile[sMap.STATUS - 1] = status;
    if (sMap.DOSSIER_LINK) zeile[sMap.DOSSIER_LINK - 1] = dossierLink;

    sh.getRange(zielZeile, 1, 1, sh.getLastColumn()).setValues([zeile]);

    if (sMap.ANRUF_DATUM) {
      sh.getRange(zielZeile, sMap.ANRUF_DATUM).setNumberFormat("dd.MM.yyyy");
    }

    registerStatusAktualisieren_(vorgangsId, status);

    if (istNeuerVorgang) {
      try {
        neueVorplanungPerMailMelden_({
          vorgangsId: vorgangsId,
          anrufDatum: anrufDatum,
          stoffbesitzer: stoffbesitzer,
          bemerkung: bemerkung,
          status: status,
          dossierLink: dossierLink
        });
      } catch (mailFehler) {
        systemLogSchreiben_(
          'WARN',
          'MaskenService',
          'E-Mail-Benachrichtigung neuer Vorgang fehlgeschlagen',
          vorgangsId,
          mailFehler && mailFehler.message ? mailFehler.message : String(mailFehler)
        );
      }
    }

    systemLogSchreiben_(
      "INFO",
      "MaskenService",
      "Vorplanung gespeichert",
      vorgangsId,
      "Zeile: " + zielZeile
    );

    return {
      ok: true,
      vorgangsId: vorgangsId,
      anrufDatum: datumIsoFormatieren_(anrufDatum),
      dossierLink: dossierLink,
      status: status
    };
  }, "speichereVorplanung");
}


/**
 * FUNKTION: Sendet bei neu angelegter Vorplanung eine E-Mail-Benachrichtigung.
 */
function neueVorplanungPerMailMelden_(daten) {
  const empfaenger =
    KONFIGURATION &&
    KONFIGURATION.BENACHRICHTIGUNG &&
    textNormalisieren_(KONFIGURATION.BENACHRICHTIGUNG.NEUER_VORGANG_EMPFAENGER);

  if (!empfaenger) {
    systemLogSchreiben_(
      "WARN",
      "MaskenService",
      "E-Mail-Benachrichtigung übersprungen",
      daten && daten.vorgangsId ? daten.vorgangsId : "",
      "Kein Empfänger für neue Vorgänge konfiguriert"
    );
    return;
  }

  const betreff = "[OGV Brennerei] Neuer Vorgang angelegt: " + (daten.vorgangsId || "");
  const text = neueVorplanungMailtextBauen_(daten);

  MailApp.sendEmail({
    to: empfaenger,
    subject: betreff,
    body: text
  });

  systemLogSchreiben_(
    "INFO",
    "MaskenService",
    "E-Mail-Benachrichtigung neuer Vorgang gesendet",
    daten && daten.vorgangsId ? daten.vorgangsId : "",
    "Empfänger: " + empfaenger
  );
}


/**
 * FUNKTION: Baut den E-Mail-Text für einen neu angelegten Vorgang.
 */
function neueVorplanungMailtextBauen_(daten) {
  const teile = [];

  teile.push("OGV BREITFURT - NEUER VORGANG");
  teile.push("");
  teile.push("Es wurde ein neuer Vorgang in der Vorplanung angelegt.");
  teile.push("");
  teile.push("Vorgangs_ID: " + (daten.vorgangsId || "-"));
  teile.push("Anruf_Datum: " + datumDeutschFuerMail_(daten.anrufDatum));
  teile.push("Stoffbesitzer: " + (daten.stoffbesitzer || "-"));
  teile.push("Bemerkung: " + (daten.bemerkung || "-"));
  teile.push("Status: " + (daten.status || "-"));
  teile.push("");
  teile.push("Dossier_Link: " + (daten.dossierLink || "-"));

  return teile.join("\n");
}


/**
 * FUNKTION: Formatiert ein Datum für den Mailtext als dd.MM.yyyy.
 */
function datumDeutschFuerMail_(wert) {
  if (!(wert instanceof Date) || isNaN(wert.getTime())) {
    return "-";
  }

  return Utilities.formatDate(
    wert,
    KONFIGURATION.ZOLL_PARAMETER.ZEIT_PARAMETER.ZEITZONE,
    "dd.MM.yyyy"
  );
}


/**
 * FUNKTION: Wandelt Datum für Vorplanung robust um.
 */
function datumFuerVorplanung_(wert) {
  const text = textNormalisieren_(wert);

  if (!text) {
    return datumHeuteOhneZeit_();
  }

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    return new Date(
      Number(iso[1]),
      Number(iso[2]) - 1,
      Number(iso[3]),
      12, 0, 0, 0
    );
  }

  const de = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (de) {
    return new Date(
      Number(de[3]),
      Number(de[2]) - 1,
      Number(de[1]),
      12, 0, 0, 0
    );
  }

  return datumHeuteOhneZeit_();
}


/**
 * FUNKTION: Heutiges Datum ohne relevante Uhrzeit.
 */
function datumHeuteOhneZeit_() {
  const jetzt = new Date();
  return new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate(), 12, 0, 0, 0);
}