-- ============================================
-- WESApp - Base de Datos PostgreSQL
-- Empresa: WES Security
-- ============================================

-- Limpiar tablas existentes (CUIDADO: esto borra todos los datos)
DROP TABLE IF EXISTS detalle_movimientos CASCADE;
DROP TABLE IF EXISTS movimientos CASCADE;
DROP TABLE IF EXISTS articulos CASCADE;
DROP TABLE IF EXISTS ubicaciones CASCADE;
DROP TABLE IF EXISTS colaboradores CASCADE;
DROP TABLE IF EXISTS abonos CASCADE;
DROP TABLE IF EXISTS retenciones CASCADE;
DROP TABLE IF EXISTS cuentas CASCADE;
DROP TABLE IF EXISTS clientes CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;

-- ============================================
-- TABLA: usuarios
-- ============================================
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    usuario VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
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
    nombre TEXT UNIQUE NOT NULL,
    identificacion TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cuentas (
    num_factura INTEGER PRIMARY KEY,
    cliente_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
    fecha_factura DATE NOT NULL,
    valor_factura NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE retenciones (
    num_retencion INTEGER PRIMARY KEY,
    num_factura INTEGER REFERENCES cuentas(num_factura) ON DELETE CASCADE,
    fecha_retencion DATE NOT NULL,
    valor_retencion NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE abonos (
    id SERIAL PRIMARY KEY,
    num_factura INTEGER REFERENCES cuentas(num_factura) ON DELETE CASCADE,
    fecha_abono DATE NOT NULL,
    valor_abono NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- MÓDULO: INVENTARIO
-- ============================================
CREATE TABLE ubicaciones (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE articulos (
    id SERIAL PRIMARY KEY,
    tipo_articulo VARCHAR(20) NOT NULL CHECK (tipo_articulo IN ('equipo', 'placa_balistica', 'arma')),
    nombre_articulo VARCHAR(100),
    cantidad INTEGER DEFAULT 1,
    talla VARCHAR(10),
    marca VARCHAR(50),
    modelo VARCHAR(50),
    numero_serie VARCHAR(100) UNIQUE,
    calibre VARCHAR(20),
    fecha_caducidad DATE,
    ubicacion_id INTEGER REFERENCES ubicaciones(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activo BOOLEAN DEFAULT TRUE
);

CREATE TABLE movimientos (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id),
    fecha_movimiento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    pdf_path TEXT
);

CREATE TABLE detalle_movimientos (
    id SERIAL PRIMARY KEY,
    movimiento_id INTEGER REFERENCES movimientos(id) ON DELETE CASCADE,
    articulo_id INTEGER REFERENCES articulos(id),
    cantidad INTEGER DEFAULT 1,
    ubicacion_origen_id INTEGER REFERENCES ubicaciones(id),
    ubicacion_destino_id INTEGER REFERENCES ubicaciones(id),
    CHECK (ubicacion_origen_id != ubicacion_destino_id)
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

-- ============================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- ============================================
CREATE INDEX idx_usuarios_tipo ON usuarios(tipo_usuario);
CREATE INDEX idx_usuarios_activo ON usuarios(activo);
CREATE INDEX idx_cuentas_cliente ON cuentas(cliente_id);
CREATE INDEX idx_cuentas_fecha ON cuentas(fecha_factura);
CREATE INDEX idx_retenciones_factura ON retenciones(num_factura);
CREATE INDEX idx_abonos_factura ON abonos(num_factura);
CREATE INDEX idx_articulos_tipo ON articulos(tipo_articulo);
CREATE INDEX idx_articulos_ubicacion ON articulos(ubicacion_id);
CREATE INDEX idx_articulos_serie ON articulos(numero_serie);
CREATE INDEX idx_movimientos_fecha ON movimientos(fecha_movimiento);
CREATE INDEX idx_colaboradores_estado ON colaboradores(estado);
CREATE INDEX idx_colaboradores_cedula ON colaboradores(cedula);

-- ============================================
-- DATOS DE PRUEBA
-- ============================================

-- Usuarios de prueba
-- Password para todos: "password123" (el hash debe generarse con bcrypt)
-- Por ahora usamos un placeholder, lo actualizaremos después
INSERT INTO usuarios (usuario, password_hash, tipo_usuario, primer_login, activo) VALUES
('gerente1', '$2b$10$rKvY8Y9xKjVH9xKfXGZ8eOpKzRzVZxZxZxZxZxZxZxZxZxZxZ', 'gerente', FALSE, TRUE),
('secretario1', '$2b$10$rKvY8Y9xKjVH9xKfXGZ8eOpKzRzVZxZxZxZxZxZxZxZxZxZxZ', 'secretario', FALSE, TRUE),
('supervisor1', '$2b$10$rKvY8Y9xKjVH9xKfXGZ8eOpKzRzVZxZxZxZxZxZxZxZxZxZxZ', 'supervisor', FALSE, TRUE),
('contador1', '$2b$10$rKvY8Y9xKjVH9xKfXGZ8eOpKzRzVZxZxZxZxZxZxZxZxZxZxZ', 'contador', FALSE, TRUE);

-- Clientes de prueba
INSERT INTO clientes (nombre, identificacion) VALUES
('Banco Pichincha', '1790012348001'),
('Corporación Favorita', '1790012346001'),
('Municipio de Quito', '1760001550001'),
('Centro Comercial El Recreo', '1790012347001'),
('Hospital Metropolitano', '1790012345001');

-- Cuentas (facturas) de prueba
INSERT INTO cuentas (num_factura, cliente_id, fecha_factura, valor_factura) VALUES
(1001, 1, '2024-01-15', 5000.00),
(1002, 2, '2024-01-20', 7500.00),
(1003, 3, '2024-02-05', 12000.00),
(1004, 1, '2024-02-10', 3200.00),
(1005, 4, '2024-02-15', 8900.00);

-- Retenciones de prueba
INSERT INTO retenciones (num_retencion, num_factura, fecha_retencion, valor_retencion) VALUES
(5001, 1001, '2024-01-16', 50.00),
(5002, 1002, '2024-01-21', 75.00),
(5003, 1003, '2024-02-06', 120.00);

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
CREATE OR REPLACE VIEW vista_reporte_cuentas AS
SELECT 
    c.num_factura,
    cl.nombre AS cliente,
    cl.identificacion,
    c.fecha_factura,
    c.valor_factura,
    MAX(r.fecha_retencion) AS fecha_retencion,
    COALESCE(SUM(r.valor_retencion), 0) AS total_retenciones,
    (c.valor_factura - COALESCE(SUM(r.valor_retencion), 0)) AS por_cobrar,
    COALESCE(SUM(a.valor_abono), 0) AS total_abonos,
    ((c.valor_factura - COALESCE(SUM(r.valor_retencion), 0)) - COALESCE(SUM(a.valor_abono), 0)) AS saldo_pendiente
FROM cuentas c
JOIN clientes cl ON c.cliente_id = cl.id
LEFT JOIN retenciones r ON c.num_factura = r.num_factura
LEFT JOIN abonos a ON c.num_factura = a.num_factura
GROUP BY c.num_factura, cl.nombre, cl.identificacion, c.fecha_factura, c.valor_factura
ORDER BY c.num_factura ASC;

-- Vista: Inventario con alertas de caducidad
CREATE OR REPLACE VIEW vista_inventario_alertas AS
SELECT 
    a.*,
    u.nombre AS ubicacion_nombre,
    CASE 
        WHEN a.fecha_caducidad IS NULL THEN 'sin_alerta'
        WHEN a.fecha_caducidad < CURRENT_DATE THEN 'vencida'
        WHEN a.fecha_caducidad <= CURRENT_DATE + INTERVAL '30 days' THEN 'proxima_a_vencer'
        ELSE 'vigente'
    END AS estado_caducidad
FROM articulos a
LEFT JOIN ubicaciones u ON a.ubicacion_id = u.id
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

CREATE TRIGGER update_articulos_updated_at BEFORE UPDATE ON articulos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_colaboradores_updated_at BEFORE UPDATE ON colaboradores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FINALIZADO
-- ============================================
