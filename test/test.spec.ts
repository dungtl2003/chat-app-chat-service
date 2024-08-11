import {io as ioc, type Socket as ClientSocket} from "socket.io-client";
import {assert} from "chai";
import SocketServer from "@/loaders/socket-server";
import Kafka from "@/loaders/kafka";
import KafkaProducer from "@/loaders/producer";
import KafkaConsumer from "@/loaders/consumer";
import {
    AckMessage,
    SocketEvent,
    SocketNamespace,
    TOPIC,
} from "@/common/constants";
import {ClientToServerEvents, ServerToClientEvents} from "@/common/types";
import ExpressServer from "@/loaders/express-server";
import {Message, MessageType} from "@prisma/client";
import config from "@/common/config";

function serialize(message: Message): string {
    return JSON.stringify(message, (_, value) =>
        typeof value === "bigint" ? value.toString(10) : value
    );
}

describe("this service", () => {
    let socketServer: SocketServer;
    let producer: KafkaProducer;
    let consumer: KafkaConsumer;
    let expressServer: ExpressServer;
    let clientSocket1: ClientSocket<ServerToClientEvents, ClientToServerEvents>;
    let clientSocket2: ClientSocket<ServerToClientEvents, ClientToServerEvents>;
    let clientSocket3: ClientSocket<ServerToClientEvents, ClientToServerEvents>;
    let clientSocket4: ClientSocket<ServerToClientEvents, ClientToServerEvents>;

    async function joinRooms() {
        await clientSocket1.emitWithAck(SocketEvent.JOIN_ROOMS, ["1", "2"]);
        await clientSocket2.emitWithAck(SocketEvent.JOIN_ROOMS, ["2", "3"]);
        await clientSocket3.emitWithAck(SocketEvent.JOIN_ROOMS, ["2"]);
        await clientSocket4.emitWithAck(SocketEvent.JOIN_ROOMS, ["1"]);
    }

    before("run all necessery servers", async () => {
        const kafka = new Kafka({
            brokers: ["localhost:9092"],
        });
        expressServer = new ExpressServer();
        producer = new KafkaProducer(kafka.instance());
        consumer = new KafkaConsumer(kafka.instance(), {
            groupId: config.nodeId,
        });
        socketServer = new SocketServer(
            expressServer.instance(),
            producer,
            consumer,
            {
                needAuth: false,
                debug: true,
            }
        );

        expressServer.listen();
        socketServer.listen();
        await producer.startProducing();
        await consumer.startConsuming({topics: [TOPIC.CHAT]});
    });

    beforeEach("run new clients and connect to socket servers", async () => {
        clientSocket1 = ioc(
            `http://localhost:${config.serverPort}/${SocketNamespace.MESSAGE}`
        );
        clientSocket2 = ioc(
            `http://localhost:${config.serverPort}/${SocketNamespace.MESSAGE}`
        );
        clientSocket3 = ioc(
            `http://localhost:${config.serverPort}/${SocketNamespace.MESSAGE}`
        );
        clientSocket4 = ioc(
            `http://localhost:${config.serverPort}/${SocketNamespace.MESSAGE}`
        );

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
        ]);
    });

    afterEach("close clients's connection with socket servers", () => {
        clientSocket1.disconnect();
        clientSocket2.disconnect();
        clientSocket3.disconnect();
        clientSocket4.disconnect();
    });

    after("shutdown all servers", async () => {
        await producer.disconnect();
        await consumer.disconnect();
        socketServer.close();
    });

    it("should add client to rooms", async () => {
        const response: AckMessage = await clientSocket1.emitWithAck(
            SocketEvent.JOIN_ROOMS,
            ["1", "2", "3"]
        );

        assert.strictEqual(response, "ok");
    });

    it("should deny the message when client sent wrong message format", async () => {
        const response: AckMessage = await clientSocket1.emitWithAck(
            SocketEvent.CHAT,
            "this message will not work"
        );

        assert.strictEqual(response, "wrong message format");
    });

    describe("when a client send a message", () => {
        it("should send to all clients in the same room", async () => {
            const msg: Message = {
                id: 1n,
                senderId: 1n,
                receiverId: 2n,
                message: "hello world",
                type: MessageType.TEXT,
                createdAt: new Date(),
                updatedAt: null,
                deletedAt: null,
            };
            const serializedMessage = serialize(msg);

            await joinRooms();
            clientSocket1.emitWithAck(SocketEvent.CHAT, serializedMessage);
            await Promise.all([
                new Promise((resolve) => {
                    clientSocket2.on(SocketEvent.CHAT, (response) => {
                        assert.strictEqual(response, serializedMessage);
                        resolve("");
                    });
                }),
                new Promise((resolve) => {
                    clientSocket3.on(SocketEvent.CHAT, (response) => {
                        assert.strictEqual(response, serializedMessage);
                        resolve("");
                    });
                }),
            ]);
        });

        it("should not send to clients in the different room and the client sent the message", async () => {
            const msg: Message = {
                id: 1n,
                senderId: 1n,
                receiverId: 2n,
                message: "hello world",
                type: MessageType.TEXT,
                createdAt: new Date(),
                updatedAt: null,
                deletedAt: null,
            };
            const serializedMessage = serialize(msg);

            await joinRooms();
            clientSocket1.emitWithAck(SocketEvent.CHAT, serializedMessage);
            await Promise.all([
                new Promise((resolve, reject) => {
                    setTimeout(() => {
                        resolve("");
                    }, 5000);
                    clientSocket1.on(SocketEvent.CHAT, (response) => {
                        if (response === serializedMessage) {
                            reject(
                                "This client should not receive the message"
                            );
                        }
                    });
                }),
                new Promise((resolve, reject) => {
                    setTimeout(() => {
                        resolve("");
                    }, 5000);
                    clientSocket4.on(SocketEvent.CHAT, (response) => {
                        if (response === serializedMessage) {
                            reject(
                                "This client should not receive the message"
                            );
                        }
                    });
                }),
            ]);
        });
    });
});
