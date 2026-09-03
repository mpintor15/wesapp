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

const isValidBitacoraTimestamp = (value) => {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,6})?)?$/.exec(value);
  if (!match || !isValidDateString(match[1])) {
    return false;
  }

  const hour = Number(match[2]);
  const minute = Number(match[3]);
  const second = Number(match[4] || 0);
  return hour <= 23 && minute <= 59 && second <= 59;
};

const bitacoraTimestamp = z
  .string({ required_error: 'Ocurrido en es requerido' })
  .refine(isValidBitacoraTimestamp, 'Ocurrido en debe ser un timestamp válido');

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

// ============================================
// BITÁCORAS SCHEMAS
// ============================================

const bitacoraRegistroCreateSchema = z
  .object({
    ubicacion_id: positiveInt('Ubicación ID'),
    manzana_id: positiveInt('Manzana ID').nullable().optional(),
    villa_id: positiveInt('Villa ID').nullable().optional(),
    ocurrido_at: bitacoraTimestamp,
    detalle: z
      .string({ required_error: 'Detalle es requerido' })
      .refine((value) => /[^\s]/u.test(value), 'Detalle no puede estar vacío'),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (
      data.manzana_id !== null &&
      data.manzana_id !== undefined &&
      (data.villa_id === null || data.villa_id === undefined)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['villa_id'],
        message: 'Villa ID es requerida con Manzana ID',
      });
    }
    if (
      data.villa_id !== null &&
      data.villa_id !== undefined &&
      (data.manzana_id === null || data.manzana_id === undefined)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['villa_id'],
        message: 'Villa ID requiere Manzana ID',
      });
    }
  });

const visitFormTipoNameSchema = requiredTrimmedString(60, 'Nombre del tipo de visita');

const visitFormTipoSchema = z
  .object({
    nombre: visitFormTipoNameSchema,
    requiere_salida: z.boolean().optional().default(false),
  })
  .strict();

const visitFormFieldAplicaASchema = z.union([
  z.literal('TODOS'),
  z.array(visitFormTipoNameSchema).min(1, 'Selecciona al menos un tipo de visita'),
]);

const visitFormFieldSchema = z
  .object({
    field_key: z
      .string({ required_error: 'field_key es requerido' })
      .trim()
      .min(1, 'field_key no puede estar vacío')
      .max(80, 'field_key no puede exceder 80 caracteres')
      .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'field_key debe ser alfanumérico'),
    label: z
      .string({ required_error: 'label es requerido' })
      .trim()
      .min(1, 'label no puede estar vacío')
      .max(120, 'label no puede exceder 120 caracteres'),
    type: z.enum(['text', 'textarea', 'number', 'select', 'checkbox', 'cedula', 'placa']),
    aplica_a: visitFormFieldAplicaASchema.optional().default('TODOS'),
    required: z.boolean().optional().default(false),
    options: z.array(z.string().trim().min(1).max(120)).optional().default([]),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.type === 'select' && data.options.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['options'],
        message: 'options es requerido para campos select',
      });
    }
    if (data.type !== 'select' && data.options.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['options'],
        message: 'options solo aplica a campos select',
      });
    }
  });

// "Visitantes" es la única estructura de grupo repetible soportada: predefinida,
// no genérica. Sus dos campos internos (Nombre, Cédula) son fijos —el builder
// solo puede configurar aplica_a, mínimo de registros y si cada uno es
// requerido— por lo que el schema valida la forma exacta en vez de aceptar
// campos arbitrarios.
const VISITANTES_GROUP_KEY = 'visitantes';
const VISITANTES_GROUP_LABEL = 'Visitantes';
const VISITANTES_FIELD_KEYS = ['nombre', 'cedula'];
const VISITANTES_FIELD_TYPES = { nombre: 'text', cedula: 'cedula' };
const VISITANTES_FIELD_LABELS = { nombre: 'Nombre', cedula: 'Cédula' };

const visitFormGroupFieldSchema = z
  .object({
    field_key: z.enum(['nombre', 'cedula']),
    label: requiredTrimmedString(120, 'label'),
    type: z.enum(['text', 'cedula']),
    required: z.boolean().optional().default(false),
  })
  .strict();

const visitFormGroupSchema = z
  .object({
    group_key: z.literal(VISITANTES_GROUP_KEY),
    label: z.literal(VISITANTES_GROUP_LABEL),
    min_count: z
      .union([z.literal(0), z.literal(1)])
      .optional()
      .default(0),
    aplica_a: visitFormFieldAplicaASchema.optional().default('TODOS'),
    fields: z
      .array(visitFormGroupFieldSchema)
      .length(2, 'El grupo Visitantes requiere Nombre y Cédula'),
  })
  .strict()
  .superRefine((data, ctx) => {
    const keys = data.fields.map((field) => field.field_key);
    VISITANTES_FIELD_KEYS.forEach((expectedKey, index) => {
      if (keys[index] !== expectedKey) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fields', index, 'field_key'],
          message: `El grupo Visitantes debe tener los campos ${VISITANTES_FIELD_KEYS.join(', ')} en ese orden`,
        });
      }
    });
    data.fields.forEach((field, index) => {
      if (
        VISITANTES_FIELD_TYPES[field.field_key] &&
        field.type !== VISITANTES_FIELD_TYPES[field.field_key]
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fields', index, 'type'],
          message: `${field.label} debe ser de tipo ${VISITANTES_FIELD_TYPES[field.field_key]}`,
        });
      }
    });
  });

const bitacoraVisitFormPublishSchema = z
  .object({
    titulo: z.string().trim().min(1).max(150).optional(),
    mostrar_fecha_hora: z.boolean().optional().default(true),
    tipos_visita: z
      .array(visitFormTipoSchema)
      .min(1, 'Se requiere al menos un tipo de visita')
      .max(20, 'No se pueden configurar más de 20 tipos de visita'),
    fields: z.array(visitFormFieldSchema).max(30).default([]),
    grupos: z.array(visitFormGroupSchema).max(1, 'Solo se admite el grupo Visitantes').default([]),
  })
  .strict()
  .superRefine((data, ctx) => {
    const keys = new Set();
    data.fields.forEach((field, index) => {
      const key = field.field_key.toLowerCase();
      if (keys.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fields', index, 'field_key'],
          message: 'field_key duplicado',
        });
      }
      keys.add(key);
    });

    // Deduplicación: si el grupo Visitantes está presente, Nombre/Cédula del
    // visitante ya quedan cubiertos por sus dos campos fijos y no pueden
    // volver a pedirse como preguntas normales sueltas.
    if (data.grupos.length > 0) {
      data.fields.forEach((field, index) => {
        if (VISITANTES_FIELD_KEYS.includes(field.field_key.toLowerCase())) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['fields', index, 'field_key'],
            message: `"${field.label}" duplica un campo del grupo Visitantes (${VISITANTES_FIELD_LABELS[field.field_key.toLowerCase()]})`,
          });
        }
      });
    }

    const tipoNames = new Set();
    const normalizedTipos = new Set();
    data.tipos_visita.forEach((tipo, index) => {
      const normalized = tipo.nombre.toLowerCase();
      if (normalizedTipos.has(normalized)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['tipos_visita', index],
          message: 'Tipo de visita duplicado',
        });
      }
      normalizedTipos.add(normalized);
      tipoNames.add(tipo.nombre);
    });

    data.fields.forEach((field, index) => {
      if (field.aplica_a === 'TODOS') {
        return;
      }
      field.aplica_a.forEach((tipo, tipoIndex) => {
        if (!tipoNames.has(tipo)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['fields', index, 'aplica_a', tipoIndex],
            message: `El tipo de visita "${tipo}" no está configurado en tipos_visita`,
          });
        }
      });
    });

    data.grupos.forEach((group, index) => {
      if (group.aplica_a === 'TODOS') {
        return;
      }
      group.aplica_a.forEach((tipo, tipoIndex) => {
        if (!tipoNames.has(tipo)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['grupos', index, 'aplica_a', tipoIndex],
            message: `El tipo de visita "${tipo}" no está configurado en tipos_visita`,
          });
        }
      });
    });
  });

const visitResponsesSchema = z.record(z.string(), z.unknown()).optional().default({});

const visitGroupResponsesSchema = z
  .record(z.string(), z.array(z.record(z.string(), z.unknown())))
  .optional()
  .default({});

const bitacoraVisitCreateSchema = z
  .object({
    ubicacion_id: positiveInt('Ubicación ID'),
    manzana_id: positiveInt('Manzana ID'),
    villa_id: positiveInt('Villa ID'),
    visitante_nombre: optionalTrimmedString(150, 'Nombre del visitante'),
    visitante_documento: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .regex(/^\d{10}$/, 'Cédula debe tener exactamente 10 dígitos')
        .optional()
    ),
    visitante_telefono: optionalTrimmedString(80, 'Teléfono del visitante'),
    tipo_visita_id: positiveInt('Tipo de visita'),
    placa: z
      .string()
      .trim()
      .transform((value) => value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
      .pipe(z.string().max(10, 'Placa no puede exceder 10 caracteres'))
      .optional(),
    respuestas: visitResponsesSchema,
    grupos: visitGroupResponsesSchema,
    autorizada: z.boolean().optional().default(true),
    motivo_no_autorizacion: optionalTrimmedString(200, 'Motivo de no autorización'),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.autorizada === false && !data.motivo_no_autorizacion) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['motivo_no_autorizacion'],
        message: 'Motivo de no autorización es requerido',
      });
    }
    if (data.autorizada !== false && data.motivo_no_autorizacion) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['motivo_no_autorizacion'],
        message: 'Motivo de no autorización solo aplica si la visita no fue autorizada',
      });
    }
  });

const bitacoraVisitCloseSchema = z.object({}).strict();

const bitacoraVisitFormArchiveSchema = z.object({}).strict();

const bitacoraVisitCancelSchema = z
  .object({
    motivo: requiredTrimmedString(200, 'Motivo'),
  })
  .strict();

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
    .min(1, 'Debes seleccionar al menos una factura con monto')
    .max(50, 'No puedes aplicar un pago a más de 50 facturas a la vez'),
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
    .min(1, 'Debes agregar al menos un artículo')
    .max(50, 'No puedes incluir más de 50 artículos en un mismo movimiento'),
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

  // Bitácoras
  bitacoraRegistroCreateSchema,
  bitacoraVisitCancelSchema,
  bitacoraVisitCloseSchema,
  bitacoraVisitCreateSchema,
  bitacoraVisitFormPublishSchema,
  bitacoraVisitFormArchiveSchema,

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
