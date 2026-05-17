/**
 * DATEI: 95_MASKEN_MONITOR.GS
 */
function maskenMonitorAktivenVorgangPruefen() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getActiveSheet();

  if (!sh || sh.getLastColumn() < 1) {
    systemAlert_("DIAGNOSE", "Bitte wechsle auf das Blatt VORPLANUNG.");
    return;
  }

  const sMap = spaltenZuordnungHolen_(sh);
  if (!sMap.VORGANGS_ID) {
    systemAlert_("DIAGNOSE", "Keine Vorgangs_ID Spalte in diesem Blatt gefunden.");
    return;
  }

  const activeRow = sh.getActiveCell().getRow();
  if (activeRow < 2) {
    systemAlert_("DIAGNOSE", "Bitte klicke in eine Zeile mit Daten.");
    return;
  }

  const vId = textNormalisieren_(sh.getRange(activeRow, sMap.VORGANGS_ID).getValue());
  if (!vId) {
    systemAlert_("DIAGNOSE", "Zeile " + activeRow + " hat keine ID.");
    return;
  }

  systemAlert_("DIAGNOSE ✅", "Vorgang " + vId + " wurde erkannt.");
}