#!/bin/bash -e

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
ROOT_DIR="$SCRIPT_DIR/.."

COMPOSE_FILE=${COMPOSE_FILE:="$ROOT_DIR/environments/test/docker-compose.yml"}

echo "Clean compose: ${COMPOSE_FILE}:"
docker compose -f "${COMPOSE_FILE}" down -v
