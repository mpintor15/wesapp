-- ============================================
-- WESApp - Base de Datos PostgreSQL
-- Empresa: WES Security
-- ============================================
--
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
-- ⚠️  PELIGRO — NO EJECUTAR EN LA BASE DE DATOS DE PRODUCCIÓN ⚠️
-- Este script elimina TODAS las tablas y sus datos con CASCADE.
-- Solo debe usarse para crear una base de datos LOCAL desde cero.
-- Para cambios en producción usa los archivos en /migrations/
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

-- Limpiar tablas existentes (SOLO PARA DESARROLLO LOCAL)
DROP TABLE IF EXISTS bitacora_registros CASCADE;
DROP TABLE IF EXISTS usuario_ubicaciones CASCADE;
DROP TABLE IF EXISTS detalle_movimientos CASCADE;
DROP TABLE IF EXISTS movimientos CASCADE;
DROP TABLE IF EXISTS articulos CASCADE;
DROP TABLE IF EXISTS ubicaciones CASCADE;
DROP TABLE IF EXISTS colaboradores CASCADE;
DROP TABLE IF EXISTS articulos_bajas CASCADE;
DROP TABLE IF EXISTS abonos CASCADE;
DROP TABLE IF EXISTS retenciones CASCADE;
DROP TABLE IF EXISTS pagos CASCADE;
DROP TABLE IF EXISTS cuentas CASCADE;
DROP TABLE IF EXISTS clientes CASCADE;
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS schema_version CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;

-- ============================================
-- TABLA: usuarios
-- ============================================
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    usuario VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nombre VARCHAR(100),
    apellido VARCHAR(100),
    tipo_usuario VARCHAR(20) NOT NULL CHECK (tipo_usuario IN ('gerente', 'secretario', 'supervisor', 'contador', 'guardia', 'monitorista')),
    primer_login BOOLEAN DEFAULT TRUE,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- MÓDULO: CUENTAS
-- ============================================
CREATE TABLE clientes (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    identificacion TEXT,
    tipo_identificacion TEXT,
    telefono TEXT,
    correo TEXT,
    direccion TEXT,
    ciudad TEXT,
    estado VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cuentas (
    num_factura INTEGER PRIMARY KEY,
    cliente_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
    fecha_factura DATE NOT NULL,
    valor_factura NUMERIC(10,2) NOT NULL CHECK (valor_factura > 0),
    incluye_iva BOOLEAN DEFAULT FALSE,
    incluye_retencion_fuente BOOLEAN DEFAULT FALSE,
    incluye_retencion_iva BOOLEAN DEFAULT FALSE,
    cancelada BOOLEAN DEFAULT FALSE,
    detalle_anulacion TEXT,
    fecha_anulacion TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE pagos (
    id          SERIAL PRIMARY KEY,
    cliente_id  INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
    fecha       DATE NOT NULL,
    metodo_pago VARCHAR(50),
    referencia  VARCHAR(100),
    notas       TEXT,
    total       NUMERIC(10,2) NOT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE abonos (
    id          SERIAL PRIMARY KEY,
    pago_id     INTEGER REFERENCES pagos(id) ON DELETE CASCADE,
    num_factura INTEGER REFERENCES cuentas(num_factura) ON UPDATE CASCADE ON DELETE CASCADE,
    fecha_abono DATE NOT NULL,
    valor_abono NUMERIC(10,2) NOT NULL CHECK (valor_abono > 0),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- MÓDULO: INVENTARIO
-- ============================================
CREATE TABLE ubicaciones (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    tipo_punto VARCHAR(20) NOT NULL DEFAULT 'GENERAL'
        CHECK (tipo_punto IN ('GENERAL', 'URBANIZACION')),
    cliente_id INTEGER CONSTRAINT fk_ubicaciones_cliente REFERENCES clientes(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE manzanas (
    id SERIAL PRIMARY KEY,
    ubicacion_id INTEGER NOT NULL REFERENCES ubicaciones(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    nombre VARCHAR(100) NOT NULL,
    estado VARCHAR(10) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
    created_by INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT manzanas_id_ubicacion_id_key UNIQUE (id, ubicacion_id)
);

CREATE UNIQUE INDEX idx_manzanas_ubicacion_nombre_normalizado_unique
    ON manzanas (ubicacion_id, LOWER(REGEXP_REPLACE(TRIM(nombre), '\s+', ' ', 'g')));
CREATE INDEX idx_manzanas_ubicacion ON manzanas (ubicacion_id);

CREATE TABLE villas (
    id SERIAL PRIMARY KEY,
    manzana_id INTEGER NOT NULL REFERENCES manzanas(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    identificador VARCHAR(100) NOT NULL,
    estado VARCHAR(10) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
    created_by INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT villas_id_manzana_id_key UNIQUE (id, manzana_id)
);

CREATE UNIQUE INDEX idx_villas_manzana_identificador_normalizado_unique
    ON villas (manzana_id, LOWER(REGEXP_REPLACE(TRIM(identificador), '\s+', ' ', 'g')));
CREATE INDEX idx_villas_manzana ON villas (manzana_id);

CREATE TABLE residentes (
    id SERIAL PRIMARY KEY,
    villa_id INTEGER NOT NULL REFERENCES villas(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    nombre VARCHAR(150) NOT NULL,
    contacto VARCHAR(150) NOT NULL,
    es_principal BOOLEAN NOT NULL DEFAULT TRUE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_by INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_residentes_villa_principal_activo_unique
    ON residentes (villa_id) WHERE es_principal = TRUE AND activo = TRUE;
CREATE INDEX idx_residentes_villa ON residentes (villa_id);

CREATE INDEX idx_ubicaciones_cliente_id ON ubicaciones(cliente_id);
CREATE UNIQUE INDEX idx_ubicaciones_cliente_nombre_lower_unique
    ON ubicaciones(cliente_id, LOWER(TRIM(nombre)))
    WHERE cliente_id IS NOT NULL;

CREATE TABLE articulos (
    id SERIAL PRIMARY KEY,
    tipo_articulo VARCHAR(20) NOT NULL CHECK (tipo_articulo IN ('equipo', 'placa_balistica', 'arma', 'radio', 'otro')),
    nombre_articulo VARCHAR(100),
    cantidad INTEGER DEFAULT 1,
    talla VARCHAR(10),
    marca VARCHAR(50),
    modelo VARCHAR(50),
    numero_serie VARCHAR(100) UNIQUE,
    calibre VARCHAR(20),
    fecha_caducidad DATE,
    codigo_pantalla VARCHAR(50),
    codigo_radio VARCHAR(50),
    version VARCHAR(50),
    ubicacion_id INTEGER REFERENCES ubicaciones(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activo BOOLEAN DEFAULT TRUE,
    eliminado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    eliminado_en TIMESTAMP,
    motivo_eliminacion TEXT,
    CONSTRAINT chk_articulos_cantidad_non_negative CHECK (cantidad >= 0)
);

CREATE TABLE movimientos (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id),
    fecha_movimiento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    pdf_path TEXT,
    estado VARCHAR(20) DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'ANULADO', 'ELIMINADO')),
    anulado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    anulado_en TIMESTAMP,
    motivo_anulacion TEXT,
    eliminado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    eliminado_en TIMESTAMP,
    motivo_eliminacion TEXT,
    reversion_datos_completos BOOLEAN DEFAULT FALSE
);

CREATE TABLE detalle_movimientos (
    id SERIAL PRIMARY KEY,
    movimiento_id INTEGER REFERENCES movimientos(id) ON DELETE CASCADE,
    articulo_id INTEGER REFERENCES articulos(id),
    cantidad INTEGER DEFAULT 1 CHECK (cantidad > 0),
    ubicacion_origen_id INTEGER REFERENCES ubicaciones(id),
    ubicacion_destino_id INTEGER REFERENCES ubicaciones(id),
    CHECK (ubicacion_origen_id != ubicacion_destino_id)
);

CREATE TABLE articulos_bajas (
    id SERIAL PRIMARY KEY,
    articulo_id INTEGER REFERENCES articulos(id) ON DELETE SET NULL,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    motivo TEXT NOT NULL CHECK (length(trim(motivo)) > 0),
    fecha_baja TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tipo_articulo VARCHAR(20),
    nombre_articulo VARCHAR(100),
    talla VARCHAR(10),
    marca VARCHAR(50),
    modelo VARCHAR(50),
    numero_serie VARCHAR(100),
    calibre VARCHAR(20),
    codigo_pantalla VARCHAR(50),
    codigo_radio VARCHAR(50),
    version VARCHAR(50),
    ubicacion_id INTEGER REFERENCES ubicaciones(id) ON DELETE SET NULL,
    ubicacion_nombre VARCHAR(100),
    estado VARCHAR(20) DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'ANULADO', 'ELIMINADO')),
    anulado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    anulado_en TIMESTAMP,
    motivo_anulacion TEXT,
    eliminado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    eliminado_en TIMESTAMP,
    motivo_eliminacion TEXT,
    reversion_datos_completos BOOLEAN DEFAULT FALSE
);

CREATE TABLE inventario_stock_efectos (
    id SERIAL PRIMARY KEY,
    movimiento_id INTEGER REFERENCES movimientos(id) ON DELETE CASCADE,
    baja_id INTEGER REFERENCES articulos_bajas(id) ON DELETE CASCADE,
    articulo_id INTEGER NOT NULL REFERENCES articulos(id),
    delta INTEGER NOT NULL,
    stock_anterior INTEGER,
    stock_posterior INTEGER,
    ubicacion_anterior_id INTEGER REFERENCES ubicaciones(id) ON DELETE SET NULL,
    ubicacion_posterior_id INTEGER REFERENCES ubicaciones(id) ON DELETE SET NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_inventario_stock_efectos_owner CHECK (
        (movimiento_id IS NOT NULL AND baja_id IS NULL)
        OR (movimiento_id IS NULL AND baja_id IS NOT NULL)
    ),
    CONSTRAINT chk_inventario_stock_efectos_change CHECK (
        delta <> 0 OR ubicacion_anterior_id IS DISTINCT FROM ubicacion_posterior_id
    )
);

-- ============================================
-- MÓDULO: PERSONAL
-- ============================================
CREATE TABLE colaboradores (
    id SERIAL PRIMARY KEY,
    nombres_completos VARCHAR(200) NOT NULL,
    cedula VARCHAR(20) UNIQUE NOT NULL,
    fecha_nacimiento DATE NOT NULL,
    cargo VARCHAR(100) NOT NULL,
    celular VARCHAR(20),
    banco VARCHAR(100),
    numero_cuenta VARCHAR(50),
    sueldo NUMERIC(10,2),
    estado VARCHAR(20) DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
    fecha_salida DATE,
    salida_voluntaria BOOLEAN,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE usuarios
    ADD COLUMN colaborador_id INTEGER NULL,
    ADD CONSTRAINT usuarios_colaborador_id_fkey
        FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id) ON DELETE RESTRICT,
    ADD CONSTRAINT usuarios_colaborador_id_key UNIQUE (colaborador_id);

CREATE TABLE usuario_ubicaciones (
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    ubicacion_id INTEGER NOT NULL REFERENCES ubicaciones(id) ON DELETE RESTRICT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER NULL REFERENCES usuarios(id) ON DELETE SET NULL,
    PRIMARY KEY (usuario_id, ubicacion_id)
);
CREATE INDEX idx_usuario_ubicaciones_ubicacion_id ON usuario_ubicaciones(ubicacion_id);

CREATE TABLE bitacora_registros (
    id SERIAL PRIMARY KEY,
    ubicacion_id INTEGER NOT NULL REFERENCES ubicaciones(id) ON DELETE RESTRICT,
    autor_usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    autor_colaborador_id INTEGER NOT NULL REFERENCES colaboradores(id) ON DELETE RESTRICT,
    ocurrido_at TIMESTAMP NOT NULL,
    detalle TEXT NOT NULL,
    estado VARCHAR(12) NOT NULL DEFAULT 'REGISTRADA',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    anulado_at TIMESTAMP NULL,
    anulado_por_usuario_id INTEGER NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    motivo_anulacion TEXT NULL,
    manzana_id INTEGER NULL,
    villa_id INTEGER NULL,
    CONSTRAINT bitacora_registros_detalle_no_vacio_check
        CHECK (detalle ~ '[^[:space:]]'),
    CONSTRAINT bitacora_registros_estado_check
        CHECK (estado IN ('REGISTRADA', 'ANULADA')),
    CONSTRAINT bitacora_registros_anulacion_coherente_check
        CHECK (
            (
                estado = 'REGISTRADA'
                AND anulado_at IS NULL
                AND anulado_por_usuario_id IS NULL
                AND motivo_anulacion IS NULL
            )
            OR
            (
                estado = 'ANULADA'
                AND anulado_at IS NOT NULL
                AND anulado_por_usuario_id IS NOT NULL
                AND motivo_anulacion IS NOT NULL
                AND motivo_anulacion ~ '[^[:space:]]'
            )
    ),
    CONSTRAINT bitacora_registros_villa_requiere_manzana_check
        CHECK (villa_id IS NULL OR manzana_id IS NOT NULL),
    CONSTRAINT bitacora_registros_manzana_ubicacion_fkey
        FOREIGN KEY (manzana_id, ubicacion_id)
        REFERENCES manzanas (id, ubicacion_id) ON DELETE RESTRICT,
    CONSTRAINT bitacora_registros_villa_manzana_fkey
        FOREIGN KEY (villa_id, manzana_id)
        REFERENCES villas (id, manzana_id) ON DELETE RESTRICT
);

CREATE INDEX idx_bitacora_registros_ubicacion_ocurrido
    ON bitacora_registros (ubicacion_id, ocurrido_at DESC, id DESC);
CREATE INDEX idx_bitacora_registros_autor_ocurrido
    ON bitacora_registros (autor_usuario_id, ocurrido_at DESC, id DESC);
CREATE INDEX idx_bitacora_registros_ocurrido
    ON bitacora_registros (ocurrido_at DESC, id DESC);
CREATE INDEX idx_bitacora_registros_estado_ocurrido
    ON bitacora_registros (estado, ocurrido_at DESC, id DESC);
CREATE INDEX idx_bitacora_registros_manzana_ubicacion
    ON bitacora_registros (manzana_id, ubicacion_id) WHERE manzana_id IS NOT NULL;
CREATE INDEX idx_bitacora_registros_villa_manzana
    ON bitacora_registros (villa_id, manzana_id) WHERE villa_id IS NOT NULL;

CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    tabla VARCHAR(50) NOT NULL,
    operacion VARCHAR(10) NOT NULL,
    registro_id VARCHAR(100),
    usuario_id INTEGER,
    usuario_nombre VARCHAR(100),
    datos_anteriores JSONB,
    datos_nuevos JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE schema_version (
    version INTEGER PRIMARY KEY,
    description TEXT NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- ============================================
CREATE INDEX idx_usuarios_tipo ON usuarios(tipo_usuario);
CREATE INDEX idx_usuarios_activo ON usuarios(activo);
CREATE INDEX idx_cuentas_cliente ON cuentas(cliente_id);
CREATE INDEX idx_cuentas_fecha ON cuentas(fecha_factura);
CREATE INDEX idx_cuentas_cancelada ON cuentas(cancelada) WHERE cancelada = FALSE;
CREATE INDEX idx_cuentas_fecha_cancelada ON cuentas(fecha_factura, cancelada);
CREATE INDEX idx_abonos_factura ON abonos(num_factura);
CREATE INDEX idx_abonos_pago ON abonos(pago_id);
CREATE INDEX idx_pagos_cliente ON pagos(cliente_id);
CREATE INDEX idx_pagos_fecha ON pagos(fecha);
CREATE INDEX idx_articulos_tipo ON articulos(tipo_articulo);
CREATE INDEX idx_articulos_ubicacion ON articulos(ubicacion_id);
CREATE INDEX idx_articulos_serie ON articulos(numero_serie);
CREATE INDEX idx_articulos_activos_created_at ON articulos(created_at DESC) WHERE activo = TRUE;
CREATE UNIQUE INDEX uq_articulos_codigo_pantalla ON articulos(codigo_pantalla) WHERE codigo_pantalla IS NOT NULL;
CREATE UNIQUE INDEX uq_articulos_codigo_radio ON articulos(codigo_radio) WHERE codigo_radio IS NOT NULL;
CREATE UNIQUE INDEX uq_articulos_version ON articulos(version) WHERE version IS NOT NULL;
CREATE INDEX idx_movimientos_fecha ON movimientos(fecha_movimiento);
CREATE INDEX idx_movimientos_operativos_fecha ON movimientos(fecha_movimiento DESC) WHERE estado <> 'ELIMINADO';
CREATE INDEX idx_detalle_movimientos_movimiento ON detalle_movimientos(movimiento_id);
CREATE INDEX idx_detalle_movimientos_articulo ON detalle_movimientos(articulo_id);
CREATE INDEX idx_detalle_movimientos_destino ON detalle_movimientos(ubicacion_destino_id);
CREATE INDEX idx_inventario_stock_efectos_movimiento ON inventario_stock_efectos(movimiento_id);
CREATE INDEX idx_inventario_stock_efectos_baja ON inventario_stock_efectos(baja_id);
CREATE INDEX idx_inventario_stock_efectos_articulo ON inventario_stock_efectos(articulo_id);
CREATE INDEX idx_articulos_bajas_fecha ON articulos_bajas(fecha_baja);
CREATE INDEX idx_articulos_bajas_operativas_fecha ON articulos_bajas(fecha_baja DESC) WHERE estado <> 'ELIMINADO';
CREATE INDEX idx_articulos_bajas_articulo ON articulos_bajas(articulo_id);
CREATE INDEX idx_articulos_bajas_usuario ON articulos_bajas(usuario_id);
CREATE INDEX idx_colaboradores_estado ON colaboradores(estado);
CREATE INDEX idx_colaboradores_cedula ON colaboradores(cedula);
CREATE INDEX idx_audit_tabla ON audit_log(tabla);
CREATE INDEX idx_audit_fecha ON audit_log(created_at);
CREATE INDEX idx_audit_usuario ON audit_log(usuario_id);
CREATE INDEX idx_clientes_nombre_normalizado ON clientes(LOWER(TRIM(nombre)));
CREATE INDEX idx_clientes_estado ON clientes(estado);
CREATE UNIQUE INDEX idx_clientes_identificacion_normalizada_unique
    ON clientes(LOWER(TRIM(identificacion)))
    WHERE identificacion IS NOT NULL AND TRIM(identificacion) <> '';

-- ============================================
-- DATOS DE PRUEBA
-- ============================================

-- Colaboradores vinculados a los Usuarios de prueba
INSERT INTO colaboradores
    (nombres_completos, cedula, fecha_nacimiento, cargo, estado)
VALUES
('Gerente Prueba', 'TEST-COL-001', '1990-01-01', 'Gerente', 'activo'),
('Secretario Prueba', 'TEST-COL-002', '1990-01-01', 'Secretario', 'activo'),
('Supervisor Prueba', 'TEST-COL-003', '1990-01-01', 'Supervisor', 'activo'),
('Contador Prueba', 'TEST-COL-004', '1990-01-01', 'Contador', 'activo');

-- Usuarios de prueba
-- Password para todos: "password123"
INSERT INTO usuarios
    (usuario, password_hash, tipo_usuario, colaborador_id, primer_login, activo)
VALUES
('gerente1', '$2b$10$l2GA3Vzunm2AlLfERjfQtOh.8TnYbxMmyxzCTTbIzT5A/3wKR.UYS', 'gerente', 1, FALSE, TRUE),
('secretario1', '$2b$10$l2GA3Vzunm2AlLfERjfQtOh.8TnYbxMmyxzCTTbIzT5A/3wKR.UYS', 'secretario', 2, FALSE, TRUE),
('supervisor1', '$2b$10$l2GA3Vzunm2AlLfERjfQtOh.8TnYbxMmyxzCTTbIzT5A/3wKR.UYS', 'supervisor', 3, FALSE, TRUE),
('contador1', '$2b$10$l2GA3Vzunm2AlLfERjfQtOh.8TnYbxMmyxzCTTbIzT5A/3wKR.UYS', 'contador', 4, FALSE, TRUE);

-- Clientes de prueba
INSERT INTO clientes (nombre, identificacion) VALUES
('Banco Pichincha', '1790012348001'),
('Corporación Favorita', '1790012346001'),
('Municipio de Quito', '1760001550001'),
('Centro Comercial El Recreo', '1790012347001'),
('Hospital Metropolitano', '1790012345001');

-- Cuentas (facturas) de prueba
INSERT INTO cuentas (num_factura, cliente_id, fecha_factura, valor_factura, incluye_iva, incluye_retencion_fuente, incluye_retencion_iva, cancelada) VALUES
(1001, 1, '2024-01-15', 5000.00, TRUE, TRUE, TRUE, FALSE),
(1002, 2, '2024-01-20', 7500.00, TRUE, TRUE, FALSE, FALSE),
(1003, 3, '2024-02-05', 12000.00, FALSE, TRUE, FALSE, FALSE),
(1004, 1, '2024-02-10', 3200.00, TRUE, FALSE, FALSE, FALSE),
(1005, 4, '2024-02-15', 8900.00, FALSE, FALSE, FALSE, FALSE);

-- Abonos de prueba
INSERT INTO abonos (num_factura, fecha_abono, valor_abono) VALUES
(1001, '2024-01-25', 2000.00),
(1001, '2024-02-10', 2000.00),
(1002, '2024-02-01', 3000.00),
(1003, '2024-02-15', 5000.00);

-- Ubicaciones de prueba
INSERT INTO ubicaciones (nombre) VALUES
('Bodega Principal'),
('Oficina Administrativa'),
('Vehículo Patrulla 01'),
('Vehículo Patrulla 02'),
('Puesto de Vigilancia Norte'),
('Puesto de Vigilancia Sur');

-- Artículos de inventario de prueba - Equipos
INSERT INTO articulos (tipo_articulo, nombre_articulo, cantidad, talla, ubicacion_id) VALUES
('equipo', 'Uniforme Operativo', 25, 'M', 1),
('equipo', 'Uniforme Operativo', 15, 'L', 1),
('equipo', 'Uniforme Operativo', 10, 'XL', 1),
('equipo', 'Radio Motorola', 20, NULL, 1),
('equipo', 'Linterna Táctica', 30, NULL, 1),
('equipo', 'Chaleco Reflectivo', 40, 'M', 1),
('equipo', 'Botas de Seguridad', 18, '42', 1),
('equipo', 'Botas de Seguridad', 12, '43', 1);

-- Placas Balísticas
INSERT INTO articulos (tipo_articulo, nombre_articulo, numero_serie, fecha_caducidad, ubicacion_id) VALUES
('placa_balistica', 'Placa Balística', 'PB-2024-001', '2029-12-31', 1),
('placa_balistica', 'Placa Balística', 'PB-2024-002', '2029-12-31', 1),
('placa_balistica', 'Placa Balística', 'PB-2024-003', '2029-06-30', 1),
('placa_balistica', 'Placa Balística', 'PB-2023-045', '2025-03-15', 1),
('placa_balistica', 'Placa Balística', 'PB-2022-089', '2024-12-31', 1);

-- Armas
INSERT INTO articulos (tipo_articulo, nombre_articulo, marca, modelo, numero_serie, calibre, ubicacion_id) VALUES
('arma', 'Pistola', 'Glock', '17 Gen5', 'GLK-001-2024', '9mm', 2),
('arma', 'Pistola', 'Glock', '19 Gen5', 'GLK-002-2024', '9mm', 2),
('arma', 'Revólver', 'Smith & Wesson', 'Model 686', 'SW-001-2024', '.357 Magnum', 2),
('arma', 'Escopeta', 'Remington', '870', 'REM-001-2024', '12 gauge', 1),
('arma', 'Pistola', 'Beretta', '92FS', 'BER-001-2024', '9mm', 2);

-- Colaboradores de prueba
INSERT INTO colaboradores (nombres_completos, cedula, fecha_nacimiento, cargo, celular, banco, numero_cuenta, sueldo, estado) VALUES
('Juan Carlos Pérez Mora', '1712345678', '1985-03-15', 'Supervisor de Turno', '0998765432', 'Banco Pichincha', '2100123456', 800.00, 'activo'),
('María Fernanda López García', '1723456789', '1990-07-22', 'Guardia de Seguridad', '0987654321', 'Banco Guayaquil', '3200234567', 500.00, 'activo'),
('Carlos Alberto Sánchez Ruiz', '1734567890', '1988-11-10', 'Guardia de Seguridad', '0976543210', 'Banco Pichincha', '2100345678', 500.00, 'activo'),
('Ana Patricia Torres Vega', '1745678901', '1992-05-18', 'Recepcionista', '0965432109', 'Banco del Pacífico', '4100456789', 450.00, 'activo'),
('Roberto Andrés Morales Castro', '1756789012', '1987-09-25', 'Coordinador Operativo', '0954321098', 'Banco Pichincha', '2100567890', 900.00, 'activo'),
('Laura Cristina Herrera Suárez', '1767890123', '1995-02-14', 'Guardia de Seguridad', '0943210987', 'Banco Guayaquil', '3200678901', 500.00, 'activo'),
('Diego Fernando Ramírez Ortiz', '1778901234', '1989-12-03', 'Guardia de Seguridad', '0932109876', 'Banco del Pacífico', '4100789012', 500.00, 'inactivo');

-- ============================================
-- VISTAS ÚTILES
-- ============================================

-- Vista: Reporte completo de cuentas
-- Tasas: IVA=15%, Retención Fuente=3%, Retención IVA=70% del IVA
CREATE OR REPLACE VIEW vista_reporte_cuentas AS
SELECT
    c.num_factura,
    c.cliente_id,
    cl.nombre AS cliente,
    cl.identificacion,
    c.fecha_factura,
    c.cancelada,
    c.detalle_anulacion,
    c.fecha_anulacion,
    c.incluye_iva,
    c.incluye_retencion_fuente,
    c.incluye_retencion_iva,
    c.valor_factura AS subtotal,
    CASE WHEN c.incluye_iva THEN ROUND(c.valor_factura * 0.15, 2) ELSE 0 END AS iva,
    CASE WHEN c.incluye_retencion_fuente THEN ROUND(c.valor_factura * 0.03, 2) ELSE 0 END AS retencion_fuente,
    CASE WHEN c.incluye_retencion_iva AND c.incluye_iva THEN ROUND(c.valor_factura * 0.15 * 0.70, 2) ELSE 0 END AS retencion_iva,
    (
        c.valor_factura
        + CASE WHEN c.incluye_iva THEN ROUND(c.valor_factura * 0.15, 2) ELSE 0 END
        - CASE WHEN c.incluye_retencion_fuente THEN ROUND(c.valor_factura * 0.03, 2) ELSE 0 END
        - CASE WHEN c.incluye_retencion_iva AND c.incluye_iva THEN ROUND(c.valor_factura * 0.15 * 0.70, 2) ELSE 0 END
    ) AS por_cobrar,
    COALESCE(SUM(a.valor_abono), 0) AS total_abonos,
    (
        c.valor_factura
        + CASE WHEN c.incluye_iva THEN ROUND(c.valor_factura * 0.15, 2) ELSE 0 END
        - CASE WHEN c.incluye_retencion_fuente THEN ROUND(c.valor_factura * 0.03, 2) ELSE 0 END
        - CASE WHEN c.incluye_retencion_iva AND c.incluye_iva THEN ROUND(c.valor_factura * 0.15 * 0.70, 2) ELSE 0 END
        - COALESCE(SUM(a.valor_abono), 0)
    ) AS saldo_pendiente
FROM cuentas c
JOIN clientes cl ON c.cliente_id = cl.id
LEFT JOIN abonos a ON c.num_factura = a.num_factura
GROUP BY c.num_factura, c.cliente_id, cl.nombre, cl.identificacion, c.fecha_factura, c.valor_factura,
         c.cancelada, c.detalle_anulacion, c.fecha_anulacion,
         c.incluye_iva, c.incluye_retencion_fuente, c.incluye_retencion_iva
ORDER BY c.num_factura ASC;

-- Vista: Inventario con alertas de caducidad
CREATE OR REPLACE VIEW vista_inventario_alertas AS
SELECT
    a.id,
    a.tipo_articulo,
    a.nombre_articulo,
    a.cantidad,
    a.talla,
    a.marca,
    a.modelo,
    a.numero_serie,
    a.calibre,
    a.fecha_caducidad,
    a.codigo_pantalla,
    a.codigo_radio,
    a.version,
    a.ubicacion_id,
    a.created_at,
    a.updated_at,
    a.activo,
    u.nombre AS ubicacion_nombre,
    CASE
        WHEN a.fecha_caducidad IS NULL THEN 'sin_alerta'
        WHEN a.fecha_caducidad < CURRENT_DATE THEN 'vencida'
        WHEN a.fecha_caducidad <= CURRENT_DATE + INTERVAL '30 days' THEN 'proxima_a_vencer'
        ELSE 'vigente'
    END AS estado_caducidad,
    u.cliente_id,
    c.nombre AS cliente_nombre
FROM articulos a
LEFT JOIN ubicaciones u ON a.ubicacion_id = u.id
LEFT JOIN clientes c ON c.id = u.cliente_id
WHERE a.activo = TRUE;

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger: Actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION enforce_manzana_urbanizacion()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ubicaciones
        WHERE id = NEW.ubicacion_id AND tipo_punto = 'URBANIZACION'
    ) THEN
        RAISE EXCEPTION 'Las Manzanas solo pertenecen a ubicaciones URBANIZACION'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION prevent_urbanizacion_downgrade_with_manzanas()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.tipo_punto = 'URBANIZACION'
       AND NEW.tipo_punto <> 'URBANIZACION'
       AND EXISTS (SELECT 1 FROM manzanas WHERE ubicacion_id = OLD.id) THEN
        RAISE EXCEPTION 'No se puede cambiar a GENERAL una Urbanización con Manzanas'
            USING ERRCODE = '23503';
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION enforce_residente_active_chain()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.activo = TRUE AND NOT EXISTS (
        SELECT 1 FROM villas v
        JOIN manzanas m ON m.id = v.manzana_id
        JOIN ubicaciones u ON u.id = m.ubicacion_id
        WHERE v.id = NEW.villa_id AND v.estado = 'activo'
          AND m.estado = 'activo' AND u.tipo_punto = 'URBANIZACION'
    ) THEN
        RAISE EXCEPTION 'El Residente activo requiere Villa, Manzana y Urbanización activas'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION prevent_villa_deactivation_with_resident()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.estado = 'activo' AND NEW.estado = 'inactivo'
       AND EXISTS (SELECT 1 FROM residentes WHERE villa_id = OLD.id AND es_principal = TRUE AND activo = TRUE) THEN
        RAISE EXCEPTION 'No se puede desactivar una Villa con Residente principal activo'
            USING ERRCODE = '23503';
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Colaborador es requerido en usuarios nuevos o al reasignarlo, pero se
-- permite preservar el NULL legacy de usuarios creados antes de esta regla
-- (ver migración 026).
CREATE OR REPLACE FUNCTION enforce_usuario_colaborador_required()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.colaborador_id IS NULL THEN
        IF TG_OP = 'INSERT' OR OLD.colaborador_id IS NOT NULL THEN
            RAISE EXCEPTION 'El colaborador es requerido'
                USING ERRCODE = '23514', CONSTRAINT = 'usuarios_colaborador_required';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_manzana_urbanizacion_trigger
    BEFORE INSERT OR UPDATE OF ubicacion_id ON manzanas
    FOR EACH ROW EXECUTE FUNCTION enforce_manzana_urbanizacion();

CREATE TRIGGER prevent_urbanizacion_downgrade_trigger
    BEFORE UPDATE OF tipo_punto ON ubicaciones
    FOR EACH ROW EXECUTE FUNCTION prevent_urbanizacion_downgrade_with_manzanas();

CREATE TRIGGER enforce_residente_active_chain_trigger
    BEFORE INSERT OR UPDATE OF villa_id, activo ON residentes
    FOR EACH ROW EXECUTE FUNCTION enforce_residente_active_chain();

CREATE TRIGGER prevent_villa_deactivation_with_resident_trigger
    BEFORE UPDATE OF estado ON villas
    FOR EACH ROW EXECUTE FUNCTION prevent_villa_deactivation_with_resident();

CREATE TRIGGER trg_usuarios_colaborador_required
    BEFORE INSERT OR UPDATE OF colaborador_id ON usuarios
    FOR EACH ROW EXECUTE FUNCTION enforce_usuario_colaborador_required();

-- Un colaborador inactivo no debe conservar acceso al sistema.
CREATE OR REPLACE FUNCTION revoke_usuario_access_on_colaborador_inactivo()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.estado = 'inactivo' AND OLD.estado IS DISTINCT FROM 'inactivo' THEN
        UPDATE usuarios
        SET activo = FALSE
        WHERE colaborador_id = NEW.id AND activo = TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_revoke_usuario_access_on_colaborador_inactivo
    AFTER UPDATE OF estado ON colaboradores
    FOR EACH ROW EXECUTE FUNCTION revoke_usuario_access_on_colaborador_inactivo();

CREATE TRIGGER update_usuarios_updated_at BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON clientes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cuentas_updated_at BEFORE UPDATE ON cuentas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_articulos_updated_at BEFORE UPDATE ON articulos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_colaboradores_updated_at BEFORE UPDATE ON colaboradores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_manzanas_updated_at BEFORE UPDATE ON manzanas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_villas_updated_at BEFORE UPDATE ON villas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_residentes_updated_at BEFORE UPDATE ON residentes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

INSERT INTO schema_version (version, description) VALUES
(2, 'Performance indexes, audit logging, and data integrity constraints'),
(3, 'Add pagos table as payment header; link abonos via pago_id'),
(4, 'Detalle de anulacion de facturas'),
(5, 'Remove obsolete retenciones table'),
(6, 'Add otro type to inventory article type constraint'),
(7, 'Expose radio fields in inventory alerts view'),
(8, 'Campos de radio unicos en inventario'),
(9, 'Add nombre and apellido columns to usuarios'),
(10, 'Ensure production columns for cuentas and pagos'),
(11, 'Historial de bajas de articulos'),
(12, 'Index on abonos(pago_id) for getPagos join performance'),
(13, 'Reconcile production schema, constraints, triggers and indexes'),
(14, 'Improve inventory table query performance'),
(15, 'Inventory transactional integrity, voiding and logical deletion metadata'),
(16, 'Inventory exact stock effects and reversible history markers'),
(17, 'Case-insensitive unique normalized locations'),
(18, 'Clientes catalog normalization'),
(19, 'Relate locations to clients with nullable cliente_id'),
(20, 'Add Guardia and Monitorista user roles'),
(21, 'Add optional one-to-one Usuario-Colaborador relationship'),
(22, 'Add Guardia-ubicacion assignments'),
(23, 'Add location point type'),
(24, 'Add blocks and villas for urbanization locations'),
(25, 'Add primary residents for villas'),
(26, 'Require collaborator for new and updated users'),
(27, 'Add minimal immutable logbook records persistence'),
(28, 'Add optional urban context to logbook records');

-- ============================================
-- FINALIZADO
-- ============================================
-- Módulo de visitas y ajustes acumulados posteriores a la bitácora base.
CREATE TABLE IF NOT EXISTS bitacora_visit_form_versions (
  id SERIAL PRIMARY KEY,
  ubicacion_id INTEGER NOT NULL REFERENCES ubicaciones(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  version INTEGER NOT NULL,
  titulo VARCHAR(150) NOT NULL DEFAULT 'Formulario de visitas',
  estado VARCHAR(12) NOT NULL DEFAULT 'ACTIVE' CHECK (estado IN ('ACTIVE', 'ARCHIVED')),
  created_by INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  published_by INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at TIMESTAMP NULL,
  CONSTRAINT bitacora_visit_form_versions_unique_version UNIQUE (ubicacion_id, version),
  CONSTRAINT bitacora_visit_form_versions_id_ubicacion_unique UNIQUE (id, ubicacion_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bitacora_visit_form_versions_one_active
  ON bitacora_visit_form_versions (ubicacion_id)
  WHERE estado = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_bitacora_visit_form_versions_ubicacion
  ON bitacora_visit_form_versions (ubicacion_id);

CREATE TABLE IF NOT EXISTS bitacora_visit_form_fields (
  id SERIAL PRIMARY KEY,
  form_version_id INTEGER NOT NULL REFERENCES bitacora_visit_form_versions(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  field_key VARCHAR(80) NOT NULL,
  label VARCHAR(120) NOT NULL,
  type VARCHAR(12) NOT NULL CHECK (type IN ('text', 'textarea', 'number', 'select', 'checkbox', 'cedula', 'placa')),
  required BOOLEAN NOT NULL DEFAULT FALSE,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT bitacora_visit_form_fields_unique_key UNIQUE (form_version_id, field_key)
);

CREATE INDEX IF NOT EXISTS idx_bitacora_visit_form_fields_version
  ON bitacora_visit_form_fields (form_version_id, sort_order, id);

ALTER TABLE residentes
  ADD CONSTRAINT residentes_id_villa_unique UNIQUE (id, villa_id);

CREATE TABLE IF NOT EXISTS bitacora_visitas (
  id SERIAL PRIMARY KEY,
  ubicacion_id INTEGER NOT NULL REFERENCES ubicaciones(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  manzana_id INTEGER NOT NULL,
  villa_id INTEGER NOT NULL,
  residente_principal_id INTEGER NOT NULL,
  form_version_id INTEGER NOT NULL,
  visitante_nombre VARCHAR(150) NOT NULL,
  visitante_documento VARCHAR(80) NOT NULL,
  visitante_telefono VARCHAR(80) NOT NULL,
  tipo_ingreso VARCHAR(10) NOT NULL CHECK (tipo_ingreso IN ('PEATONAL', 'VEHICULO')),
  placa VARCHAR(30) NULL,
  estado VARCHAR(12) NOT NULL DEFAULT 'ABIERTA' CHECK (estado IN ('ABIERTA', 'CERRADA', 'ANULADA')),
  entrada_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  salida_at TIMESTAMP NULL,
  registrado_por_usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  registrado_por_colaborador_id INTEGER NOT NULL REFERENCES colaboradores(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  cerrado_por_usuario_id INTEGER REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  cerrado_por_colaborador_id INTEGER REFERENCES colaboradores(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  entrada_bitacora_registro_id INTEGER REFERENCES bitacora_registros(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  salida_bitacora_registro_id INTEGER REFERENCES bitacora_registros(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT bitacora_visitas_manzana_ubicacion_fkey
    FOREIGN KEY (manzana_id, ubicacion_id) REFERENCES manzanas(id, ubicacion_id) ON DELETE RESTRICT,
  CONSTRAINT bitacora_visitas_villa_manzana_fkey
    FOREIGN KEY (villa_id, manzana_id) REFERENCES villas(id, manzana_id) ON DELETE RESTRICT,
  CONSTRAINT bitacora_visitas_residente_villa_fkey
    FOREIGN KEY (residente_principal_id, villa_id) REFERENCES residentes(id, villa_id)
      ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT bitacora_visitas_form_ubicacion_fkey
    FOREIGN KEY (form_version_id, ubicacion_id) REFERENCES bitacora_visit_form_versions(id, ubicacion_id)
      ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT bitacora_visitas_placa_por_tipo_check
    CHECK (tipo_ingreso = 'PEATONAL' OR (placa IS NOT NULL AND BTRIM(placa) <> '')),
  CONSTRAINT bitacora_visitas_cedula_check
    CHECK (visitante_documento ~ '^[0-9]{10}$')
);

CREATE INDEX IF NOT EXISTS idx_bitacora_visitas_ubicacion_estado
  ON bitacora_visitas (ubicacion_id, estado, entrada_at DESC);

CREATE INDEX IF NOT EXISTS idx_bitacora_visitas_casa
  ON bitacora_visitas (manzana_id, villa_id);

CREATE INDEX IF NOT EXISTS idx_bitacora_visitas_placa
  ON bitacora_visitas (LOWER(placa));

CREATE TABLE IF NOT EXISTS bitacora_visita_respuestas (
  id SERIAL PRIMARY KEY,
  visita_id INTEGER NOT NULL REFERENCES bitacora_visitas(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  form_field_id INTEGER NOT NULL REFERENCES bitacora_visit_form_fields(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  field_key_snapshot VARCHAR(80) NOT NULL,
  label_snapshot VARCHAR(120) NOT NULL,
  type_snapshot VARCHAR(12) NOT NULL,
  value_text TEXT NULL,
  value_json JSONB NULL,
  CONSTRAINT bitacora_visita_respuestas_unique_field UNIQUE (visita_id, form_field_id)
);

CREATE INDEX IF NOT EXISTS idx_bitacora_visita_respuestas_visita
  ON bitacora_visita_respuestas (visita_id);

CREATE OR REPLACE FUNCTION enforce_bitacora_visit_form_urbanizacion()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM ubicaciones
    WHERE id = NEW.ubicacion_id AND tipo_punto = 'URBANIZACION'
  ) THEN
    RAISE EXCEPTION 'Los formularios de visita solo pertenecen a ubicaciones URBANIZACION'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_bitacora_visit_form_urbanizacion_trigger ON bitacora_visit_form_versions;
CREATE TRIGGER enforce_bitacora_visit_form_urbanizacion_trigger
  BEFORE INSERT OR UPDATE OF ubicacion_id ON bitacora_visit_form_versions
  FOR EACH ROW EXECUTE FUNCTION enforce_bitacora_visit_form_urbanizacion();

CREATE OR REPLACE FUNCTION enforce_bitacora_visit_form_version_lifecycle()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Los formularios de visita publicados no se pueden eliminar'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.estado = 'ACTIVE' AND NEW.estado = 'ARCHIVED'
     AND NEW.id = OLD.id
     AND NEW.ubicacion_id = OLD.ubicacion_id
     AND NEW.version = OLD.version
     AND NEW.titulo = OLD.titulo
     AND NEW.created_by IS NOT DISTINCT FROM OLD.created_by
     AND NEW.published_by IS NOT DISTINCT FROM OLD.published_by
     AND NEW.created_at = OLD.created_at
     AND NEW.published_at IS NOT DISTINCT FROM OLD.published_at THEN
    RETURN NEW;
  END IF;

  IF OLD.estado = 'ACTIVE' AND NEW.estado = 'ACTIVE'
     AND OLD.published_at IS NULL AND NEW.published_at IS NOT NULL
     AND NEW.id = OLD.id
     AND NEW.ubicacion_id = OLD.ubicacion_id
     AND NEW.version = OLD.version
     AND NEW.titulo = OLD.titulo
     AND NEW.created_by IS NOT DISTINCT FROM OLD.created_by
     AND NEW.published_by IS NOT DISTINCT FROM OLD.published_by
     AND NEW.created_at = OLD.created_at THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Los formularios de visita publicados son inmutables'
    USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_bitacora_visit_form_version_lifecycle_trigger ON bitacora_visit_form_versions;
CREATE TRIGGER enforce_bitacora_visit_form_version_lifecycle_trigger
  BEFORE UPDATE OR DELETE ON bitacora_visit_form_versions
  FOR EACH ROW EXECUTE FUNCTION enforce_bitacora_visit_form_version_lifecycle();

CREATE OR REPLACE FUNCTION enforce_bitacora_visit_form_field_immutability()
RETURNS TRIGGER AS $$
DECLARE
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF EXISTS (
      SELECT 1
      FROM bitacora_visit_form_versions
      WHERE id = NEW.form_version_id AND published_at IS NULL
    ) THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'No se pueden agregar campos a un formulario de visita publicado'
      USING ERRCODE = '23514';
  END IF;

  RAISE EXCEPTION 'Los campos de formularios de visita publicados son inmutables'
    USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_bitacora_visit_form_field_immutability_trigger ON bitacora_visit_form_fields;
CREATE TRIGGER enforce_bitacora_visit_form_field_immutability_trigger
  BEFORE INSERT OR UPDATE OR DELETE ON bitacora_visit_form_fields
  FOR EACH ROW EXECUTE FUNCTION enforce_bitacora_visit_form_field_immutability();

CREATE OR REPLACE FUNCTION enforce_bitacora_visita_titular_activo()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM residentes
    WHERE id = NEW.residente_principal_id
      AND villa_id = NEW.villa_id
      AND es_principal = TRUE
      AND activo = TRUE
  ) THEN
    RAISE EXCEPTION 'La visita debe apuntar al titular activo de la Villa'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_bitacora_visita_titular_activo_trigger ON bitacora_visitas;
CREATE TRIGGER enforce_bitacora_visita_titular_activo_trigger
  BEFORE INSERT OR UPDATE OF residente_principal_id, villa_id ON bitacora_visitas
  FOR EACH ROW EXECUTE FUNCTION enforce_bitacora_visita_titular_activo();

DROP TRIGGER IF EXISTS update_bitacora_visitas_updated_at ON bitacora_visitas;
CREATE TRIGGER update_bitacora_visitas_updated_at BEFORE UPDATE ON bitacora_visitas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

INSERT INTO schema_version (version, description)
VALUES (29, 'Add versioned urbanization visit forms and visits')
ON CONFLICT (version) DO NOTHING;

ALTER TABLE bitacora_visit_form_versions
  ADD COLUMN IF NOT EXISTS mostrar_fecha_hora BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE bitacora_visit_form_fields
  ADD COLUMN IF NOT EXISTS aplica_a VARCHAR(10) NOT NULL DEFAULT 'TODOS';

ALTER TABLE bitacora_visit_form_fields
  DROP CONSTRAINT IF EXISTS bitacora_visit_form_fields_aplica_a_check;

ALTER TABLE bitacora_visit_form_fields
  ADD CONSTRAINT bitacora_visit_form_fields_aplica_a_check
  CHECK (aplica_a IN ('TODOS', 'PEATON', 'VEHICULO'));

ALTER TABLE bitacora_visitas
  ADD COLUMN IF NOT EXISTS tipo_ingreso VARCHAR(10);

ALTER TABLE bitacora_visitas
  DROP CONSTRAINT IF EXISTS bitacora_visitas_tipo_ingreso_check;

ALTER TABLE bitacora_visitas
  DROP CONSTRAINT IF EXISTS bitacora_visitas_placa_por_tipo_check;

UPDATE bitacora_visitas
SET tipo_ingreso = 'PEATON'
WHERE tipo_ingreso = 'PEATONAL';

UPDATE bitacora_visitas
SET tipo_ingreso = CASE
  WHEN placa IS NOT NULL AND BTRIM(placa) <> '' THEN 'VEHICULO'
  ELSE 'PEATON'
END
WHERE tipo_ingreso IS NULL;

ALTER TABLE bitacora_visitas
  ALTER COLUMN tipo_ingreso SET NOT NULL;

ALTER TABLE bitacora_visitas
  ADD CONSTRAINT bitacora_visitas_tipo_ingreso_check
  CHECK (tipo_ingreso IN ('PEATON', 'VEHICULO'));

ALTER TABLE bitacora_visitas
  ADD CONSTRAINT bitacora_visitas_placa_por_tipo_check
  CHECK (tipo_ingreso = 'PEATON' OR (placa IS NOT NULL AND BTRIM(placa) <> ''));

CREATE OR REPLACE FUNCTION enforce_bitacora_visit_form_version_lifecycle()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Los formularios de visita publicados no se pueden eliminar'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.estado = 'ACTIVE' AND NEW.estado = 'ARCHIVED'
     AND NEW.id = OLD.id
     AND NEW.ubicacion_id = OLD.ubicacion_id
     AND NEW.version = OLD.version
     AND NEW.titulo = OLD.titulo
     AND NEW.mostrar_fecha_hora = OLD.mostrar_fecha_hora
     AND NEW.created_by IS NOT DISTINCT FROM OLD.created_by
     AND NEW.published_by IS NOT DISTINCT FROM OLD.published_by
     AND NEW.created_at = OLD.created_at
     AND NEW.published_at IS NOT DISTINCT FROM OLD.published_at THEN
    RETURN NEW;
  END IF;

  IF OLD.estado = 'ACTIVE' AND NEW.estado = 'ACTIVE'
     AND OLD.published_at IS NULL AND NEW.published_at IS NOT NULL
     AND NEW.id = OLD.id
     AND NEW.ubicacion_id = OLD.ubicacion_id
     AND NEW.version = OLD.version
     AND NEW.titulo = OLD.titulo
     AND NEW.mostrar_fecha_hora = OLD.mostrar_fecha_hora
     AND NEW.created_by IS NOT DISTINCT FROM OLD.created_by
     AND NEW.published_by IS NOT DISTINCT FROM OLD.published_by
     AND NEW.created_at = OLD.created_at THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Los formularios de visita publicados son inmutables'
    USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

INSERT INTO schema_version (version, description)
VALUES (30, 'Add visit form applicability and display configuration')
ON CONFLICT (version) DO NOTHING;

ALTER TABLE bitacora_visitas
  ADD COLUMN IF NOT EXISTS motivo_anulacion TEXT NULL;

INSERT INTO schema_version (version, description)
VALUES (31, 'Persist visita cancellation reason')
ON CONFLICT (version) DO NOTHING;

CREATE TABLE IF NOT EXISTS bitacora_visit_form_tipos (
  id SERIAL PRIMARY KEY,
  form_version_id INTEGER NOT NULL REFERENCES bitacora_visit_form_versions(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  nombre VARCHAR(60) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT bitacora_visit_form_tipos_unique_nombre UNIQUE (form_version_id, nombre),
  CONSTRAINT bitacora_visit_form_tipos_id_version_unique UNIQUE (id, form_version_id)
);

CREATE INDEX IF NOT EXISTS idx_bitacora_visit_form_tipos_version
  ON bitacora_visit_form_tipos (form_version_id, sort_order, id);

ALTER TABLE bitacora_visit_form_fields
  ADD CONSTRAINT bitacora_visit_form_fields_id_version_unique UNIQUE (id, form_version_id);

CREATE TABLE IF NOT EXISTS bitacora_visit_form_field_tipos (
  form_field_id INTEGER NOT NULL,
  form_version_id INTEGER NOT NULL,
  tipo_id INTEGER NOT NULL,
  PRIMARY KEY (form_field_id, tipo_id),
  CONSTRAINT bitacora_visit_form_field_tipos_field_fkey
    FOREIGN KEY (form_field_id, form_version_id)
    REFERENCES bitacora_visit_form_fields (id, form_version_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT bitacora_visit_form_field_tipos_tipo_fkey
    FOREIGN KEY (tipo_id, form_version_id)
    REFERENCES bitacora_visit_form_tipos (id, form_version_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_bitacora_visit_form_field_tipos_tipo
  ON bitacora_visit_form_field_tipos (tipo_id);

INSERT INTO bitacora_visit_form_tipos (form_version_id, nombre, sort_order)
SELECT id, 'Peatón', 1 FROM bitacora_visit_form_versions;

INSERT INTO bitacora_visit_form_tipos (form_version_id, nombre, sort_order)
SELECT id, 'Vehículo', 2 FROM bitacora_visit_form_versions;

ALTER TABLE bitacora_visit_form_fields
  ADD COLUMN IF NOT EXISTS aplica_a_nuevo VARCHAR(20);

ALTER TABLE bitacora_visit_form_fields
  DISABLE TRIGGER enforce_bitacora_visit_form_field_immutability_trigger;

UPDATE bitacora_visit_form_fields
SET aplica_a_nuevo = CASE WHEN aplica_a = 'TODOS' THEN 'TODOS' ELSE 'SELECCIONADOS' END;

ALTER TABLE bitacora_visit_form_fields
  ENABLE TRIGGER enforce_bitacora_visit_form_field_immutability_trigger;

INSERT INTO bitacora_visit_form_field_tipos (form_field_id, form_version_id, tipo_id)
SELECT f.id, f.form_version_id, t.id
FROM bitacora_visit_form_fields f
JOIN bitacora_visit_form_tipos t
  ON t.form_version_id = f.form_version_id
 AND t.nombre = (CASE f.aplica_a WHEN 'PEATON' THEN 'Peatón' WHEN 'VEHICULO' THEN 'Vehículo' END)
WHERE f.aplica_a IN ('PEATON', 'VEHICULO');

ALTER TABLE bitacora_visit_form_fields
  DROP CONSTRAINT IF EXISTS bitacora_visit_form_fields_aplica_a_check;

ALTER TABLE bitacora_visit_form_fields
  DROP COLUMN aplica_a;

ALTER TABLE bitacora_visit_form_fields
  RENAME COLUMN aplica_a_nuevo TO aplica_a;

ALTER TABLE bitacora_visit_form_fields
  ALTER COLUMN aplica_a SET NOT NULL,
  ALTER COLUMN aplica_a SET DEFAULT 'TODOS';

ALTER TABLE bitacora_visit_form_fields
  ADD CONSTRAINT bitacora_visit_form_fields_aplica_a_check
  CHECK (aplica_a IN ('TODOS', 'SELECCIONADOS'));

ALTER TABLE bitacora_visitas
  ADD COLUMN IF NOT EXISTS tipo_visita_id INTEGER;

UPDATE bitacora_visitas bv
SET tipo_visita_id = t.id
FROM bitacora_visit_form_tipos t
WHERE t.form_version_id = bv.form_version_id
  AND t.nombre = (CASE bv.tipo_ingreso WHEN 'PEATON' THEN 'Peatón' WHEN 'VEHICULO' THEN 'Vehículo' END);

ALTER TABLE bitacora_visitas
  ALTER COLUMN tipo_visita_id SET NOT NULL;

ALTER TABLE bitacora_visitas
  DROP CONSTRAINT IF EXISTS bitacora_visitas_tipo_ingreso_check;

ALTER TABLE bitacora_visitas
  DROP CONSTRAINT IF EXISTS bitacora_visitas_placa_por_tipo_check;

ALTER TABLE bitacora_visitas
  DROP COLUMN tipo_ingreso;

ALTER TABLE bitacora_visitas
  ADD CONSTRAINT bitacora_visitas_tipo_visita_fkey
  FOREIGN KEY (tipo_visita_id, form_version_id)
  REFERENCES bitacora_visit_form_tipos (id, form_version_id)
  ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_bitacora_visitas_tipo_visita
  ON bitacora_visitas (tipo_visita_id);


CREATE OR REPLACE FUNCTION enforce_bitacora_visit_form_tipo_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF EXISTS (
      SELECT 1
      FROM bitacora_visit_form_versions
      WHERE id = NEW.form_version_id AND published_at IS NULL
    ) THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'No se pueden agregar tipos de visita a un formulario publicado'
      USING ERRCODE = '23514';
  END IF;

  RAISE EXCEPTION 'Los tipos de visita de formularios publicados son inmutables'
    USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_bitacora_visit_form_tipo_immutability_trigger ON bitacora_visit_form_tipos;
CREATE TRIGGER enforce_bitacora_visit_form_tipo_immutability_trigger
  BEFORE INSERT OR UPDATE OR DELETE ON bitacora_visit_form_tipos
  FOR EACH ROW EXECUTE FUNCTION enforce_bitacora_visit_form_tipo_immutability();

CREATE OR REPLACE FUNCTION enforce_bitacora_visit_form_field_tipo_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF EXISTS (
      SELECT 1
      FROM bitacora_visit_form_versions
      WHERE id = NEW.form_version_id AND published_at IS NULL
    ) THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'No se pueden asignar tipos de visita a preguntas de un formulario publicado'
      USING ERRCODE = '23514';
  END IF;

  RAISE EXCEPTION 'La asignación de tipos de visita a preguntas publicadas es inmutable'
    USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_bitacora_visit_form_field_tipo_immutability_trigger ON bitacora_visit_form_field_tipos;
CREATE TRIGGER enforce_bitacora_visit_form_field_tipo_immutability_trigger
  BEFORE INSERT OR UPDATE OR DELETE ON bitacora_visit_form_field_tipos
  FOR EACH ROW EXECUTE FUNCTION enforce_bitacora_visit_form_field_tipo_immutability();

INSERT INTO schema_version (version, description)
VALUES (32, 'Add per-form-version configurable visit types, replacing PEATON/VEHICULO')
ON CONFLICT (version) DO NOTHING;

ALTER TABLE bitacora_visitas
  ALTER COLUMN visitante_nombre DROP NOT NULL,
  ALTER COLUMN visitante_documento DROP NOT NULL,
  ALTER COLUMN visitante_telefono DROP NOT NULL;

ALTER TABLE bitacora_visitas
  DROP CONSTRAINT IF EXISTS bitacora_visitas_cedula_check;

ALTER TABLE bitacora_visitas
  ADD CONSTRAINT bitacora_visitas_cedula_check
  CHECK (visitante_documento IS NULL OR visitante_documento ~ '^[0-9]{10}$');

INSERT INTO schema_version (version, description)
VALUES (33, 'Make bitacora_visitas visitor name/document/phone optional, matching placa')
ON CONFLICT (version) DO NOTHING;

CREATE TABLE IF NOT EXISTS bitacora_visit_form_groups (
  id SERIAL PRIMARY KEY,
  form_version_id INTEGER NOT NULL REFERENCES bitacora_visit_form_versions(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  group_key VARCHAR(80) NOT NULL,
  label VARCHAR(120) NOT NULL,
  min_count SMALLINT NOT NULL DEFAULT 0 CHECK (min_count IN (0, 1)),
  aplica_a VARCHAR(20) NOT NULL DEFAULT 'TODOS' CHECK (aplica_a IN ('TODOS', 'SELECCIONADOS')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT bitacora_visit_form_groups_unique_key UNIQUE (form_version_id, group_key),
  CONSTRAINT bitacora_visit_form_groups_id_version_unique UNIQUE (id, form_version_id)
);

CREATE INDEX IF NOT EXISTS idx_bitacora_visit_form_groups_version
  ON bitacora_visit_form_groups (form_version_id, sort_order, id);

CREATE TABLE IF NOT EXISTS bitacora_visit_form_group_fields (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL,
  form_version_id INTEGER NOT NULL,
  field_key VARCHAR(80) NOT NULL,
  label VARCHAR(120) NOT NULL,
  type VARCHAR(12) NOT NULL CHECK (type IN ('text', 'textarea', 'number', 'select', 'checkbox', 'cedula', 'placa')),
  required BOOLEAN NOT NULL DEFAULT FALSE,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT bitacora_visit_form_group_fields_unique_key UNIQUE (group_id, field_key),
  CONSTRAINT bitacora_visit_form_group_fields_group_fkey
    FOREIGN KEY (group_id, form_version_id)
    REFERENCES bitacora_visit_form_groups (id, form_version_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_bitacora_visit_form_group_fields_group
  ON bitacora_visit_form_group_fields (group_id, sort_order, id);

CREATE TABLE IF NOT EXISTS bitacora_visit_form_group_tipos (
  group_id INTEGER NOT NULL,
  form_version_id INTEGER NOT NULL,
  tipo_id INTEGER NOT NULL,
  PRIMARY KEY (group_id, tipo_id),
  CONSTRAINT bitacora_visit_form_group_tipos_group_fkey
    FOREIGN KEY (group_id, form_version_id)
    REFERENCES bitacora_visit_form_groups (id, form_version_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT bitacora_visit_form_group_tipos_tipo_fkey
    FOREIGN KEY (tipo_id, form_version_id)
    REFERENCES bitacora_visit_form_tipos (id, form_version_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_bitacora_visit_form_group_tipos_tipo
  ON bitacora_visit_form_group_tipos (tipo_id);


CREATE OR REPLACE FUNCTION enforce_bitacora_visit_form_group_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF EXISTS (
      SELECT 1 FROM bitacora_visit_form_versions
      WHERE id = NEW.form_version_id AND published_at IS NULL
    ) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'No se pueden agregar grupos a un formulario de visita publicado'
      USING ERRCODE = '23514';
  END IF;
  RAISE EXCEPTION 'Los grupos de formularios de visita publicados son inmutables'
    USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_bitacora_visit_form_group_immutability_trigger ON bitacora_visit_form_groups;
CREATE TRIGGER enforce_bitacora_visit_form_group_immutability_trigger
  BEFORE INSERT OR UPDATE OR DELETE ON bitacora_visit_form_groups
  FOR EACH ROW EXECUTE FUNCTION enforce_bitacora_visit_form_group_immutability();

CREATE OR REPLACE FUNCTION enforce_bitacora_visit_form_group_field_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF EXISTS (
      SELECT 1 FROM bitacora_visit_form_versions
      WHERE id = NEW.form_version_id AND published_at IS NULL
    ) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'No se pueden agregar campos a un grupo de un formulario publicado'
      USING ERRCODE = '23514';
  END IF;
  RAISE EXCEPTION 'Los campos de grupos de formularios de visita publicados son inmutables'
    USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_bitacora_visit_form_group_field_immutability_trigger ON bitacora_visit_form_group_fields;
CREATE TRIGGER enforce_bitacora_visit_form_group_field_immutability_trigger
  BEFORE INSERT OR UPDATE OR DELETE ON bitacora_visit_form_group_fields
  FOR EACH ROW EXECUTE FUNCTION enforce_bitacora_visit_form_group_field_immutability();

CREATE OR REPLACE FUNCTION enforce_bitacora_visit_form_group_tipo_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF EXISTS (
      SELECT 1 FROM bitacora_visit_form_versions
      WHERE id = NEW.form_version_id AND published_at IS NULL
    ) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'No se pueden asignar tipos de visita a grupos de un formulario publicado'
      USING ERRCODE = '23514';
  END IF;
  RAISE EXCEPTION 'La asignación de tipos de visita a grupos publicados es inmutable'
    USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_bitacora_visit_form_group_tipo_immutability_trigger ON bitacora_visit_form_group_tipos;
CREATE TRIGGER enforce_bitacora_visit_form_group_tipo_immutability_trigger
  BEFORE INSERT OR UPDATE OR DELETE ON bitacora_visit_form_group_tipos
  FOR EACH ROW EXECUTE FUNCTION enforce_bitacora_visit_form_group_tipo_immutability();


CREATE TABLE IF NOT EXISTS bitacora_visita_grupo_registros (
  id SERIAL PRIMARY KEY,
  visita_id INTEGER NOT NULL REFERENCES bitacora_visitas(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  group_id INTEGER NOT NULL,
  form_version_id INTEGER NOT NULL,
  group_key_snapshot VARCHAR(80) NOT NULL,
  label_snapshot VARCHAR(120) NOT NULL,
  entry_index INTEGER NOT NULL CHECK (entry_index >= 1),
  respuestas JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT bitacora_visita_grupo_registros_unique_entry UNIQUE (visita_id, group_id, entry_index),
  CONSTRAINT bitacora_visita_grupo_registros_group_fkey
    FOREIGN KEY (group_id, form_version_id)
    REFERENCES bitacora_visit_form_groups (id, form_version_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_bitacora_visita_grupo_registros_visita
  ON bitacora_visita_grupo_registros (visita_id, group_id, entry_index);

INSERT INTO schema_version (version, description)
VALUES (34, 'Add repeatable person groups to visit forms (grupos)')
ON CONFLICT (version) DO NOTHING;

ALTER TABLE bitacora_visit_form_tipos
  ADD COLUMN IF NOT EXISTS requiere_salida BOOLEAN NOT NULL DEFAULT TRUE;

INSERT INTO schema_version (version, description)
VALUES (35, 'Add requiere_salida to bitacora_visit_form_tipos (per-tipo auto-close)')
ON CONFLICT (version) DO NOTHING;

ALTER TABLE bitacora_registros
  ADD COLUMN IF NOT EXISTS origen VARCHAR(10) NOT NULL DEFAULT 'MANUAL'
    CHECK (origen IN ('MANUAL', 'VISITA'));

UPDATE bitacora_registros br
SET origen = 'VISITA'
WHERE EXISTS (
  SELECT 1 FROM bitacora_visitas bv
  WHERE bv.entrada_bitacora_registro_id = br.id
     OR bv.salida_bitacora_registro_id = br.id
);

CREATE INDEX IF NOT EXISTS idx_bitacora_registros_origen
  ON bitacora_registros (origen);

INSERT INTO schema_version (version, description)
VALUES (36, 'Add origen to bitacora_registros to separate manual Registro from visit audit trail')
ON CONFLICT (version) DO NOTHING;

ALTER TABLE bitacora_visitas
  DROP CONSTRAINT IF EXISTS bitacora_visitas_estado_check;

ALTER TABLE bitacora_visitas
  ALTER COLUMN estado TYPE VARCHAR(20);

ALTER TABLE bitacora_visitas
  ADD CONSTRAINT bitacora_visitas_estado_check
  CHECK (estado IN ('ABIERTA', 'CERRADA', 'ANULADA', 'NO_AUTORIZADA'));

ALTER TABLE bitacora_visitas
  ADD COLUMN IF NOT EXISTS motivo_no_autorizacion TEXT NULL;

ALTER TABLE bitacora_visitas
  DROP CONSTRAINT IF EXISTS bitacora_visitas_no_autorizacion_coherente_check;

ALTER TABLE bitacora_visitas
  ADD CONSTRAINT bitacora_visitas_no_autorizacion_coherente_check
  CHECK (
    (estado = 'NO_AUTORIZADA' AND motivo_no_autorizacion IS NOT NULL AND BTRIM(motivo_no_autorizacion) <> '')
    OR (estado <> 'NO_AUTORIZADA' AND motivo_no_autorizacion IS NULL)
  );

INSERT INTO schema_version (version, description)
VALUES (37, 'Add NO_AUTORIZADA visita state with its own motivo, distinct from anulacion')
ON CONFLICT (version) DO NOTHING;

ALTER TABLE bitacora_visit_form_versions
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_bitacora_visit_form_versions_visible
  ON bitacora_visit_form_versions (ubicacion_id, published_at DESC, id DESC)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION enforce_bitacora_visit_form_version_lifecycle()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Los formularios de visita publicados no se pueden eliminar'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.estado = 'ACTIVE' AND NEW.estado = 'ARCHIVED'
     AND NEW.deleted_at IS NOT DISTINCT FROM OLD.deleted_at
     AND NEW.id = OLD.id
     AND NEW.ubicacion_id = OLD.ubicacion_id
     AND NEW.version = OLD.version
     AND NEW.titulo = OLD.titulo
     AND NEW.mostrar_fecha_hora = OLD.mostrar_fecha_hora
     AND NEW.created_by IS NOT DISTINCT FROM OLD.created_by
     AND NEW.published_by IS NOT DISTINCT FROM OLD.published_by
     AND NEW.created_at = OLD.created_at
     AND NEW.published_at IS NOT DISTINCT FROM OLD.published_at THEN
    RETURN NEW;
  END IF;

  IF OLD.estado = 'ACTIVE' AND NEW.estado = 'ACTIVE'
     AND OLD.published_at IS NULL AND NEW.published_at IS NOT NULL
     AND NEW.deleted_at IS NOT DISTINCT FROM OLD.deleted_at
     AND NEW.id = OLD.id
     AND NEW.ubicacion_id = OLD.ubicacion_id
     AND NEW.version = OLD.version
     AND NEW.titulo = OLD.titulo
     AND NEW.mostrar_fecha_hora = OLD.mostrar_fecha_hora
     AND NEW.created_by IS NOT DISTINCT FROM OLD.created_by
     AND NEW.published_by IS NOT DISTINCT FROM OLD.published_by
     AND NEW.created_at = OLD.created_at THEN
    RETURN NEW;
  END IF;

  IF OLD.estado = 'ARCHIVED' AND NEW.estado = 'ARCHIVED'
     AND OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL
     AND NEW.id = OLD.id
     AND NEW.ubicacion_id = OLD.ubicacion_id
     AND NEW.version = OLD.version
     AND NEW.titulo = OLD.titulo
     AND NEW.mostrar_fecha_hora = OLD.mostrar_fecha_hora
     AND NEW.created_by IS NOT DISTINCT FROM OLD.created_by
     AND NEW.published_by IS NOT DISTINCT FROM OLD.published_by
     AND NEW.created_at = OLD.created_at
     AND NEW.published_at IS NOT DISTINCT FROM OLD.published_at THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Los formularios de visita publicados son inmutables'
    USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

INSERT INTO schema_version (version, description)
VALUES (38, 'Eliminación lógica de formularios de visita archivados')
ON CONFLICT (version) DO NOTHING;

BEGIN;

DO $$
DECLARE
  wes_id INTEGER;
BEGIN
  SELECT id INTO wes_id
  FROM clientes
  WHERE LOWER(TRIM(nombre)) = LOWER(TRIM('WES Security'))
  ORDER BY id ASC
  LIMIT 1;

  IF wes_id IS NULL THEN
    INSERT INTO clientes (nombre, estado)
    VALUES ('WES Security', 'activo')
    RETURNING id INTO wes_id;
  END IF;

  UPDATE ubicaciones u
  SET cliente_id = wes_id
  WHERE u.cliente_id IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM ubicaciones existing
      WHERE existing.id <> u.id
        AND LOWER(TRIM(existing.nombre)) = LOWER(TRIM(u.nombre))
        AND (existing.cliente_id = wes_id OR existing.cliente_id IS NULL)
    );
END
$$;

INSERT INTO schema_version (version, description)
VALUES (39, 'Crea el cliente WES Security y reasigna ubicaciones históricas sin cliente')
ON CONFLICT (version) DO NOTHING;

COMMIT;

CREATE OR REPLACE FUNCTION revoke_usuario_access_on_colaborador_inactivo()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estado = 'inactivo' AND OLD.estado IS DISTINCT FROM 'inactivo' THEN
    UPDATE usuarios
    SET activo = FALSE
    WHERE colaborador_id = NEW.id AND activo = TRUE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'colaboradores' AND column_name = 'estado'
  ) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_revoke_usuario_access_on_colaborador_inactivo ON colaboradores';
    EXECUTE '
      CREATE TRIGGER trg_revoke_usuario_access_on_colaborador_inactivo
        AFTER UPDATE OF estado ON colaboradores
        FOR EACH ROW
        EXECUTE FUNCTION revoke_usuario_access_on_colaborador_inactivo()';
  END IF;
END $$;

INSERT INTO schema_version (version, description)
VALUES (40, 'Revoke system user access automatically when their colaborador becomes inactive')
ON CONFLICT (version) DO NOTHING;

ALTER TABLE bitacora_visit_form_fields
  DROP CONSTRAINT IF EXISTS bitacora_visit_form_fields_type_check;
ALTER TABLE bitacora_visit_form_fields
  ADD CONSTRAINT bitacora_visit_form_fields_type_check
  CHECK (type IN ('text', 'textarea', 'number', 'select', 'checkbox', 'cedula', 'placa', 'photo'));

ALTER TABLE bitacora_visita_respuestas
  DROP CONSTRAINT IF EXISTS bitacora_visita_respuestas_type_snapshot_check;

ALTER TABLE bitacora_visitas
  ADD COLUMN IF NOT EXISTS manzana_texto VARCHAR(100),
  ADD COLUMN IF NOT EXISTS villa_texto VARCHAR(100),
  ALTER COLUMN manzana_id DROP NOT NULL,
  ALTER COLUMN villa_id DROP NOT NULL,
  ALTER COLUMN residente_principal_id DROP NOT NULL;

UPDATE bitacora_visitas bv
SET manzana_texto = COALESCE(bv.manzana_texto, m.nombre),
    villa_texto = COALESCE(bv.villa_texto, v.identificador)
FROM manzanas m, villas v
WHERE bv.manzana_id = m.id AND bv.villa_id = v.id;

ALTER TABLE bitacora_visitas
  ADD CONSTRAINT bitacora_visitas_manzana_texto_check
    CHECK (manzana_texto IS NULL OR BTRIM(manzana_texto) <> ''),
  ADD CONSTRAINT bitacora_visitas_villa_texto_check
    CHECK (villa_texto IS NULL OR BTRIM(villa_texto) <> '');

ALTER TABLE colaboradores
  ADD COLUMN IF NOT EXISTS fecha_salida DATE,
  ADD COLUMN IF NOT EXISTS salida_voluntaria BOOLEAN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'colaboradores' AND column_name = 'estado'
  ) THEN
    UPDATE colaboradores
    SET fecha_salida = COALESCE(fecha_salida, CURRENT_DATE),
        salida_voluntaria = COALESCE(salida_voluntaria, FALSE)
    WHERE estado = 'inactivo';

    ALTER TABLE colaboradores
      DROP CONSTRAINT IF EXISTS colaboradores_salida_inactivo_check;
    ALTER TABLE colaboradores
      ADD CONSTRAINT colaboradores_salida_inactivo_check CHECK (
        (estado = 'activo' AND fecha_salida IS NULL AND salida_voluntaria IS NULL)
        OR
        (estado = 'inactivo' AND fecha_salida IS NOT NULL AND salida_voluntaria IS NOT NULL)
      ) NOT VALID;
  END IF;
END $$;

INSERT INTO schema_version (version, description)
VALUES (41, 'Visitas manuales, fotos en formularios y datos de salida de colaboradores')
ON CONFLICT (version) DO NOTHING;
DROP TRIGGER IF EXISTS enforce_bitacora_visita_titular_activo_trigger ON bitacora_visitas;
DROP FUNCTION IF EXISTS enforce_bitacora_visita_titular_activo();

INSERT INTO schema_version (version, description)
VALUES (42, 'Retira validación legacy de titular, Manzana y Villa en visitas manuales')
ON CONFLICT (version) DO NOTHING;
ALTER TABLE bitacora_visitas ALTER COLUMN placa DROP NOT NULL;

INSERT INTO schema_version (version, description)
VALUES (43, 'Hace opcional la placa legacy en visitas con formularios dinámicos')
ON CONFLICT (version) DO NOTHING;

ALTER TABLE bitacora_visit_form_versions
  ADD COLUMN IF NOT EXISTS mostrar_casa BOOLEAN NOT NULL DEFAULT TRUE;

INSERT INTO schema_version (version, description)
VALUES (44, 'Permite configurar la pregunta Casa por formulario de visitas')
ON CONFLICT (version) DO NOTHING;
