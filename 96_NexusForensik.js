/**
 * DATEI: 96_NEXUSFORENSIK.GS
 * STATUS: MASTER-DIAGNOSE (FINALE VERSION 1.1)
 */

function TEST_1_Konfiguration()      { fuehreTestAus_("BASIS-STRUKTUR", test_Basis); }
function TEST_2_IDService()          { fuehreTestAus_("ID-SERVICE", test_ID_Service); }
function TEST_3_DriveService()       { fuehreTestAus_("DRIVE-ANBINDUNG", test_Drive_Service); }
function TEST_4_MaskenService_DEEP() { fuehreTestAus_("MASKE-TIEFENCHECK", test_Maske_Deep); }
function TEST_5_Workflow()           { fuehreTestAus_("WORKFLOW-LOGIK", test_Workflow_Logik); }
function TEST_6_Transfer()           { fuehreTestAus_("TRANSFER-BRÜCKE", test_Transfer_Logik); }
function TEST_7_Archivierung()       { fuehreTestAus_("ARCHIV-LOGIK", test_Archiv_Logik); }

function STARTE_VOLLANALYSE() {
  console.log("🚀 STARTE SYSTEM-VOLLANALYSE...");
  test_Basis();
  test_ID_Service();
  test_Drive_Service();
  test_Maske_Deep();
  test_Workflow_Logik();
  test_Transfer_Logik();
  test_Archiv_Logik();
  console.log("🏁 ALLE SYSTEME BEREIT. KEINE FEHLER GEFUNDEN.");
}

// --- LOGIKEN ---

function test_Basis() {
  if (typeof KONFIGURATION === 'undefined') throw new Error("01_Config fehlt!");["VORPLANUNG", "MAISCHEANNAHME", "ZENTRALREGISTER", "SYSTEM_LOG"].forEach(t => {
    if (!tabelleHolen_(t)) throw new Error("Tabelle " + t + " nicht gefunden!");
  });
}

function test_ID_Service() {
  const id = vorgangsIdSicherstellen_("FORENSIK_USER");
  if (!id || id.indexOf("V-") !== 0) throw new Error("ID-Format falsch!");
}

function test_Drive_Service() {
  const rootId = KONFIGURATION.DRIVE_ORDNER.WURZEL_ORDNER_ID;
  if (!DriveApp.getFolderById(rootId)) throw new Error("Drive-Zugriff fehlgeschlagen!");
}

function test_Maske_Deep() {
  const payload = {
    stoff: "TEST_USER",
    anrufDatum: "2026-04-05",
    faesser: [{ inhalt: 10, material: "Apfel", fassgroesse: 120 }]
  };
  const res = vorplanungMaskeSpeichern(payload);
  if (!res || !res.ok) throw new Error("Speichern fehlgeschlagen!");
}

function test_Workflow_Logik() {
  const res = automatischerZeitCheck_("2026-01-01", "08:00", 1);
  if (!res.bis) throw new Error("Zeitberechnung leer!");
}

function test_Transfer_Logik() {
  const shVP = tabelleHolen_("VORPLANUNG");
  const shMA = tabelleHolen_("MAISCHEANNAHME");
  const sVP = spaltenZuordnungHolen_(shVP);
  const sMA = spaltenZuordnungHolen_(shMA);
  if (!sVP.VORGANGS_ID || !sMA.VORGANGS_ID) throw new Error("Mapping fehlerhaft!");
}

function test_Archiv_Logik() {
  const shArchiv = tabelleHolen_("JAHRESARCHIV");
  if (!shArchiv) throw new Error("Archiv-Blatt nicht gefunden!");
  
  // WICHTIG: Wir prüfen jetzt auf die NEUE Funktion aus Datei 16
  if (typeof vorgangInArchivVerschieben !== 'function') {
    throw new Error("CODE-LÜCKE: Die Funktion 'vorgangInArchivVerschieben' aus Datei 16 wurde nicht gefunden!");
  }
}

function fuehreTestAus_(label, testFunktion) {
  try {
    testFunktion();
    console.log("✅ [" + label + "] OK.");
  } catch (e) {
    const stack = e.stack || "";
    const zeilen = stack.split("\n");
    const match = (zeilen[2] || zeilen[1] || "").match(/at (.*?) \((.*):(\d+)\)/) || (zeilen[1] || "").match(/at (.*):(\d+)/);
    console.error("❌ [" + label + "] FEHLER: " + e.message + (match ? " (Datei: " + match[2] + " | Zeile: " + match[3] + ")" : ""));
  }
}