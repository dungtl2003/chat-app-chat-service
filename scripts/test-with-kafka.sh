#!/bin/bash -ex

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
ROOT_DIR="$SCRIPT_DIR/.."
ENV_PATH=${ENV_PATH:-"$ROOT_DIR/environments/test/.env"}

testCommand="$1"
extraArgs="$2"

export COMPOSE_FILE=${COMPOSE_FILE:="$ROOT_DIR/environments/test/docker-compose.yml"}
export KAFKAJS_DEBUG_PROTOCOL_BUFFERS=${KAFKAJS_DEBUG_PROTOCOL_BUFFERS:=1}

export_envs() {
    for line in "${lines[@]}"; do
        printf "export %s\n" $line;
        export $line;
    done
}

find_container_id() {
  echo $(docker ps \
    --filter "status=running" \
    --filter "label=custom.project=chat" \
    --filter "label=custom.service=broker1" \
    --no-trunc \
    -q)
}

quit() {
  docker-compose -f "${COMPOSE_FILE}" down --remove-orphans -v
  exit 1
}

if [ -z ${DO_NOT_STOP} ]; then
  trap quit ERR
fi

export_envs

if [ -z "$(find_container_id)" ]; then
  echo -e "Start kafka docker container"
  NO_LOGS=1 "$SCRIPT_DIR/docker-compose-up.sh"
  if [ "1" = "$?" ]; then
    echo -e "Failed to start kafka image"
    exit 1
  fi
fi

npx tsx "$SCRIPT_DIR/wait-for-kafka.ts"
echo

set +x
echo
echo -e "Running tests with NODE_OPTIONS=${NODE_OPTIONS}"
echo -e "Heap size in MB:"
node -e "console.log((require('v8').getHeapStatistics().total_available_size / 1024 / 1024).toFixed(2))"
echo
set -x

shopt -s globstar # for ** pattern matching
eval "${testCommand} ${extraArgs}"
TEST_EXIT=$?
echo

if [ -z ${DO_NOT_STOP} ]; then
  docker-compose -f "${COMPOSE_FILE}" down --remove-orphans -v
fi
exit ${TEST_EXIT}
