/**
 * DATEI: 00_Locksystem.gs
 * ZWECK: SPERRLOGIK FÜR SICHERE SCHREIBVORGÄNGE
 * EINSATZ:
 * - WebApp-Speichern
 * - Blockweises Ersetzen von Vorgängen
 * - Admin-Selbsttests
 * - alle schreibenden Operationen mit Risiko auf Doppelaufruf
 */


/**
 * FUNKTION: Führt eine Funktion unter ScriptLock aus.
 * LOGIK:
 * - wartet bis max. timeoutMs auf die Sperre
 * - schreibt Start/Fehler/Ende ins Log
 * - gibt das Ergebnis der Callback-Funktion zurück
 */
function mitSperreAusfuehren_(callback, kontext, timeoutMs) {
  const lock = LockService.getScriptLock();
  const ctx = textNormalisieren_(kontext) || "Unbekannt";
  const wartezeit = Number(timeoutMs) > 0 ? Number(timeoutMs) : 30000;

  try {
    lock.waitLock(wartezeit);

    systemLogSchreiben_(
      "INFO",
      "Locksystem",
      "Sperre erhalten",
      "",
      "Kontext: " + ctx
    );

    const ergebnis = callback();

    systemLogSchreiben_(
      "INFO",
      "Locksystem",
      "Sperre erfolgreich verarbeitet",
      "",
      "Kontext: " + ctx
    );

    return ergebnis;
  } catch (err) {
    systemLogSchreiben_(
      "ERROR",
      "Locksystem",
      "Sperre/Verarbeitung fehlgeschlagen",
      "",
      "Kontext: " + ctx + " | Fehler: " + (err && err.message ? err.message : String(err))
    );
    throw err;
  } finally {
    try {
      lock.releaseLock();
    } catch (e) {
    }
  }
}


/**
 * FUNKTION: Führt eine Funktion unter DocumentLock aus.
 * EINSATZ: Wenn nur das aktuelle Spreadsheet geschützt werden soll.
 */
function mitDokumentSperreAusfuehren_(callback, kontext, timeoutMs) {
  const lock = LockService.getDocumentLock();
  const ctx = textNormalisieren_(kontext) || "Unbekannt";
  const wartezeit = Number(timeoutMs) > 0 ? Number(timeoutMs) : 30000;

  try {
    lock.waitLock(wartezeit);

    systemLogSchreiben_(
      "INFO",
      "Locksystem",
      "Dokumentsperre erhalten",
      "",
      "Kontext: " + ctx
    );

    const ergebnis = callback();

    systemLogSchreiben_(
      "INFO",
      "Locksystem",
      "Dokumentsperre erfolgreich verarbeitet",
      "",
      "Kontext: " + ctx
    );

    return ergebnis;
  } catch (err) {
    systemLogSchreiben_(
      "ERROR",
      "Locksystem",
      "Dokumentsperre/Verarbeitung fehlgeschlagen",
      "",
      "Kontext: " + ctx + " | Fehler: " + (err && err.message ? err.message : String(err))
    );
    throw err;
  } finally {
    try {
      lock.releaseLock();
    } catch (e) {
    }
  }
}


/**
 * FUNKTION: Liefert true, wenn aktuell eine Script-Sperre erhältlich ist.
 * HINWEIS: Nur Diagnose, nicht für Geschäftslogik.
 */
function scriptSperreVerfuegbar_() {
  const lock = LockService.getScriptLock();

  try {
    const ok = lock.tryLock(1);
    if (ok) {
      lock.releaseLock();
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}


/**
 * FUNKTION: Öffentlicher Kurztest für die Sperrlogik.
 */
function locksystemSelbsttest() {
  return mitSperreAusfuehren_(function() {
    Utilities.sleep(250);
    return {
      ok: true,
      zeit: Utilities.formatDate(new Date(), holeZeitzone_(), "dd.MM.yyyy HH:mm:ss"),
      scriptSperreVerfuegbar: scriptSperreVerfuegbar_()
    };
  }, "locksystemSelbsttest", 5000);
}