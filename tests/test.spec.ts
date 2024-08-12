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

function serialize(message: Message): string {
    return JSON.stringify(message, (_, value) =>
        typeof value === "bigint" ? value.toString(10) : value
    );
}

describe("this service", () => {
    let socketServer1: SocketServer;
    let socketServer2: SocketServer;

    let producer1: KafkaProducer;
    let producer2: KafkaProducer;

    let consumer1: KafkaConsumer;
    let consumer2: KafkaConsumer;

    let expressServer1: ExpressServer;
    let expressServer2: ExpressServer;

    let clientSocket11: ClientSocket<
        ServerToClientEvents,
        ClientToServerEvents
    >;
    let clientSocket12: ClientSocket<
        ServerToClientEvents,
        ClientToServerEvents
    >;
    let clientSocket13: ClientSocket<
        ServerToClientEvents,
        ClientToServerEvents
    >;
    let clientSocket14: ClientSocket<
        ServerToClientEvents,
        ClientToServerEvents
    >;

    let clientSocket21: ClientSocket<
        ServerToClientEvents,
        ClientToServerEvents
    >;
    let clientSocket22: ClientSocket<
        ServerToClientEvents,
        ClientToServerEvents
    >;

    async function joinRooms() {
        await clientSocket11.emitWithAck(SocketEvent.JOIN_ROOMS, ["1", "2"]);
        await clientSocket12.emitWithAck(SocketEvent.JOIN_ROOMS, ["2", "3"]);
        await clientSocket13.emitWithAck(SocketEvent.JOIN_ROOMS, ["2"]);
        await clientSocket14.emitWithAck(SocketEvent.JOIN_ROOMS, ["1"]);

        await clientSocket21.emitWithAck(SocketEvent.JOIN_ROOMS, ["1", "2"]);
        await clientSocket22.emitWithAck(SocketEvent.JOIN_ROOMS, ["3"]);
    }

    before("run all necessery servers", async () => {
        const kafka = new Kafka({
            brokers: ["localhost:9092", "localhost:10092", "localhost:11092"],
        });

        expressServer1 = new ExpressServer({port: 8020});
        expressServer2 = new ExpressServer({port: 8030});

        producer1 = new KafkaProducer(kafka.instance());
        producer2 = new KafkaProducer(kafka.instance());

        consumer1 = new KafkaConsumer(kafka.instance(), {
            groupId: "1",
        });
        consumer2 = new KafkaConsumer(kafka.instance(), {
            groupId: "2",
        });

        socketServer1 = new SocketServer(
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
        socketServer2 = new SocketServer(
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

        await producer1.startProducing();
        await consumer1.startConsuming({topics: [TOPIC.CHAT]});

        await producer2.startProducing();
        await consumer2.startConsuming({topics: [TOPIC.CHAT]});
    });

    beforeEach("run new clients and connect to socket servers", async () => {
        clientSocket11 = ioc(
            `http://localhost:8020/${SocketNamespace.MESSAGE}`
        );
        clientSocket12 = ioc(
            `http://localhost:8020/${SocketNamespace.MESSAGE}`
        );
        clientSocket13 = ioc(
            `http://localhost:8020/${SocketNamespace.MESSAGE}`
        );
        clientSocket14 = ioc(
            `http://localhost:8020/${SocketNamespace.MESSAGE}`
        );

        clientSocket21 = ioc(
            `http://localhost:8030/${SocketNamespace.MESSAGE}`
        );
        clientSocket22 = ioc(
            `http://localhost:8030/${SocketNamespace.MESSAGE}`
        );

        await Promise.all([
            new Promise((resolve) =>
                clientSocket11.on(SocketEvent.CONNECT, () => {
                    resolve("");
                })
            ),
            new Promise((resolve) =>
                clientSocket12.on(SocketEvent.CONNECT, () => {
                    resolve("");
                })
            ),
            new Promise((resolve) =>
                clientSocket13.on(SocketEvent.CONNECT, () => {
                    resolve("");
                })
            ),
            new Promise((resolve) =>
                clientSocket14.on(SocketEvent.CONNECT, () => {
                    resolve("");
                })
            ),

            new Promise((resolve) =>
                clientSocket21.on(SocketEvent.CONNECT, () => {
                    resolve("");
                })
            ),
            new Promise((resolve) =>
                clientSocket22.on(SocketEvent.CONNECT, () => {
                    resolve("");
                })
            ),
        ]);
    });

    afterEach("close clients's connection with socket servers", () => {
        clientSocket11.disconnect();
        clientSocket12.disconnect();
        clientSocket13.disconnect();
        clientSocket14.disconnect();

        clientSocket21.disconnect();
        clientSocket22.disconnect();
    });

    after("shutdown all servers", async () => {
        await producer1.disconnect();
        await consumer1.disconnect();
        socketServer1.close();

        await producer2.disconnect();
        await consumer2.disconnect();
        socketServer2.close();
    });

    it("should add client to rooms", async () => {
        const response: AckMessage = await clientSocket11.emitWithAck(
            SocketEvent.JOIN_ROOMS,
            ["1", "2", "3"]
        );

        assert.strictEqual(response, "ok");
    });

    it("should deny the message when client sent wrong message format", async () => {
        const response: AckMessage = await clientSocket11.emitWithAck(
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
            clientSocket11.emitWithAck(SocketEvent.CHAT, serializedMessage);
            await Promise.all([
                new Promise((resolve) => {
                    clientSocket12.on(SocketEvent.CHAT, (response) => {
                        assert.strictEqual(response, serializedMessage);
                        resolve("");
                    });
                }),
                new Promise((resolve) => {
                    clientSocket13.on(SocketEvent.CHAT, (response) => {
                        assert.strictEqual(response, serializedMessage);
                        resolve("");
                    });
                }),

                new Promise((resolve) => {
                    clientSocket21.on(SocketEvent.CHAT, (response) => {
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
            clientSocket11.emitWithAck(SocketEvent.CHAT, serializedMessage);
            await Promise.all([
                new Promise((resolve, reject) => {
                    setTimeout(() => {
                        resolve("");
                    }, 5000);
                    clientSocket11.on(SocketEvent.CHAT, (response) => {
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
                    clientSocket14.on(SocketEvent.CHAT, (response) => {
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
                    clientSocket22.on(SocketEvent.CHAT, (response) => {
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
