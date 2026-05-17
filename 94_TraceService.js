/**
 * DATEI: 94_TRACESERVICE.GS
 * ZWECK: Die "Blackbox" des Systems. Schreibt jeden Schritt in das Blatt DEBUG_TRACE.
 */

function nexusTrace(schritt, status, nachricht, daten) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh = ss.getSheetByName("DEBUG_TRACE");
    
    // Falls das Blatt gelöscht wurde, neu erstellen
    if (!sh) {
      sh = ss.insertSheet("DEBUG_TRACE");
      sh.appendRow(["Zeitstempel", "Schritt", "Status", "Nachricht", "Daten-Dump"]);
    }
    
    const dump = daten ? JSON.stringify(daten, null, 2) : "keine Daten";
    const zeit = Utilities.formatDate(new Date(), "Europe/Berlin", "HH:mm:ss.SSS");
    
    sh.appendRow([zeit, schritt, status, nachricht, dump]);
    
    // Auch in den Google-internen Logger schreiben
    Logger.log("[" + schritt + "] " + status + ": " + nachricht);
  } catch (e) {
    // Falls selbst das Loggen fehlschlägt, können wir nichts mehr tun
  }
}

/**
 * Hilfsfunktion um das Log zu leeren
 */
function logLeeren() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("DEBUG_TRACE");
  if (sh && sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 5).clearContent();
  }
}