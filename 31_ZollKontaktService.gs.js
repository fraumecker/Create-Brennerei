/**
 * DATEI: 31_ZollKontaktService.gs
 * ZWECK: Liefert die Zoll-Kontaktliste aus KONFIGURATION.ZOLL_KONTAKTLISTE an HTML-Seiten.
 * DATENQUELLE: KONFIGURATION.ZOLL_KONTAKTLISTE
 * WICHTIG: Ausgabe erfolgt im Kleinbuchstaben-Format für HTML/Leitstand.
 */

function getZollNotfallKontaktliste() {
  const quelle = KONFIGURATION.ZOLL_KONTAKTLISTE;

  if (!quelle) {
    return {
      fehler: 'KONFIGURATION.ZOLL_KONTAKTLISTE fehlt.',
      titel: 'Zoll-Kontaktliste',
      untertitel: '',
      stand: '',
      faxAlleStandorte: '',
      zentraleEmail: '',
      kontakte: []
    };
  }

  return {
    titel: quelle.TITEL || 'Zoll-Kontaktliste',
    untertitel: quelle.UNTERTITEL || '',
    stand: quelle.STAND || '',
    faxAlleStandorte: quelle.FAX_ALLE_STANDORTE || '',
    zentraleEmail: quelle.ZENTRALE_EMAIL || '',
    kontakte: Array.isArray(quelle.KONTAKTE)
      ? quelle.KONTAKTE.map(function(k) {
          return {
            name: k.NAME || '',
            dienstsitz: k.DIENSTSITZ || '',
            telefon: k.TELEFON || '',
            mobil: k.MOBIL || '',
            email: k.EMAIL || ''
          };
        })
      : []
  };
}