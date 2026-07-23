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
    tipo_usuario VARCHAR(20) NOT NULL CHECK (tipo_usuario IN ('gerente', 'secretario', 'supervisor', 'contador')),
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
    cliente_id INTEGER CONSTRAINT fk_ubicaciones_cliente REFERENCES clientes(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

-- Usuarios de prueba
-- Password para todos: "password123"
INSERT INTO usuarios (usuario, password_hash, tipo_usuario, primer_login, activo) VALUES
('gerente1', '$2b$10$l2GA3Vzunm2AlLfERjfQtOh.8TnYbxMmyxzCTTbIzT5A/3wKR.UYS', 'gerente', FALSE, TRUE),
('secretario1', '$2b$10$l2GA3Vzunm2AlLfERjfQtOh.8TnYbxMmyxzCTTbIzT5A/3wKR.UYS', 'secretario', FALSE, TRUE),
('supervisor1', '$2b$10$l2GA3Vzunm2AlLfERjfQtOh.8TnYbxMmyxzCTTbIzT5A/3wKR.UYS', 'supervisor', FALSE, TRUE),
('contador1', '$2b$10$l2GA3Vzunm2AlLfERjfQtOh.8TnYbxMmyxzCTTbIzT5A/3wKR.UYS', 'contador', FALSE, TRUE);

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
(19, 'Relate locations to clients with nullable cliente_id');

-- ============================================
-- FINALIZADO
-- ============================================
