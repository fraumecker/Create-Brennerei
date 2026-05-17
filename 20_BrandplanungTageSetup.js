function erstelleTabellenblattBrandtagePlanung() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const blattName = "🗓️_BRANDTAGE_PLANUNG";

  const kopfzeile = [
    "Planung_ID",
    "Vorgangs_ID",
    "Stoffbesitzer",
    "Bemerkung_Vorplanung",
    "Status",
    "Datum_Maischeannahme",
    "Brandtag",
    "Brenner",
    "Zeitslot_von",
    "Zeitslot_bis",
    "Bemerkung_Intern",
    "Erstellt_am",
    "Geändert_am"
  ];

  let sh = ss.getSheetByName(blattName);

  if (!sh) {
    sh = ss.insertSheet(blattName);
  } else {
    sh.clearContents();
    sh.clearFormats();
    sh.clearDataValidations();
  }

  sh.getRange(1, 1, 1, kopfzeile.length).setValues([kopfzeile]);
  sh.setFrozenRows(1);

  sh.getRange(1, 1, 1, kopfzeile.length)
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle")
    .setWrap(true);

  sh.getRange(2, 1, Math.max(sh.getMaxRows() - 1, 1), kopfzeile.length)
    .setVerticalAlignment("middle");

  sh.setColumnWidth(1, 140);
  sh.setColumnWidth(2, 140);
  sh.setColumnWidth(3, 220);
  sh.setColumnWidth(4, 420);
  sh.setColumnWidth(5, 180);
  sh.setColumnWidth(6, 160);
  sh.setColumnWidth(7, 160);
  sh.setColumnWidth(8, 180);
  sh.setColumnWidth(9, 140);
  sh.setColumnWidth(10, 140);
  sh.setColumnWidth(11, 320);
  sh.setColumnWidth(12, 170);
  sh.setColumnWidth(13, 170);

  sh.getRange("D:D").setWrap(true);
  sh.getRange("K:K").setWrap(true);

  sh.getRange("F:G").setNumberFormat("dd.MM.yyyy");
  sh.getRange("I:J").setNumberFormat("HH:mm");
  sh.getRange("L:M").setNumberFormat("dd.MM.yyyy HH:mm");

  const statusRegel = SpreadsheetApp.newDataValidation()
    .requireValueInList(
      ["IN ORGA", "TERMINIERT", "IN MAISCHEANNAHME ÜBERGEBEN"],
      true
    )
    .setAllowInvalid(false)
    .build();

  sh.getRange("E2:E").setDataValidation(statusRegel);

  SpreadsheetApp.flush();
}