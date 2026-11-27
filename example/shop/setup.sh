#!/usr/bin/env bash
# Fetches the OpenTelemetry Demo's source (the pinned release the map was written for) into .demo/ at the top of the
# fraktul checkout, where example/shop/model.yaml expects it. The map's file and function levels are read from it.
set -euo pipefail
cd "$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
TAG="${OTEL_DEMO_TAG:-2.1.3}"
if [ -d .demo/opentelemetry-demo/.git ]; then
  echo "shop: .demo/opentelemetry-demo is already there ($(git -C .demo/opentelemetry-demo describe --tags 2>/dev/null || echo unknown))"
else
  mkdir -p .demo
  git clone --quiet --depth 1 --branch "$TAG" https://github.com/open-telemetry/opentelemetry-demo.git .demo/opentelemetry-demo
  echo "shop: cloned the OpenTelemetry Demo $TAG into .demo/opentelemetry-demo"
fi
