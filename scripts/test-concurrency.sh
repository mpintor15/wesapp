#!/bin/bash

# ============================================
# Script para probar concurrencia en WESApp
# ============================================

echo "🧪 Iniciando pruebas de concurrencia..."
echo ""

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuración
API_URL="http://localhost:3000/api"
CONCURRENT_REQUESTS=10

# Función para hacer login y obtener token
get_token() {
  local response=$(curl -s -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@wesapp.com","password":"admin123"}')

  echo "$response" | grep -o '"token":"[^"]*' | cut -d'"' -f4
}

# Test 1: Múltiples solicitudes de health check
echo "📊 Test 1: Health checks concurrentes ($CONCURRENT_REQUESTS requests)"
echo "----------------------------------------"

for i in $(seq 1 $CONCURRENT_REQUESTS); do
  (curl -s "$API_URL/../health" > /dev/null && echo -e "${GREEN}✓${NC} Request $i completed") &
done
wait
echo ""

# Test 2: Consultas a la base de datos simultáneas
echo "📊 Test 2: Consultas de clientes concurrentes"
echo "----------------------------------------"

TOKEN=$(get_token)

if [ -z "$TOKEN" ]; then
  echo -e "${RED}✗ Error: No se pudo obtener token${NC}"
  exit 1
fi

for i in $(seq 1 $CONCURRENT_REQUESTS); do
  (curl -s -H "Authorization: Bearer $TOKEN" "$API_URL/cuentas/clientes" > /dev/null && \
   echo -e "${GREEN}✓${NC} Query $i completed") &
done
wait
echo ""

# Test 3: Pool de conexiones
echo "📊 Test 3: Verificar estado del pool de conexiones"
echo "----------------------------------------"

HEALTH=$(curl -s "http://localhost:3000/health")
echo "$HEALTH" | jq '.'
echo ""

# Test 4: Simular creación concurrente de facturas (requiere datos de prueba)
echo "📊 Test 4: Intentar crear misma factura simultáneamente"
echo "----------------------------------------"

FACTURA_NUM=$((1000 + RANDOM % 9000))

echo "Intentando crear factura #$FACTURA_NUM desde 3 clientes simultáneos..."

for i in $(seq 1 3); do
  (
    RESULT=$(curl -s -X POST "$API_URL/cuentas/facturas" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"num_factura\": $FACTURA_NUM,
        \"cliente_id\": 1,
        \"fecha_factura\": \"2026-02-12\",
        \"valor_factura\": 100.00,
        \"incluye_iva\": false,
        \"incluye_retencion_fuente\": false,
        \"incluye_retencion_iva\": false
      }")

    if echo "$RESULT" | grep -q '"success":true'; then
      echo -e "${GREEN}✓${NC} Cliente $i: Factura creada exitosamente"
    elif echo "$RESULT" | grep -q "Ya existe una factura"; then
      echo -e "${YELLOW}⚠${NC} Cliente $i: Factura ya existe (esperado)"
    else
      echo -e "${RED}✗${NC} Cliente $i: Error - $RESULT"
    fi
  ) &
done
wait
echo ""

# Test 5: Verificar índices de la base de datos
echo "📊 Test 5: Verificar índices de performance"
echo "----------------------------------------"

psql -U mpinto15 -d wesapp -c "
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('cuentas', 'abonos', 'retenciones', 'clientes')
ORDER BY tablename, indexname;
" 2>/dev/null || echo -e "${YELLOW}⚠ No se pudo conectar a PostgreSQL directamente${NC}"

echo ""

# Test 6: Verificar tabla de auditoría
echo "📊 Test 6: Verificar sistema de auditoría"
echo "----------------------------------------"

AUDIT_COUNT=$(psql -U mpinto15 -d wesapp -t -c "SELECT COUNT(*) FROM audit_log;" 2>/dev/null | tr -d ' ')

if [ ! -z "$AUDIT_COUNT" ]; then
  echo -e "${GREEN}✓${NC} Tabla audit_log existe con $AUDIT_COUNT registros"
else
  echo -e "${RED}✗${NC} Tabla audit_log no encontrada o vacía"
fi

echo ""

# Test 7: Rendimiento de queries
echo "📊 Test 7: Benchmark de consulta de reporte"
echo "----------------------------------------"

echo "Ejecutando query sin cache..."
psql -U mpinto15 -d wesapp -c "\timing on" -c "SELECT COUNT(*) FROM vista_reporte_cuentas;" 2>/dev/null | grep "Time:" || echo "No disponible"

echo ""

# Resumen
echo "=========================================="
echo -e "${GREEN}✅ Pruebas de concurrencia completadas${NC}"
echo "=========================================="
echo ""
echo "Próximos pasos:"
echo "1. Revisar logs de PM2: pm2 logs"
echo "2. Monitorear pool: Ver health check arriba"
echo "3. Verificar audit_log para operaciones"
echo ""
