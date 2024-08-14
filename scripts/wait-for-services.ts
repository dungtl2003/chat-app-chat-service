import {execa} from "execa";
import crypto from "crypto";

function secureRandom(length: number = 10) {
    return crypto.randomBytes(length).toString("hex");
}

async function findContainerId(node: string): Promise<string> {
    const cmd = `docker ps \
      --filter "status=running" \
      --filter "label=custom.project=chat" \
      --filter "label=custom.service=${node}" \
      --no-trunc \
      -q`;
    const {stdout: containerId} = await execa({shell: true})`${cmd}`;
    console.log(`${node}: ${containerId}`);
    return containerId;
}

async function waitForKafka(containerId: string) {
    const cmd = `docker exec \
      --workdir /opt/kafka/bin/ \
      ${containerId} \
      bash -c "./kafka-topics.sh --bootstrap-server controller-1:9093 --list 2> /dev/null"
    sleep 5`;

    await execa({shell: true})`${cmd}`;
    console.log(`Kafka container ${containerId} is running`);
}

async function waitForAuth(containerId: string) {
    const cmd = `sleep 15 && docker exec \
      ${containerId} \
      sh -c "wget -q -O - http://auth-service/actuator/health"`;

    const {stdout: status} = await execa({shell: true})`${cmd}`;
    console.log("output: ", status);
    if (JSON.parse(status.trim()).status.trim() === "UP") {
        console.log(`Auth service container ${containerId} is running`);
    } else {
        console.log(`Auth service container ${containerId} is not running`);
        throw new Error();
    }
}

async function createTopic(containerId: string, topicName: string) {
    const cmd = `
    docker exec \
      --workdir /opt/kafka/bin/ \
      ${containerId} \
      bash -c "./kafka-topics.sh --create --if-not-exists --topic ${topicName} --replication-factor 3 --partitions 1 --bootstrap-server localhost:19092 2> /dev/null"
  `;

    await execa({shell: true})`${cmd}`;
}

async function consumerGroupDescribe(containerId: string) {
    const cmd = `
    docker exec \
      --workdir /opt/kafka/bin/ \
      ${containerId} \
      bash -c "./kafka-consumer-groups.sh --bootstrap-server b1.test:9092 --group test-group-${secureRandom()} --describe > /dev/null 2>&1"
    sleep 1
  `;
    await execa({shell: true})`${cmd}`;
}

async function main() {
    console.log("\nFinding container ids...");
    const b1 = await findContainerId("broker1");
    const b2 = await findContainerId("broker2");
    const b3 = await findContainerId("broker3");
    await findContainerId("controller1");
    await findContainerId("controller2");
    await findContainerId("controller3");

    const auth = await findContainerId("auth");

    console.log("\nWaiting for nodes...");
    await Promise.all([
        waitForKafka(b1),
        waitForKafka(b2),
        waitForKafka(b3),
        waitForAuth(auth),
    ]);

    console.log("\nAll nodes up:");
    const cmd = `docker compose -f ${process.env.COMPOSE_FILE} ps`;
    const {stdout} = await execa({shell: true})`${cmd}`;
    console.log(stdout);

    console.log("\nCreating default topics...");
    createTopic(b1, "test-topic-already-exists");

    console.log("\nWarming up Kafka...");

    const totalRandomTopics = 10;
    console.log(`  -> creating ${totalRandomTopics} random topics...`);
    Array(totalRandomTopics)
        .fill(0)
        .forEach(() => {
            createTopic(b1, `test-topic-${secureRandom()}`);
        });

    console.log("  -> running consumer describe");
    consumerGroupDescribe(b1);
}

main();
