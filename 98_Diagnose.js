/**
 * DATEI: 98_DIAGNOSE.GS
 * STATUS: REVISION V23.0 - FORCED SYNC DIAGNOSE
 */

function systemIntegritaetPruefen() {
  // FUNKTION: Erzwingt, dass Google alle manuellen Header-Änderungen sofort speichert
  SpreadsheetApp.flush(); 

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cfg = KONFIGURATION;
  
  const report = {
    zeitpunkt: Utilities.formatDate(new Date(), cfg.ZOLL_PARAMETER.ZEIT_PARAMETER.ZEITZONE, "dd.MM.yyyy HH:mm:ss"),
    tabellen: []
  };

  const alleKeys = Object.keys(cfg.TABELLEN);

  alleKeys.forEach(function(tKey) {
    const sName = cfg.TABELLEN[tKey];
    const sh = ss.getSheetByName(sName);
    
    const tStatus = {
      key: tKey,
      name: sName,
      existiert: !!sh,
      zeilen: sh ? sh.getLastRow() : 0,
      spalten: sh ? sh.getLastColumn() : 0,
      audit: []
    };

    if (sh && tStatus.spalten > 0) {
      const istHeaders = sh.getRange(1, 1, 1, tStatus.spalten).getValues()[0];
      const validations = sh.getRange(2, 1, 1, tStatus.spalten).getDataValidations()[0];

      istHeaders.forEach(function(hName, index) {
        const hClean = String(hName).trim();
        let gefundenerKey = "---";

        // Vergleich mit den Config-Vorgaben
        for (let configKey in cfg.SPALTEN) {
          if (cfg.SPALTEN[configKey] === hClean) {
            gefundenerKey = configKey;
            break;
          }
        }

        tStatus.audit.push({
          pos: index + 1,
          header: hClean || "(Leerzeile)",
          key: gefundenerKey,
          dropdown: !!(validations && validations[index])
        });
      });
    }
    report.tabellen.push(tStatus);
  });

  return report;
}