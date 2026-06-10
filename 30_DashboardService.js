/**
 * DATEI: 30_DashboardService.gs
 * ZWECK: Erstellt ein farbiges Dashboard-Blatt im Stil eines Management-Dashboards.
 * DATENQUELLE: vorhandene Jahresarchiv-Blätter.
 * SCHREIBT NUR: Dashboard-Blatt 📊_DASHBOARD_JAHRESARCHIV
 * KEINE zusätzlichen Rohstofflisten, keine manuelle Datenpflege, keine Änderung an Archivlogik.
 *
 * Bedienung:
 * 1. Funktion jahresarchivDashboardErstellen() ausführen.
 * 2. Im Dashboard können Materialgruppen über die Zeilengruppierung links aufgeklappt werden.
 * 3. Bei neuen Archivdaten Funktion erneut ausführen.
 */

const DASHBOARD_JA_BLAETTER_NAME = '📊_DASHBOARD_JAHRESARCHIV';
const DASHBOARD_JA_OGV_NAME = 'Obst- und Gartenbauverein Breitfurt';

function jahresarchivDashboardErstellen() {
  const ss = SpreadsheetApp.getActive();
  const dashboard = dashboardBlattNeuAufbauen_(ss, DASHBOARD_JA_BLAETTER_NAME);
  const daten = dashboardJahresarchivDatenSammeln_(ss);
  const auswertung = dashboardJahresarchivAggregieren_(daten);

  dashboard.getCharts().forEach(function(chart) {
    dashboard.removeChart(chart);
  });

  dashboardDesignLayoutSchreiben_(dashboard, auswertung);
  dashboardDesignChartsErstellen_(dashboard, auswertung);

  // Fixierung deaktiviert: verbundene Dashboard-Zellen verursachen sonst Google-Sheets-Fehler.
  // Keine Spalten fixieren: Im Kopfbereich sind Zellen über mehrere Spalten verbunden.
  // Google Sheets wirft sonst: "Sie können keine Spalten fixieren, die nur Teile von verbundenen Zellen enthalten."
  // Fixierung deaktiviert: verbundene Dashboard-Zellen verursachen sonst Google-Sheets-Fehler.
  dashboard.activate();
  SpreadsheetApp.flush();

  return {
    ok: true,
    dashboard: DASHBOARD_JA_BLAETTER_NAME,
    archivZeilen: daten.length,
    jahre: auswertung.jahre,
    materialien: auswertung.materialRows.length
  };
}

function dashboardMenuEinrichten_() {
  SpreadsheetApp.getUi()
    .createMenu('OGV Dashboard')
    .addItem('Jahresarchiv-Dashboard aktualisieren', 'jahresarchivDashboardErstellen')
    .addToUi();
}

function dashboardBlattNeuAufbauen_(ss, name) {
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
  }

  // Vor dem Neuaufbau alte Fixierungen und verbundene Zellen sauber entfernen.
  // Sonst können alte Merge-Zellen mit neuer Spaltenfixierung kollidieren.
  // Fixierung deaktiviert: verbundene Dashboard-Zellen verursachen sonst Google-Sheets-Fehler.
  // Fixierung deaktiviert: verbundene Dashboard-Zellen verursachen sonst Google-Sheets-Fehler.
  try { sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart(); } catch (mergeErr) {}

  sh.clear();
  sh.clearFormats();
  sh.clearConditionalFormatRules();

  sh.getCharts().forEach(function(chart) {
    sh.removeChart(chart);
  });

  try {
    const oldFilter = sh.getFilter();
    if (oldFilter) oldFilter.remove();
  } catch (err) {}

  // Alte Gruppierungen soweit möglich zurücksetzen.
  try {
    const maxRows = Math.max(sh.getMaxRows(), 200);
    sh.showRows(1, maxRows);
    for (let i = 0; i < 8; i++) {
      sh.getRange(1, 1, maxRows, 1).shiftRowGroupDepth(-1);
    }
  } catch (err2) {}

  sh.setHiddenGridlines(true);
  return sh;
}

function dashboardJahresarchivDatenSammeln_(ss) {
  const blaetter = ss.getSheets().filter(function(sh) {
    const n = dashboardNorm_(sh.getName());
    return n.indexOf('jahresarchiv') !== -1 && sh.getName() !== DASHBOARD_JA_BLAETTER_NAME;
  });

  const result = [];

  blaetter.forEach(function(sh) {
    const lastRow = sh.getLastRow();
    const lastCol = sh.getLastColumn();
    if (lastRow < 2 || lastCol < 1) return;

    const header = sh.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
    const values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
    const display = sh.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues();
    const c = dashboardArchivSpaltenFinden_(header);
    const jahrAusBlatt = dashboardJahrAusText_(sh.getName());

    values.forEach(function(row, i) {
      const displayRow = display[i];
      const stoffbesitzer = dashboardText_(dashboardWert_(row, displayRow, c.stoffbesitzer));
      const material = dashboardText_(dashboardWert_(row, displayRow, c.material));
      const brandtag = dashboardText_(dashboardWert_(row, displayRow, c.brandtag));
      const registernummer = dashboardText_(dashboardWert_(row, displayRow, c.registernummer));
      const jahr = dashboardJahrAusText_(brandtag) || jahrAusBlatt || 'ohne Jahr';
      const ausbeute = dashboardZahl_(dashboardWert_(row, displayRow, c.ausbeute));
      const literGefuellt = dashboardZahl_(dashboardWert_(row, displayRow, c.literGefuellt));

      if (!stoffbesitzer && !material && !ausbeute && !literGefuellt) return;

      result.push({
        jahr: jahr,
        archivblatt: sh.getName(),
        stoffbesitzer: stoffbesitzer || 'ohne Stoffbesitzer',
        kategorie: dashboardIstEigeneHerstellung_(stoffbesitzer) ? 'Eigene Herstellung' : 'Stoffbesitzer',
        registernummer: registernummer,
        brandtag: brandtag,
        material: material || 'ohne Material',
        ausbeute: ausbeute,
        literGefuellt: literGefuellt
      });
    });
  });

  return result;
}

function dashboardJahresarchivAggregieren_(daten) {
  const jahreMap = {};
  const materialMap = {};
  const jahrMap = {};
  const kategorieMap = {
    'Eigene Herstellung': { liter: 0, ausbeute: 0, anzahl: 0 },
    'Stoffbesitzer': { liter: 0, ausbeute: 0, anzahl: 0 }
  };

  let gesamtLiter = 0;
  let gesamtAusbeute = 0;
  let anzahlBraende = 0;

  daten.forEach(function(d) {
    const jahr = d.jahr || 'ohne Jahr';
    const material = d.material || 'ohne Material';
    const istEigen = d.kategorie === 'Eigene Herstellung';

    jahreMap[jahr] = true;
    gesamtLiter += d.literGefuellt;
    gesamtAusbeute += d.ausbeute;
    anzahlBraende += 1;

    if (!kategorieMap[d.kategorie]) kategorieMap[d.kategorie] = { liter: 0, ausbeute: 0, anzahl: 0 };
    kategorieMap[d.kategorie].liter += d.literGefuellt;
    kategorieMap[d.kategorie].ausbeute += d.ausbeute;
    kategorieMap[d.kategorie].anzahl += 1;

    if (!materialMap[material]) {
      materialMap[material] = {
        material: material,
        eigenLiter: 0,
        stoffLiter: 0,
        gesamtLiter: 0,
        eigenAusbeute: 0,
        stoffAusbeute: 0,
        gesamtAusbeute: 0,
        anzahl: 0,
        details: []
      };
    }

    if (istEigen) {
      materialMap[material].eigenLiter += d.literGefuellt;
      materialMap[material].eigenAusbeute += d.ausbeute;
    } else {
      materialMap[material].stoffLiter += d.literGefuellt;
      materialMap[material].stoffAusbeute += d.ausbeute;
    }
    materialMap[material].gesamtLiter += d.literGefuellt;
    materialMap[material].gesamtAusbeute += d.ausbeute;
    materialMap[material].anzahl += 1;
    materialMap[material].details.push(d);

    if (!jahrMap[jahr]) {
      jahrMap[jahr] = { jahr: jahr, eigenLiter: 0, stoffLiter: 0, gesamtLiter: 0, ausbeute: 0, anzahl: 0 };
    }
    if (istEigen) jahrMap[jahr].eigenLiter += d.literGefuellt;
    else jahrMap[jahr].stoffLiter += d.literGefuellt;
    jahrMap[jahr].gesamtLiter += d.literGefuellt;
    jahrMap[jahr].ausbeute += d.ausbeute;
    jahrMap[jahr].anzahl += 1;
  });

  const materialRows = Object.keys(materialMap).map(function(k) {
    materialMap[k].details.sort(function(a, b) {
      return String(b.jahr).localeCompare(String(a.jahr), 'de') || String(b.brandtag).localeCompare(String(a.brandtag), 'de');
    });
    return materialMap[k];
  }).sort(function(a, b) {
    return b.gesamtLiter - a.gesamtLiter || a.material.localeCompare(b.material, 'de');
  });

  const jahrRows = Object.keys(jahrMap).map(function(k) { return jahrMap[k]; })
    .sort(function(a, b) { return String(a.jahr).localeCompare(String(b.jahr), 'de'); });

  const jahre = Object.keys(jahreMap).sort(function(a, b) { return String(b).localeCompare(String(a), 'de'); });

  return {
    stand: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm'),
    jahre: jahre,
    gesamtLiter: gesamtLiter,
    gesamtAusbeute: gesamtAusbeute,
    anzahlBraende: anzahlBraende,
    kategorieMap: kategorieMap,
    materialRows: materialRows,
    jahrRows: jahrRows,
    detailRows: daten.sort(function(a, b) {
      return String(b.jahr).localeCompare(String(a.jahr), 'de') || String(b.brandtag).localeCompare(String(a.brandtag), 'de');
    })
  };
}


function dashboardDesignLayoutSchreiben_(sh, a) {
  const navy = '#071B4D';
  const navy2 = '#0B2E6D';
  const blue = '#0069FF';
  const aqua = '#00C2FF';
  const teal = '#00B8A9';
  const green = '#10B981';
  const pink = '#FF4D8D';
  const violet = '#7C3AED';
  const orange = '#FFB000';
  const lime = '#84CC16';
  const bg = '#EAF2FF';
  const panel = '#FFFFFF';
  const line = '#D7E3F3';
  const darkText = '#102033';

  sh.setTabColor(blue);
  sh.setHiddenGridlines(true);
  sh.setColumnWidths(1, 11, 118);
  sh.setColumnWidth(1, 150);
  sh.setColumnWidth(11, 140);
  sh.setRowHeights(1, 4, 28);
  sh.setRowHeights(5, 6, 34);
  sh.setRowHeights(12, 16, 24);
  sh.getRange('A1:K140').setBackground(bg).setFontFamily('Arial').setVerticalAlignment('middle');

  // Dunkler Kopfbereich mit Tab-Optik.
  sh.getRange('A1:K4').setBackground(navy).setFontColor('#FFFFFF');
  sh.getRange('A1:D2').merge().setValue('OGV BREITFURT\nBrennerei Dashboard')
    .setFontSize(17).setFontWeight('bold').setWrap(true).setHorizontalAlignment('left');
  dashboardPill_(sh.getRange('E1:F1'), 'Overview', '#274C9B');
  dashboardPill_(sh.getRange('G1:H1'), 'Analytics', navy2);
  dashboardPill_(sh.getRange('I1:K1'), 'Jahresarchiv', blue);
  sh.getRange('E2:K2').merge().setValue('Live-Auswertung aus vorhandenen Jahresarchiven · keine manuelle Rohstoffliste')
    .setFontSize(10).setFontColor('#CFE3FF').setHorizontalAlignment('right');
  sh.getRange('A3:K4').merge().setValue('Eigene Herstellung = ' + DASHBOARD_JA_OGV_NAME + ' · Aktualisiert: ' + a.stand)
    .setFontSize(10).setFontColor('#E6F0FF').setHorizontalAlignment('left');

  const kEigen = a.kategorieMap['Eigene Herstellung'] || { liter: 0, ausbeute: 0, anzahl: 0 };
  const kStoff = a.kategorieMap['Stoffbesitzer'] || { liter: 0, ausbeute: 0, anzahl: 0 };
  const quote = a.gesamtAusbeute ? (a.gesamtLiter / a.gesamtAusbeute) : 0;

  dashboardPremiumKpiKarte_(sh, 'A6:B10', 'Gesamt Liter', a.gesamtLiter, 'Liter gefüllt', '#5B4BEA', '#3D2FBB');
  dashboardPremiumKpiKarte_(sh, 'C6:D10', 'Ausbeute', a.gesamtAusbeute, 'Liter Ausbeute', '#0066B3', '#004D8A');
  dashboardPremiumKpiKarte_(sh, 'E6:F10', 'Eigene Herstellung', kEigen.liter, 'OGV Breitfurt', '#00A6D6', '#007CA0');
  dashboardPremiumKpiKarte_(sh, 'G6:H10', 'Stoffbesitzer', kStoff.liter, 'Fremdbrände', '#12B886', '#0B8F68');
  dashboardPremiumKpiKarte_(sh, 'I6:J10', 'Brände', a.anzahlBraende, 'Anzahl Vorgänge', '#EF476F', '#C62853');
  dashboardPremiumKpiKarte_(sh, 'K6:K10', 'Quote', quote, 'Liter/Ausbeute', '#7C3AED', '#5B21B6');

  // Chart-Datenquellen in den sichtbaren Bereichen, Charts liegen optisch darüber.
  const topMaterial = a.materialRows.slice(0, 12);
  const materialChartStart = 13;
  sh.getRange('A12:D12').merge().setValue('Liter je Material')
    .setBackground('#FFFFFF').setFontColor(darkText).setFontWeight('bold').setHorizontalAlignment('left');
  sh.getRange(materialChartStart, 1, 1, 4).setValues([['Material', 'Eigene Herstellung Liter', 'Stoffbesitzer Liter', 'Gesamt Liter']]);
  if (topMaterial.length) {
    sh.getRange(materialChartStart + 1, 1, topMaterial.length, 4).setValues(topMaterial.map(function(r) {
      return [r.material, r.eigenLiter, r.stoffLiter, r.gesamtLiter];
    }));
  }
  dashboardHeaderPremium_(sh.getRange(materialChartStart, 1, 1, 4));
  if (topMaterial.length) sh.getRange(materialChartStart + 1, 2, topMaterial.length, 3).setNumberFormat('0.00');
  dashboardPanel_(sh.getRange('A12:D27'));

  const ausbeuteChartStart = 13;
  sh.getRange('E12:G12').merge().setValue('Ausbeute Top 12')
    .setBackground('#FFFFFF').setFontColor(darkText).setFontWeight('bold').setHorizontalAlignment('left');
  sh.getRange(ausbeuteChartStart, 5, 1, 2).setValues([['Material', 'Ausbeute']]);
  if (topMaterial.length) {
    sh.getRange(ausbeuteChartStart + 1, 5, topMaterial.length, 2).setValues(topMaterial.map(function(r) {
      return [r.material, r.gesamtAusbeute];
    }));
  }
  dashboardHeaderPremium_(sh.getRange(ausbeuteChartStart, 5, 1, 2));
  if (topMaterial.length) sh.getRange(ausbeuteChartStart + 1, 6, topMaterial.length, 1).setNumberFormat('0.00');
  dashboardPanel_(sh.getRange('E12:G27'));

  const katStart = 13;
  sh.getRange('H12:K12').merge().setValue('Eigene Herstellung vs Stoffbesitzer')
    .setBackground('#FFFFFF').setFontColor(darkText).setFontWeight('bold').setHorizontalAlignment('left');
  sh.getRange(katStart, 8, 1, 3).setValues([['Kategorie', 'Liter', 'Ausbeute']]);
  sh.getRange(katStart + 1, 8, 2, 3).setValues([
    ['Eigene Herstellung', kEigen.liter, kEigen.ausbeute],
    ['Stoffbesitzer', kStoff.liter, kStoff.ausbeute]
  ]);
  dashboardHeaderPremium_(sh.getRange(katStart, 8, 1, 3));
  sh.getRange(katStart + 1, 9, 2, 2).setNumberFormat('0.00');
  dashboardPanel_(sh.getRange('H12:K27'));

  const jahrStart = 31;
  sh.getRange('A29:F29').merge().setValue('Jahresentwicklung')
    .setBackground(navy2).setFontColor('#FFFFFF').setFontWeight('bold');
  sh.getRange(jahrStart, 1, 1, 6).setValues([['Jahr', 'Eigene Herstellung Liter', 'Stoffbesitzer Liter', 'Gesamt Liter', 'Ausbeute', 'Anzahl Brände']]);
  if (a.jahrRows.length) {
    sh.getRange(jahrStart + 1, 1, a.jahrRows.length, 6).setValues(a.jahrRows.map(function(r) {
      return [r.jahr, r.eigenLiter, r.stoffLiter, r.gesamtLiter, r.ausbeute, r.anzahl];
    }));
  }
  dashboardHeaderPremium_(sh.getRange(jahrStart, 1, 1, 6));
  if (a.jahrRows.length) sh.getRange(jahrStart + 1, 2, a.jahrRows.length, 4).setNumberFormat('0.00');
  dashboardPanel_(sh.getRange('A29:F38'));

  // Kompakte Rohstoff-Tabelle rechts mit Heatmap-Farben.
  sh.getRange('H29:K29').merge().setValue('Top-Materialien')
    .setBackground(navy2).setFontColor('#FFFFFF').setFontWeight('bold');
  sh.getRange(31, 8, 1, 4).setValues([['Material', 'Eigene L', 'Stoffbesitzer L', 'Gesamt L']]);
  dashboardHeaderPremium_(sh.getRange(31, 8, 1, 4));
  if (topMaterial.length) {
    sh.getRange(32, 8, topMaterial.length, 4).setValues(topMaterial.map(function(r) {
      return [r.material, r.eigenLiter, r.stoffLiter, r.gesamtLiter];
    }));
    sh.getRange(32, 9, topMaterial.length, 3).setNumberFormat('0.00');
    dashboardHeatRows_(sh, 32, topMaterial.length, 8, 4, [blue, aqua, green, orange, pink, violet]);
  }
  dashboardPanel_(sh.getRange('H29:K44'));

  // Aufklappbare Materialliste mit stärkerer Card-Optik.
  const matStart = 48;
  sh.getRange('A46:K46').merge().setValue('Materialien aufklappen · Detailnachweis je Rohstoff')
    .setBackground('#111827').setFontColor('#FFFFFF').setFontWeight('bold').setFontSize(12);
  sh.getRange(matStart, 1, 1, 10).setValues([['Material', 'Eigene Herstellung Liter', 'Stoffbesitzer Liter', 'Gesamt Liter', 'Eigene Herstellung Ausbeute', 'Stoffbesitzer Ausbeute', 'Gesamt Ausbeute', 'Anzahl Brände', 'Status', 'Archiv']]);
  dashboardHeaderPremium_(sh.getRange(matStart, 1, 1, 10));

  let row = matStart + 1;
  const palette = ['#DBEAFE', '#CCFBF1', '#DCFCE7', '#FEF3C7', '#FCE7F3', '#EDE9FE'];
  a.materialRows.forEach(function(m, idx) {
    const cardColor = palette[idx % palette.length];
    const accent = [blue, teal, green, orange, pink, violet][idx % 6];
    const summaryRow = row;
    sh.getRange(summaryRow, 1, 1, 10).setValues([[
      '▸ ' + m.material,
      m.eigenLiter,
      m.stoffLiter,
      m.gesamtLiter,
      m.eigenAusbeute,
      m.stoffAusbeute,
      m.gesamtAusbeute,
      m.anzahl,
      'aufklappbar',
      'Jahresarchiv'
    ]]);
    sh.getRange(summaryRow, 1, 1, 10)
      .setFontWeight('bold')
      .setFontColor('#0F172A')
      .setBackground(cardColor)
      .setBorder(true, true, true, true, true, true, '#FFFFFF', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    sh.getRange(summaryRow, 1).setBackground(accent).setFontColor('#FFFFFF');
    sh.getRange(summaryRow, 2, 1, 6).setNumberFormat('0.00');
    row++;

    const detailHeaderRow = row;
    sh.getRange(detailHeaderRow, 1, 1, 10).setValues([['', 'Jahr', 'Kategorie', 'Stoffbesitzer', 'Registernummer', 'Brandtag', 'Material', 'Ausbeute', 'Liter gefüllt', 'Archivblatt']]);
    sh.getRange(detailHeaderRow, 1, 1, 10)
      .setFontWeight('bold')
      .setFontSize(9)
      .setBackground('#F8FAFC')
      .setFontColor('#334155');
    row++;

    const detailStart = row;
    if (m.details.length) {
      sh.getRange(detailStart, 1, m.details.length, 10).setValues(m.details.map(function(d) {
        return ['', d.jahr, d.kategorie, d.stoffbesitzer, d.registernummer, d.brandtag, d.material, d.ausbeute, d.literGefuellt, d.archivblatt];
      }));
      sh.getRange(detailStart, 8, m.details.length, 2).setNumberFormat('0.00');
      sh.getRange(detailStart, 1, m.details.length, 10)
        .setFontSize(9)
        .setBackground('#FFFFFF')
        .setBorder(true, true, true, true, true, true, '#E5E7EB', SpreadsheetApp.BorderStyle.SOLID);
      row += m.details.length;
    }

    try {
      const groupStart = detailHeaderRow;
      const groupCount = Math.max(1, row - detailHeaderRow);
      sh.getRange(groupStart, 1, groupCount, 1).shiftRowGroupDepth(1);
      sh.getRowGroup(groupStart, 1).collapse();
    } catch (groupErr) {}
  });

  const last = Math.max(row + 3, 90);
  sh.getRange(1, 1, last, 11).setVerticalAlignment('middle');
  sh.getRange('A1:K' + last).setFontFamily('Arial');
  sh.getRange('A1:K' + last).setWrap(true);
  sh.getRange('A13:K44').setFontSize(9);
  sh.getRange('A46:K' + last).setFontSize(9);

  // Bedingte Farbskala für Gesamt Liter in Top-Materialien.
  try {
    const rules = sh.getConditionalFormatRules();
    if (topMaterial.length) {
      rules.push(SpreadsheetApp.newConditionalFormatRule()
        .setGradientMinpoint('#E0F2FE')
        .setGradientMidpointWithValue('#38BDF8', SpreadsheetApp.InterpolationType.PERCENTILE, '50')
        .setGradientMaxpoint('#0F766E')
        .setRanges([sh.getRange(32, 11, topMaterial.length, 1)])
        .build());
    }
    sh.setConditionalFormatRules(rules);
  } catch (cfErr) {}

  if (sh.getMaxColumns() > 11) sh.hideColumns(12, sh.getMaxColumns() - 11);
}

function dashboardPill_(range, text, color) {
  range.merge().setValue(text)
    .setBackground(color)
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setBorder(true, true, true, true, false, false, '#0B1220', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
}

function dashboardPremiumKpiKarte_(sh, a1Notation, titel, wert, untertitel, farbe, schatten) {
  const range = sh.getRange(a1Notation);
  range.merge();
  range.setBackground(farbe)
    .setFontColor('#FFFFFF')
    .setHorizontalAlignment('left')
    .setVerticalAlignment('middle')
    .setBorder(true, true, true, true, false, false, schatten, SpreadsheetApp.BorderStyle.SOLID_THICK);

  const valueText = dashboardFormatZahl_(wert);
  const text = titel + '\n' + valueText + '\n' + untertitel;
  const rich = SpreadsheetApp.newRichTextValue()
    .setText(text)
    .setTextStyle(0, titel.length, SpreadsheetApp.newTextStyle().setFontSize(9).setForegroundColor('#EAF2FF').setBold(true).build())
    .setTextStyle(titel.length + 1, titel.length + 1 + valueText.length, SpreadsheetApp.newTextStyle().setFontSize(22).setForegroundColor('#FFFFFF').setBold(true).build())
    .setTextStyle(titel.length + 2 + valueText.length, text.length, SpreadsheetApp.newTextStyle().setFontSize(8).setForegroundColor('#EAF2FF').setBold(false).build())
    .build();
  range.setRichTextValue(rich).setWrap(true);
}

function dashboardPanel_(range) {
  range.setBackground('#FFFFFF')
    .setBorder(true, true, true, true, false, false, '#CBD5E1', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
}

function dashboardHeatRows_(sh, startRow, numRows, startCol, numCols, colors) {
  for (let i = 0; i < numRows; i++) {
    const color = colors[i % colors.length];
    sh.getRange(startRow + i, startCol, 1, numCols)
      .setBackground(i % 2 === 0 ? '#FFFFFF' : '#F8FAFC')
      .setBorder(true, true, true, true, true, true, '#E5E7EB', SpreadsheetApp.BorderStyle.SOLID);
    sh.getRange(startRow + i, startCol).setBackground(color).setFontColor('#FFFFFF').setFontWeight('bold');
  }
}

function dashboardDesignChartsErstellen_(sh, a) {
  const materialRows = Math.min(a.materialRows.length, 12);
  const jahrRows = a.jahrRows.length;

  if (materialRows > 0) {
    const chart1 = sh.newChart()
      .setChartType(Charts.ChartType.AREA)
      .addRange(sh.getRange(13, 1, materialRows + 1, 4))
      .setPosition(12, 1, 10, 18)
      .setOption('title', 'Liter nach Material')
      .setOption('titleTextStyle', { color: '#102033', fontSize: 13, bold: true })
      .setOption('legend', { position: 'bottom', textStyle: { color: '#334155', fontSize: 9 } })
      .setOption('colors', ['#5B4BEA', '#00C2FF', '#10B981'])
      .setOption('backgroundColor', '#FFFFFF')
      .setOption('chartArea', { left: 48, top: 34, width: '72%', height: '58%' })
      .setOption('areaOpacity', 0.35)
      .setOption('lineWidth', 3)
      .setOption('height', 300)
      .setOption('width', 470)
      .build();
    sh.insertChart(chart1);

    const chart2 = sh.newChart()
      .setChartType(Charts.ChartType.COLUMN)
      .addRange(sh.getRange(13, 5, materialRows + 1, 2))
      .setPosition(12, 5, 10, 18)
      .setOption('title', 'Ausbeute nach Material')
      .setOption('titleTextStyle', { color: '#102033', fontSize: 13, bold: true })
      .setOption('legend', { position: 'none' })
      .setOption('colors', ['#FFB000'])
      .setOption('backgroundColor', '#FFFFFF')
      .setOption('chartArea', { left: 42, top: 34, width: '72%', height: '58%' })
      .setOption('height', 300)
      .setOption('width', 350)
      .build();
    sh.insertChart(chart2);
  }

  const chart3 = sh.newChart()
    .setChartType(Charts.ChartType.PIE)
    .addRange(sh.getRange(13, 8, 3, 2))
    .setPosition(12, 8, 10, 18)
    .setOption('title', 'Herstellungskategorie')
    .setOption('titleTextStyle', { color: '#102033', fontSize: 13, bold: true })
    .setOption('legend', { position: 'right', textStyle: { color: '#334155', fontSize: 9 } })
    .setOption('colors', ['#00C2FF', '#10B981'])
    .setOption('is3D', true)
    .setOption('pieHole', 0.35)
    .setOption('backgroundColor', '#FFFFFF')
    .setOption('height', 300)
    .setOption('width', 440)
    .build();
  sh.insertChart(chart3);

  if (jahrRows > 0) {
    const chart4 = sh.newChart()
      .setChartType(Charts.ChartType.COMBO)
      .addRange(sh.getRange(31, 1, jahrRows + 1, 4))
      .setPosition(29, 1, 10, 18)
      .setOption('title', 'Jahresentwicklung Liter')
      .setOption('titleTextStyle', { color: '#102033', fontSize: 13, bold: true })
      .setOption('legend', { position: 'bottom', textStyle: { color: '#334155', fontSize: 9 } })
      .setOption('colors', ['#5B4BEA', '#00C2FF', '#10B981'])
      .setOption('seriesType', 'bars')
      .setOption('series', { 2: { type: 'line', lineWidth: 4, pointSize: 6 } })
      .setOption('backgroundColor', '#FFFFFF')
      .setOption('chartArea', { left: 48, top: 34, width: '72%', height: '58%' })
      .setOption('height', 300)
      .setOption('width', 630)
      .build();
    sh.insertChart(chart4);
  }
}

function dashboardHeaderDunkel_(range) {
  dashboardHeaderPremium_(range);
}

function dashboardHeaderPremium_(range) {
  range.setFontWeight('bold')
    .setBackground('#071B4D')
    .setFontColor('#FFFFFF')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setBorder(true, true, true, true, true, true, '#1E3A8A', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
}

function dashboardArchivSpaltenFinden_(header) {
  return {
    stoffbesitzer: dashboardSpalteNachAlias_(header, ['Stoffbesitzer', 'STOFFBESITZER', 'Name', 'Kunde', 'KUNDE', 'Besitzer']),
    registernummer: dashboardSpalteNachAlias_(header, ['Registernummer', 'Registriernummer', 'Reg.Nr.', 'Reg Nr', 'REGISTERNUMMER', 'REG_NR']),
    brandtag: dashboardSpalteNachAlias_(header, ['Tag_Brand', 'Brandtag', 'Brand_Tag', 'Brenndatum', 'Datum_Brand', 'TAG_BRAND', 'BRANDTAG']),
    material: dashboardSpalteNachAlias_(header, ['Material', 'MATERIAL', 'Rohstoff', 'ROHSTOFF', 'Obstart', 'Sorte']),
    ausbeute: dashboardSpalteNachAlias_(header, ['Ausbeute', 'AUSBEUTE', 'Ausbeute Liter', 'Ausbeute_Liter', 'L_AUSBEUTE']),
    literGefuellt: dashboardSpalteNachAlias_(header, ['Liter gefüllt', 'Liter_gefuellt', 'Liter gefuellt', 'Abgefüllt', 'Abgefuellt', 'Menge gefüllt', 'Menge_gefuellt', 'Inhalt', 'INH_VP', 'LITER', 'L_GEFUELLT'])
  };
}

function dashboardSpalteNachAlias_(header, aliases) {
  const normAliases = aliases.map(dashboardNorm_);
  for (let i = 0; i < header.length; i++) {
    const h = dashboardNorm_(header[i]);
    if (normAliases.indexOf(h) !== -1) return i;
  }
  return -1;
}

function dashboardWert_(row, displayRow, index) {
  if (index == null || index < 0 || index >= row.length) return '';
  const value = row[index];
  if (value !== null && value !== undefined && value !== '') return value;
  return displayRow[index] || '';
}

function dashboardZahl_(wert) {
  if (typeof wert === 'number') return isNaN(wert) ? 0 : wert;
  let text = dashboardText_(wert);
  if (!text) return 0;
  text = text.replace(/liter/gi, '').replace(/l\b/gi, '').replace(/%/g, '').trim();
  text = text.replace(/\./g, '').replace(',', '.');
  const n = Number(text.replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function dashboardText_(wert) {
  if (wert === null || wert === undefined) return '';
  if (Object.prototype.toString.call(wert) === '[object Date]') {
    return Utilities.formatDate(wert, Session.getScriptTimeZone(), 'dd.MM.yyyy');
  }
  return String(wert).trim();
}

function dashboardNorm_(wert) {
  let text = dashboardText_(wert).toLowerCase();
  text = text.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
  text = text.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return text;
}

function dashboardJahrAusText_(text) {
  const m = String(text || '').match(/(20\d{2}|19\d{2})/);
  return m ? m[1] : '';
}

function dashboardIstEigeneHerstellung_(stoffbesitzer) {
  return dashboardNorm_(stoffbesitzer) === dashboardNorm_(DASHBOARD_JA_OGV_NAME);
}

function dashboardFormatZahl_(wert) {
  if (typeof wert !== 'number') return String(wert || '');
  return wert.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
