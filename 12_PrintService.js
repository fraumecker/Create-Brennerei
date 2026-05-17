/**
 * DATEI: 12_PRINTSERVICE.GS
 * DRUCKFUNKTIONEN FÜR BRENNPROTOKOLL
 */

// FUNKTION: Druckt die markierten Datenzeilen als Brennprotokoll | EINGRIFF: UI / DRIVE / URLFETCH
function protokollDrucken() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getActiveSheet();
  const map = spaltenZuordnungHolen_(sh);
  const zeilen = protokollZeilenAuswahlHolen_(sh);

  if (zeilen.length === 0) {
    SpreadsheetApp.getUi().alert("Bitte markieren Sie zuerst mindestens eine Datenzeile.");
    return;
  }

  let logoBase64 = "";
  try {
    const files = DriveApp.getFolderById(KONFIGURATION.DRIVE_ORDNER.LOGO_ORDNER_ID).getFiles();
    while (files.hasNext()) {
      const f = files.next();
      const n = String(f.getName() || "").toLowerCase();
      if (n.indexOf("ogv") !== -1 || n.indexOf("logo") !== -1 || n.match(/\.(png|jpg|jpeg|svg|webp)$/)) {
        logoBase64 = "data:" + f.getMimeType() + ";base64," + Utilities.base64Encode(f.getBlob().getBytes());
        break;
      }
    }
  } catch (e) {
    systemLogSchreiben_("WARN", "PrintService", "Logoabruf fehlgeschlagen", "", String(e));
  }

  const brennereiNummer = (KONFIGURATION.IDENTITAET && KONFIGURATION.IDENTITAET.BRENNEREI_NUMMER)
    ? KONFIGURATION.IDENTITAET.BRENNEREI_NUMMER
    : "1460927";

  const zollOrdnerUrl = "https://drive.google.com/drive/folders/1W8OO9I6viZYlCqapX2uqcONDES0vySPn";

  let qrZollOrdner = "";
  try {
    const qrBlob = UrlFetchApp.fetch(
      "https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=" + encodeURIComponent(zollOrdnerUrl),
      { muteHttpExceptions: true }
    ).getBlob();
    qrZollOrdner = "data:" + qrBlob.getContentType() + ";base64," + Utilities.base64Encode(qrBlob.getBytes());
  } catch (e) {
    systemLogSchreiben_("WARN", "PrintService", "QR-Code für Zollordner fehlgeschlagen", "", String(e));
  }

  let html = `<html><head><style>
    @page {
      size: A4 landscape;
      margin: 8mm;
    }

    html, body {
      margin: 0;
      padding: 0;
    }

    body {
      font-family: "Segoe UI", sans-serif;
      font-size: 10px;
      line-height: 1.2;
      color: #333;
      background: #fff;
    }

    .page {
      width: 100%;
      box-sizing: border-box;
      position: relative;
      min-height: 100%;
      padding-bottom: 46px;
    }

    .no-p {
      text-align: center;
      padding: 0;
      margin: 0;
    }

    .print-btn {
      position: fixed;
      left: 50%;
      transform: translateX(-50%);
      bottom: 10px;
      z-index: 9999;
      padding: 6px 14px;
      background: #d9534f;
      color: white;
      font-weight: bold;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 11px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.2);
    }

    .header {
      display: grid;
      grid-template-columns: 300px 1fr 260px;
      align-items: start;
      column-gap: 12px;
      border-bottom: 3px solid #d9534f;
      padding-bottom: 4px;
      margin-bottom: 4px;
    }

    .logo-wrap {
      text-align: left;
    }

    .logo-img {
      width: 150px;
      max-width: 300px;
      height: auto;
      display: block;
    }

    .title-block {
      text-align: center;
      color: #000;
      line-height: 1.05;
      padding-top: 0;
      margin-top: 0;
    }

    .title-main {
      font-weight: 800;
      font-size: 26px;
      letter-spacing: 0.2px;
    }

    .title-sub {
      margin-top: 4px;
      font-weight: 700;
      font-size: 16px;
    }

    .contact-info {
      text-align: right;
      font-size: 9.5px;
      line-height: 1.15;
      color: #333;
      padding-top: 0;
      margin-top: 0;
    }

    .zoll-contact-inline {
      margin-top: 4px;
      text-align: right;
      color: #b3b3b3;
      font-size: 7.8px;
      line-height: 1.1;
      filter: grayscale(1) opacity(0.32);
    }

    .zoll-contact-inline img {
      width: 38px;
      height: 38px;
      object-fit: contain;
      display: block;
      margin: 0 0 2px auto;
      border: 1px solid #e3e3e3;
      background: #fff;
    }

    .zoll-contact-title {
      font-weight: 700;
      color: #b3b3b3;
      margin-bottom: 1px;
    }

    .protokoll-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      margin-top: 0;
      margin-bottom: 8px;
    }

    .protokoll-table th {
      border: 1.2px solid #000;
      background: #eaeaea;
      color: #000;
      padding: 4px 3px;
      font-size: 8.2px;
      font-weight: 800;
      text-transform: uppercase;
      line-height: 1.05;
    }

    .protokoll-table td {
      border: 1.2px solid #000;
      padding: 5px 4px;
      font-size: 9.5px;
      line-height: 1.15;
      vertical-align: top;
      word-break: break-word;
    }

    .qr-col {
      text-align: center;
      padding: 2px !important;
    }

    .row-qr {
      width: 28px;
      height: 28px;
      object-fit: contain;
      display: block;
      margin: 0 auto;
    }

    @media print {
      .no-p {
        display: none;
      }
    }
  </style></head><body>
    <div class="no-p">
      <button class="print-btn" onclick="window.print()">DRUCKEN</button>
    </div>

    <div class="page">
      <div class="header">
        <div class="logo-wrap">
          ${logoBase64 ? `<img src="${logoBase64}" class="logo-img">` : ``}
        </div>

        <div class="title-block">
          <div class="title-main">Brennprotokoll</div>
          <div class="title-sub">Brennereinummer: ${printEscapeHtml_(brennereiNummer)}</div>
        </div>

        <div class="contact-info">
          Ansprechpartner: ${printEscapeHtml_(KONFIGURATION.KONTAKT.NAME)}<br>
          📞 ${printEscapeHtml_(KONFIGURATION.KONTAKT.TEL)}<br>
          📧 ${printEscapeHtml_(KONFIGURATION.KONTAKT.MAIL)}

          <div class="zoll-contact-inline">
            ${qrZollOrdner ? `<img src="${qrZollOrdner}" alt="">` : ``}
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
            <th style="width:3%;">Wasser</th>
            <th style="width:4%;">QR</th>
          </tr>
        </thead>
        <tbody>`;

  zeilen.forEach(function(z) {
    const valueRow = sh.getRange(z, 1, 1, sh.getLastColumn()).getValues()[0];
    const displayRow = sh.getRange(z, 1, 1, sh.getLastColumn()).getDisplayValues()[0];

    const brandtag = protokollDatumDeutschAusZeile_(valueRow, displayRow, map, "TAG_BRAND");
    const brenner = protokollWertAusZeile_(displayRow, map, "BRENNER");
    const von = protokollZeitAusZeile_(valueRow, displayRow, map, "VON");
    const bis = protokollZeitAusZeile_(valueRow, displayRow, map, "BIS");
    const stoffbesitzer = protokollWertAusZeile_(displayRow, map, "STOFFBESITZER");
    const vorgangsId = protokollWertAusZeile_(displayRow, map, "VORGANGS_ID");
    const registernummer = protokollWertAusZeile_(displayRow, map, "REGISTERNUMMER");
    const material = protokollWertAusZeile_(displayRow, map, "MATERIAL");
    const fassNr = protokollWertAusZeile_(displayRow, map, "FASS_NR") || protokollWertAusZeile_(displayRow, map, "FASS_VP");
    const fassVolumen = protokollWertAusZeile_(displayRow, map, "FASSVOLUMEN") || protokollWertAusZeile_(displayRow, map, "FASS_VOLUMEN");
    const inhalt = protokollWertAusZeile_(displayRow, map, "INHALT");
    const alkohol = protokollWertAusZeile_(displayRow, map, "ALKOHOL");
    const ausbeute = protokollWertAusZeile_(displayRow, map, "AUSBEUTE");
    const wasser = protokollWertAusZeile_(displayRow, map, "WASSER");
    const dossierLink =
      protokollWertAusZeile_(displayRow, map, "DOSSIER_LINK") ||
      protokollWertAusZeile_(displayRow, map, "DOSSIERLINK") ||
      protokollWertAusZeile_(displayRow, map, "Dossier_Link");

    let rowQrHtml = "";
    if (dossierLink) {
      try {
        const rowQrBlob = UrlFetchApp.fetch(
          "https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=" + encodeURIComponent(dossierLink),
          { muteHttpExceptions: true }
        ).getBlob();
        const rowQrBase64 = "data:" + rowQrBlob.getContentType() + ";base64," + Utilities.base64Encode(rowQrBlob.getBytes());
        rowQrHtml = `<img src="${rowQrBase64}" class="row-qr">`;
      } catch (e) {
        rowQrHtml = "";
        systemLogSchreiben_("WARN", "PrintService", "QR-Code pro Vorgang fehlgeschlagen", String(vorgangsId), String(e));
      }
    }

    html += `<tr>
      <td>${printEscapeHtml_(brandtag)}</td>
      <td>${printEscapeHtml_(brenner)}</td>
      <td>${printEscapeHtml_(von)}</td>
      <td>${printEscapeHtml_(bis)}</td>
      <td>${printEscapeHtml_(stoffbesitzer)}</td>
      <td>${printEscapeHtml_(vorgangsId)}</td>
      <td>${printEscapeHtml_(registernummer)}</td>
      <td>${printEscapeHtml_(material)}</td>
      <td>${printEscapeHtml_(fassNr)}</td>
      <td>${printEscapeHtml_(fassVolumen)}</td>
      <td>${printEscapeHtml_(inhalt)}</td>
      <td>${printEscapeHtml_(alkohol)}</td>
      <td>${printEscapeHtml_(ausbeute)}</td>
      <td>${printEscapeHtml_(wasser)}</td>
      <td class="qr-col">${rowQrHtml}</td>
    </tr>`;
  });

  html += `
        </tbody>
      </table>
    </div>
  </body></html>`;

  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(1280).setHeight(920),
    " "
  );
}

// FUNKTION: Liest einen Feldwert aus der Zeile über Mapping-Schlüssel | EINGRIFF: Mapping
function protokollWertAusZeile_(row, map, key) {
  return map[key] ? (row[map[key] - 1] || "") : "";
}


// FUNKTION: Liest und formatiert ein Datumsfeld für das Brennprotokoll stabil als dd.MM.yyyy | EINGRIFF: Druckdarstellung
function protokollDatumDeutschAusZeile_(valueRow, displayRow, map, key) {
  const raw = protokollWertAusZeile_(valueRow, map, key);

  if (raw instanceof Date && !isNaN(raw.getTime())) {
    return Utilities.formatDate(
      raw,
      KONFIGURATION.ZOLL_PARAMETER.ZEIT_PARAMETER.ZEITZONE,
      "dd.MM.yyyy"
    );
  }

  const display = protokollWertAusZeile_(displayRow, map, key);
  const text = textNormalisieren_(display || raw);
  if (!text) return "";

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return iso[3] + "." + iso[2] + "." + iso[1];

  const deutsch = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (deutsch) return deutsch[1] + "." + deutsch[2] + "." + deutsch[3];

  return text;
}

// FUNKTION: Liest und formatiert ein Uhrzeitfeld für das Brennprotokoll stabil als HH:mm | EINGRIFF: Druckdarstellung
function protokollZeitAusZeile_(valueRow, displayRow, map, key) {
  const raw = protokollWertAusZeile_(valueRow, map, key);

  if (raw instanceof Date && !isNaN(raw.getTime())) {
    return Utilities.formatDate(
      raw,
      KONFIGURATION.ZOLL_PARAMETER.ZEIT_PARAMETER.ZEITZONE,
      "HH:mm"
    );
  }

  const display = protokollWertAusZeile_(displayRow, map, key);
  const text = textNormalisieren_(display || raw);
  if (!text) return "";

  const kurz = text.match(/^(\d{1,2}):(\d{2})$/);
  if (kurz) return ("0" + kurz[1]).slice(-2) + ":" + kurz[2];

  const lang = text.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (lang) return ("0" + lang[1]).slice(-2) + ":" + lang[2];

  const datumMitZeit = text.match(/(?:^|\s)(\d{1,2}):(\d{2})(?::\d{2})?(?:\s|$)/);
  if (datumMitZeit) return ("0" + datumMitZeit[1]).slice(-2) + ":" + datumMitZeit[2];

  return text;
}

// FUNKTION: Ermittelt alle ausgewählten Datenzeilen | EINGRIFF: UI-Selektion
function protokollZeilenAuswahlHolen_(blatt) {
  const gesammelt = {};
  const rangeList = blatt.getActiveRangeList();
  const ranges = rangeList ? rangeList.getRanges() : [blatt.getActiveRange()];

  ranges.forEach(function(r) {
    if (!r) return;
    const startRow = r.getRow();
    const rowCount = r.getNumRows();

    for (let i = 0; i < rowCount; i++) {
      const zeile = startRow + i;
      if (zeile > 1) gesammelt[zeile] = true;
    }
  });

  return Object.keys(gesammelt).map(Number).sort(function(a, b) {
    return a - b;
  });
}

// FUNKTION: Escaped HTML-sichere Ausgabe | EINGRIFF: Druckdarstellung
function printEscapeHtml_(text) {
  if (text == null) return "";
  return String(text).replace(/[&<>"']/g, function(m) {
    const esc = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#039;"
    };
    return esc[m];
  });
}

// FUNKTION: Erzeugt das Druck-HTML für einen kompletten Brandtag | EINGRIFF: WEBAPP / DRIVE / URLFETCH
function getProtokollHtmlFuerBrandtag(dateStr) {
  const sh = tabelleHolen_("BRANDTAG_UEBERSICHT");
  if (!sh) {
    return protokollLeerHtmlErstellen_('Blatt ' + KONFIGURATION.TABELLEN.BRANDTAG_UEBERSICHT + ' nicht gefunden.');
  }

  const map = spaltenZuordnungHolen_(sh);
  const zeilen = protokollZeilenFuerBrandtagHolen_(sh, map, dateStr);

  if (zeilen.length === 0) {
    return protokollLeerHtmlErstellen_('Keine Brände für den ausgewählten Brandtag.');
  }

  return protokollHtmlAusZeilenErstellen_(sh, map, zeilen);
}

// FUNKTION: Ermittelt alle Datenzeilen eines Brandtags | EINGRIFF: Tabellenlesezugriff
function protokollZeilenFuerBrandtagHolen_(blatt, map, dateStr) {
  if (!blatt || !map || !map.TAG_BRAND) return [];

  const gesucht = protokollDatumAlsIsoString_(dateStr);
  if (!gesucht) return [];

  const daten = blatt.getDataRange().getValues();
  const zeilen = [];

  for (let i = 1; i < daten.length; i++) {
    const row = daten[i];
    const tagBrand = protokollDatumAlsIsoString_(row[map.TAG_BRAND - 1]);
    const zollOk = protokollWertAusZeile_(row, map, "ZOLL_OK");
    if (tagBrand === gesucht && zollOk === "✅ GENEHMIGT") {
      zeilen.push(i + 1);
    }
  }

  return zeilen;
}

// FUNKTION: Erstellt das vollständige Druck-HTML aus Datenzeilen | EINGRIFF: HTML-Aufbau / DRIVE / URLFETCH
function protokollHtmlAusZeilenErstellen_(sh, map, zeilen) {
  let logoBase64 = "";
  try {
    const files = DriveApp.getFolderById(KONFIGURATION.DRIVE_ORDNER.LOGO_ORDNER_ID).getFiles();
    while (files.hasNext()) {
      const f = files.next();
      const n = String(f.getName() || "").toLowerCase();
      if (n.indexOf("ogv") !== -1 || n.indexOf("logo") !== -1 || n.match(/\.(png|jpg|jpeg|svg|webp)$/)) {
        logoBase64 = "data:" + f.getMimeType() + ";base64," + Utilities.base64Encode(f.getBlob().getBytes());
        break;
      }
    }
  } catch (e) {
    systemLogSchreiben_("WARN", "PrintService", "Logoabruf fehlgeschlagen", "", String(e));
  }

  const brennereiNummer = (KONFIGURATION.IDENTITAET && KONFIGURATION.IDENTITAET.BRENNEREI_NUMMER)
    ? KONFIGURATION.IDENTITAET.BRENNEREI_NUMMER
    : "1460927";

  const zollOrdnerUrl = "https://drive.google.com/drive/folders/1W8OO9I6viZYlCqapX2uqcONDES0vySPn";

  let qrZollOrdner = "";
  try {
    const qrBlob = UrlFetchApp.fetch(
      "https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=" + encodeURIComponent(zollOrdnerUrl),
      { muteHttpExceptions: true }
    ).getBlob();
    qrZollOrdner = "data:" + qrBlob.getContentType() + ";base64," + Utilities.base64Encode(qrBlob.getBytes());
  } catch (e) {
    systemLogSchreiben_("WARN", "PrintService", "QR-Code für Zollordner fehlgeschlagen", "", String(e));
  }

  let html = `<html><head><style>
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
    .protokoll-table td { border: 1.2px solid #000; padding: 5px 4px; font-size: 9.5px; line-height: 1.15; vertical-align: top; word-break: break-word; }
    .qr-col { text-align: center; padding: 2px !important; }
    .row-qr { width: 28px; height: 28px; object-fit: contain; display: block; margin: 0 auto; }
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
            ${qrZollOrdner ? `<img src="${qrZollOrdner}" alt="">` : ``}
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
            <th style="width:3%;">Wasser</th>
            <th style="width:4%;">QR</th>
          </tr>
        </thead>
        <tbody>`;

  zeilen.forEach(function(z) {
    const valueRow = sh.getRange(z, 1, 1, sh.getLastColumn()).getValues()[0];
    const displayRow = sh.getRange(z, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
    const brandtag = protokollDatumDeutschAusZeile_(valueRow, displayRow, map, "TAG_BRAND");
    const brenner = protokollWertAusZeile_(displayRow, map, "BRENNER");
    const von = protokollZeitAusZeile_(valueRow, displayRow, map, "VON");
    const bis = protokollZeitAusZeile_(valueRow, displayRow, map, "BIS");
    const stoffbesitzer = protokollWertAusZeile_(displayRow, map, "STOFFBESITZER");
    const vorgangsId = protokollWertAusZeile_(displayRow, map, "VORGANGS_ID");
    const registernummer = protokollWertAusZeile_(displayRow, map, "REGISTERNUMMER");
    const material = protokollWertAusZeile_(displayRow, map, "MATERIAL");
    const fassNr = protokollWertAusZeile_(displayRow, map, "FASS_NR") || protokollWertAusZeile_(displayRow, map, "FASS_VP");
    const fassVolumen = protokollWertAusZeile_(displayRow, map, "FASSVOLUMEN") || protokollWertAusZeile_(displayRow, map, "FASS_VOLUMEN");
    const inhalt = protokollWertAusZeile_(displayRow, map, "INHALT");
    const alkohol = protokollWertAusZeile_(displayRow, map, "ALKOHOL");
    const ausbeute = protokollWertAusZeile_(displayRow, map, "AUSBEUTE");
    const wasser = protokollWertAusZeile_(displayRow, map, "WASSER");
    const dossierLink = protokollWertAusZeile_(displayRow, map, "DOSSIER_LINK") || protokollWertAusZeile_(displayRow, map, "DOSSIERLINK") || protokollWertAusZeile_(displayRow, map, "Dossier_Link");

    let rowQrHtml = "";
    if (dossierLink) {
      try {
        const rowQrBlob = UrlFetchApp.fetch("https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=" + encodeURIComponent(dossierLink), { muteHttpExceptions: true }).getBlob();
        const rowQrBase64 = "data:" + rowQrBlob.getContentType() + ";base64," + Utilities.base64Encode(rowQrBlob.getBytes());
        rowQrHtml = `<img src="${rowQrBase64}" class="row-qr">`;
      } catch (e) {
        rowQrHtml = "";
        systemLogSchreiben_("WARN", "PrintService", "QR-Code pro Vorgang fehlgeschlagen", String(vorgangsId), String(e));
      }
    }

    html += `<tr>
      <td>${printEscapeHtml_(brandtag)}</td>
      <td>${printEscapeHtml_(brenner)}</td>
      <td>${printEscapeHtml_(von)}</td>
      <td>${printEscapeHtml_(bis)}</td>
      <td>${printEscapeHtml_(stoffbesitzer)}</td>
      <td>${printEscapeHtml_(vorgangsId)}</td>
      <td>${printEscapeHtml_(registernummer)}</td>
      <td>${printEscapeHtml_(material)}</td>
      <td>${printEscapeHtml_(fassNr)}</td>
      <td>${printEscapeHtml_(fassVolumen)}</td>
      <td>${printEscapeHtml_(inhalt)}</td>
      <td>${printEscapeHtml_(alkohol)}</td>
      <td>${printEscapeHtml_(ausbeute)}</td>
      <td>${printEscapeHtml_(wasser)}</td>
      <td class="qr-col">${rowQrHtml}</td>
    </tr>`;
  });

  html += `</tbody></table></div></body></html>`;
  return html;
}

// FUNKTION: Leeres Druck-HTML für WebApp-Rückgabe | EINGRIFF: HTML-Aufbau
function protokollLeerHtmlErstellen_(meldung) {
  return `<html><head><style>
    body { font-family: "Segoe UI", sans-serif; margin: 0; padding: 32px; background: #ffffff; color: #333333; }
    .msg { max-width: 720px; margin: 0 auto; border: 1px solid #d9d9d9; border-radius: 12px; padding: 24px; text-align: center; font-size: 18px; font-weight: 600; }
  </style></head><body><div class="msg">${printEscapeHtml_(meldung || 'Keine Daten vorhanden.')}</div></body></html>`;
}

// FUNKTION: ISO-Datum für Brandtag-Vergleich | EINGRIFF: Datumsnormalisierung
function protokollDatumAlsIsoString_(wert) {
  if (!wert) return '';

  if (wert instanceof Date) {
    return Utilities.formatDate(
      wert,
      KONFIGURATION.ZOLL_PARAMETER.ZEIT_PARAMETER.ZEITZONE,
      'yyyy-MM-dd'
    );
  }

  const text = String(wert || '').trim();
  if (!text) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const match = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (match) {
    return match[3] + '-' + match[2] + '-' + match[1];
  }

  return '';
}
