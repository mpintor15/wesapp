#!/usr/bin/env bash
set -euo pipefail

# Read-only verification intended for the release operator. It never sends
# credentials or changes application state.
production_url="${PRODUCTION_URL:?Define PRODUCTION_URL, e.g. https://app.example.com}"
production_url="${production_url%/}"

if [[ ! "$production_url" =~ ^https:// ]]; then
  echo "PRODUCTION_URL must use HTTPS." >&2
  exit 1
fi

check_status() {
  local path="$1"
  local expected="$2"
  local response
  response="$(curl --fail --silent --show-error --location --max-time 15 \
    --write-out '\n%{http_code}' "$production_url$path")"
  local status="${response##*$'\n'}"
  local body="${response%$'\n'*}"

  if [[ "$status" != "$expected" ]]; then
    echo "$path returned HTTP $status; expected $expected." >&2
    exit 1
  fi

  echo "$body" | grep -q '"success":true' || {
    echo "$path did not return a successful application response." >&2
    exit 1
  }
  printf 'OK %s (HTTP %s)\n' "$path" "$status"
}

headers="$(curl --silent --show-error --head --max-time 15 "$production_url/")"
printf '%s\n' "$headers" | grep -qi '^strict-transport-security:' || {
  echo 'Missing Strict-Transport-Security response header.' >&2
  exit 1
}
printf '%s\n' "$headers" | grep -qi '^x-content-type-options: nosniff' || {
  echo 'Missing X-Content-Type-Options: nosniff response header.' >&2
  exit 1
}
printf 'OK security headers\n'

check_status '/health/live' '200'
check_status '/health/ready' '200'

echo 'Production smoke check passed.'
