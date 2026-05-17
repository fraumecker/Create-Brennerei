/**
 * DATEI: 14_BEREINIGUNGSERVICE.GS
 * STATUS: REVISION V26.5 - VORGANGS-ID GLOBAL LÖSCHEN + DRIVE-DOSSIER IN PAPIERKORB
 */

function markierteZeilenInPapierkorbSichernUndLoeschen() {
  systemAlert_(
    "HINWEIS",
    "Die alte zeilenweise Löschung ist deaktiviert. Bitte wähle eine Zeile mit Vorgangs-ID aus. Es wird jetzt die globale Vorgangslöschung für alle fachlichen Blätter und den Drive-Papierkorb verwendet."
  );
  aktivenVorgangLoeschen();
}

// --- Menü-Aufruf "Zeilen löschen" ---
function markierteZeilenLoeschenDirekt() {
  systemAlert_(
    "HINWEIS",
    "Die direkte Zeilenlöschung ist deaktiviert, damit keine Teillöschungen entstehen. Bitte wähle eine Zeile mit Vorgangs-ID aus. Es wird jetzt die globale Vorgangslöschung für alle fachlichen Blätter und den Drive-Papierkorb verwendet."
  );
  aktivenVorgangLoeschen();
}

// --- Menü-Aufruf "Vorgang löschen" ---
function aktivenVorgangLoeschen() {
  const blatt = SpreadsheetApp.getActiveSheet();
  const row = blatt.getActiveCell().getRow();
  
  if (row <= 1) {
    systemAlert_("HINWEIS", "Bitte wähle eine Zeile mit einer Vorgangs-ID aus.");
    return;
  }
  
  const sMap = spaltenZuordnungHolen_(blatt);
  if (!sMap.VORGANGS_ID) {
    systemAlert_("HINWEIS", "Das aktive Blatt enthält keine Vorgangs-ID-Spalte.");
    return;
  }
  
  const vId = textNormalisieren_(blatt.getRange(row, sMap.VORGANGS_ID).getValue());
  if (!vId) {
    systemAlert_("HINWEIS", "Keine Vorgangs-ID in der aktiven Zeile gefunden.");
    return;
  }

  const ui = SpreadsheetApp.getUi();
  const res = ui.alert(
    "Vorgang löschen",
    "Soll der komplette Vorgang " + vId + " aus allen fachlichen Blättern gelöscht, vorher in den Tabellen-Papierkorb gesichert und der Drive-Vorgangsordner in den Drive-Papierkorb verschoben werden?",
    ui.ButtonSet.YES_NO
  );
  if (res !== ui.Button.YES) return;

  mitSperreAusfuehren_(function() {
    const ergebnis = vorgangGlobalInPapierkorbVerschiebenUndLoeschen_(vId);

    systemLogSchreiben_(
      "WARN",
      "Bereinigung",
      "Vorgang global gelöscht",
      vId,
      "Tabellenzeilen: " + ergebnis.geloeschteZeilen +
        " | Blätter: " + ergebnis.betroffeneBlaetter.join(", ") +
        " | Drive-Ordner in Papierkorb: " + ergebnis.driveOrdnerInPapierkorb +
        (ergebnis.driveHinweis ? " | Drive-Hinweis: " + ergebnis.driveHinweis : "")
    );

    ui.alert(
      "Erfolg",
      "Vorgang " + vId + " wurde aus den fachlichen Blättern gelöscht.\n" +
        "Gesicherte/gelöschte Tabellenzeilen: " + ergebnis.geloeschteZeilen + "\n" +
        "Betroffene Blätter: " + (ergebnis.betroffeneBlaetter.length ? ergebnis.betroffeneBlaetter.join(", ") : "keine") + "\n" +
        "Drive-Ordner in Papierkorb: " + ergebnis.driveOrdnerInPapierkorb +
        (ergebnis.driveHinweis ? "\nHinweis Drive: " + ergebnis.driveHinweis : ""),
      ui.ButtonSet.OK
    );
  }, "VorgangGlobalLoeschen");
}

/**
 * FUNKTION: Löscht eine Vorgangs-ID aus allen fachlichen Tabellenblättern.
 * LOGIK:
 * - sichert jede gefundene Fachzeile zuerst im Tabellenblatt PAPIERKORB
 * - löscht danach rückwärts aus dem Quellblatt
 * - verschiebt vorhandene Drive-Vorgangsordner in den Drive-Papierkorb
 * - SYSTEM_LOG bleibt als Audit-Trail bewusst bestehen
 */
function vorgangGlobalInPapierkorbVerschiebenUndLoeschen_(vorgangsId) {
  const vId = textNormalisieren_(vorgangsId);
  if (!vId) throw new Error("Vorgangs-ID fehlt.");

  const papierkorb = tabelleHolen_("PAPIERKORB");
  if (!papierkorb) {
    throw new Error("Papierkorb-Blatt (🗑️_PAPIERKORB) wurde nicht gefunden.");
  }

  const tabKeys = vorgangLoeschbareTabellenKeys_();
  const stoffbesitzerListe = [];
  const dossierLinks = [];
  const betroffeneBlaetter = [];
  let geloeschteZeilen = 0;

  tabKeys.forEach(function(tabKey) {
    const sh = tabelleHolen_(tabKey);
    if (!sh) return;

    const sMap = spaltenZuordnungHolen_(sh);
    if (!sMap.VORGANGS_ID) return;

    const zeilen = alleZeilenMitVorgangsIdHolen_(sh, vId).sort(function(a, b) { return b - a; });
    if (!zeilen.length) return;

    betroffeneBlaetter.push(sh.getName());

    zeilen.forEach(function(zeileNr) {
      if (sMap.STOFFBESITZER) {
        const stoff = textNormalisieren_(sh.getRange(zeileNr, sMap.STOFFBESITZER).getDisplayValue());
        if (stoff) stoffbesitzerListe.push(stoff);
      }

      if (sMap.DOSSIER_LINK) {
        const link = textNormalisieren_(sh.getRange(zeileNr, sMap.DOSSIER_LINK).getDisplayValue());
        if (link) dossierLinks.push(link);
      }

      zeileInPapierkorbSichern_(sh, zeileNr, papierkorb);
      sh.deleteRow(zeileNr);
      geloeschteZeilen++;
    });
  });

  const driveErgebnis = typeof dossierOrdnerFuerVorgangInPapierkorbVerschieben_ === "function"
    ? dossierOrdnerFuerVorgangInPapierkorbVerschieben_(vId, stoffbesitzerListe, dossierLinks)
    : { verschoben: 0, hinweis: "DriveService-Funktion dossierOrdnerFuerVorgangInPapierkorbVerschieben_ fehlt." };

  return {
    vorgangsId: vId,
    geloeschteZeilen: geloeschteZeilen,
    betroffeneBlaetter: betroffeneBlaetter,
    driveOrdnerInPapierkorb: driveErgebnis.verschoben || 0,
    driveHinweis: driveErgebnis.hinweis || ""
  };
}

/**
 * FUNKTION: Liefert alle fachlichen Tabellen, aus denen eine Vorgangs-ID vollständig entfernt werden soll.
 * SYSTEM_LOG wird bewusst nicht gelöscht, weil es der Audit-Trail ist.
 * PAPIERKORB wird nicht als Quelle gelöscht, weil er die Sicherung aufnimmt.
 */
function vorgangLoeschbareTabellenKeys_() {
  return [
    "VORPLANUNG",
    "BRANDTAGE_PLANUNG",
    "MAISCHEANNAHME",
    "BRENNFREIGABE",
    "BRANDTAG_UEBERSICHT",
    "JAHRESARCHIV",
    "ZENTRALREGISTER"
  ];
}

/**
 * FUNKTION: Sichert eine Quellzeile anhand gleicher Header in den Tabellen-Papierkorb.
 * Fehlende Zielspalten bleiben leer. Zusätzliche Quellspalten werden nicht in Fremdspalten gezwungen.
 */
function zeileInPapierkorbSichern_(quellBlatt, zeileNr, papierkorb) {
  if (!quellBlatt || !papierkorb || zeileNr <= 1) return;

  const sourceHeader = quellBlatt.getRange(1, 1, 1, quellBlatt.getLastColumn()).getValues()[0].map(textNormalisieren_);
  const sourceData = quellBlatt.getRange(zeileNr, 1, 1, quellBlatt.getLastColumn()).getValues()[0];
  const targetHeader = papierkorb.getRange(1, 1, 1, papierkorb.getLastColumn()).getValues()[0];

  const spezialMapping = {
    "Reg.Nr.": "Registernummer"
  };

  const rowToTrash = targetHeader.map(function(h) {
    const zielHeader = textNormalisieren_(h);
    let idx = sourceHeader.indexOf(zielHeader);

    if (idx === -1 && spezialMapping[zielHeader]) {
      idx = sourceHeader.indexOf(textNormalisieren_(spezialMapping[zielHeader]));
    }

    return idx > -1 ? sourceData[idx] : "";
  });

  papierkorb.appendRow(rowToTrash);
}

// --- HILFSFUNKTION FÜR MARKIERUNGEN ---
function markierteZeilenHolen_(blatt) {
  const set = new Set();
  const ranges = blatt.getActiveRangeList().getRanges();
  ranges.forEach(r => {
    const start = r.getRow();
    const count = r.getNumRows();
    for (let i = 0; i < count; i++) set.add(start + i);
  });
  return Array.from(set);
}
