const { Writable } = require('node:stream');
const ExcelJS = require('exceljs');

jest.mock('../config/database', () => ({
  query: jest.fn(),
  transaction: jest.fn(),
  getClient: jest.fn(),
}));

jest.mock('../config/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
}));

jest.mock('../utils/audit', () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
  auditFromReq: jest.fn(() => ({ usuario_id: 1, ip: '127.0.0.1' })),
}));

const db = require('../config/database');
const { createWorkbook, styleDataRows, sendExcel } = require('../utils/excel');
const { exportPagosExcel } = require('../controllers/cuentasController');
const { exportArticulosExcel } = require('../controllers/inventarioController');
const { exportColaboradoresExcel } = require('../controllers/personalController');

class MockExcelResponse extends Writable {
  constructor() {
    super();
    this.chunks = [];
    this.headers = {};
    this.endCalled = false;
    this.status = jest.fn().mockReturnValue(this);
    this.json = jest.fn().mockReturnValue(this);
    this.finished = new Promise((resolve) => this.on('finish', resolve));
  }

  _write(chunk, _encoding, callback) {
    this.chunks.push(Buffer.from(chunk));
    callback();
  }

  setHeader(name, value) {
    this.headers[name] = value;
  }

  end(...args) {
    this.endCalled = true;
    return super.end(...args);
  }

  async toBuffer() {
    await this.finished;
    return Buffer.concat(this.chunks);
  }
}

const mockReq = ({ query = {}, body = {}, params = {}, user = { id: 1 } } = {}) => ({
  query,
  body,
  params,
  user,
  ip: '127.0.0.1',
  get: jest.fn().mockReturnValue('jest-agent'),
});

const loadWorkbookFromResponse = async (res) => {
  const buffer = await res.toBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
};

const headerValues = (worksheet) => worksheet.getRow(1).values.slice(1);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('excel utility', () => {
  test('createWorkbook creates a styled worksheet with configured columns', () => {
    const { workbook, worksheet } = createWorkbook('Prueba', [
      { header: 'Nombre', key: 'nombre', width: 30 },
      { header: 'Total', key: 'total', width: 14, numFmt: '$#,##0.00' },
    ]);

    expect(workbook.creator).toBe('WES Security');
    expect(worksheet.name).toBe('Prueba');
    expect(headerValues(worksheet)).toEqual(['Nombre', 'Total']);
    expect(worksheet.getColumn('nombre').width).toBe(30);
    expect(worksheet.getRow(1).getCell(1).font.bold).toBe(true);
    expect(worksheet.views[0]).toEqual(
      expect.objectContaining({ state: 'frozen', ySplit: 1, showGridLines: false })
    );
  });

  test('styleDataRows applies row styling without changing values', () => {
    const { worksheet } = createWorkbook('Datos', [
      { header: 'Texto', key: 'texto', width: 30 },
      { header: 'Valor', key: 'valor', width: 12 },
    ]);
    worksheet.addRow({ texto: 'Niño & Cía', valor: 125.75 });

    styleDataRows(worksheet);

    expect(worksheet.getRow(2).height).toBe(18);
    expect(worksheet.getCell('A2').value).toBe('Niño & Cía');
    expect(worksheet.getCell('B2').value).toBe(125.75);
    expect(worksheet.getCell('A2').border.top.style).toBe('thin');
  });

  test('sendExcel writes a real xlsx response with attachment headers', async () => {
    const { workbook, worksheet } = createWorkbook('Descarga', [
      { header: 'Cliente', key: 'cliente', width: 30 },
    ]);
    worksheet.addRow({ cliente: 'Compañía Ñandú' });
    const res = new MockExcelResponse();

    await sendExcel(workbook, res, 'clientes.xlsx');
    const parsedWorkbook = await loadWorkbookFromResponse(res);

    expect(res.headers['Content-Type']).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    expect(res.headers['Content-Disposition']).toBe('attachment; filename="clientes.xlsx"');
    expect(res.endCalled).toBe(true);
    expect(parsedWorkbook.getWorksheet('Descarga').getCell('A2').value).toBe('Compañía Ñandú');
  });
});

describe('excel export controllers', () => {
  test('exportPagosExcel generates pagos workbook with text, dates and numeric totals', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        {
          id: 44,
          fecha: '2024-02-03',
          cliente: 'Niño & Cía Seguridad',
          metodo_pago: 'Transferencia',
          notas: 'Pago parcial ñá #1, referencia A/B',
          total: '1234.56',
          facturas: '#1001 (700.00), #1002 (534.56)',
        },
      ],
      rowCount: 1,
    });
    const res = new MockExcelResponse();

    await exportPagosExcel(mockReq({ query: { metodo_pago: 'TRANSFERENCIA' } }), res);
    const workbook = await loadWorkbookFromResponse(res);
    const worksheet = workbook.getWorksheet('Pagos');

    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('FROM pagos p'), [
      'transferencia',
    ]);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.headers['Content-Disposition']).toBe('attachment; filename="pagos.xlsx"');
    expect(headerValues(worksheet)).toEqual([
      'Pago',
      'Fecha',
      'Cliente',
      'Método de pago',
      'Valor',
      'Facturas',
      'Notas',
    ]);
    expect(worksheet.getCell('A2').value).toBe(44);
    expect(worksheet.getCell('C2').value).toBe('Niño & Cía Seguridad');
    expect(worksheet.getCell('E2').value).toBe(1234.56);
    expect(worksheet.getCell('G2').value).toBe('Pago parcial ñá #1, referencia A/B');
  });

  test('exportArticulosExcel generates inventario workbook with nullable fields and accents', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        {
          tipo_articulo: 'equipo',
          nombre_articulo: 'Chaleco táctico ñandú edición larga',
          numero_serie: null,
          cantidad: 7,
          talla: 'M',
          marca: 'Marca Ñ',
          modelo: '',
          calibre: null,
          codigo_pantalla: 'CP-01',
          version: 'v2',
          fecha_caducidad: '2025-12-31',
          ubicacion_nombre: 'Bodega Central',
          estado_caducidad: 'vigente',
        },
      ],
      rowCount: 1,
    });
    const res = new MockExcelResponse();

    await exportArticulosExcel(mockReq({ query: { tipo: 'equipo', search: 'chaleco' } }), res);
    const workbook = await loadWorkbookFromResponse(res);
    const worksheet = workbook.getWorksheet('Inventario');

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('vista_inventario_alertas'),
      expect.any(Array)
    );
    expect(res.status).not.toHaveBeenCalled();
    expect(res.headers['Content-Disposition']).toBe('attachment; filename="inventario.xlsx"');
    expect(headerValues(worksheet)).toEqual([
      'Tipo',
      'Artículo',
      'Serie',
      'Cantidad',
      'Talla',
      'Marca',
      'Modelo',
      'Calibre',
      'Cód. Pantalla',
      'Versión',
      'Caducidad',
      'Ubicación',
      'Estado',
    ]);
    expect(worksheet.getCell('A2').value).toBe('Equipo');
    expect(worksheet.getCell('B2').value).toBe('Chaleco táctico ñandú edición larga');
    expect(worksheet.getCell('D2').value).toBe(7);
    expect(worksheet.getCell('F2').value).toBe('Marca Ñ');
    expect(worksheet.getCell('M2').value).toBe('Vigente');
  });

  test('exportColaboradoresExcel generates colaboradores workbook with salary formatting', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        {
          nombres_completos: 'María José Núñez',
          cedula: '0102030405',
          fecha_nacimiento: '1992-05-09',
          cargo: 'Supervisora de Operaciones',
          celular: '',
          banco: 'Banco Pichincha',
          numero_cuenta: null,
          sueldo: '789.45',
          estado: 'activo',
        },
      ],
      rowCount: 1,
    });
    const res = new MockExcelResponse();

    await exportColaboradoresExcel(
      mockReq({ query: { estado: 'activo', cargo: 'supervisora' } }),
      res
    );
    const workbook = await loadWorkbookFromResponse(res);
    const worksheet = workbook.getWorksheet('Colaboradores');

    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('FROM colaboradores'), [
      'activo',
      'supervisora',
    ]);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.headers['Content-Disposition']).toBe('attachment; filename="colaboradores.xlsx"');
    expect(headerValues(worksheet)).toEqual([
      'Nombres',
      'Cédula',
      'Fecha Nacimiento',
      'Cargo',
      'Celular',
      'Banco',
      'Cuenta',
      'Sueldo',
      'Estado',
    ]);
    expect(worksheet.getCell('A2').value).toBe('María José Núñez');
    expect(worksheet.getCell('F2').value).toBe('Banco Pichincha');
    expect(worksheet.getCell('H2').value).toBe(789.45);
    expect(worksheet.getCell('H2').numFmt).toBe('$#,##0.00');
  });
});
