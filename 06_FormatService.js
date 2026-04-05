/**
 * DATEI: 06_FORMATSERVICE.GS
 * FORMAT- UND ZEITFUNKTIONEN
 */

function formatForDateInput_(date) {
  if (!date || !(date instanceof Date)) {
    const tempDate = new Date(date);
    if (isNaN(tempDate.getTime())) return "";
    return Utilities.formatDate(tempDate, KONFIGURATION.ZOLL_PARAMETER.ZEIT_PARAMETER.ZEITZONE, "yyyy-MM-dd");
  }

  return Utilities.formatDate(date, KONFIGURATION.ZOLL_PARAMETER.ZEIT_PARAMETER.ZEITZONE, "yyyy-MM-dd");
}

function zeitZuMinuten_(zeitStr) {
  if (!zeitStr || String(zeitStr).indexOf(":") === -1) return 0;

  const teile = String(zeitStr).split(":");
  const stunden = parseInt(teile[0], 10);
  const minuten = parseInt(teile[1], 10);

  if (isNaN(stunden) || isNaN(minuten)) return 0;
  return (stunden * 60) + minuten;
}

function minutenZuZeit_(gesamtMinuten) {
  let minuten = Number(gesamtMinuten) || 0;
  minuten = ((minuten % 1440) + 1440) % 1440;

  const stunden = Math.floor(minuten / 60);
  const restMinuten = minuten % 60;

  const h = stunden < 10 ? "0" + stunden : String(stunden);
  const m = restMinuten < 10 ? "0" + restMinuten : String(restMinuten);

  return h + ":" + m;
}