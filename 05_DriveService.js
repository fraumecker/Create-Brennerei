/**
 * DATEI: 05_DRIVESERVICE.GS
 * DYNAMISCHE ORDNERVERWALTUNG MIT NACHTRÄGLICHER REG-NR AKTUALISIERUNG
 */

// FUNKTION: Verwaltet den Vorgangsordner (Erstellen/Umbenennen) | EINGRIFF: Google Drive
// CHECK: Existenz eines Ordners mit der vId als Anker | FOLGE: Konsistente Dossier-Verlinkung
function dossierOrdnerVerwalten_(vId, stoffbesitzer, regNr, brandDatum) {
  // FUNKTION: Holt den Hauptordner des Stoffbesitzers | EINGRIFF: Drive-Root
  const personOrdner = getStoffbesitzerHauptOrdner_(stoffbesitzer);
  // FUNKTION: Liest die konfigurierte Zeitzone | EINGRIFF: 01_CONFIG
  const zeitzone = KONFIGURATION.ZOLL_PARAMETER.ZEIT_PARAMETER.ZEITZONE || "Europe/Berlin";
  // FUNKTION: Formatiert das Branddatum für den Ordnernamen | EINGRIFF: Namenslogik
  const datumStr = brandDatum ? Utilities.formatDate(new Date(brandDatum), zeitzone, "yyyy-MM-dd") : "0000-00-00";
  
  // FUNKTION: Identifiziert den bevorzugten Bezeichner für den Ordnernamen | EINGRIFF: Namenslogik
  // CHECK: Ist eine belastbare Register-Nummer vorhanden? | FOLGE: Vorrang vor interner Vorgangs-ID
  const zollId = (regNr && String(regNr).length > 2 && String(regNr).toLowerCase().indexOf("ausstehend") === -1) ? String(regNr) : String(vId || "");
  // FUNKTION: Baut den Zielnamen des Vorgangsordners | EINGRIFF: Namenslogik
  const zielName = datumStr + "_" + zollId + "_" + String(stoffbesitzer || "");

  // FUNKTION: Durchsucht vorhandene Unterordner des Stoffbesitzers | EINGRIFF: Drive-Iterator
  const ordnerIter = personOrdner.getFolders();
  // FUNKTION: Initialisiert die Zielreferenz | EINGRIFF: Datenstruktur
  let caseOrdner = null;

  // FUNKTION: Iteriert über vorhandene Vorgangsordner | EINGRIFF: Drive-Loop
  while (ordnerIter.hasNext()) {
    // FUNKTION: Referenziert den aktuellen Unterordner | EINGRIFF: Drive
    const current = ordnerIter.next();
    // CHECK: Enthält der Ordnername die interne Vorgangs-ID als Anker? | FOLGE: Wiederverwendung des bestehenden Ordners
    if (String(current.getName() || "").indexOf(String(vId || "")) !== -1) {
      caseOrdner = current;
      break;
    }
  }

  // CHECK: Wurde noch kein Ordner gefunden? | FOLGE: Erstmalige Anlage
  if (!caseOrdner) {
    // FUNKTION: Erstellt den Vorgangsordner erstmalig | EINGRIFF: Drive-Filesystem
    caseOrdner = personOrdner.createFolder(zielName);
    // FUNKTION: Protokolliert die Ordneranlage | EINGRIFF: SYSTEM_LOG
    systemLogSchreiben_("INFO", "DriveService", "Dossier-Ordner erstellt", vId, zielName);
  } else if (caseOrdner.getName() !== zielName) {
    // CHECK: Weicht der bestehende Name vom Sollnamen ab? | FOLGE: Umbenennung des vorhandenen Ordners
    caseOrdner.setName(zielName);
    // FUNKTION: Protokolliert die Ordnerumbenennung | EINGRIFF: SYSTEM_LOG
    systemLogSchreiben_("INFO", "DriveService", "Dossier-Ordner aktualisiert", vId, zielName);
  }

  // FUNKTION: Liefert die Ordnerreferenz zurück | EINGRIFF: API-Rückgabe
  return caseOrdner;
}

// FUNKTION: Holt oder erstellt den Hauptordner des Stoffbesitzers | EINGRIFF: Drive-Root
function getStoffbesitzerHauptOrdner_(stoffbesitzer) {
  // FUNKTION: Liest die Wurzelordner-ID aus der Konfiguration | EINGRIFF: 01_CONFIG
  const rootId = KONFIGURATION.DRIVE_ORDNER && KONFIGURATION.DRIVE_ORDNER.WURZEL_ORDNER_ID ? KONFIGURATION.DRIVE_ORDNER.WURZEL_ORDNER_ID : "";
  // CHECK: Ist eine Root-ID konfiguriert? | FOLGE: Abbruch bei fehlender Drive-Basis
  if (!rootId) {
    throw new Error("Drive-Wurzelordner fehlt in der Konfiguration.");
  }

  // FUNKTION: Referenziert den konfigurierten Wurzelordner | EINGRIFF: Drive
  const root = DriveApp.getFolderById(rootId);
  // FUNKTION: Sucht vorhandene Ordner mit dem Stoffbesitzer-Namen | EINGRIFF: Drive
  const iter = root.getFoldersByName(String(stoffbesitzer || ""));

  // CHECK: Existiert bereits ein Hauptordner für den Stoffbesitzer? | FOLGE: Rückgabe des Bestandsordners
  if (iter.hasNext()) {
    return iter.next();
  }

  // FUNKTION: Erstellt den Hauptordner des Stoffbesitzers neu | EINGRIFF: Drive-Filesystem
  return root.createFolder(String(stoffbesitzer || ""));
}

// FUNKTION: API-Endpunkt zum Sync der Dossier-Links | EINGRIFF: Tabelle
// CHECK: Vorhandensein von vId und Stoffbesitzer | FOLGE: Update der Link-Spalte
function dossierLinkAktualisieren_(blatt, zeile, sMap) {
  // CHECK: Sind Blatt, Zeile und Mapping verwertbar? | FOLGE: Abbruch bei Fehlstruktur
  if (!blatt || !sMap || zeile <= 1) return;

  // FUNKTION: Liest die Vorgangs-ID der Zielzeile | EINGRIFF: Physikalische Tabelle
  const vId = sMap.VORGANGS_ID ? blatt.getRange(zeile, sMap.VORGANGS_ID).getValue() : "";
  // FUNKTION: Liest den Stoffbesitzer der Zielzeile | EINGRIFF: Physikalische Tabelle
  const stoff = sMap.STOFFBESITZER ? blatt.getRange(zeile, sMap.STOFFBESITZER).getValue() : "";
  // FUNKTION: Liest die Register-Nummer der Zielzeile primär über Standard-Key | EINGRIFF: Physikalische Tabelle
  const regNr = sMap.REGISTER_NR ? blatt.getRange(zeile, sMap.REGISTER_NR).getValue() : (sMap.REGISTERNUMMER ? blatt.getRange(zeile, sMap.REGISTERNUMMER).getValue() : "");
  // FUNKTION: Liest das Datumsfeld der Zielzeile für die Ordnerbenennung | EINGRIFF: Physikalische Tabelle
  const datum = sMap.TAG_BRAND ? blatt.getRange(zeile, sMap.TAG_BRAND).getValue() : (sMap.TERMIN_MAISCHE ? blatt.getRange(zeile, sMap.TERMIN_MAISCHE).getValue() : null);

  // CHECK: Liegen Vorgangs-ID und Stoffbesitzer vor? | FOLGE: Erstellung oder Aktualisierung des Dossiers
  if (vId && stoff) {
    // FUNKTION: Holt oder erstellt den Dossier-Ordner | EINGRIFF: DriveService
    const ordner = dossierOrdnerVerwalten_(vId, stoff, regNr, datum);
    // CHECK: Existiert eine Dossier-Link-Spalte? | FOLGE: Schreiben der Drive-URL
    if (sMap.DOSSIER_LINK) {
      blatt.getRange(zeile, sMap.DOSSIER_LINK).setValue(ordner.getUrl());
    }
  }
}