/**
 * DATEI: 22_ChecklistenBenachrichtigung.gs
 * ZWECK:
 * - Prüft nach der Brandplanung, ob für den Stoffbesitzer eine E-Mail-Adresse vorliegt
 * - Versendet die vorhandene Checkliste als PDF-Anhang
 * - Gibt bei fehlender Mailadresse einen klaren Hinweis für Postversand zurück
 *
 * HINWEIS:
 * - Es wird bewusst nur E-Mail umgesetzt
 * - Keine WhatsApp-/Messenger-Erfindungen
 * - Als Checkliste wird der vorhandene Checklisten-Inhalt als HTML-PDF erzeugt
 */


/**
 * HAUPTFUNKTION:
 * Prüft und versendet die Checkliste für eine bereits gespeicherte Brandplanung.
 *
 * AUFRUF:
 *   pruefeUndVersendeChecklisteNachBrandplanung(vorgangsId)
 *
 * RÜCKGABE:
 * {
 *   ok: true|false,
 *   versendet: true|false,
 *   kanal: "E-MAIL"|"POST",
 *   empfaenger: "...",
 *   hinweis: "..."
 * }
 */
function pruefeUndVersendeChecklisteNachBrandplanung(vorgangsId) {
  const vId = textNormalisieren_(vorgangsId);
  if (!vId) {
    throw new Error("Vorgangs-ID fehlt.");
  }

  const planung = holeBrandplanungNachVorgangsId_(vId);
  if (!planung) {
    throw new Error("Brandplanung zu Vorgangs-ID nicht gefunden: " + vId);
  }

  if (!planung.datumMaischeannahme) {
    throw new Error("Datum_Maischeannahme fehlt für Vorgangs-ID: " + vId);
  }

  const mitglied = holeMitgliedMitKontaktZuStoffbesitzer_(planung.stoffbesitzer);

  if (!mitglied || !mitglied.email) {
    const hinweis =
      (KONFIGURATION &&
       KONFIGURATION.BENACHRICHTIGUNG &&
       KONFIGURATION.BENACHRICHTIGUNG.HINWEIS_KEINE_EMAIL_CHECKLISTE)
        ? KONFIGURATION.BENACHRICHTIGUNG.HINWEIS_KEINE_EMAIL_CHECKLISTE
        : "Keine E-Mail-Adresse hinterlegt. Checkliste per Post versenden.";

    systemLogSchreiben_(
      "WARN",
      "ChecklistenBenachrichtigung",
      "Keine E-Mail-Adresse für Stoffbesitzer vorhanden",
      vId,
      planung.stoffbesitzer
    );

    return {
      ok: true,
      versendet: false,
      kanal: "POST",
      empfaenger: "",
      hinweis: hinweis
    };
  }

  try {
    const pdfBlob = exportiereChecklisteAlsPdfBlob_(planung);
    const betreff = baueBetreffCheckliste_(planung);
    const mailText = baueMailtextCheckliste_(planung);

    MailApp.sendEmail({
      to: mitglied.email,
      subject: betreff,
      body: mailText,
      attachments: [pdfBlob]
    });

    systemLogSchreiben_(
      "INFO",
      "ChecklistenBenachrichtigung",
      "Checkliste per E-Mail versendet",
      vId,
      mitglied.email
    );

    return {
      ok: true,
      versendet: true,
      kanal: "E-MAIL",
      empfaenger: mitglied.email,
      hinweis: "Checkliste per E-Mail versendet."
    };
  } catch (e) {
    const fehlertext = e && e.message ? e.message : String(e);

    systemLogSchreiben_(
      "WARN",
      "ChecklistenBenachrichtigung",
      "Checkliste konnte nicht versendet werden",
      vId,
      fehlertext
    );

    return {
      ok: false,
      versendet: false,
      kanal: "E-MAIL",
      empfaenger: mitglied.email,
      hinweis: "Checkliste konnte nicht gesendet werden: " + fehlertext + " Prüfen: Menü SYSTEM → API Autorisierung einmal ausführen, E-Mail-Adresse prüfen."
    };
  }
}


/**
 * FUNKTION:
 * Holt den Datensatz aus 🗓️_BRANDTAGE_PLANUNG anhand der Vorgangs-ID.
 */
function holeBrandplanungNachVorgangsId_(vorgangsId) {
  const vId = textNormalisieren_(vorgangsId);
  if (!vId) return null;

  const sh = tabelleHolen_("BRANDTAGE_PLANUNG");
  if (!sh) {
    throw new Error("Tabelle 🗓️_BRANDTAGE_PLANUNG nicht gefunden.");
  }
  if (sh.getLastRow() < 2) {
    return null;
  }

  const pflicht = pruefePflichtspalten_(sh, [
    "VORGANGS_ID",
    "STOFFBESITZER",
    "DATUM_MAISCHEANNAHME",
    "BRANDTAG",
    "BEMERKUNG_VORPLANUNG",
    "STATUS"
  ]);

  if (!pflicht.ok) {
    throw new Error(
      "Pflichtspalten in 🗓️_BRANDTAGE_PLANUNG fehlen: " + pflicht.missing.join(", ")
    );
  }

  const sMap = pflicht.map;
  const daten = sh.getDataRange().getValues();

  for (let i = 1; i < daten.length; i++) {
    const row = daten[i];
    const rowVorgangsId = textNormalisieren_(row[sMap.VORGANGS_ID - 1]);

    if (rowVorgangsId !== vId) continue;

    return {
      zeile: i + 1,
      vorgangsId: rowVorgangsId,
      stoffbesitzer: textNormalisieren_(row[sMap.STOFFBESITZER - 1]),
      datumMaischeannahme: row[sMap.DATUM_MAISCHEANNAHME - 1],
      brandtag: row[sMap.BRANDTAG - 1],
      bemerkungVorplanung: textNormalisieren_(row[sMap.BEMERKUNG_VORPLANUNG - 1]),
      status: textNormalisieren_(row[sMap.STATUS - 1])
    };
  }

  return null;
}


/**
 * FUNKTION:
 * Sucht den Stoffbesitzer in 👥_MITGLIEDER über NameAnzeige und liest die Mailadresse.
 *
 * HINWEIS:
 * Da der exakte Mail-Spaltenname in der bisherigen Quelle nicht festgelegt wurde,
 * wird hier robust auf typische Spaltennamen geprüft.
 */
function holeMitgliedMitKontaktZuStoffbesitzer_(stoffbesitzer) {
  const name = textNormalisieren_(stoffbesitzer);
  if (!name) return null;

  const sh = tabelleHolen_("MITGLIEDER");
  if (!sh) {
    throw new Error("Tabelle 👥_MITGLIEDER nicht gefunden.");
  }
  if (sh.getLastRow() < 2) {
    return null;
  }

  const daten = sh.getDataRange().getValues();
  const kopf = daten[0].map(function(v) {
    return textNormalisieren_(v);
  });

  const idxNameAnzeige = findeSpaltenIndexNachText_(kopf, [
    "NameAnzeige"
  ]);

  if (idxNameAnzeige < 0) {
    throw new Error("Spalte NameAnzeige in 👥_MITGLIEDER nicht gefunden.");
  }

  const idxEmail = findeSpaltenIndexNachText_(kopf, [
    "E-Mail",
    "E-Mail-Adresse",
    "E Mail",
    "EMail",
    "Email",
    "Mail",
    "Mailadresse",
    "E_Mail",
    "Emailadresse",
    "E-Mailadresse",
    "E-Mail_Privat",
    "E-Mail Privat",
    "Mail_Privat",
    "Mail Privat",
    "Email_Privat",
    "Email Privat"
  ]);

  for (let i = 1; i < daten.length; i++) {
    const row = daten[i];
    const rowName = textNormalisieren_(row[idxNameAnzeige]);

    if (rowName !== name) continue;

    const email = idxEmail > -1 ? textNormalisieren_(row[idxEmail]) : "";

    return {
      nameAnzeige: rowName,
      email: email
    };
  }

  return null;
}


/**
 * FUNKTION:
 * Exportiert den vorhandenen Checklisten-Inhalt als PDF-Blob.
 */
function exportiereChecklisteAlsPdfBlob_(planung) {
  const dateiName = [
    "Checkliste",
    bereinigeDateiname_(planung.stoffbesitzer || "Stoffbesitzer"),
    bereinigeDateiname_(planung.vorgangsId || "Vorgang")
  ].join("_") + ".pdf";

  const html = baueChecklistenHtmlFuerMail_(planung);
  const htmlOutput = HtmlService.createHtmlOutput(html)
    .setWidth(1123)
    .setHeight(794);

  const pdfBlob = htmlOutput.getBlob().getAs(MimeType.PDF).setName(dateiName);

  if (!pdfBlob || !pdfBlob.getBytes || pdfBlob.getBytes().length === 0) {
    throw new Error("PDF-Export der Checkliste lieferte eine leere Datei.");
  }

  return pdfBlob;
}

function baueChecklistenHtmlFuerMail_(planung) {
  const safePlanung = planningSafe_(planung);

  return baueChecklistenHtmlVollstaendig_(
    {
      stoffbesitzer: safePlanung.stoffbesitzer || "",
      vorgangsId: safePlanung.vorgangsId || "",
      terminMaische: formatDatumDeutsch_(safePlanung.datumMaischeannahme || ""),
      brandtag: formatDatumDeutsch_(safePlanung.brandtag || "")
    },
    {
      druckButton: false
    }
  );
}
function planningSafe_(planung) {
  return planung || {};
}

function escapeHtmlCheckliste_(text) {
  return String(text == null ? "" : text).replace(/[&<>"']/g, function(m) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#039;"
    }[m];
  });
}


function exportiereBlattAlsPdfBlobMitWiederholung_(spreadsheetId, sheetId, dateiName) {
  let letzterFehler = null;

  for (let versuch = 1; versuch <= 3; versuch++) {
    try {
      const blob = exportiereBlattAlsPdfBlobEinmal_(spreadsheetId, sheetId, dateiName);
      if (blob && blob.getBytes && blob.getBytes().length > 0) {
        return blob;
      }
      letzterFehler = new Error("PDF-Export lieferte eine leere Datei.");
    } catch (e) {
      letzterFehler = e;
    }

    Utilities.sleep(versuch * 1800);
    SpreadsheetApp.flush();
  }

  throw letzterFehler || new Error("PDF-Export der Checkliste fehlgeschlagen.");
}

function exportiereBlattAlsPdfBlobEinmal_(spreadsheetId, sheetId, dateiName) {
  const exportUrl =
    "https://docs.google.com/spreadsheets/d/" + spreadsheetId + "/export" +
    "?format=pdf" +
    "&size=A4" +
    "&portrait=false" +
    "&fitw=true" +
    "&sheetnames=false" +
    "&printtitle=false" +
    "&pagenumbers=false" +
    "&gridlines=false" +
    "&fzr=false" +
    "&top_margin=0.35" +
    "&bottom_margin=0.35" +
    "&left_margin=0.35" +
    "&right_margin=0.35" +
    "&gid=" + sheetId;

  const response = UrlFetchApp.fetch(exportUrl, {
    headers: {
      Authorization: "Bearer " + ScriptApp.getOAuthToken()
    },
    muteHttpExceptions: true
  });

  const rc = response.getResponseCode();
  if (rc !== 200) {
    const body = response.getContentText ? response.getContentText().slice(0, 250) : "";
    throw new Error("PDF-Export der Checkliste fehlgeschlagen. HTTP-Code: " + rc + (body ? " | Antwort: " + body : ""));
  }

  return response.getBlob().setName(dateiName);
}

function exportiereChecklisteUeberTemporaereKopie_(rohformBlatt, dateiName) {
  let tempSpreadsheet = null;

  try {
    tempSpreadsheet = SpreadsheetApp.create("TMP_Checkliste_" + new Date().getTime());
    const kopie = rohformBlatt.copyTo(tempSpreadsheet).setName(rohformBlatt.getName());

    kopie.showSheet();
    tempSpreadsheet.setActiveSheet(kopie);

    // Das Standardblatt wird bewusst nicht gelöscht.
    // Der PDF-Export läuft gezielt über die gid des kopierten ROHFORM-Blattes.
    // Dadurch entsteht kein Fehler, wenn Google die kopierte Rohform zunächst als versteckt behandelt.
    // Die Kopie bleibt sichtbar und aktiv, damit Google nicht versucht, alle sichtbaren Tabellenblätter zu entfernen.
    SpreadsheetApp.flush();
    Utilities.sleep(1800);

    return exportiereBlattAlsPdfBlobMitWiederholung_(tempSpreadsheet.getId(), kopie.getSheetId(), dateiName);
  } finally {
    if (tempSpreadsheet) {
      try {
        DriveApp.getFileById(tempSpreadsheet.getId()).setTrashed(true);
      } catch (cleanupFehler) {
        systemLogSchreiben_(
          "WARN",
          "ChecklistenBenachrichtigung",
          "Temporäre PDF-Kopie konnte nicht gelöscht werden",
          "",
          cleanupFehler && cleanupFehler.message ? cleanupFehler.message : String(cleanupFehler)
        );
      }
    }
  }
}

/**
 * FUNKTION:
 * Baut den Betreff der Checklisten-Mail.
 */
function baueBetreffCheckliste_(planung) {
  return "Checkliste Maischeannahme - " + planung.stoffbesitzer + " - " + planung.vorgangsId;
}


/**
 * FUNKTION:
 * Baut den Mailtext für die Checklisten-Mail.
 */
function baueMailtextCheckliste_(planung) {
  const datumMaischeannahmeText = formatDatumDeutsch_(planung.datumMaischeannahme);
  const brandtagText = formatDatumDeutsch_(planung.brandtag);

  return [
    "Guten Tag,",
    "",
    "anbei erhalten Sie die Checkliste für die anstehende Maischeannahme.Bitte teilen Sie uns mit wie groß Ihre Fässer sind, die genaue Literzahl des Inhaltes und der Inhalt. Nutzen Sie gerne dafür das angehängte Formular oder einfach innerhalb der Email",
    "",
    "Stoffbesitzer: " + (planung.stoffbesitzer || ""),
    "Vorgangs_ID: " + (planung.vorgangsId || ""),
    "Datum_Maischeannahme: " + datumMaischeannahmeText,
    "Brandtag: " + brandtagText,
    "",
    "Bitte bringen Sie die erforderlichen Unterlagen und Angaben vollständig mit.",
    "",
    "Mit freundlichen Grüßen",
    KONFIGURATION.KONTAKT.NAME,
    KONFIGURATION.IDENTITAET.BETRIEB,
    "Telefon: " + KONFIGURATION.KONTAKT.TEL,
    "E-Mail: " + KONFIGURATION.KONTAKT.MAIL
  ].join("\n");
}


/**
 * FUNKTION:
 * Liefert den Index der ersten gefundenen Spalte in einer Kopfzeile.
 */
function findeSpaltenIndexNachText_(kopfzeile, kandidaten) {
  if (!kopfzeile || !kopfzeile.length) return -1;
  if (!kandidaten || !kandidaten.length) return -1;

  const normalisierteKandidaten = kandidaten.map(function(v) {
    return textNormalisieren_(v).toLowerCase();
  });

  for (let i = 0; i < kopfzeile.length; i++) {
    const wert = textNormalisieren_(kopfzeile[i]).toLowerCase();
    if (normalisierteKandidaten.indexOf(wert) > -1) {
      return i;
    }
  }

  return -1;
}


/**
 * FUNKTION:
 * Formatiert Date/Datum sauber als dd.MM.yyyy.
 */
function formatDatumDeutsch_(wert) {
  if (!wert) return "";

  let datum = wert;
  if (Object.prototype.toString.call(wert) !== "[object Date]") {
    datum = new Date(wert);
  }

  if (isNaN(datum)) return "";

  return Utilities.formatDate(
    datum,
    Session.getScriptTimeZone() || "Europe/Berlin",
    "dd.MM.yyyy"
  );
}


/**
 * FUNKTION:
 * Bereinigt Dateinamen für PDF-Anhang.
 */
function bereinigeDateiname_(text) {
  return String(text || "")
    .replace(/[\\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}
