#!/usr/bin/env bash
set -euo pipefail

DIST_DIR="${1:-dist}"
ARCHIVE_NAME="${2:-extension.zip}"
BROWSER="${3:-chrome}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PACKAGE_DIR="${DIST_DIR}/package-${BROWSER}"

if ! command -v zip >/dev/null 2>&1; then
  echo "zip command is required but not installed."
  exit 1
fi

node "${REPO_ROOT}/scripts/build.mjs" "${BROWSER}"

rm -rf "${PACKAGE_DIR}"
mkdir -p "${PACKAGE_DIR}"
cp -R "${REPO_ROOT}/dist/${BROWSER}/." "${PACKAGE_DIR}/"

(
  cd "${PACKAGE_DIR}"
  find . -name '.DS_Store' -delete
  zip -qr "../${ARCHIVE_NAME}" .
)

rm -rf "${PACKAGE_DIR}"

echo "Built extension package: ${DIST_DIR}/${ARCHIVE_NAME}"

