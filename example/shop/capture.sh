#!/usr/bin/env bash
# Runs the OpenTelemetry Demo in Docker, lets its load generator shop for a few minutes, and reads the traces into
# example/shop/traces.json. Needs Docker with Compose and about 8 GB of memory for the containers; the first run
# downloads several GB of images.
#
#   example/shop/capture.sh            start, wait 4 minutes, read the traces, stop
#   MINUTES=10 example/shop/capture.sh wait longer (more traces, rarer calls)
#   KEEP=1 example/shop/capture.sh     leave the shop running afterwards: http://localhost:8080
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
TOP="$(git -C "$HERE" rev-parse --show-toplevel)"
"$HERE/setup.sh"
DEMO="$TOP/.demo/opentelemetry-demo"
MINUTES="${MINUTES:-4}"
cd "$DEMO"

# The Collector also writes every span to a file (OTLP JSON), which `fraktul traces` reads.
mkdir -p otel-export && chmod 777 otel-export && rm -f otel-export/traces.jsonl
cp "$HERE/otelcol-extras.yml" src/otel-collector/otelcol-config-extras.yml
cat > docker-compose.override.yml <<'YAML'
services:
  otel-collector:
    user: "0:0"
    volumes:
      - ./otel-export:/tmp/otel-export
YAML
# The demo's docker_stats receiver speaks a Docker API that current Docker engines refuse; the map does not need it.
sed -i.bak -e '/^  docker_stats:$/,/^    endpoint: unix:.*docker.sock$/d' -e 's/receivers: \[docker_stats, /receivers: [/' src/otel-collector/otelcol-config.yml
# Use the images of the release that was checked out, not "latest".
sed -i.bak "s/^DEMO_VERSION=.*/DEMO_VERSION=$(git describe --tags)/" .env

docker compose build opensearch
docker compose up -d --no-build
echo "shop: running at http://localhost:8080 (Jaeger: http://localhost:8080/jaeger/ui). Shopping for $MINUTES minutes…"
sleep $((MINUTES * 60))

cd "$TOP"
node bin/fraktul.ts traces "$DEMO/otel-export/traces.jsonl" --model example/shop/model.yaml
node bin/fraktul.ts check example/shop/model.yaml
if [ -z "${KEEP:-}" ]; then (cd "$DEMO" && docker compose down); fi
