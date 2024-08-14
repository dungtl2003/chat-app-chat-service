import KafkaConsumer from "@/loaders/consumer";
import {io as ioc, type Socket as ClientSocket} from "socket.io-client";
import ExpressServer from "@/loaders/express-server";
import Kafka from "@/loaders/kafka";
import KafkaProducer from "@/loaders/producer";
import SocketServer from "@/loaders/socket-server";
import {ClientToServerEvents, ServerToClientEvents} from "@/common/types";
import {SocketEvent, SocketNamespace, TOPIC} from "@/common/constants";
import {execa} from "execa";

async function recreateTopic(topicName: string) {
    await deleteTopic(topicName);
    await createTopic(topicName);
}

async function findContainerId(node: string): Promise<string> {
    const cmd = `docker ps \
      --filter "status=running" \
      --filter "label=custom.project=chat" \
      --filter "label=custom.service=${node}" \
      --no-trunc \
      -q`;
    const {stdout: containerId} = await execa({shell: true})`${cmd}`;
    return containerId;
}

async function createTopic(topicName: string) {
    const containerId = await findContainerId("broker1");

    const cmd = `
    docker exec \
      --workdir /opt/kafka/bin/ \
      ${containerId} \
      bash -c "./kafka-topics.sh --create --if-not-exists --topic ${topicName} --replication-factor 3 --partitions 1 --bootstrap-server localhost:19092 2> /dev/null"
  `;

    await execa({shell: true})`${cmd}`;
}

async function deleteTopic(topicName: string) {
    const containerId = await findContainerId("broker1");

    const cmd = `
    docker exec \
      --workdir /opt/kafka/bin/ \
      ${containerId} \
      bash -c "./kafka-topics.sh --delete --topic ${topicName} --bootstrap-server localhost:19092 2> /dev/null"
  `;

    await execa({shell: true})`${cmd}`;
}

async function setup() {
    const kafkaConsumer = new Kafka({
        brokers: ["localhost:9092", "localhost:10092", "localhost:11092"],
        clientId: "consumer",
    });
    const kafkaProducer = new Kafka({
        brokers: ["localhost:9092", "localhost:10092", "localhost:11092"],
        clientId: "producer",
    });

    const expressServer1 = new ExpressServer({port: 8020});
    const expressServer2 = new ExpressServer({port: 8030});

    const producer1 = new KafkaProducer(kafkaProducer.instance(), {
        debug: true,
    });
    const producer2 = new KafkaProducer(kafkaProducer.instance(), {
        debug: true,
    });

    const consumer1 = new KafkaConsumer(
        kafkaConsumer.instance(),
        {
            groupId: "1",
            metadataMaxAge: 0, // handle case where you recreate topic and the metadata isn't updated
        },
        {debug: true}
    );
    const consumer2 = new KafkaConsumer(
        kafkaConsumer.instance(),
        {
            groupId: "2",
            metadataMaxAge: 0,
        },
        {debug: true}
    );

    const socketServer1 = new SocketServer(
        expressServer1.instance(),
        producer1,
        consumer1,
        "http://localhost:8000",
        "http://localhost:8010/api/v1/auth/authorize",
        {
            nodeId: "1",
            needAuth: false,
            debug: true,
        }
    );
    const socketServer2 = new SocketServer(
        expressServer2.instance(),
        producer2,
        consumer2,
        "http://localhost:8000",
        "http://localhost:8010/api/v1/auth/authorize",
        {
            nodeId: "2",
            needAuth: false,
            debug: true,
        }
    );

    expressServer1.listen();
    socketServer1.listen();

    expressServer2.listen();
    socketServer2.listen();

    await createTopic(TOPIC.CHAT);

    await producer1.startProducing();
    await consumer1.startConsuming({topics: [TOPIC.CHAT]});

    await producer2.startProducing();
    await consumer2.startConsuming({topics: [TOPIC.CHAT]});

    const clientSocket1: ClientSocket<
        ServerToClientEvents,
        ClientToServerEvents
    > = ioc(`http://localhost:8020/${SocketNamespace.MESSAGE}`);
    const clientSocket2: ClientSocket<
        ServerToClientEvents,
        ClientToServerEvents
    > = ioc(`http://localhost:8020/${SocketNamespace.MESSAGE}`);
    const clientSocket3: ClientSocket<
        ServerToClientEvents,
        ClientToServerEvents
    > = ioc(`http://localhost:8020/${SocketNamespace.MESSAGE}`);
    const clientSocket4: ClientSocket<
        ServerToClientEvents,
        ClientToServerEvents
    > = ioc(`http://localhost:8020/${SocketNamespace.MESSAGE}`);

    const clientSocket5: ClientSocket<
        ServerToClientEvents,
        ClientToServerEvents
    > = ioc(`http://localhost:8030/${SocketNamespace.MESSAGE}`);
    const clientSocket6: ClientSocket<
        ServerToClientEvents,
        ClientToServerEvents
    > = ioc(`http://localhost:8030/${SocketNamespace.MESSAGE}`);

    await Promise.all([
        new Promise((resolve) =>
            clientSocket1.on(SocketEvent.CONNECT, () => {
                resolve("");
            })
        ),
        new Promise((resolve) =>
            clientSocket2.on(SocketEvent.CONNECT, () => {
                resolve("");
            })
        ),
        new Promise((resolve) =>
            clientSocket3.on(SocketEvent.CONNECT, () => {
                resolve("");
            })
        ),
        new Promise((resolve) =>
            clientSocket4.on(SocketEvent.CONNECT, () => {
                resolve("");
            })
        ),

        new Promise((resolve) =>
            clientSocket5.on(SocketEvent.CONNECT, () => {
                resolve("");
            })
        ),
        new Promise((resolve) =>
            clientSocket6.on(SocketEvent.CONNECT, () => {
                resolve("");
            })
        ),
    ]);

    return {
        socketServer1,
        socketServer2,

        clientSocket1,
        clientSocket2,
        clientSocket3,
        clientSocket4,
        clientSocket5,
        clientSocket6,

        async cleanup() {
            clientSocket1.disconnect();
            clientSocket2.disconnect();
            clientSocket3.disconnect();
            clientSocket4.disconnect();

            clientSocket5.disconnect();
            clientSocket6.disconnect();

            await producer1.disconnect();
            await producer2.disconnect();

            await consumer1.disconnect();
            await consumer2.disconnect();

            socketServer1.close();
            socketServer2.close();
        },
        async recreateTopic(topicName: string) {
            await deleteTopic(topicName);
            await createTopic(topicName);

            await consumer1.disconnect();
            await consumer2.disconnect();

            await consumer1.startConsuming({topics: [topicName]});
            await consumer2.startConsuming({topics: [topicName]});
        },
    };
}

export {setup, recreateTopic};
