# 📡 API Reference - WESApp

REST API endpoints para WESApp. Todos los endpoints requieren autenticación con JWT token (excepto login).

**Base URL:** `http://localhost:3001/api` (desarrollo) o `https://your-domain.com/api` (producción)

---

## 🔐 Authentication

### Login
**POST** `/auth/login`

Autentica un usuario y retorna JWT token.

**Request:**
```json
{
  "usuario": "usuario_demo",
  "password": "contraseña_segura"
}
```

**Response (200):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "usuario": "usuario_demo",
    "tipo_usuario": "gerente",
    "primer_login": false,
    "activo": true
  }
}
```

**Response (401):**
```json
{
  "success": false,
  "message": "Usuario o contraseña incorrectos"
}
```

**Rate Limit:** 10 intentos por 15 minutos (producción), 30 (desarrollo)

---

### Change Password
**POST** `/auth/change-password`

Cambiar contraseña del usuario (obligatorio en primer login).

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "password_actual": "contraseña_actual_segura",
  "password_nueva": "nueva_contraseña_segura"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Contraseña actualizada exitosamente"
}
```

---

### Verify Token
**GET** `/auth/verify`

Verifica que el token sea válido y retorna datos del usuario.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "usuario": "usuario_demo",
    "tipo_usuario": "gerente",
    "activo": true
  }
}
```

---

## 👥 Usuarios (Users Management)

**Access:** Solo `gerente` role

### Listar Usuarios
**GET** `/usuarios`

**Response (200):**
```json
{
  "success": true,
  "usuarios": [
    {
      "id": 1,
      "usuario": "usuario_demo",
      "tipo_usuario": "gerente",
      "activo": true,
      "primer_login": false
    }
  ]
}
```

### Crear Usuario
**POST** `/usuarios`

**Request:**
```json
{
  "usuario": "juan.perez",
  "tipo_usuario": "secretario",
  "password_temporal": "contraseña_temporal_segura"
}
```

**Response (201):**
```json
{
  "success": true,
  "id": 2,
  "message": "Usuario creado"
}
```

### Actualizar Usuario
**PUT** `/usuarios/:id`

**Request:**
```json
{
  "tipo_usuario": "contador",
  "activo": true
}
```

### Eliminar Usuario
**DELETE** `/usuarios/:id`

---

## 📊 Cuentas (Accounts & Invoicing)

**Access:** 
- `gerente`, `secretario`, `contador` - Read/Write
- `supervisor` - No access

### Clientes (Customers)

#### Listar Clientes
**GET** `/cuentas/clientes`

**Query Params:**
- `search` - Filtrar por nombre o identificación
- `activo` - Filter by active status (true/false)

**Response (200):**
```json
{
  "success": true,
  "clientes": [
    {
      "id": 1,
      "nombre": "Empresa ABC S.A.",
      "identificacion": "123456789",
      "activo": true
    }
  ]
}
```

#### Crear Cliente
**POST** `/cuentas/clientes`

**Request:**
```json
{
  "nombre": "Nueva Empresa",
  "identificacion": "987654321"
}
```

#### Exportar Clientes a Excel
**GET** `/cuentas/clientes/excel`

Descarga archivo `clientes.xlsx`

#### Eliminar Cliente
**DELETE** `/cuentas/clientes/:id`

---

### Facturas (Invoices)

#### Obtener Siguiente Número de Factura
**GET** `/cuentas/facturas/next-number`

**Response:**
```json
{
  "success": true,
  "next_number": 1001
}
```

#### Crear Factura
**POST** `/cuentas/facturas`

**Request:**
```json
{
  "num_factura": 1001,
  "cliente_id": 1,
  "valor_factura": 500000,
  "iva_aplicable": true,
  "iva_valor": 95000,
  "iva_incluido": false,
  "retension_aplicable": false
}
```

**Response (201):**
```json
{
  "success": true,
  "id": 1,
  "num_factura": 1001
}
```

#### Listar Facturas
**GET** `/cuentas/facturas`

**Query Params:**
- `cliente_id` - Filter by customer
- `cancelada` - Filter by status (true/false)
- `desde` - Start date (YYYY-MM-DD)
- `hasta` - End date (YYYY-MM-DD)

#### Obtener Detalles de Factura
**GET** `/cuentas/facturas/:num_factura`

#### Editar Factura
**PUT** `/cuentas/facturas/:num_factura`

#### Eliminar Factura
**DELETE** `/cuentas/facturas/:num_factura`

#### Exportar Facturas a Excel
**GET** `/cuentas/facturas/excel`

---

### Pagos (Payments)

#### Crear Pago
**POST** `/cuentas/pagos`

**Request:**
```json
{
  "cliente_id": 1,
  "total": 500000,
  "descripcion": "Pago factura 1001"
}
```

**Response (201):**
```json
{
  "success": true,
  "id": 1,
  "pago_id": 1
}
```

#### Aplicar Abono a Factura
**POST** `/cuentas/abonos`

**Request:**
```json
{
  "pago_id": 1,
  "num_factura": 1001,
  "valor_abono": 500000
}
```

#### Listar Pagos de Cliente
**GET** `/cuentas/pagos?cliente_id=1`

#### Listar Abonos
**GET** `/cuentas/abonos?cliente_id=1`

---

## 📦 Inventario (Inventory)

**Access:** 
- `gerente`, `secretario`, `supervisor` - Read
- `gerente`, `secretario` - Write

### Ubicaciones (Locations)

#### Listar Ubicaciones
**GET** `/inventario/ubicaciones`

**Response:**
```json
{
  "success": true,
  "ubicaciones": [
    { "id": 1, "nombre": "Bodega A" },
    { "id": 2, "nombre": "Bodega B" }
  ]
}
```

---

### Artículos (Equipment)

#### Listar Artículos
**GET** `/inventario/articulos`

**Query Params:**
- `tipo_articulo` - Filter by type
- `ubicacion_id` - Filter by location
- `search` - Search by serial number or description
- `activo` - Filter by status

**Response:**
```json
{
  "success": true,
  "articulos": [
    {
      "id": 1,
      "tipo_articulo": "Laptop",
      "numero_serie": "ABC123DEF456",
      "ubicacion_id": 1,
      "ubicacion_nombre": "Bodega A",
      "activo": true,
      "fecha_caducidad": "2026-12-31"
    }
  ]
}
```

#### Crear Artículo
**POST** `/inventario/articulos`

**Request:**
```json
{
  "tipo_articulo": "Laptop",
  "numero_serie": "ABC123DEF456",
  "ubicacion_id": 1,
  "descripcion": "Dell XPS 13",
  "fecha_caducidad": "2026-12-31"
}
```

#### Actualizar Artículo
**PUT** `/inventario/articulos/:id`

#### Eliminar Artículo
**DELETE** `/inventario/articulos/:id`

---

### Movimientos (Transfers)

#### Crear Movimiento
**POST** `/inventario/movimientos`

**Request:**
```json
{
  "articulos": [
    {
      "articulo_id": 1,
      "ubicacion_origen_id": 1,
      "ubicacion_destino_id": 2
    }
  ]
}
```

**Response (201):**
```json
{
  "success": true,
  "id": 1,
  "pdf_url": "/storage/movimiento_001.pdf"
}
```

#### Listar Movimientos
**GET** `/inventario/movimientos`

**Query Params:**
- `fecha_desde` - Start date
- `fecha_hasta` - End date

#### Obtener PDF de Movimiento
**GET** `/inventario/movimientos/:id/pdf`

Descarga el PDF del movimiento

---

### Bajas (Write-offs)

#### Registrar Baja
**POST** `/inventario/bajas`

**Request:**
```json
{
  "articulo_id": 1,
  "cantidad": 1,
  "motivo": "Equipo dañado"
}
```

#### Listar Bajas
**GET** `/inventario/bajas`

#### Exportar Bajas a Excel
**GET** `/inventario/bajas/excel`

---

## 👨‍💼 Personal (Employees)

**Access:** 
- `gerente`, `secretario`, `supervisor` - Read
- `gerente`, `secretario` - Write

### Colaboradores (Employees)

#### Listar Colaboradores
**GET** `/personal/colaboradores`

**Response:**
```json
{
  "success": true,
  "colaboradores": [
    {
      "id": 1,
      "cedula": "123456789",
      "nombres_completos": "Juan Pérez",
      "cargo": "Gerente",
      "sueldo": 2000000,
      "banco": "Banco ABC",
      "activo": true
    }
  ]
}
```

#### Crear Colaborador
**POST** `/personal/colaboradores`

**Request:**
```json
{
  "cedula": "123456789",
  "nombres_completos": "Juan Pérez",
  "cargo": "Técnico",
  "sueldo": 1500000,
  "banco": "Banco ABC"
}
```

#### Actualizar Colaborador
**PUT** `/personal/colaboradores/:id`

#### Eliminar Colaborador
**DELETE** `/personal/colaboradores/:id`

---

## ⚠️ Error Responses

Todos los errores siguen este formato:

```json
{
  "success": false,
  "message": "Descripción del error",
  "error": "error_code (development only)"
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| `200` | OK - Solicitud exitosa |
| `201` | Created - Recurso creado |
| `400` | Bad Request - Datos inválidos |
| `401` | Unauthorized - Token inválido/expirado |
| `403` | Forbidden - Sin permisos |
| `404` | Not Found - Recurso no encontrado |
| `429` | Too Many Requests - Rate limit |
| `500` | Internal Server Error |

---

## 🔑 Authorization Header

Todas las solicitudes privadas requieren:

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3001/api/usuarios
```

**Token Format:**
```
Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImlhdCI6MTY3MzAwMDAwMH0.signature...
```

Token válido por **24 horas**. Después expira y requiere nuevo login.

---

## 💡 Ejemplos con cURL

### Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "usuario": "usuario_demo",
    "password": "contraseña_segura"
  }'
```

### Listar Usuarios (con token)
```bash
curl http://localhost:3001/api/usuarios \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Crear Cliente
```bash
curl -X POST http://localhost:3001/api/cuentas/clientes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "nombre": "Nueva Empresa",
    "identificacion": "987654321"
  }'
```

---

## 🔗 Documentación Adicional

- [README.md](./README.md) - Visión general del proyecto
- [SETUP.md](./SETUP.md) - Guía de configuración
- [Backend Routes](./backend/src/routes/) - Código fuente de rutas
- [Controllers](./backend/src/controllers/) - Lógica de negocio
