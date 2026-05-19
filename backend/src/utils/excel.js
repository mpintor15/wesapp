const ExcelJS = require('exceljs');

// WES brand palette
const BRAND_RED    = 'FFE8201A';
const WHITE        = 'FFFFFFFF';
const ROW_ALT_FILL = 'FFFDF2F2'; // very light red tint for alternating rows
const BORDER_COLOR = 'FFE2E8F0';

const thinBorder = () => ({
  top:    { style: 'thin', color: { argb: BORDER_COLOR } },
  left:   { style: 'thin', color: { argb: BORDER_COLOR } },
  bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
  right:  { style: 'thin', color: { argb: BORDER_COLOR } },
});

/**
 * Creates a workbook with one styled worksheet.
 * columns: Array<{ header, key, width, numFmt? }>
 */
const createWorkbook = (sheetName, columns) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'WES Security';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(sheetName);
  worksheet.views = [{ state: 'frozen', ySplit: 1, showGridLines: false }];
  worksheet.columns = columns;

  const headerRow = worksheet.getRow(1);
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.font      = { bold: true, color: { argb: WHITE }, size: 10, name: 'Calibri' };
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_RED } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
    cell.border    = thinBorder();
  });

  return { workbook, worksheet };
};

/**
 * Applies alternating fill and borders to every data row (row 1 = header, skipped).
 */
const styleDataRows = (worksheet) => {
  const colCount = worksheet.columnCount;
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.height = 18;
    for (let c = 1; c <= colCount; c++) {
      const cell = row.getCell(c);
      if (rowNumber % 2 === 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ROW_ALT_FILL } };
      }
      cell.border    = thinBorder();
      cell.alignment = { ...cell.alignment, vertical: 'middle' };
    }
  });
};

/**
 * Sends the workbook as an xlsx attachment.
 */
const sendExcel = async (workbook, res, filename) => {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
};

module.exports = { createWorkbook, styleDataRows, sendExcel };
