
/**
 * DATEI: 01_WEBAPP.GS
 * EXTERNE DATENABFRAGE FÜR DEN LEITSTAND-MONITOR (API-SCHNITTSTELLE)
 */

// FUNKTION: Extrahiert Jobs für einen spezifischen Brandtag | EINGRIFF: Leitstand-API
// CHECK: Abgleich des Datums via TAG_BRAND Key | FOLGE: Rückgabe gefilterter Datensätze
function getLeitstandData(dateStr) {
  // FUNKTION: Referenziert das Blatt der Maischeannahme | EINGRIFF: 01_CONFIG
  const shMA = tabelleHolen_("MAISCHEANNAHME");
  // CHECK: Ist das Blatt vorhanden? | FOLGE: Leerantwort bei Fehlstruktur
  if (!shMA) return { jobs: [], stats: { total: 0, date: dateStr } };

  // FUNKTION: Liest das dynamische Mapping des Blatts | EINGRIFF: 02_BASISHELPER
  const sMap = spaltenZuordnungHolen_(shMA);
  // FUNKTION: Liest alle Daten des Blatts | EINGRIFF: Physikalische Tabelle
  const data = shMA.getDataRange().getValues();
  // FUNKTION: Initialisiert die Ergebnisliste | EINGRIFF: API-Rückgabe
  const jobs = [];
  // FUNKTION: Initialisiert den Tageszähler | EINGRIFF: Statistik
  let totalBraende = 0;

  // FUNKTION: Iteriert über Maischeannahme ab Zeile 2 | EINGRIFF: Daten-Loop
  for (let i = 1; i < data.length; i++) {
    // FUNKTION: Referenziert die aktuelle Zeile | EINGRIFF: Array-Zugriff
    const row = data[i];
    // FUNKTION: Liest den Brandtag der Zeile | EINGRIFF: Mapping
    const brandTagRaw = sMap.TAG_BRAND ? row[sMap.TAG_BRAND - 1] : "";

    // CHECK: Ist das Datum gültig? | FOLGE: Formatierung für Vergleich mit dateStr
    let rowDate = (brandTagRaw instanceof Date)
      ? Utilities.formatDate(brandTagRaw, KONFIGURATION.ZOLL_PARAMETER.ZEIT_PARAMETER.ZEITZONE, "yyyy-MM-dd")
      : "";

    // CHECK: Passt die Zeile zum angeforderten Datum? | FOLGE: Übernahme in Export
    if (rowDate === dateStr) {
      // FUNKTION: Erhöht den Tageszähler | EINGRIFF: Statistik
      totalBraende++;

      // FUNKTION: Erstellt Job-Objekt mit realen Config-Keys | EINGRIFF: JSON-Export
      jobs.push({
        row: i + 1,
        vId: sMap.VORGANGS_ID ? row[sMap.VORGANGS_ID - 1] : "",
        owner: sMap.STOFFBESITZER ? row[sMap.STOFFBESITZER - 1] : "",
        brenner: sMap.BRENNER ? row[sMap.BRENNER - 1] : "",
        material: sMap.MATERIAL ? row[sMap.MATERIAL - 1] : "",
        fassNr: sMap.FASS_NR ? row[sMap.FASS_NR - 1] : "",
        regNr: sMap.REGISTER_NR ? row[sMap.REGISTER_NR - 1] : "",
        von: sMap.VON ? row[sMap.VON - 1] : "",
        bis: sMap.BIS ? row[sMap.BIS - 1] : "",
        alk: sMap.ALKOHOL ? row[sMap.ALKOHOL - 1] : "",
        ausbeute: sMap.AUSBEUTE ? row[sMap.AUSBEUTE - 1] : "",
        zollOk: sMap.ZOLL_OK ? row[sMap.ZOLL_OK - 1] : "",
        link: sMap.DOSSIER_LINK ? row[sMap.DOSSIER_LINK - 1] : ""
      });
    }
  }

  // FUNKTION: Sortiert Jobs chronologisch nach Startzeit | EINGRIFF: Anzeige-Logik
  return {
    jobs: jobs.sort(function(a, b) { return String(a.von).localeCompare(String(b.von)); }),
    stats: { total: totalBraende, date: dateStr }
  };
}

// FUNKTION: Schreibt einzelne Messwerte vom Monitor in die Tabelle | EINGRIFF: Rückschreib-API
// CHECK: Existenz des Feldes in der sMap | FOLGE: Gezieltes Update einer Zelle
function saveLeitstandField(row, fieldKey, val) {
  // FUNKTION: Referenziert das Blatt der Maischeannahme | EINGRIFF: 01_CONFIG
  const sh = tabelleHolen_("🍎_MAISCHEANNAHME");
  // CHECK: Ist das Blatt vorhanden? | FOLGE: Abbruch bei Fehlstruktur
  if (!sh) return false;

  // FUNKTION: Liest das dynamische Mapping des Blatts | EINGRIFF: 02_BASISHELPER
  const sMap = spaltenZuordnungHolen_(sh);
  // FUNKTION: Ermittelt den Spaltenindex zum übergebenen Feld-Key | EINGRIFF: Mapping
  const colIndex = sMap[fieldKey];

  // CHECK: Sind Zielspalte und Datenzeile gültig? | FOLGE: Schreiben des Werts
  if (colIndex && row > 1) {
    // FUNKTION: Schreibt den Wert in die Zielzelle | EINGRIFF: Physikalische Tabelle
    sh.getRange(row, colIndex).setValue(val);
    // FUNKTION: Meldet erfolgreichen Schreibvorgang zurück | EINGRIFF: API-Rückgabe
    return true;
  }

  // FUNKTION: Meldet fehlgeschlagenen Schreibvorgang zurück | EINGRIFF: API-Rückgabe
  return false;
}