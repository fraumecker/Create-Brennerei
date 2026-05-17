/**
 * DATEI: 17_BENACHRICHTIGUNGSSERVICE.GS
 * STATUS: NEU
 * ZWECK: BRENNER-INFORMATION PER MAIL UND GOOGLE CHAT
 */

function aktiveBrennerInfoPerMailSenden() {
  const daten = benachrichtigungsDatenAusAktiverZeileHolen_();
  if (!daten) return;

  const empfaenger = brennerMailAdresseHolen_(daten.brenner);
  if (!empfaenger) {
    systemAlert_('FEHLER', 'Für den Brenner wurde keine E-Mail-Adresse gefunden.');
    return;
  }

  const betreff = '[OGV Brennerei] Vorabinfo ' + (daten.vId || '');
  const text = benachrichtigungsTextBauen_(daten);

  MailApp.sendEmail({
    to: empfaenger,
    subject: betreff,
    body: text
  });

  benachrichtigungsStatusMerken_(daten, 'MAIL an ' + empfaenger);
  systemAlert_('ERFOLG', 'E-Mail wurde an ' + empfaenger + ' gesendet.');
}


function aktiveBrennerInfoPerChatSenden() {
  const daten = benachrichtigungsDatenAusAktiverZeileHolen_();
  if (!daten) return;

  const webhookUrl = PropertiesService.getScriptProperties().getProperty('BRENNER_CHAT_WEBHOOK_URL');
  if (!webhookUrl) {
    systemAlert_('FEHLER', 'Script-Eigenschaft BRENNER_CHAT_WEBHOOK_URL fehlt.');
    return;
  }

  const text = benachrichtigungsTextBauen_(daten);

  const response = UrlFetchApp.fetch(webhookUrl, {
    method: 'post',
    contentType: 'application/json; charset=utf-8',
    payload: JSON.stringify({ text: text }),
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    systemAlert_('FEHLER', 'Chat-Versand fehlgeschlagen. HTTP-Code: ' + code);
    return;
  }

  benachrichtigungsStatusMerken_(daten, 'CHAT gesendet');
  systemAlert_('ERFOLG', 'Chat-Nachricht wurde gesendet.');
}


function aktiveBrennerInfoPerMailUndChatSenden() {
  const daten = benachrichtigungsDatenAusAktiverZeileHolen_();
  if (!daten) return;

  const empfaenger = brennerMailAdresseHolen_(daten.brenner);
  const webhookUrl = PropertiesService.getScriptProperties().getProperty('BRENNER_CHAT_WEBHOOK_URL');
  const text = benachrichtigungsTextBauen_(daten);

  let erfolgMail = false;
  let erfolgChat = false;

  if (empfaenger) {
    MailApp.sendEmail({
      to: empfaenger,
      subject: '[OGV Brennerei] Vorabinfo ' + (daten.vId || ''),
      body: text
    });
    erfolgMail = true;
  }

  if (webhookUrl) {
    const response = UrlFetchApp.fetch(webhookUrl, {
      method: 'post',
      contentType: 'application/json; charset=utf-8',
      payload: JSON.stringify({ text: text }),
      muteHttpExceptions: true
    });

    const code = response.getResponseCode();
    if (code >= 200 && code < 300) {
      erfolgChat = true;
    }
  }

  if (!erfolgMail && !erfolgChat) {
    systemAlert_('FEHLER', 'Weder Mail noch Chat konnten versendet werden.');
    return;
  }

  let statusText = '';
  if (erfolgMail && erfolgChat) {
    statusText = 'MAIL + CHAT gesendet';
  } else if (erfolgMail) {
    statusText = 'MAIL an ' + empfaenger;
  } else {
    statusText = 'CHAT gesendet';
  }

  benachrichtigungsStatusMerken_(daten, statusText);
  systemAlert_('ERFOLG', statusText);
}


function benachrichtigungsDatenAusAktiverZeileHolen_() {
  const kontext = aktiveMaischeannahmeZeileHolen_();
  if (!kontext) return null;

  const sh = kontext.blatt;
  const row = kontext.zeile;
  const sMap = kontext.sMap;

  const daten = {
    blatt: sh,
    zeile: row,
    sMap: sMap,
    vId: leseZellwertBenachrichtigung_(sh, row, sMap.VORGANGS_ID),
    stoffbesitzer: leseZellwertBenachrichtigung_(sh, row, sMap.STOFFBESITZER),
    status: leseZellwertBenachrichtigung_(sh, row, sMap.STATUS),
    tagBrand: leseZellwertBenachrichtigung_(sh, row, sMap.TAG_BRAND),
    terminMaische: leseZellwertBenachrichtigung_(sh, row, sMap.TERMIN_MAISCHE),
    brenner: leseZellwertBenachrichtigung_(sh, row, sMap.BRENNER),
    von: leseZellwertBenachrichtigung_(sh, row, sMap.VON),
    bis: leseZellwertBenachrichtigung_(sh, row, sMap.BIS),
    material: leseZellwertBenachrichtigung_(sh, row, sMap.MATERIAL),
    fassNr: leseZellwertBenachrichtigung_(sh, row, sMap.FASS_NR),
    fass: leseZellwertBenachrichtigung_(sh, row, sMap.FASS_VP),
    inhalt: leseZellwertBenachrichtigung_(sh, row, sMap.INH_VP),
    regNr: leseZellwertBenachrichtigung_(sh, row, sMap.REGISTERNUMMER),
    dossierLink: leseZellwertBenachrichtigung_(sh, row, sMap.DOSSIER_LINK),
    infoSystem: leseZellwertBenachrichtigung_(sh, row, sMap.INFO_SYSTEM)
  };

  if (!daten.stoffbesitzer) {
    systemAlert_('FEHLER', 'Stoffbesitzer ist leer.');
    return null;
  }

  return daten;
}


function leseZellwertBenachrichtigung_(blatt, zeile, spalte) {
  if (!spalte) return '';
  return textNormalisieren_(blatt.getRange(zeile, spalte).getDisplayValue());
}


function benachrichtigungsTextBauen_(daten) {
  const teile = [];

  teile.push('OGV BREITFURT - BRENNERINFO');
  teile.push('');
  teile.push('Vorgangs-ID: ' + (daten.vId || '-'));
  teile.push('Stoffbesitzer: ' + (daten.stoffbesitzer || '-'));
  teile.push('Brenner: ' + (daten.brenner || '-'));
  teile.push('Status: ' + (daten.status || '-'));
  teile.push('Tag Brand: ' + (daten.tagBrand || '-'));
  teile.push('Termin Maische: ' + (daten.terminMaische || '-'));
  teile.push('Von: ' + (daten.von || '-'));
  teile.push('Bis: ' + (daten.bis || '-'));
  teile.push('Material: ' + (daten.material || '-'));
  teile.push('Fassnummer: ' + (daten.fassNr || '-'));
  teile.push('Faßgröße: ' + (daten.fass || '-'));
  teile.push('Inhalt: ' + (daten.inhalt || '-'));
  teile.push('Registernummer: ' + (daten.regNr || '-'));
  teile.push('');
  teile.push('Dossier: ' + (daten.dossierLink || '-'));
  teile.push('');
  teile.push('Info_System: ' + (daten.infoSystem || '-'));

  return teile.join('\n');
}


function brennerMailAdresseHolen_(brennerName) {
  const suchName = textNormalisieren_(brennerName).toLowerCase();
  if (!suchName) return '';

  const sh = tabelleHolen_('MITGLIEDER');
  if (!sh || sh.getLastRow() < 2) return '';

  const header = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
  const daten = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getDisplayValues();

  const idxMail = header.indexOf('E-Mail');
  const idxNameAnzeige = header.indexOf('NameAnzeige');
  const idxName = header.indexOf('Name');
  const idxVorname = header.indexOf('Vorname');
  const idxNachname = header.indexOf('Nachname');

  if (idxMail === -1) return '';

  for (var i = 0; i < daten.length; i++) {
    const row = daten[i];

    const kandidaten = [];
    if (idxNameAnzeige > -1) kandidaten.push(textNormalisieren_(row[idxNameAnzeige]));
    if (idxName > -1) kandidaten.push(textNormalisieren_(row[idxName]));
    if (idxVorname > -1 || idxNachname > -1) {
      kandidaten.push(
        textNormalisieren_(
          ((idxVorname > -1 ? row[idxVorname] : '') + ' ' + (idxNachname > -1 ? row[idxNachname] : '')).trim()
        )
      );
    }

    const treffer = kandidaten.some(function(k) {
      return textNormalisieren_(k).toLowerCase() === suchName;
    });

    if (treffer) {
      return textNormalisieren_(row[idxMail]);
    }
  }

  return '';
}


function benachrichtigungsStatusMerken_(daten, kanalText) {
  if (!daten || !daten.blatt || !daten.sMap) return;

  const zeit = Utilities.formatDate(
    new Date(),
    KONFIGURATION.ZOLL_PARAMETER.ZEIT_PARAMETER.ZEITZONE,
    'dd.MM.yyyy HH:mm:ss'
  );

  const vId = daten.vId || '';
  const neu = '[' + zeit + '] ' + kanalText;
  const alt = daten.infoSystem || '';

  if (daten.sMap.INFO_SYSTEM) {
    daten.blatt.getRange(daten.zeile, daten.sMap.INFO_SYSTEM).setValue(alt ? (alt + ' | ' + neu) : neu);
  }

  systemLogSchreiben_('INFO', 'BenachrichtigungService', 'Brennerinfo versendet', vId, kanalText);
}