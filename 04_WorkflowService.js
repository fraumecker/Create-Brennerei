/**
 * DATEI: 04_WORKFLOWSERVICE.GS
 * WORKFLOW-STEUERUNG FÜR VORPLANUNG, SPLITTUNG UND ZEITLOGIK
 */


// FUNKTION: Verarbeitet Änderungen in der Vorplanung zeilenbezogen | EINGRIFF: 📅_VORPLANUNG
function vorplanungEditVerarbeiten_(zeile, spalte) {
  // FUNKTION: Führt die gesamte Workflow-Kette unter Sperre aus | EINGRIFF: 00_LOCKSYSTEM
  return mitSperreAusfuehren_(function() {
    // FUNKTION: Referenziert das Blatt der Vorplanung | EINGRIFF: 01_CONFIG
    const sh = tabelleHolen_("VORPLANUNG");
    // CHECK: Ist das Blatt vorhanden? | FOLGE: Abbruch bei Fehlstruktur
    if (!sh) return;


    // FUNKTION: Ermittelt das dynamische Mapping des Blatts | EINGRIFF: 02_BASISHELPER
    const sMap = spaltenZuordnungHolen_(sh);
    // CHECK: Ist eine Datenzeile betroffen? | FOLGE: Abbruch bei Header-Zeile
    if (!zeile || zeile <= 1) return;


    // CHECK: Wurde die Stoffbesitzer-Spalte bearbeitet? | FOLGE: ID-Sicherstellung
    if (spalte === sMap.STOFFBESITZER) {
      // FUNKTION: Liest den Stoffbesitzer der bearbeiteten Zeile | EINGRIFF: Physikalische Tabelle
      const stoff = textNormalisieren_(sh.getRange(zeile, sMap.STOFFBESITZER).getValue());
      // CHECK: Ist ein Stoffbesitzer eingetragen? | FOLGE: Start der ID-Logik
      if (stoff) {
        // FUNKTION: Referenziert die ID-Zelle der Zeile | EINGRIFF: Physikalische Tabelle
        const zelleId = sh.getRange(zeile, sMap.VORGANGS_ID);
        // CHECK: Ist dort noch keine ID vorhanden? | FOLGE: Vergabe einer Vorgangs-ID
        if (!textNormalisieren_(zelleId.getValue())) {
          // FUNKTION: Holt oder erzeugt die zentrale ID | EINGRIFF: 03_IDSERVICE
          const vId = vorgangsIdSicherstellen_(stoff);
          // FUNKTION: Schreibt die ID in die Vorplanung | EINGRIFF: Physikalische Tabelle
          zelleId.setValue(vId);
        }
      }
    }


    // CHECK: Wurde die Mengen-Spalte der Vorplanung bearbeitet? | FOLGE: Prüfung auf Splittung
    if (spalte === sMap.INH_VP) {
      // FUNKTION: Liest den Inhalt der Zeile | EINGRIFF: Physikalische Tabelle
      const inhalt = Number(sh.getRange(zeile, sMap.INH_VP).getValue()) || 0;
      // CHECK: Überschreitet die Menge die Maximalblase? | FOLGE: Ausführung der Splittung
      if (inhalt > KONFIGURATION.IDENTITAET.MAX_BLASE) {
        // FUNKTION: Führt die Splittung direkt aus | EINGRIFF: Tabellenstruktur
        ausfuehrenFassSplittung_(sh, zeile, inhalt, sMap);
      }
    }


    // FUNKTION: Definiert die zeitkritischen Spalten | EINGRIFF: Workflow-Regel
    const zeitSpalten = [sMap.TAG_BRAND, sMap.VON, sMap.MATERIAL, sMap.ANZAHL_BRAENDE];
    // CHECK: Ist die editierte Spalte für die Zeitberechnung relevant? | FOLGE: Start der Endzeitlogik
    if (zeitSpalten.indexOf(spalte) !== -1) {
      // FUNKTION: Liest Brandtag der Zeile | EINGRIFF: Physikalische Tabelle
      const tagBrandRaw = sh.getRange(zeile, sMap.TAG_BRAND).getValue();
      // FUNKTION: Liest die Startzeit der Zeile | EINGRIFF: Physikalische Tabelle
      const von = sh.getRange(zeile, sMap.VON).getDisplayValue();
      // FUNKTION: Liest das Material der Zeile | EINGRIFF: Physikalische Tabelle
      const material = sh.getRange(zeile, sMap.MATERIAL).getValue();
      // FUNKTION: Liest die Vorgangs-ID der Zeile | EINGRIFF: Physikalische Tabelle
      const vId = sh.getRange(zeile, sMap.VORGANGS_ID).getValue();
      // FUNKTION: Liest die Anzahl der Brände der Zeile | EINGRIFF: Physikalische Tabelle
      const anzahlBraende = sMap.ANZAHL_BRAENDE ? Number(sh.getRange(zeile, sMap.ANZAHL_BRAENDE).getValue()) || 1 : 1;


      // FUNKTION: Wandelt den Brandtag robust in ein Datum um | EINGRIFF: Typisierung
      const tagBrand = (tagBrandRaw instanceof Date) ? tagBrandRaw : new Date(tagBrandRaw);


      // CHECK: Liegen Datum und Startzeit verwertbar vor? | FOLGE: Zeitberechnung
      if (!isNaN(tagBrand.getTime()) && String(von).indexOf(":") !== -1) {
        // FUNKTION: Berechnet die neue Endzeit | EINGRIFF: Zeit-Engine
        const result = automatischerZeitCheck_(
          Utilities.formatDate(tagBrand, KONFIGURATION.ZOLL_PARAMETER.ZEIT_PARAMETER.ZEITZONE, "yyyy-MM-dd"),
          von,
          material,
          vId,
          anzahlBraende
        );


        // CHECK: Existiert eine BIS-Spalte? | FOLGE: Schreiben der Endzeit
        if (sMap.BIS) {
          // FUNKTION: Schreibt die berechnete Endzeit zurück | EINGRIFF: Physikalische Tabelle
          sh.getRange(zeile, sMap.BIS).setValue(result.bis);
        }


        // CHECK: Existiert eine Info-System-Spalte? | FOLGE: Rückmeldung zur Zeitlogik
        if (sMap.INFO_SYSTEM) {
          // FUNKTION: Schreibt Statusinformationen zum Zeitlauf | EINGRIFF: UI-Hilfsspalte
          sh.getRange(zeile, sMap.INFO_SYSTEM).setValue(result.info);
        }
      }
    }
  }, "vorplanungEditVerarbeiten_");
}


// FUNKTION: Führt die Splittung einer Übermenge auf mehrere Zeilen aus | EINGRIFF: 📅_VORPLANUNG
function ausfuehrenFassSplittung_(sh, zeile, mengeGesamt, sMap) {
  // CHECK: Ist die Eingangsmenge valide? | FOLGE: Abbruch bei Nullwerten
  if (!sh || !zeile || mengeGesamt <= 0) return;
  // CHECK: Wurde die Zeile bereits als Teilbrand markiert? | FOLGE: Schutz gegen Endlossplittung
  if (sMap.INFO_SYSTEM) {
    // FUNKTION: Liest die Systeminfo der Ursprungszeile | EINGRIFF: Physikalische Tabelle
    const info = textNormalisieren_(sh.getRange(zeile, sMap.INFO_SYSTEM).getValue());
    // CHECK: Ist bereits eine Splittung dokumentiert? | FOLGE: Abbruch
    if (info.indexOf("SPLIT") !== -1) return;
  }


  // FUNKTION: Berechnet die Zahl benötigter Teilbrände | EINGRIFF: Kalkulation
  const anzahl = Math.ceil(mengeGesamt / KONFIGURATION.IDENTITAET.MAX_BLASE);
  // FUNKTION: Ermittelt die Restmenge für die Aufteilung | EINGRIFF: Kalkulation
  let rest = mengeGesamt;
  // FUNKTION: Initialisiert die Teilmengenliste | EINGRIFF: Datenstruktur
  const teile = [];


  // FUNKTION: Erstellt die Teilmengen max. bis zur Blasengröße | EINGRIFF: Splittungslogik
  for (let i = 0; i < anzahl; i++) {
    // FUNKTION: Berechnet den Einzelanteil | EINGRIFF: Kalkulation
    const teil = Math.min(KONFIGURATION.IDENTITAET.MAX_BLASE, rest);
    // FUNKTION: Übernimmt die Teilmenge in die Liste | EINGRIFF: Datenstruktur
    teile.push(teil);
    // FUNKTION: Reduziert die Restmenge | EINGRIFF: Kalkulation
    rest -= teil;
  }


  // FUNKTION: Liest die komplette Ursprungszeile | EINGRIFF: Physikalische Tabelle
  const basisZeile = sh.getRange(zeile, 1, 1, sh.getLastColumn()).getValues()[0];


  // FUNKTION: Setzt die erste Zeile auf die erste Teilmenge | EINGRIFF: Physikalische Tabelle
  sh.getRange(zeile, sMap.INH_VP).setValue(teile[0]);


  // CHECK: Existiert die Brandspalte? | FOLGE: Setzung auf Gesamtanzahl
  if (sMap.ANZAHL_BRAENDE) {
    // FUNKTION: Schreibt die Gesamtanzahl in die Ursprungszeile | EINGRIFF: Physikalische Tabelle
    sh.getRange(zeile, sMap.ANZAHL_BRAENDE).setValue(anzahl);
  }


  // CHECK: Existiert die Systemspalte? | FOLGE: Markierung der Ursprungszeile
  if (sMap.INFO_SYSTEM) {
    // FUNKTION: Kennzeichnet die Ursprungszeile als Split-Anker | EINGRIFF: UI-Hilfsspalte
    sh.getRange(zeile, sMap.INFO_SYSTEM).setValue("SPLIT-ANKER 1/" + anzahl);
  }


  // FUNKTION: Erzeugt die Folgezeilen für alle weiteren Teilmengen | EINGRIFF: Tabellenstruktur
  for (let i = 1; i < teile.length; i++) {
    // FUNKTION: Erstellt eine saubere Kopie der Ursprungszeile für die Folgezeile | EINGRIFF: Datenstruktur
    const neueWerte = basisZeile.slice();
    // FUNKTION: Setzt die Teilmenge in der Folgezeile | EINGRIFF: Splittungslogik
    neueWerte[sMap.INH_VP - 1] = teile[i];


    // CHECK: Existiert die Brandspalte? | FOLGE: Setzung der Gesamtanzahl
    if (sMap.ANZAHL_BRAENDE) {
      // FUNKTION: Schreibt die Gesamtanzahl in die Folgezeile | EINGRIFF: Splittungslogik
      neueWerte[sMap.ANZAHL_BRAENDE - 1] = anzahl;
    }


    // CHECK: Existiert eine Fassgrößen-Spalte in der Vorplanung? | FOLGE: Leeren in Folgezeilen
    if (sMap.FASS_VP) {
      // FUNKTION: Leert die Fassgrößen-Spalte der Folgezeile | EINGRIFF: UI-Kennzeichnung
      neueWerte[sMap.FASS_VP - 1] = "";
    }


    // CHECK: Existiert die Systemspalte? | FOLGE: Markierung als Teilbrand
    if (sMap.INFO_SYSTEM) {
      // FUNKTION: Schreibt die Teilbrand-Information in die Folgezeile | EINGRIFF: UI-Hilfsspalte
      neueWerte[sMap.INFO_SYSTEM - 1] = "SPLIT-FOLGE " + (i + 1) + "/" + anzahl;
    }


    // FUNKTION: Fügt unterhalb der zuletzt geschriebenen Zeile eine neue Zeile ein | EINGRIFF: Physikalische Tabelle
    sh.insertRowAfter(zeile + i - 1);
    // FUNKTION: Schreibt die sauber aufgebaute Folgezeile in das Blatt | EINGRIFF: Physikalische Tabelle
    sh.getRange(zeile + i, 1, 1, neueWerte.length).setValues([neueWerte]);
  }


  // FUNKTION: Dokumentiert die Splittung im Systemlog | EINGRIFF: SYSTEM_LOG
  systemLogSchreiben_("INFO", "WorkflowService", "Mengen-Splittung durchgeführt", "", "Zeile " + zeile + " | Brände: " + anzahl + " | Gesamt: " + mengeGesamt);
}


// FUNKTION: Berechnet die Endzeit eines Brandblocks | EINGRIFF: Zeit-Engine
function automatischerZeitCheck_(tagStr, vonZeit, material, vId, anzahlBraende) {
  // FUNKTION: Liest die Zeitparameter aus der Konfiguration | EINGRIFF: 01_CONFIG
  const zp = KONFIGURATION.ZOLL_PARAMETER.ZEIT_PARAMETER;
  // FUNKTION: Wandelt die Startzeit in Minuten um | EINGRIFF: 06_FORMATSERVICE
  const startMin = zeitZuMinuten_(vonZeit);
  // FUNKTION: Ermittelt die Anzahl der Brände | EINGRIFF: Kalkulation
  const braende = Math.max(1, Number(anzahlBraende) || 1);


  // FUNKTION: Berechnet die Gesamtdauer des Blocks | EINGRIFF: Zoll-Zeitlogik
  let dauer = zp.KALTSTART + zp.REINIGUNG;
  // CHECK: Sind mehr als ein Brand vorgesehen? | FOLGE: Zuschlag für Folgebrände
  if (braende > 1) {
    // FUNKTION: Addiert die Folgebrandzeiten | EINGRIFF: Zoll-Zeitlogik
    dauer += (braende - 1) * zp.FOLGEBRAND;
  }


  // FUNKTION: Ermittelt die Endminute des Blocks | EINGRIFF: Zeit-Kalkulation
  const endMin = startMin + dauer;
  // FUNKTION: Baut die Ergebnisstruktur | EINGRIFF: API-Rückgabe
  const result = {
    bis: minutenZuZeit_(endMin),
    minutenGesamt: dauer,
    info: "ZEIT OK | " + braende + " Brand/Brände | " + dauer + " Min. | " + String(material || "")
  };


  // FUNKTION: Referenziert das Blatt der Vorplanung | EINGRIFF: 01_CONFIG
  const sh = tabelleHolen_("VORPLANUNG");
  // CHECK: Ist das Blatt vorhanden? | FOLGE: optionale Kollisionsprüfung
  if (!sh) return result;


  // FUNKTION: Holt das Mapping des Vorplanungsblatts | EINGRIFF: 02_BASISHELPER
  const sMap = spaltenZuordnungHolen_(sh);
  // CHECK: Sind die relevanten Spalten vorhanden? | FOLGE: sonst Rückgabe ohne Kollisionsscan
  if (!sMap.TAG_BRAND || !sMap.VON || !sMap.BIS) return result;
  // CHECK: Enthält das Blatt Datenzeilen? | FOLGE: sonst Rückgabe ohne Kollisionsscan
  if (sh.getLastRow() < 2) return result;


  // FUNKTION: Liest alle Datenzeilen der Vorplanung | EINGRIFF: Physikalische Tabelle
  const daten = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();


  // FUNKTION: Iteriert über alle Bestandszeilen zur Kollisionserkennung | EINGRIFF: Such-Loop
  for (let i = 0; i < daten.length; i++) {
    // FUNKTION: Referenziert die aktuelle Datenzeile | EINGRIFF: Array-Zugriff
    const row = daten[i];
    // FUNKTION: Liest die ID der Bestandszeile | EINGRIFF: Mapping
    const andereId = sMap.VORGANGS_ID ? textNormalisieren_(row[sMap.VORGANGS_ID - 1]) : "";
    // CHECK: Ist es derselbe Vorgang? | FOLGE: Auslassen der Eigenprüfung
    if (vId && andereId && andereId === textNormalisieren_(vId)) continue;


    // FUNKTION: Liest den Brandtag der Bestandszeile | EINGRIFF: Mapping
    const andererTag = row[sMap.TAG_BRAND - 1];
    // FUNKTION: Wandelt den Brandtag robust in ein Datumsobjekt um | EINGRIFF: Typisierung
    const dateObj = (andererTag instanceof Date) ? andererTag : new Date(andererTag);
    // CHECK: Ist das Datum der Bestandszeile verwertbar? | FOLGE: Vergleich auf denselben Tag
    if (isNaN(dateObj.getTime())) continue;


    // FUNKTION: Formatiert das Bestandsdatum | EINGRIFF: Datumsvergleich
    const andererTagStr = Utilities.formatDate(dateObj, KONFIGURATION.ZOLL_PARAMETER.ZEIT_PARAMETER.ZEITZONE, "yyyy-MM-dd");
    // CHECK: Liegt die Bestandszeile am selben Tag? | FOLGE: Zeitvergleich
    if (andererTagStr !== tagStr) continue;


    // FUNKTION: Liest Start- und Endzeit der Bestandszeile | EINGRIFF: Mapping
    const vonAndere = textNormalisieren_(row[sMap.VON - 1]);
    const bisAndere = textNormalisieren_(row[sMap.BIS - 1]);
    // CHECK: Sind beide Zeiten verwertbar? | FOLGE: Überschneidungsprüfung
    if (vonAndere.indexOf(":") === -1 || bisAndere.indexOf(":") === -1) continue;


    // FUNKTION: Rechnet die Bestandszeiten in Minuten um | EINGRIFF: Zeit-Engine
    const startAndere = zeitZuMinuten_(vonAndere);
    const endAndere = zeitZuMinuten_(bisAndere);
    // CHECK: Überschneiden sich die Zeitfenster? | FOLGE: Kennzeichnung im Ergebnis
    if (startMin < endAndere && endMin > startAndere) {
      // FUNKTION: Ergänzt die Info um eine Kollisionswarnung | EINGRIFF: API-Rückgabe
      result.info = "KOLLISION mit Zeile " + (i + 2) + " | " + vonAndere + "-" + bisAndere;
      break;
    }
  }


  // FUNKTION: Liefert das Berechnungsergebnis zurück | EINGRIFF: API-Rückgabe
  return result;
}