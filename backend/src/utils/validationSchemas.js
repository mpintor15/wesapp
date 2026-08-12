const { z } = require('zod');
const {
  isValidDateString,
  parseStrictPositiveInteger,
  parseStrictPositiveNumber,
} = require('./inputValidation');

const emptyToUndefined = (value) => (value === '' ? undefined : value);
const trimmedString = (max, label) =>
  z.string().trim().max(max, `${label} no puede exceder ${max} caracteres`);
const optionalTrimmedString = (max, label) =>
  z.preprocess(emptyToUndefined, trimmedString(max, label).optional());
const requiredTrimmedString = (max, label) =>
  trimmedString(max, label).min(1, `${label} no puede estar vacío`);
const positiveInt = (label) =>
  z
    .union([z.string(), z.number()], { required_error: `${label} es requerido` })
    .refine((value) => parseStrictPositiveInteger(value, `${label} debe ser positivo`).valid, {
      message: `${label} debe ser un entero positivo`,
    })
    .transform((value) => parseStrictPositiveInteger(value, `${label} debe ser positivo`).value);
const positiveNumber = (label) =>
  z
    .union([z.string(), z.number()], { required_error: `${label} es requerido` })
    .refine((value) => parseStrictPositiveNumber(value, `${label} debe ser positivo`).valid, {
      message: `${label} debe ser positivo`,
    })
    .transform((value) => parseStrictPositiveNumber(value, `${label} debe ser positivo`).value);
const optionalPositiveNumber = (label) =>
  z.preprocess(
    emptyToUndefined,
    z
      .union([z.string(), z.number()], { required_error: `${label} es requerido` })
      .refine((value) => parseStrictPositiveNumber(value, `${label} debe ser positivo`).valid, {
        message: `${label} debe ser positivo`,
      })
      .transform((value) => parseStrictPositiveNumber(value, `${label} debe ser positivo`).value)
      .optional()
  );
const dateString = (label) =>
  z
    .string({ required_error: `${label} es requerida` })
    .regex(/^\d{4}-\d{2}-\d{2}$/, `${label} debe tener formato YYYY-MM-DD`)
    .refine(isValidDateString, `${label} debe ser una fecha real`);
const optionalDateString = (label) => z.preprocess(emptyToUndefined, dateString(label).optional());
const booleanFromForm = z.preprocess((value) => {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  if (value === '1') {
    return true;
  }
  if (value === '0') {
    return false;
  }
  return value;
}, z.boolean());
const optionalBooleanFromForm = z.preprocess(emptyToUndefined, booleanFromForm.optional());

// ============================================
// AUTH SCHEMAS
// ============================================

const loginSchema = z.object({
  usuario: z
    .string({ required_error: 'Usuario es requerido' })
    .min(3, 'Usuario debe tener al menos 3 caracteres')
    .max(50, 'Usuario no puede exceder 50 caracteres'),
  password: z
    .string({ required_error: 'Contraseña es requerida' })
    .min(1, 'Contraseña no puede estar vacía'),
});

const changePasswordSchema = z
  .object({
    nueva_password: z
      .string({ required_error: 'Nueva contraseña es requerida' })
      .min(8, 'Nueva contraseña debe tener al menos 8 caracteres'),
    confirmar_password: z
      .string({ required_error: 'Confirmación de contraseña es requerida' })
      .min(8, 'Confirmación debe tener al menos 8 caracteres'),
  })
  .refine((data) => data.nueva_password === data.confirmar_password, {
    path: ['confirmar_password'],
    message: 'Las contraseñas no coinciden',
  });

// ============================================
// USUARIOS SCHEMAS
// ============================================

const ALLOWED_ROLES = ['gerente', 'secretario', 'supervisor', 'contador', 'guardia', 'monitorista'];

const usuarioCreateSchema = z.object({
  usuario: z
    .string({ required_error: 'Usuario es requerido' })
    .min(3, 'Usuario debe tener al menos 3 caracteres')
    .max(50, 'Usuario no puede exceder 50 caracteres'),
  nombre: z
    .string({ required_error: 'Nombre es requerido' })
    .min(1, 'Nombre no puede estar vacío')
    .max(100, 'Nombre no puede exceder 100 caracteres'),
  apellido: z
    .string({ required_error: 'Apellido es requerido' })
    .min(1, 'Apellido no puede estar vacío')
    .max(100, 'Apellido no puede exceder 100 caracteres'),
  tipo_usuario: z.enum(ALLOWED_ROLES, {
    errorMap: () => ({ message: `Tipo debe ser uno de: ${ALLOWED_ROLES.join(', ')}` }),
  }),
  colaborador_id: positiveInt('Colaborador ID'),
  ubicacion_ids: z.array(positiveInt('Ubicación ID')).optional(),
});

const usuarioUpdateSchema = z.object({
  nombre: z
    .string()
    .min(1, 'Nombre no puede estar vacío')
    .max(100, 'Nombre no puede exceder 100 caracteres')
    .optional(),
  apellido: z
    .string()
    .min(1, 'Apellido no puede estar vacío')
    .max(100, 'Apellido no puede exceder 100 caracteres')
    .optional(),
  tipo_usuario: z
    .enum(ALLOWED_ROLES, {
      errorMap: () => ({ message: `Tipo debe ser uno de: ${ALLOWED_ROLES.join(', ')}` }),
    })
    .optional(),
  activo: z.boolean().optional(),
  colaborador_id: positiveInt('Colaborador ID').optional(),
  ubicacion_ids: z.array(positiveInt('Ubicación ID')).optional(),
});

// ============================================
// CLIENTES SCHEMAS
// ============================================

const clienteCreateSchema = z.object({
  nombre: z
    .string({ required_error: 'Nombre es requerido' })
    .min(1, 'Nombre no puede estar vacío')
    .max(255, 'Nombre no puede exceder 255 caracteres'),
  identificacion: z
    .string({ required_error: 'Identificación es requerida' })
    .min(5, 'Identificación debe tener al menos 5 caracteres')
    .max(50, 'Identificación no puede exceder 50 caracteres'),
});

// ============================================
// FACTURAS SCHEMAS
// ============================================

const facturaCreateSchema = z.object({
  num_factura: positiveInt('Número de factura'),
  cliente_id: positiveInt('Cliente ID'),
  fecha_factura: dateString('Fecha de factura'),
  valor_factura: positiveNumber('Valor de factura'),
  incluye_iva: optionalBooleanFromForm.default(false),
  incluye_retencion_fuente: optionalBooleanFromForm.default(false),
  incluye_retencion_iva: optionalBooleanFromForm.default(false),
});

const facturaUpdateSchema = facturaCreateSchema.omit({ num_factura: true });

const facturaCancelSchema = z.object({
  detalle_anulacion: requiredTrimmedString(500, 'Detalle de anulación'),
});

// ============================================
// PAGOS SCHEMAS
// ============================================

const pagoCreateSchema = z.object({
  cliente_id: positiveInt('Cliente ID'),
  fecha: dateString('Fecha del pago'),
  metodo_pago: z.enum(['efectivo', 'transferencia', 'cheque', 'otro']).optional().nullable(),
  referencia: optionalTrimmedString(100, 'Referencia').nullable(),
  notas: optionalTrimmedString(500, 'Notas').nullable(),
  abonos: z
    .array(
      z.object({
        num_factura: positiveInt('Número de factura'),
        valor_abono: positiveNumber('Valor de abono'),
      })
    )
    .min(1, 'Debes seleccionar al menos una factura con monto'),
});

// ============================================
// ARTICULOS SCHEMAS
// ============================================

const articuloCreateSchema = z.object({
  tipo_articulo: z
    .string({ required_error: 'Tipo de artículo es requerido' })
    .min(1, 'Tipo no puede estar vacío')
    .max(100, 'Tipo no puede exceder 100 caracteres'),
  nombre_articulo: requiredTrimmedString(255, 'Nombre del artículo'),
  cantidad: optionalPositiveNumber('Cantidad'),
  talla: optionalTrimmedString(100, 'Talla'),
  marca: optionalTrimmedString(100, 'Marca'),
  modelo: optionalTrimmedString(100, 'Modelo'),
  numero_serie: optionalTrimmedString(100, 'Número de serie'),
  calibre: optionalTrimmedString(100, 'Calibre'),
  fecha_caducidad: optionalDateString('Fecha de caducidad'),
  ubicacion_id: z.preprocess(emptyToUndefined, positiveInt('Ubicación ID').optional()),
  cliente_id: z.preprocess(emptyToUndefined, positiveInt('Cliente ID').optional()),
  ubicacion_nombre: optionalTrimmedString(255, 'Ubicación'),
  codigo_pantalla: optionalTrimmedString(100, 'Código de pantalla'),
  codigo_radio: optionalTrimmedString(100, 'Código de radio'),
  version: optionalTrimmedString(100, 'Versión'),
});

const articuloUpdateSchema = articuloCreateSchema.partial();

const articuloBajaSchema = z.object({
  motivo: requiredTrimmedString(500, 'Motivo de baja'),
  cantidad: z.preprocess(emptyToUndefined, positiveInt('Cantidad').optional()),
});

const movimientoCreateSchema = z.object({
  ubicacion_destino_id: z.preprocess(emptyToUndefined, positiveInt('Ubicación destino').optional()),
  cliente_destino_id: z.preprocess(emptyToUndefined, positiveInt('Cliente destino').optional()),
  ubicacion_destino_nombre: optionalTrimmedString(255, 'Ubicación destino'),
  fecha_movimiento: optionalDateString('Fecha de movimiento'),
  items: z
    .array(
      z.object({
        articulo_id: positiveInt('Artículo'),
        cantidad: z.preprocess(emptyToUndefined, positiveInt('Cantidad').optional()),
        talla: optionalTrimmedString(100, 'Talla'),
      })
    )
    .min(1, 'Debes agregar al menos un artículo'),
});

// ============================================
// COLABORADORES SCHEMAS
// ============================================

const colaboradorCreateSchema = z.object({
  cedula: z
    .string({ required_error: 'Cédula es requerida' })
    .min(5, 'Cédula debe tener al menos 5 caracteres')
    .max(20, 'Cédula no puede exceder 20 caracteres'),
  nombres_completos: z
    .string({ required_error: 'Nombres completos son requeridos' })
    .min(1, 'Nombres no pueden estar vacíos')
    .max(255, 'Nombres no pueden exceder 255 caracteres'),
  cargo: z
    .string({ required_error: 'Cargo es requerido' })
    .min(1, 'Cargo no puede estar vacío')
    .max(100, 'Cargo no puede exceder 100 caracteres'),
  fecha_nacimiento: dateString('Fecha de nacimiento'),
  celular: optionalTrimmedString(20, 'Celular'),
  banco: optionalTrimmedString(100, 'Banco'),
  numero_cuenta: optionalTrimmedString(100, 'Número de cuenta'),
  sueldo: optionalPositiveNumber('Sueldo').nullable(),
  estado: z.enum(['activo', 'inactivo']).optional().default('activo'),
});

const colaboradorUpdateSchema = colaboradorCreateSchema.partial();

module.exports = {
  // Auth
  loginSchema,
  changePasswordSchema,

  // Usuarios
  usuarioCreateSchema,
  usuarioUpdateSchema,

  // Clientes
  clienteCreateSchema,

  // Facturas
  facturaCreateSchema,
  facturaUpdateSchema,
  facturaCancelSchema,

  // Pagos
  pagoCreateSchema,

  // Articulos
  articuloCreateSchema,
  articuloUpdateSchema,
  articuloBajaSchema,
  movimientoCreateSchema,

  // Colaboradores
  colaboradorCreateSchema,
  colaboradorUpdateSchema,
};
