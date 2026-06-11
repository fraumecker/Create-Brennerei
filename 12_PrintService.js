// DATEI: 12_PRINTSERVICE.GS

/**
 * DATEI: 12_PRINTSERVICE.GS
 * DRUCKFUNKTIONEN FÜR BRENNPROTOKOLL
 */

// FUNKTION: Druckt markierte Datenzeilen als Brennprotokoll.
function protokollDrucken() { // Start Druck aus Tabellenmarkierung.
  const ss = SpreadsheetApp.getActiveSpreadsheet(); // Aktive Tabelle holen.
  const sh = ss.getActiveSheet(); // Aktives Blatt holen.
  const map = spaltenZuordnungHolen_(sh); // Spaltenmapping des aktiven Blatts holen.
  let zeilen = protokollZeilenAuswahlHolen_(sh); // Markierte Datenzeilen holen.
  zeilen = protokollZeilenNachUhrzeitSortieren_(sh, map, zeilen); // Zeilen nach Brennzeit sortieren.

  if (zeilen.length === 0) { // Prüfen, ob überhaupt Datenzeilen markiert wurden.
    SpreadsheetApp.getUi().alert("Bitte markieren Sie zuerst mindestens eine Datenzeile."); // Bedienhinweis ausgeben.
    return; // Funktion abbrechen.
  }

  const html = protokollHtmlAusZeilenErstellen_(sh, map, zeilen); // Druck-HTML zentral erzeugen.

  SpreadsheetApp.getUi().showModalDialog( // Druckdialog öffnen.
    HtmlService.createHtmlOutput(html).setWidth(1280).setHeight(920), // HTML mit Dialoggröße übergeben.
    " " // Dialogtitel leer halten.
  );
} // Ende protokollDrucken.

// FUNKTION: Erzeugt das Druck-HTML für einen kompletten Brandtag.
function getProtokollHtmlFuerBrandtag(dateStr) { // Start WebApp-Druck für Brandtag.
  const shBrandtag = tabelleHolen_("BRANDTAG_UEBERSICHT"); // Brandtag-Übersicht holen.

  if (shBrandtag) { // Prüfen, ob Brandtag-Blatt existiert.
    const mapBrandtag = spaltenZuordnungHolen_(shBrandtag); // Spaltenmapping Brandtag holen.
    const zeilenBrandtag = protokollZeilenFuerBrandtagHolen_(shBrandtag, mapBrandtag, dateStr); // Zeilen zum Datum holen.

    if (zeilenBrandtag.length > 0) { // Prüfen, ob Zeilen gefunden wurden.
      return protokollHtmlAusZeilenErstellen_(shBrandtag, mapBrandtag, zeilenBrandtag); // Druck-HTML zurückgeben.
    }
  }

  const shArchiv = tabelleHolen_("JAHRESARCHIV"); // Jahresarchiv holen.

  if (shArchiv) { // Prüfen, ob Archiv existiert.
    const mapArchiv = spaltenZuordnungHolen_(shArchiv); // Spaltenmapping Archiv holen.
    const zeilenArchiv = protokollZeilenFuerBrandtagHolen_(shArchiv, mapArchiv, dateStr); // Archivzeilen zum Datum holen.

    if (zeilenArchiv.length > 0) { // Prüfen, ob Archivzeilen gefunden wurden.
      return protokollHtmlAusZeilenErstellen_(shArchiv, mapArchiv, zeilenArchiv); // Druck-HTML aus Archiv zurückgeben.
    }
  }

  if (!shBrandtag && !shArchiv) { // Prüfen, ob beide Blätter fehlen.
    return protokollLeerHtmlErstellen_("Blätter BRANDTAG_UEBERSICHT und JAHRESARCHIV wurden nicht gefunden."); // Fehlermeldung ausgeben.
  }

  return protokollLeerHtmlErstellen_("Keine Brände für den ausgewählten Brandtag."); // Leermeldung ausgeben.
} // Ende getProtokollHtmlFuerBrandtag.

// FUNKTION: Erstellt vollständiges Brennprotokoll-HTML.
function protokollHtmlAusZeilenErstellen_(sh, map, zeilen) { // Start zentraler HTML-Aufbau.
  zeilen = protokollZeilenNachUhrzeitSortieren_(sh, map, zeilen); // Zeilen fachlich sortieren.

  const logoBase64 = protokollLogoBase64Holen_(); // Logo als Base64 holen.
  const brennereiNummer = protokollBrennereiNummerHolen_(); // Brennereinummer holen.

  let html = protokollHtmlKopfErstellen_(logoBase64, brennereiNummer); // HTML-Kopf und Tabellenkopf erzeugen.

  zeilen.forEach(function(z) { // Jede Druckzeile verarbeiten.
    html += protokollTabellenzeileHtmlErstellen_(sh, map, z); // Tabellenzeile anhängen.
  });

  html += protokollHtmlFussErstellen_(); // HTML-Fuß anhängen.
  return html; // Fertiges HTML zurückgeben.
} // Ende protokollHtmlAusZeilenErstellen_.

// FUNKTION: Erstellt eine Tabellenzeile für das Brennprotokoll.
function protokollTabellenzeileHtmlErstellen_(sh, map, zeile) { // Start Zeilenaufbau.
  const valueRow = sh.getRange(zeile, 1, 1, sh.getLastColumn()).getValues()[0]; // Rohwerte der Tabellenzeile holen.
  const displayRow = sh.getRange(zeile, 1, 1, sh.getLastColumn()).getDisplayValues()[0]; // Anzeigewerte der Tabellenzeile holen.

  const brandtag = protokollDatumDeutschAusZeile_(valueRow, displayRow, map, "TAG_BRAND"); // Brandtag formatieren.
  const brenner = protokollWertAusZeile_(displayRow, map, "BRENNER"); // Brenner holen.
  const von = protokollZeitAusZeile_(valueRow, displayRow, map, "VON"); // Beginnzeit holen.
  const bis = protokollZeitAusZeile_(valueRow, displayRow, map, "BIS"); // Endezeit holen.
  const stoffbesitzer = protokollWertAusZeile_(displayRow, map, "STOFFBESITZER"); // Stoffbesitzer holen.
  const vorgangsId = protokollWertAusZeile_(displayRow, map, "VORGANGS_ID"); // Vorgangs-ID holen.
  const registernummer = protokollWertAusZeile_(displayRow, map, "REGISTERNUMMER"); // Registernummer holen.
  const fassdaten = protokollFassdatenAusZeileHolen_(displayRow, map); // Fassdaten fachlich aufbereiten.
  const alkohol = protokollWertAusZeile_(displayRow, map, "ALKOHOL"); // Alkoholwert holen.
  const ausbeute = protokollWertAusZeile_(displayRow, map, "AUSBEUTE"); // Ausbeute holen.
  const trinkstaerke = protokollWertAusZeileFlexibel_(displayRow, map, ["TRINKSTAERKE", "TRINKSTÄRKE", "TRINK_STAERKE", "TRINK_STÄRKE"]); // Trinkstärke holen.
  let wasser = protokollWertAusZeileFlexibel_(displayRow, map, ["WASSERZUGABE", "WASSER", "LITER_WASSER"]); // Wasserzugabe holen.
  let literDestillat = protokollWertAusZeileFlexibel_(displayRow, map, ["LITER_DESTILLAT", "LITER", "DESTILLAT_LITER"]); // Liter Destillat holen.
  let endmenge = protokollWertAusZeileFlexibel_(displayRow, map, ["ENDMENGE", "ENDMENGE_DESTILLAT", "FERTIGES_DESTILLAT"]); // Endmenge holen.
  const kosten = protokollWertAusZeileFlexibel_(displayRow, map, ["KOSTEN", "KOSTEN_BRAND"]); // Kosten holen.
  const herabsetzung = protokollHerabsetzungBerechnen_(alkohol, ausbeute, literDestillat, trinkstaerke, wasser, endmenge); // Fehlende Werte rechnerisch ergänzen.

  wasser = herabsetzung.wasser; // Wasserzugabe übernehmen.
  literDestillat = herabsetzung.liter; // Liter Destillat übernehmen.
  endmenge = herabsetzung.endmenge; // Endmenge übernehmen.

  return `<tr>
    <td>${printEscapeHtml_(brandtag)}</td>
    <td>${printEscapeHtml_(brenner)}</td>
    <td>${printEscapeHtml_(von)}</td>
    <td>${printEscapeHtml_(bis)}</td>
    <td>${printEscapeHtml_(stoffbesitzer)}</td>
    <td>${printEscapeHtml_(vorgangsId)}</td>
    <td>${printEscapeHtml_(registernummer)}</td>
    <td>${printEscapeHtmlMitZeilenumbruch_(fassdaten.material)}</td>
    <td>${printEscapeHtmlMitZeilenumbruch_(fassdaten.fassNr)}</td>
    <td>${printEscapeHtmlMitZeilenumbruch_(fassdaten.fassVolumen)}</td>
    <td>${printEscapeHtmlMitZeilenumbruch_(fassdaten.inhalt)}</td>
    <td>${printEscapeHtml_(alkohol)}</td>
    <td>${printEscapeHtml_(ausbeute)}</td>
    <td>${printEscapeHtml_(trinkstaerke)}</td>
    <td>${printEscapeHtml_(wasser)}</td>
    <td>${printEscapeHtml_(literDestillat)}</td>
    <td>${printEscapeHtml_(endmenge)}</td>
    <td>${printEscapeHtml_(kosten)}</td>
  </tr>`; // HTML-Zeile zurückgeben.
} // Ende protokollTabellenzeileHtmlErstellen_.

// FUNKTION: Bereitet Fassnummer, Fassvolumen, Inhalt und Material sauber für den Ausdruck auf.
function protokollFassdatenAusZeileHolen_(displayRow, map) { // Start Fassdatenaufbereitung.
  const fassNrText = protokollWertAusZeileFlexibel_(displayRow, map, ["FASS_NR", "FASSNUMMER", "FASS_NUMMER"]); // Fassnummern holen.
  const fassVolumenText = protokollWertAusZeileFlexibel_(displayRow, map, ["FASS_VP", "FASSVOLUMEN", "FASS_VOLUMEN", "FASSGROESSE", "FASSGRÖSSE"]); // Fassvolumen holen.
  const inhaltText = protokollWertAusZeileFlexibel_(displayRow, map, ["INH_VP", "INHALT", "FASSINHALT", "FASS_INHALT"]); // Inhalt holen.
  const materialText = protokollWertAusZeileFlexibel_(displayRow, map, ["MATERIAL", "ROHSTOFF", "OBSTART"]); // Material holen.
  const entnahmeText = protokollWertAusZeileFlexibel_(displayRow, map, ["ENTNAHME", "ENTNAHME_BRAND", "ENTNAHME_FUER_DIESEN_BRAND", "ENTNAHME_FÜR_DIESEN_BRAND"]); // Entnahme holen.
  const fassSplittungText = protokollWertAusZeileFlexibel_(displayRow, map, ["FASS_SPLITTUNG", "FASSSPLITTUNG", "FASSANTEILE"]); // Fasssplittung holen.

  const anteile = protokollFassanteileAusText_(fassSplittungText); // Strukturierte Fassanteile auswerten.

  if (anteile.length > 0) { // Wenn Fassanteile vorhanden sind.
    return { // Geordnete Fassdaten zurückgeben.
      material: anteile.map(function(a) { return a.material || materialText || ""; }).join("\n"), // Material je Fass.
      fassNr: anteile.map(function(a) { return a.fassnummer || ""; }).join("\n"), // Fassnummer je Fass.
      fassVolumen: anteile.map(function(a) { return a.fassvolumen || ""; }).join("\n"), // Fassvolumen je Fass.
      inhalt: anteile.map(function(a) { return a.entnahme || a.fassinhalt || ""; }).join("\n") // Entnahme oder Inhalt je Fass.
    }; // Ende Rückgabe.
  }

  const fassListe = protokollFassListeAusText_(fassNrText); // Fassnummernliste aus Sammelfeld bilden.

  if (fassListe.length === 0) { // Wenn keine Fassnummer erkennbar ist.
    return { // Einfache Rohdaten zurückgeben.
      material: protokollSammelfeldWertOhneSchluessel_(materialText), // Material bereinigen.
      fassNr: protokollSammelfeldWertOhneSchluessel_(fassNrText), // Fassnummer bereinigen.
      fassVolumen: protokollSammelfeldWertOhneSchluessel_(fassVolumenText), // Fassvolumen bereinigen.
      inhalt: protokollSammelfeldWertOhneSchluessel_(entnahmeText || inhaltText) // Entnahme oder Inhalt bereinigen.
    }; // Ende Rückgabe.
  }

  if (fassListe.length === 1) { // Wenn nur ein Fass vorhanden ist.
    const fass = fassListe[0]; // Fassnummer holen.
    return { // Einzelfassdaten zurückgeben.
      material: protokollWertJeFassAusSammelfeld_(materialText, fass, 0) || protokollSammelfeldWertOhneSchluessel_(materialText), // Material passend holen.
      fassNr: fass, // Fassnummer setzen.
      fassVolumen: protokollWertJeFassAusSammelfeld_(fassVolumenText, fass, 0), // Fassvolumen passend holen.
      inhalt: protokollWertJeFassAusSammelfeld_(entnahmeText || inhaltText, fass, 0) // Entnahme oder Inhalt passend holen.
    }; // Ende Rückgabe.
  }

  return { // Mehrfassdaten zurückgeben.
    material: fassListe.map(function(fass, index) { return protokollWertJeFassAusSammelfeld_(materialText, fass, index) || materialText || ""; }).join("\n"), // Material je Fass.
    fassNr: fassListe.join("\n"), // Fassnummern untereinander.
    fassVolumen: fassListe.map(function(fass, index) { return protokollWertJeFassAusSammelfeld_(fassVolumenText, fass, index); }).join("\n"), // Fassvolumen je Fass.
    inhalt: fassListe.map(function(fass, index) { return protokollWertJeFassAusSammelfeld_(entnahmeText || inhaltText, fass, index); }).join("\n") // Entnahme oder Inhalt je Fass.
  }; // Ende Rückgabe.
} // Ende protokollFassdatenAusZeileHolen_.

// FUNKTION: Liest strukturierte Fassanteile aus Textfeldern.
function protokollFassanteileAusText_(text) { // Start Parser Fassanteile.
  const roh = textNormalisieren_(text); // Text normalisieren.
  if (!roh) return []; // Ohne Text keine Fassanteile.

  const zeilen = roh.split(/\r?\n/); // Text in Zeilen zerlegen.
  const anteile = []; // Ergebnisliste vorbereiten.

  zeilen.forEach(function(line) { // Jede Zeile prüfen.
    const zeile = String(line || "").trim(); // Zeile bereinigen.
    if (!zeile) return; // Leere Zeile überspringen.
    if (!/^[-•]?\s*Fass\s+/i.test(zeile)) return; // Nur Fass-Zeilen verarbeiten.

    const obj = { // Fassobjekt vorbereiten.
      fassnummer: "", // Fassnummer.
      fassvolumen: "", // Fassvolumen.
      fassinhalt: "", // Fassinhalt.
      material: "", // Material.
      entnahme: "", // Entnahme.
      rest: "", // Rest.
      zuordnung: "" // Zuordnung.
    };

    const teile = zeile.replace(/^[-•]\s*/, "").split(/\s*\|\s*/); // Feldteile trennen.
    const kopf = teile.shift() || ""; // Kopfteil entnehmen.
    const kopfMatch = kopf.match(/^Fass\s+(.+)$/i); // Fassnummer aus Kopf lesen.
    if (!kopfMatch) return; // Ohne Fassnummer abbrechen.

    obj.fassnummer = String(kopfMatch[1] || "").trim(); // Fassnummer setzen.

    teile.forEach(function(teil) { // Teilfelder auswerten.
      const feld = String(teil || "").split(/\s*:\s*/); // Label und Wert trennen.
      const label = String(feld.shift() || "").trim().toLowerCase(); // Label normalisieren.
      const wert = feld.join(":").trim(); // Wert zusammensetzen.
      if (!label) return; // Ohne Label überspringen.

      if (label.indexOf("fassvolumen") >= 0 || label === "volumen") obj.fassvolumen = wert; // Fassvolumen übernehmen.
      else if (label.indexOf("fassinhalt") >= 0 || label === "inhalt" || label === "gesamt") obj.fassinhalt = wert; // Fassinhalt übernehmen.
      else if (label.indexOf("material") >= 0 || label.indexOf("rohstoff") >= 0) obj.material = wert; // Material übernehmen.
      else if (label.indexOf("entnahme") >= 0) obj.entnahme = wert; // Entnahme übernehmen.
      else if (label === "rest") obj.rest = wert; // Rest übernehmen.
      else if (label.indexOf("zuordnung") >= 0 || label.indexOf("rest /") >= 0) obj.zuordnung = wert; // Zuordnung übernehmen.
    });

    anteile.push(obj); // Fassobjekt übernehmen.
  });

  return anteile; // Fassanteile zurückgeben.
} // Ende protokollFassanteileAusText_.

// FUNKTION: Zerlegt Fassnummern aus Sammelfeldern.
function protokollFassListeAusText_(text) { // Start Fasslisten-Zerlegung.
  const roh = textNormalisieren_(text); // Text normalisieren.
  if (!roh) return []; // Ohne Text leere Liste zurückgeben.

  return roh // Text verarbeiten.
    .replace(/\bFass\b/gi, "") // Wort Fass entfernen.
    .split(/\s*\/\s*|\s*,\s*|\s*;\s*|\s*\|\s*/) // Übliche Trennzeichen auswerten.
    .map(function(v) { return String(v || "").trim(); }) // Einzelwerte bereinigen.
    .filter(Boolean); // Leere Werte entfernen.
} // Ende protokollFassListeAusText_.

// FUNKTION: Holt aus Sammelfeld den Wert zur passenden Fassnummer.
function protokollWertJeFassAusSammelfeld_(text, fassnummer, index) { // Start Wertzuordnung je Fass.
  const roh = textNormalisieren_(text); // Text normalisieren.
  if (!roh) return ""; // Ohne Text leer zurückgeben.

  const gesucht = protokollFassKey_(fassnummer); // Fassnummer für Vergleich normalisieren.
  const teile = roh.split(/\s*\|\s*|\s*;\s*|\r?\n/).map(function(v) { return String(v || "").trim(); }).filter(Boolean); // Feldteile bilden.

  for (let i = 0; i < teile.length; i++) { // Alle Feldteile prüfen.
    const teil = teile[i]; // Aktuellen Teil holen.
    const match = teil.match(/^(?:Fass\s*)?([^:=]+?)\s*[:=]\s*(.+)$/i); // Schlüssel-Wert-Format prüfen.

    if (match && protokollFassKey_(match[1]) === gesucht) { // Passende Fassnummer prüfen.
      return protokollSammelfeldWertOhneSchluessel_(match[2]); // Wert zurückgeben.
    }
  }

  const positionswerte = roh.split(/\s*\/\s*|\s*\|\s*|\s*;\s*/).map(function(v) { return String(v || "").trim(); }).filter(Boolean); // Positionswerte bilden.

  if (positionswerte.length > 1 && index >= 0 && index < positionswerte.length) { // Positionszugriff prüfen.
    return protokollSammelfeldWertOhneSchluessel_(positionswerte[index]); // Wert über Position zurückgeben.
  }

  return protokollSammelfeldWertOhneSchluessel_(roh); // Einzelwert bereinigt zurückgeben.
} // Ende protokollWertJeFassAusSammelfeld_.

// FUNKTION: Entfernt führenden Fass-Schlüssel aus Einzelwert.
function protokollSammelfeldWertOhneSchluessel_(text) { // Start Schlüsselbereinigung.
  const roh = textNormalisieren_(text); // Text normalisieren.
  if (!roh) return ""; // Ohne Text leer zurückgeben.

  const match = roh.match(/^(?:Fass\s*)?[^:=]+?\s*[:=]\s*(.+)$/i); // Schlüssel-Wert-Format prüfen.
  return match ? String(match[1] || "").trim() : roh; // Nur Wert oder Rohtext zurückgeben.
} // Ende protokollSammelfeldWertOhneSchluessel_.

// FUNKTION: Normalisiert Fassnummern für Vergleiche.
function protokollFassKey_(wert) { // Start Fasskey.
  return String(wert || "").trim().replace(/^fass\s*/i, "").replace(/\s+/g, "").toLowerCase(); // Normalisierten Key zurückgeben.
} // Ende protokollFassKey_.

// FUNKTION: Erstellt den HTML-Kopf mit Tabellenkopf.
function protokollHtmlKopfErstellen_(logoBase64, brennereiNummer) { // Start HTML-Kopf.
  return `<html><head><style>
    @page { size: A4 landscape; margin: 8mm; }
    html, body { margin: 0; padding: 0; }
    body { font-family: "Segoe UI", sans-serif; font-size: 10px; line-height: 1.2; color: #333; background: #fff; }
    .page { width: 100%; box-sizing: border-box; position: relative; min-height: 100%; padding-bottom: 46px; }
    .no-p { text-align: center; padding: 0; margin: 0; }
    .print-btn { position: fixed; left: 50%; transform: translateX(-50%); bottom: 10px; z-index: 9999; padding: 6px 14px; background: #d9534f; color: white; font-weight: bold; border: none; border-radius: 5px; cursor: pointer; font-size: 11px; box-shadow: 0 1px 4px rgba(0,0,0,0.2); }
    .header { display: grid; grid-template-columns: 300px 1fr 260px; align-items: start; column-gap: 12px; border-bottom: 3px solid #d9534f; padding-bottom: 4px; margin-bottom: 4px; }
    .logo-wrap { text-align: left; }
    .logo-img { width: 150px; max-width: 300px; height: auto; display: block; }
    .title-block { text-align: center; color: #000; line-height: 1.05; padding-top: 0; margin-top: 0; }
    .title-main { font-weight: 800; font-size: 26px; letter-spacing: 0.2px; }
    .title-sub { margin-top: 4px; font-weight: 700; font-size: 16px; }
    .contact-info { text-align: right; font-size: 9.5px; line-height: 1.15; color: #333; padding-top: 0; margin-top: 0; }
    .zoll-contact-inline { margin-top: 4px; text-align: right; color: #b3b3b3; font-size: 7.8px; line-height: 1.1; filter: grayscale(1) opacity(0.32); }
    .zoll-contact-inline img { width: 38px; height: 38px; object-fit: contain; display: block; margin: 0 0 2px auto; border: 1px solid #e3e3e3; background: #fff; }
    .zoll-contact-title { font-weight: 700; color: #b3b3b3; margin-bottom: 1px; }
    .protokoll-table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 0; margin-bottom: 8px; }
    .protokoll-table th { border: 1.2px solid #000; background: #eaeaea; color: #000; padding: 4px 3px; font-size: 8.2px; font-weight: 800; text-transform: uppercase; line-height: 1.05; }
    .protokoll-table td { border: 1.2px solid #000; padding: 5px 4px; font-size: 9.5px; line-height: 1.15; vertical-align: top; word-break: break-word; white-space: normal; }
    @media print { .no-p { display: none; } }
  </style></head><body>
    <div class="no-p"><button class="print-btn" onclick="window.print()">DRUCKEN</button></div>
    <div class="page">
      <div class="header">
        <div class="logo-wrap">${logoBase64 ? `<img src="${logoBase64}" class="logo-img">` : ``}</div>
        <div class="title-block">
          <div class="title-main">Brennprotokoll</div>
          <div class="title-sub">Brennereinummer: ${printEscapeHtml_(brennereiNummer)}</div>
        </div>
        <div class="contact-info">
          Ansprechpartner: ${printEscapeHtml_(KONFIGURATION.KONTAKT.NAME)}<br>
          📞 ${printEscapeHtml_(KONFIGURATION.KONTAKT.TEL)}<br>
          📧 ${printEscapeHtml_(KONFIGURATION.KONTAKT.MAIL)}
          <div class="zoll-contact-inline">
            <div class="zoll-contact-title">Kontaktdaten Zoll</div>
            <div>bei Notfall / Minderausbeute</div>
          </div>
        </div>
      </div>
      <table class="protokoll-table">
        <thead>
          <tr>
            <th style="width:7%;">Brandtag</th>
            <th style="width:7%;">Brenner</th>
            <th style="width:5%;">Von</th>
            <th style="width:5%;">Bis</th>
            <th style="width:12%;">Stoffbesitzer</th>
            <th style="width:7%;">Vorgangs_ID</th>
            <th style="width:8%;">Registernr.</th>
            <th style="width:12%;">Material</th>
            <th style="width:7%;">Fass-Nr.</th>
            <th style="width:7%;">Fassvolumen</th>
            <th style="width:7%;">Inhalt</th>
            <th style="width:6%;">Alkohol</th>
            <th style="width:6%;">Ausbeute</th>
            <th style="width:5%;">Trinkstärke</th>
            <th style="width:5%;">Wasser</th>
            <th style="width:6%;">Liter Destillat</th>
            <th style="width:6%;">Endmenge</th>
            <th style="width:5%;">Kosten</th>
          </tr>
        </thead>
        <tbody>`; // HTML-Kopf zurückgeben.
} // Ende protokollHtmlKopfErstellen_.

// FUNKTION: Erstellt den HTML-Fuß.
function protokollHtmlFussErstellen_() { // Start HTML-Fuß.
  return `</tbody></table></div></body></html>`; // HTML-Fuß zurückgeben.
} // Ende protokollHtmlFussErstellen_.

// FUNKTION: Holt das Logo als Base64.
function protokollLogoBase64Holen_() { // Start Logoabruf.
  let logoBase64 = ""; // Leeren Logowert setzen.

  try { // Geschützten Drive-Zugriff starten.
    const files = DriveApp.getFolderById(KONFIGURATION.DRIVE_ORDNER.LOGO_ORDNER_ID).getFiles(); // Dateien aus Logoordner holen.

    while (files.hasNext()) { // Dateien durchlaufen.
      const f = files.next(); // Nächste Datei holen.
      const n = String(f.getName() || "").toLowerCase(); // Dateinamen normalisieren.

      if (n.indexOf("ogv") !== -1 || n.indexOf("logo") !== -1 || n.match(/\.(png|jpg|jpeg|svg|webp)$/)) { // Logodatei erkennen.
        logoBase64 = "data:" + f.getMimeType() + ";base64," + Utilities.base64Encode(f.getBlob().getBytes()); // Base64 erzeugen.
        break; // Suche beenden.
      }
    }
  } catch (e) { // Fehler beim Logoabruf abfangen.
    systemLogSchreiben_("WARN", "PrintService", "Logoabruf fehlgeschlagen", "", String(e)); // Warnung schreiben.
  }

  return logoBase64; // Logo zurückgeben.
} // Ende protokollLogoBase64Holen_.

// FUNKTION: Holt die Brennereinummer.
function protokollBrennereiNummerHolen_() { // Start Nummernabruf.
  return (KONFIGURATION.IDENTITAET && KONFIGURATION.IDENTITAET.BRENNEREI_NUMMER) ? KONFIGURATION.IDENTITAET.BRENNEREI_NUMMER : "1460927"; // Nummer oder Standardwert zurückgeben.
} // Ende protokollBrennereiNummerHolen_.

// FUNKTION: Ermittelt alle Datenzeilen eines Brandtags.
function protokollZeilenFuerBrandtagHolen_(blatt, map, dateStr) { // Start Zeilensuche.
  if (!blatt || !map || !map.TAG_BRAND) return []; // Ohne Blatt oder Datumsspalte abbrechen.

  const gesucht = protokollDatumAlsIsoString_(dateStr); // Gesuchtes Datum normalisieren.
  if (!gesucht) return []; // Ohne gültiges Datum abbrechen.

  const daten = blatt.getDataRange().getValues(); // Alle Daten holen.
  const zeilen = []; // Ergebnisliste vorbereiten.

  for (let i = 1; i < daten.length; i++) { // Datenzeilen ohne Kopf durchlaufen.
    const row = daten[i]; // Aktuelle Datenzeile holen.
    const tagBrand = protokollDatumAlsIsoString_(row[map.TAG_BRAND - 1]); // Brandtag der Zeile normalisieren.
    const zollOk = protokollWertAusZeile_(row, map, "ZOLL_OK"); // Zoll-OK holen.
    const status = protokollWertAusZeile_(row, map, "STATUS"); // Status holen.
    const statusAktion = protokollWertAusZeile_(row, map, "STATUS_AKTION"); // Statusaktion holen.

    if (tagBrand === gesucht && protokollIstZollGenehmigt_(zollOk, status, statusAktion)) { // Datum und Zollstatus prüfen.
      zeilen.push(i + 1); // Tabellenzeile übernehmen.
    }
  }

  return zeilen; // Gefundene Zeilen zurückgeben.
} // Ende protokollZeilenFuerBrandtagHolen_.

// FUNKTION: Bewertet Zollfreigabe robust für Brennprotokoll.
function protokollIstZollGenehmigt_(zollOk, status, statusAktion) { // Start Zollstatusprüfung.
  const werte = [zollOk, status, statusAktion]; // Prüffelder sammeln.

  for (let i = 0; i < werte.length; i++) { // Prüffelder durchlaufen.
    const raw = werte[i]; // Rohwert holen.

    if (raw === true) return true; // Boolean TRUE akzeptieren.

    const text = String(raw == null ? "" : raw).trim().toUpperCase(); // Textwert normalisieren.
    if (!text) continue; // Leere Werte überspringen.

    if (text === "TRUE" || text === "WAHR" || text === "JA" || text === "OK" || text === "ZOLL_OK") return true; // Direkte Freigaben akzeptieren.
    if (text === "🛂 BEIM ZOLL" || text === "BEIM ZOLL" || text === "AN ZOLL GESENDET") return true; // Zollprozess akzeptieren.
    if (text.indexOf("BEIM ZOLL") !== -1 || text.indexOf("AN ZOLL") !== -1 || text.indexOf("ZOLL GESENDET") !== -1) return true; // Zolltext akzeptieren.
    if (text.indexOf("GENEHMIGT") !== -1 || text.indexOf("FREIGEGEBEN") !== -1 || text.indexOf("FREIGABE") !== -1) return true; // Freigabetext akzeptieren.
  }

  return false; // Sonst keine Freigabe.
} // Ende protokollIstZollGenehmigt_.

// FUNKTION: Liest einen Feldwert aus einer Zeile über Mapping-Schlüssel.
function protokollWertAusZeile_(row, map, key) { // Start Feldzugriff.
  return map && map[key] ? (row[map[key] - 1] || "") : ""; // Wert oder leer zurückgeben.
} // Ende protokollWertAusZeile_.

// FUNKTION: Liest einen Feldwert über mehrere mögliche Mapping-Schlüssel.
function protokollWertAusZeileFlexibel_(row, map, keys) { // Start flexibler Feldzugriff.
  for (let i = 0; i < keys.length; i++) { // Schlüssel durchlaufen.
    const wert = protokollWertAusZeile_(row, map, keys[i]); // Wert zum Schlüssel holen.
    if (textNormalisieren_(wert)) return wert; // Ersten gefüllten Wert zurückgeben.
  }

  return ""; // Ohne Treffer leer zurückgeben.
} // Ende protokollWertAusZeileFlexibel_.

// FUNKTION: Wandelt deutsche Zahlenformate in Number.
function protokollZahlAusText_(wert) { // Start Zahlenumwandlung.
  const text = textNormalisieren_(wert).replace(",", ".").replace(/[^0-9.\-]/g, ""); // Zahlentext bereinigen.
  const zahl = Number(text); // Number erzeugen.
  return isFinite(zahl) ? zahl : 0; // Gültige Zahl oder 0 zurückgeben.
} // Ende protokollZahlAusText_.

// FUNKTION: Ergänzt Wasserzugabe und Endmenge rechnerisch, wenn Werte fehlen.
function protokollHerabsetzungBerechnen_(alkoholText, ausbeuteText, literText, trinkstaerkeText, wasserText, endmengeText) { // Start Herabsetzungsrechnung.
  const alkohol = protokollZahlAusText_(alkoholText); // Alkoholzahl holen.
  const ausbeute = protokollZahlAusText_(ausbeuteText); // Ausbeutezahl holen.
  const trink = protokollZahlAusText_(trinkstaerkeText); // Trinkstärkezahl holen.
  let liter = protokollZahlAusText_(literText); // Literzahl holen.

  if (!liter && ausbeute > 0) { // Wenn Liter fehlen, aber Ausbeute vorhanden ist.
    liter = ausbeute; // Ausbeute als Literbasis nutzen.
    literText = liter.toFixed(2).replace(".", ","); // Litertext deutsch formatieren.
  }

  if (liter > 0 && alkohol > 0 && trink > 0) { // Rechnerische Grundlage prüfen.
    const endmenge = (liter * alkohol) / trink; // Endmenge berechnen.
    const wasser = endmenge - liter; // Wasserzugabe berechnen.

    if (!textNormalisieren_(endmengeText)) endmengeText = endmenge.toFixed(2).replace(".", ","); // Endmenge ergänzen.
    if (!textNormalisieren_(wasserText)) wasserText = wasser >= 0 ? wasser.toFixed(2).replace(".", ",") : ""; // Wasser ergänzen.
  }

  return { // Ergebnisobjekt zurückgeben.
    liter: literText || "", // Literwert.
    wasser: wasserText || "", // Wasserwert.
    endmenge: endmengeText || "" // Endmenge.
  };
} // Ende protokollHerabsetzungBerechnen_.

// FUNKTION: Formatiert ein Datumsfeld als dd.MM.yyyy.
function protokollDatumDeutschAusZeile_(valueRow, displayRow, map, key) { // Start Datumsformatierung.
  const raw = protokollWertAusZeile_(valueRow, map, key); // Rohwert holen.

  if (raw instanceof Date && !isNaN(raw.getTime())) { // Datumstyp prüfen.
    return Utilities.formatDate(raw, KONFIGURATION.ZOLL_PARAMETER.ZEIT_PARAMETER.ZEITZONE, "dd.MM.yyyy"); // Datum deutsch formatieren.
  }

  const display = protokollWertAusZeile_(displayRow, map, key); // Anzeigewert holen.
  const text = textNormalisieren_(display || raw); // Text normalisieren.
  if (!text) return ""; // Ohne Text leer zurückgeben.

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/); // ISO-Datum prüfen.
  if (iso) return iso[3] + "." + iso[2] + "." + iso[1]; // ISO nach deutsch wandeln.

  const deutsch = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/); // Deutsches Datum prüfen.
  if (deutsch) return deutsch[1] + "." + deutsch[2] + "." + deutsch[3]; // Deutsches Datum zurückgeben.

  return text; // Sonst Rohtext zurückgeben.
} // Ende protokollDatumDeutschAusZeile_.

// FUNKTION: Formatiert ein Uhrzeitfeld als HH:mm.
function protokollZeitAusZeile_(valueRow, displayRow, map, key) { // Start Uhrzeitformatierung.
  const display = protokollWertAusZeile_(displayRow, map, key); // Anzeigewert holen.
  const displayText = textNormalisieren_(display); // Anzeigetext normalisieren.
  const displayZeit = protokollZeitTextBereinigen_(displayText); // Uhrzeit aus Anzeige extrahieren.

  if (displayZeit) return displayZeit; // Anzeigewert nutzen, wenn lesbar.

  const raw = protokollWertAusZeile_(valueRow, map, key); // Rohwert holen.

  if (raw instanceof Date && !isNaN(raw.getTime())) { // Datumstyp prüfen.
    const jahr = raw.getFullYear(); // Jahr holen.

    if (jahr < 1901) { // Reine Google-Sheets-Uhrzeit erkennen.
      return ("0" + raw.getHours()).slice(-2) + ":" + ("0" + raw.getMinutes()).slice(-2); // Uhrzeit ohne historische Zeitzone formatieren.
    }

    return Utilities.formatDate(raw, KONFIGURATION.ZOLL_PARAMETER.ZEIT_PARAMETER.ZEITZONE, "HH:mm"); // Uhrzeit formatieren.
  }

  const rawText = textNormalisieren_(raw); // Rohtext normalisieren.
  const rawZeit = protokollZeitTextBereinigen_(rawText); // Uhrzeit aus Rohtext extrahieren.
  if (rawZeit) return rawZeit; // Extrahierte Uhrzeit zurückgeben.

  return rawText; // Sonst Rohtext zurückgeben.
} // Ende protokollZeitAusZeile_.

// FUNKTION: Extrahiert HH:mm aus Uhrzeittexten.
function protokollZeitTextBereinigen_(text) { // Start Uhrzeitbereinigung.
  const t = textNormalisieren_(text); // Text normalisieren.
  if (!t) return ""; // Ohne Text leer zurückgeben.

  const kurz = t.match(/^(\d{1,2}):(\d{2})$/); // HH:mm prüfen.
  if (kurz) return ("0" + kurz[1]).slice(-2) + ":" + kurz[2]; // HH:mm zurückgeben.

  const lang = t.match(/^(\d{1,2}):(\d{2}):(\d{2})$/); // HH:mm:ss prüfen.
  if (lang) return ("0" + lang[1]).slice(-2) + ":" + lang[2]; // Sekunden abschneiden.

  const datumMitZeit = t.match(/(?:^|\s|T)(\d{1,2}):(\d{2})(?::\d{2})?(?:\s|$)/); // Datum mit Uhrzeit prüfen.
  if (datumMitZeit) return ("0" + datumMitZeit[1]).slice(-2) + ":" + datumMitZeit[2]; // Uhrzeit zurückgeben.

  return ""; // Keine Uhrzeit gefunden.
} // Ende protokollZeitTextBereinigen_.

// FUNKTION: Ermittelt markierte Datenzeilen.
function protokollZeilenAuswahlHolen_(blatt) { // Start Auswahlermittlung.
  const gesammelt = {}; // Eindeutige Zeilen sammeln.
  const rangeList = blatt.getActiveRangeList(); // Mehrfachauswahl holen.
  const ranges = rangeList ? rangeList.getRanges() : [blatt.getActiveRange()]; // Bereiche bestimmen.

  ranges.forEach(function(r) { // Bereiche durchlaufen.
    if (!r) return; // Leeren Bereich überspringen.
    const startRow = r.getRow(); // Startzeile holen.
    const rowCount = r.getNumRows(); // Zeilenanzahl holen.

    for (let i = 0; i < rowCount; i++) { // Bereichszeilen durchlaufen.
      const zeile = startRow + i; // Tabellenzeile berechnen.
      if (zeile > 1) gesammelt[zeile] = true; // Kopfzeile ausschließen.
    }
  });

  return Object.keys(gesammelt).map(Number).sort(function(a, b) { return a - b; }); // Sortierte Zeilen zurückgeben.
} // Ende protokollZeilenAuswahlHolen_.

// FUNKTION: Sortiert Brennprotokoll-Zeilen nach Beginn, Ende und Zeilennummer.
function protokollZeilenNachUhrzeitSortieren_(sh, map, zeilen) { // Start Sortierung.
  if (!sh || !map || !Array.isArray(zeilen) || zeilen.length < 2) return zeilen || []; // Ohne Bedarf unverändert zurückgeben.

  return zeilen.slice().sort(function(a, b) { // Sortierte Kopie erzeugen.
    const ka = protokollSortKeyFuerZeile_(sh, map, a); // Sortkey A holen.
    const kb = protokollSortKeyFuerZeile_(sh, map, b); // Sortkey B holen.

    if (ka.von !== kb.von) return ka.von - kb.von; // Nach Von sortieren.
    if (ka.bis !== kb.bis) return ka.bis - kb.bis; // Nach Bis sortieren.
    return a - b; // Sonst Tabellenzeile nutzen.
  });
} // Ende protokollZeilenNachUhrzeitSortieren_.

// FUNKTION: Erstellt Sortierschlüssel für eine Tabellenzeile.
function protokollSortKeyFuerZeile_(sh, map, zeile) { // Start Sortkey.
  const valueRow = sh.getRange(zeile, 1, 1, sh.getLastColumn()).getValues()[0]; // Rohwerte holen.
  const displayRow = sh.getRange(zeile, 1, 1, sh.getLastColumn()).getDisplayValues()[0]; // Anzeigewerte holen.
  const vonText = protokollZeitAusZeile_(valueRow, displayRow, map, "VON"); // Von-Zeit holen.
  const bisText = protokollZeitAusZeile_(valueRow, displayRow, map, "BIS"); // Bis-Zeit holen.

  return { // Sortkey zurückgeben.
    von: protokollZeitSortwert_(vonText), // Von-Minuten.
    bis: protokollZeitSortwert_(bisText) // Bis-Minuten.
  };
} // Ende protokollSortKeyFuerZeile_.

// FUNKTION: Wandelt Uhrzeit in Minuten seit 00:00.
function protokollZeitSortwert_(zeitText) { // Start Sortwert.
  const text = String(zeitText || "").trim(); // Text bereinigen.
  if (!text) return 999999; // Leere Werte ans Ende.

  const hhmm = text.match(/^(\d{1,2}):(\d{2})$/); // HH:mm prüfen.
  if (hhmm) { // Treffer prüfen.
    const h = Number(hhmm[1]); // Stunden holen.
    const m = Number(hhmm[2]); // Minuten holen.
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return h * 60 + m; // Minutenwert zurückgeben.
  }

  const kompakt = text.match(/^(\d{1,2})(\d{2})$/); // HHmm prüfen.
  if (kompakt) { // Treffer prüfen.
    const h = Number(kompakt[1]); // Stunden holen.
    const m = Number(kompakt[2]); // Minuten holen.
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return h * 60 + m; // Minutenwert zurückgeben.
  }

  const irgendwo = text.match(/(\d{1,2}):(\d{2})/); // Uhrzeit irgendwo im Text suchen.
  if (irgendwo) { // Treffer prüfen.
    const h = Number(irgendwo[1]); // Stunden holen.
    const m = Number(irgendwo[2]); // Minuten holen.
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return h * 60 + m; // Minutenwert zurückgeben.
  }

  return 999999; // Unlesbare Werte ans Ende.
} // Ende protokollZeitSortwert_.

// FUNKTION: Erstellt leeres Druck-HTML für Meldungen.
function protokollLeerHtmlErstellen_(meldung) { // Start Leer-HTML.
  return `<html><head><style>
    body { font-family: "Segoe UI", sans-serif; margin: 0; padding: 32px; background: #ffffff; color: #333333; }
    .msg { max-width: 720px; margin: 0 auto; border: 1px solid #d9d9d9; border-radius: 12px; padding: 24px; text-align: center; font-size: 18px; font-weight: 600; }
  </style></head><body><div class="msg">${printEscapeHtml_(meldung || "Keine Daten vorhanden.")}</div></body></html>`; // Meldungs-HTML zurückgeben.
} // Ende protokollLeerHtmlErstellen_.

// FUNKTION: Wandelt Datum in ISO-String yyyy-MM-dd.
function protokollDatumAlsIsoString_(wert) { // Start ISO-Datum.
  if (!wert) return ""; // Ohne Wert leer zurückgeben.

  if (wert instanceof Date) { // Datumstyp prüfen.
    return Utilities.formatDate(wert, KONFIGURATION.ZOLL_PARAMETER.ZEIT_PARAMETER.ZEITZONE, "yyyy-MM-dd"); // ISO-Datum formatieren.
  }

  const text = String(wert || "").trim(); // Text bereinigen.
  if (!text) return ""; // Ohne Text leer zurückgeben.
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text; // Bereits ISO zurückgeben.

  const match = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/); // Deutsches Datum prüfen.
  if (match) return match[3] + "-" + match[2] + "-" + match[1]; // Nach ISO wandeln.

  return ""; // Sonst leer zurückgeben.
} // Ende protokollDatumAlsIsoString_.

// FUNKTION: Escaped HTML-sichere Ausgabe.
function printEscapeHtml_(text) { // Start HTML-Escaping.
  if (text == null) return ""; // Nullwerte abfangen.

  return String(text).replace(/[&<>"']/g, function(m) { // Sonderzeichen ersetzen.
    const esc = { // Escape-Tabelle.
      "&": "&amp;", // Ampersand.
      "<": "&lt;", // Kleiner als.
      ">": "&gt;", // Größer als.
      "\"": "&quot;", // Doppeltes Anführungszeichen.
      "'": "&#039;" // Einfaches Anführungszeichen.
    };

    return esc[m]; // Escape-Wert zurückgeben.
  });
} // Ende printEscapeHtml_.

// FUNKTION: Escaped HTML und erhält Zeilenumbrüche.
function printEscapeHtmlMitZeilenumbruch_(text) { // Start HTML-Ausgabe mit Zeilenumbruch.
  return printEscapeHtml_(text).replace(/\r?\n/g, "<br>"); // Zeilenumbrüche in BR wandeln.
} // Ende printEscapeHtmlMitZeilenumbruch_.