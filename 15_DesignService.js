/**
 * DATEI: 15_DESIGNSERVICE.GS
 * REPARATUR-VERSION: Kein Verschieben, kein autoResize!
 * Nur Farben, 3D-Kanten und moderne Schrift.
 */

function layoutModernisieren() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const blatt = ss.getActiveSheet();
  const name = blatt.getName().toUpperCase();
  const istMaische = (name.indexOf("MAISCHE") !== -1);
  
  const DESIGN = {
    BG: "#0d0d0d",
    ZEILE_HELL: "#252525",
    ZEILE_DUNKEL: "#1a1a1a",
    PINK: "#ff007f",
    CYAN: "#00f2ff",
    NEON_GRUEN: "#39ff14",
    BORDER_LIGHT: "#444444",
    FONT: "Trebuchet MS"
  };

  const akzent = istMaische ? DESIGN.CYAN : DESIGN.PINK;
  const letzteZeile = Math.max(blatt.getLastRow(), 50);
  const maxZeilen = Math.max(blatt.getMaxRows(), 1);
  const zielZeilen = Math.min(letzteZeile, maxZeilen);
  const letzteSpalte = Math.max(blatt.getLastColumn(), 1);

  // 1. NUR HINTERGRUND & SCHRIFT (Keine Breitenänderung!)
  const gesamtBereich = blatt.getRange(1, 1, blatt.getMaxRows(), blatt.getMaxColumns());
  gesamtBereich
    .setBackground(DESIGN.BG)
    .setFontFamily(DESIGN.FONT)
    .setFontColor("#e0e0e0")
    .setVerticalAlignment("middle");

 // FUNKTION: Ermittelt die maximale physische Zeilenanzahl | EINGRIFF: Tabellenstruktur
const anzahlZeilen = blatt.getMaxRows();
// FUNKTION: Setzt die Zeilenhöhe limitiert auf das physische Maximum | EINGRIFF: Layout-Rendering
blatt.setRowHeights(1, Math.min(letzteZeile, anzahlZeilen), 42);

  // 3. HEADER (3D-LOOK OHNE TEXT-ÄNDERUNG)
  const header = blatt.getRange(1, 1, 1, letzteSpalte);
  header
    .setBackground("#000000")
    .setFontColor(akzent)
    .setFontWeight("bold")
    .setFontSize(11)
    .setHorizontalAlignment("center")
    .setBorder(null, null, true, null, null, null, akzent, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  // 4. DATEN-ZEILEN (3D-STRUKTUR)
  if (zielZeilen > 1) {
    for (let i = 2; i <= zielZeilen; i++) {
      let r = blatt.getRange(i, 1, 1, letzteSpalte);
      let bg = (i % 2 === 0) ? DESIGN.ZEILE_HELL : DESIGN.ZEILE_DUNKEL;
      
      r.setBackground(bg).setFontSize(10).setFontColor("#ffffff");
      r.setBorder(true, null, false, null, null, null, DESIGN.BORDER_LIGHT, SpreadsheetApp.BorderStyle.SOLID);
    }

    // 5. NEON-HIGHLIGHTS (Vorgangs_ID)
    try {
      const sMap = spaltenZuordnungHolen_(blatt);
      if (sMap.VORGANGS_ID) {
        blatt.getRange(2, sMap.VORGANGS_ID, zielZeilen - 1, 1)
             .setFontColor(DESIGN.NEON_GRUEN)
             .setFontWeight("bold");
      }
    } catch (e) {}
  }

  blatt.setHiddenGridlines(true);
  SpreadsheetApp.getUi().alert("🎨 DESIGN FIX: Struktur erhalten, Look modernisiert.");
}