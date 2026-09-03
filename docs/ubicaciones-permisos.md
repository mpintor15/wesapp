# Permisos de Ubicaciones

## Administracion

Configuracion > Ubicaciones usa exclusivamente permisos especificos:

- `inventario.ubicaciones.ver`
- `inventario.ubicaciones.crear`
- `inventario.ubicaciones.editar`
- `inventario.ubicaciones.eliminar`

Los permisos de Articulos o Movimientos no conceden administracion de Ubicaciones.

## Consulta agrupada

`GET /api/inventario/ubicaciones/agrupadas` devuelve grupos paginados de clientes y ubicaciones para
presentaciones administrativas. No reemplaza a `GET /api/inventario/ubicaciones`, que permanece como
catalogo plano compartido para selectores, filtros y operaciones de Inventario.

La consulta agrupada usa la misma politica de lectura que el catalogo plano. Requiere autenticacion y
al menos uno de estos permisos:

- `inventario.ubicaciones.ver`
- `inventario.articulos.ver`
- `inventario.articulos.crear`
- `inventario.movimientos.ver`
- `inventario.movimientos.crear`

Estos permisos permiten consultar el endpoint, pero no conceden por si solos capacidad para crear,
editar o eliminar ubicaciones. Las operaciones de escritura mantienen sus permisos especificos:

- `inventario.ubicaciones.crear`
- `inventario.ubicaciones.editar`
- `inventario.ubicaciones.eliminar`

## Catalogo operativo

`GET /api/inventario/ubicaciones` se mantiene como catalogo compartido para selectores y filtros
de Inventario. Puede ser usado por operaciones autorizadas de Articulos o Movimientos, ademas de
la administracion de Ubicaciones.

Usar una ubicacion existente no equivale a administrarla y no requiere `inventario.ubicaciones.crear`.

La respuesta de ubicaciones incluye `cliente_estado` junto con `cliente_id` y `cliente_nombre`. El
`LEFT JOIN` con clientes preserva ubicaciones historicas sin cliente, por lo que `cliente_id`,
`cliente_nombre` y `cliente_estado` pueden ser `null`.

## Opciones limitadas de clientes

`GET /api/clientes/opciones-ubicaciones` es el catalogo minimo para selectores de ubicaciones e
Inventario. Devuelve exclusivamente:

- `id`
- `nombre`
- `estado`

Este endpoint no reemplaza al catalogo administrativo `GET /api/clientes`. La administracion de
clientes sigue protegida por permisos `clientes.*`, mientras que las opciones limitadas aceptan
`clientes.ver` o permisos relevantes de ubicaciones:

- `inventario.ubicaciones.ver`
- `inventario.ubicaciones.crear`
- `inventario.ubicaciones.editar`

Configuracion usa este endpoint para cargar clientes activos en la administracion de ubicaciones.
Inventario tambien lo usa para cargar opciones de cliente sin depender de `clientes.ver`.

## Creacion contextual desde Articulos

Crear articulos puede crear una ubicacion nueva como parte del mismo flujo. Esta es una capacidad
permanente del permiso operativo:

- `inventario.articulos.crear` autoriza crear una ubicacion solo durante `POST /api/inventario/articulos`.
- `inventario.ubicaciones.crear` tambien autoriza esa creacion contextual cuando el usuario ya puede crear articulos.

Este contrato no concede acceso a Configuracion, ni permite editar o eliminar ubicaciones, ni permite
llamar directamente `POST /api/inventario/ubicaciones`.

## Movimientos

Movimientos usa separacion estricta:

- `inventario.movimientos.crear` puede usar una ubicacion existente por ID.
- `inventario.movimientos.crear` puede resolver una ubicacion existente por nombre dentro del cliente.
- Crear una ubicacion nueva durante un movimiento requiere `inventario.ubicaciones.crear`.
- Si el nombre no existe y falta `inventario.ubicaciones.crear`, la API responde `403 INSUFFICIENT_PERMISSIONS` y no inserta ubicacion ni movimiento.

Si otra transaccion crea la ubicacion entre la busqueda inicial y la autorizacion, el movimiento puede
reconsultarla y usarla sin ejecutar `INSERT`.

## Ejemplos

- Secretario: puede crear movimientos hacia ubicaciones existentes, pero no crear ubicaciones nuevas.
- Secretario: conserva `clientes.ver` y `clientes.crear`, sin editar ni eliminar clientes.
- Supervisor: puede crear articulos, movimientos y ubicaciones contextuales porque tiene permisos operativos y `inventario.ubicaciones.crear`.
- Supervisor: puede cargar Inventario y opciones de clientes sin recibir `clientes.ver`.
- Contador: administra clientes con permisos `clientes.*`, pero no tiene acceso operativo al catalogo de Inventario.

## Matriz por rol

- Gerente: acceso total.
- Supervisor: `ubicaciones.ver`, `ubicaciones.crear`, `ubicaciones.editar`; sin `ubicaciones.eliminar`.
- Secretario: `ubicaciones.ver`; sin crear, editar ni eliminar ubicaciones.
- Contador: `clientes.ver`, `clientes.crear`, `clientes.editar`, `clientes.eliminar`; sin permisos de Ubicaciones.

## Despliegue

Orden seguro:

1. Desplegar backend con permisos especificos de Ubicaciones y protecciones finales.
2. Confirmar que roles activos ya reciben permisos nuevos.
3. Desplegar frontend que oculta/expone controles segun la politica final.
4. Observar errores `403 INSUFFICIENT_PERMISSIONS` en operaciones indirectas.

Un frontend nuevo no es necesariamente compatible con un backend viejo si depende de permisos nuevos.
El backend compatible debe desplegarse antes del frontend basado en esos permisos.

## Rollback

Rollback de frontend es tolerable porque el backend mantiene la barrera de autorizacion. Rollback de
backend puede reabrir creacion implicita no deseada desde Movimientos, por lo que debe evitarse tras
activar esta politica.
