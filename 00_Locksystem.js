/**
 * 00_Locksystem.gs
 * Sperrlogik
 */

function mitSperreAusfuehren_(callback, name) {
  let sperre = null;

  try {
    sperre = LockService.getDocumentLock();
  } catch (_) {
    sperre = null;
  }

  if (!sperre) {
    sperre = LockService.getScriptLock();
  }

  sperre.waitLock(30000);

  try {
    return callback();
  } catch (fehler) {
    try {
      systemLogSchreiben_("ERROR", "Locksystem", name || "", "", String(fehler));
    } catch (_) {
    }
    throw fehler;
  } finally {
    try {
      sperre.releaseLock();
    } catch (_) {
    }
  }
}