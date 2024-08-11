#!/bin/bash -e

find_container_id() {
  echo $(docker ps \
    --filter "status=running" \
    --filter "label=custom.project=chat" \
    --filter "label=custom.service=broker1" \
    --no-trunc \
    -q)
}

TOPIC=${TOPIC:='chat'}
PARTITIONS=${PARTITIONS:=1}

docker exec \
    --workdir /opt/kafka/bin/ \
  $(find_container_id) \
  bash -c "./kafka-topics.sh --create --if-not-exists --topic ${TOPIC} --replication-factor 3 --partitions ${PARTITIONS} --bootstrap-server localhost:19092"
