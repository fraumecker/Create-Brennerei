/**
 * DATEI: 99_SENTINELSERVICE.GS
 * ZWECK: SYSTEM-ÜBERWACHUNG & INTEGRITÄTS-RADAR
 * STATUS: INITIAL RELEASE V1.0
 */

function systemIntegritaetSentinelLauf() {
  const status = { ok: true, fehler: [] };
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. CHECK: Existenzprüfung aller konfigurierten Blätter | EINGRIFF: Integrität
  const tabs = Object.keys(KONFIGURATION.TABELLEN);
  tabs.forEach(key => {
    const name = KONFIGURATION.TABELLEN[key];
    if (!ss.getSheetByName(name)) {
      status.ok = false;
      status.fehler.push("BLATT FEHLT: " + name + " (Key: " + key + ")");
    }
  });

  // 2. CHECK: Spalten-Mapping Validierung | EINGRIFF: Datenlogik
  const shVP = ss.getSheetByName(KONFIGURATION.TABELLEN.VORPLANUNG);
  if (shVP) {
    const currentHeaders = shVP.getRange(1, 1, 1, Math.max(1, shVP.getLastColumn())).getValues()[0].map(textNormalisieren_);
    const pflichtFelder = ["VORGANGS_ID", "STOFFBESITZER", "TAG_BRAND", "VON", "INH_VP", "ANZAHL_BRAENDE"];
    
    pflichtFelder.forEach(pKey => {
      const sollName = KONFIGURATION.SPALTEN[pKey];
      if (currentHeaders.indexOf(textNormalisieren_(sollName)) === -1) {
        status.ok = false;
        status.fehler.push("SPALTE FEHLT IN VORPLANUNG: " + sollName);
      }
    });
  }

  // 3. CHECK: API-Referenzprüfung Maischeannahme | EINGRIFF: Cockpit-Stabilität
  const shMA = ss.getSheetByName(KONFIGURATION.TABELLEN.MAISCHEANNAHME);
  if (shMA) {
    const maHeaders = shMA.getRange(1, 1, 1, Math.max(1, shMA.getLastColumn())).getValues()[0].map(textNormalisieren_);
    const cockpitFelder = ["ALKOHOL", "AUSBEUTE", "VORGANGS_ID"];
    cockpitFelder.forEach(cKey => {
      const sollName = KONFIGURATION.SPALTEN[cKey];
      if (maHeaders.indexOf(textNormalisieren_(sollName)) === -1) {
        status.ok = false;
        status.fehler.push("COCKPIT-SPALTE FEHLT IN ANNAHME: " + sollName);
      }
    });
  }

  // 4. PROTOKOLLIERUNG & ALARM | EINGRIFF: SYSTEM_LOG
  if (!status.ok) {
    systemLogSchreiben_("CRITICAL", "Sentinel", "Integritäts-Fehler erkannt", "", status.fehler.join(" | "));
    // Nur Toast statt Alert, um den User beim Öffnen nicht zu blockieren, aber zu warnen
    ss.toast("⚠️ SYSTEM-INTEGRITÄT GEFÄHRDET! Details im System_LOG.", "Sentinel Warnung", 10);
  } else {
    systemLogSchreiben_("INFO", "Sentinel", "Integrität bestätigt", "", "Alle Systeme bereit.");
  }

  return status;
}

/**
 * Manueller Startpunkt für den Sentinel-Check
 */
function menue_SentinelCheck() {
  const result = systemIntegritaetSentinelLauf();
  if (result.ok) {
    systemAlert_("SENTINEL STATUS: OK", "Alle Tabellennamen und Kern-Spalten sind korrekt konfiguriert.");
  } else {
    systemAlert_("SENTINEL STATUS: FEHLER", "Folgende Probleme wurden gefunden:\n\n" + result.fehler.join("\n"));
  }
}