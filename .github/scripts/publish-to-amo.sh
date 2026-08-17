#!/usr/bin/env bash
set -euo pipefail

TARGET_PATH="${1:-dist/firefox}"
API_KEY="${AMO_API_KEY:-${AMO_JWT_ISSUER:-${WEB_EXT_API_KEY:-}}}"
API_SECRET="${AMO_API_SECRET:-${AMO_JWT_SECRET:-${WEB_EXT_API_SECRET:-}}}"
CHANNEL="${AMO_CHANNEL:-listed}"
APPROVAL_TIMEOUT="${AMO_APPROVAL_TIMEOUT:-0}"
TIMEOUT="${AMO_TIMEOUT:-900000}"
ARTIFACTS_DIR="${AMO_ARTIFACTS_DIR:-dist/amo-artifacts}"

trim_secret() {
  local value="$1"
  value="$(printf '%s' "${value}" | tr -d '\r')"
  value="$(printf '%s' "${value}" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  printf '%s' "${value}"
}

API_KEY="$(trim_secret "${API_KEY}")"
API_SECRET="$(trim_secret "${API_SECRET}")"
CHANNEL="$(trim_secret "${CHANNEL}")"
APPROVAL_TIMEOUT="$(trim_secret "${APPROVAL_TIMEOUT}")"
TIMEOUT="$(trim_secret "${TIMEOUT}")"

if [ -z "${API_KEY}" ]; then
  echo 'Missing required env var: AMO_API_KEY (or AMO_JWT_ISSUER / WEB_EXT_API_KEY)'
  exit 1
fi

if [ -z "${API_SECRET}" ]; then
  echo 'Missing required env var: AMO_API_SECRET (or AMO_JWT_SECRET / WEB_EXT_API_SECRET)'
  exit 1
fi

if [ ! -e "${TARGET_PATH}" ]; then
  echo "Target path does not exist: ${TARGET_PATH}"
  exit 1
fi

TEMP_DIR=""
cleanup() {
  if [ -n "${TEMP_DIR}" ] && [ -d "${TEMP_DIR}" ]; then
    rm -rf "${TEMP_DIR}"
  fi
}
trap cleanup EXIT

SOURCE_DIR=""
if [ -d "${TARGET_PATH}" ]; then
  SOURCE_DIR="${TARGET_PATH}"
elif [ -f "${TARGET_PATH}" ]; then
  TEMP_DIR="$(mktemp -d)"
  if ! command -v unzip >/dev/null 2>&1; then
    echo "unzip command is required to extract archive but not installed."
    exit 1
  fi
  unzip -q "${TARGET_PATH}" -d "${TEMP_DIR}"
  SOURCE_DIR="${TEMP_DIR}"
else
  echo "Invalid target path: ${TARGET_PATH}"
  exit 1
fi

if [ ! -f "${SOURCE_DIR}/manifest.json" ]; then
  echo "manifest.json not found in source directory: ${SOURCE_DIR}"
  exit 1
fi

mkdir -p "${ARTIFACTS_DIR}"

EXTRA_ARGS=()
if [ -n "${AMO_EXTENSION_ID:-}" ]; then
  EXTRA_ARGS+=("--id=$(trim_secret "${AMO_EXTENSION_ID}")")
fi

echo "Submitting Firefox extension to Mozilla Add-ons (AMO)..."
echo "Channel: ${CHANNEL}"
echo "Approval Timeout: ${APPROVAL_TIMEOUT}ms"

npx --yes web-ext sign \
  --source-dir="${SOURCE_DIR}" \
  --artifacts-dir="${ARTIFACTS_DIR}" \
  --api-key="${API_KEY}" \
  --api-secret="${API_SECRET}" \
  --channel="${CHANNEL}" \
  --approval-timeout="${APPROVAL_TIMEOUT}" \
  --timeout="${TIMEOUT}" \
  --no-input \
  "${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}"

echo "Firefox Add-ons (AMO) submission completed successfully."
