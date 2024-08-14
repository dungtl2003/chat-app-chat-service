import {io as ioc, type Socket as ClientSocket} from "socket.io-client";
import SocketServer from "@/loaders/socket-server";
import {ClientToServerEvents, ServerToClientEvents} from "@/common/types";
import Kafka from "@/loaders/kafka";
import ExpressServer from "@/loaders/express-server";
import KafkaProducer from "@/loaders/producer";
import KafkaConsumer from "@/loaders/consumer";
import {SocketNamespace, TOPIC} from "@/common/constants";
import {createTopic} from "../utils";
import {Gender, PrismaClient, Role, User, UserStatus} from "@prisma/client";

interface LoginPayload {
    payload: {
        user: {
            email: string;
            password: string;
        };
    };
}

interface LoginResponseBody {
    access_token: string;
}

async function addTempUser(db: PrismaClient) {
    const fakeUser: User = {
        id: 1n,
        email: "test@gmail.com",
        username: "test",
        firstName: "test",
        lastName: "test",
        password: "somehashedpassword",
        birthday: new Date(2012, 1, 3),
        gender: Gender.MALE,
        role: Role.USER,
        phoneNumber: "0123456789",
        privacy: null,
        status: UserStatus.ONLINE,
        lastActiveAt: new Date(),
        avatarUrl: null,
        refreshTokens: [],
        createdAt: new Date(),
        deletedAt: null,
        updatedAt: null,
    };
    await db.user.create({data: fakeUser});
    return fakeUser;
}

describe("auth", () => {
    const AUTH_ENDPOINT = "http://localhost:8020/api/v1/auth/authorize";
    const LOGIN_ENDPOINT = "http://localhost:8020/api/v1/auth/login";
    const BROKER_ENDPOINTS = [
        "localhost:9092",
        "localhost:10092",
        "localhost:11092",
    ];

    let expressServer: ExpressServer;
    let clientSocket: ClientSocket<ServerToClientEvents, ClientToServerEvents>;
    let socketServer: SocketServer;
    let producer: KafkaProducer;
    let consumer: KafkaConsumer;

    const db = new PrismaClient();

    before("init services", async () => {
        const kafka = new Kafka({
            brokers: BROKER_ENDPOINTS,
            clientId: "chatservice",
        });
        expressServer = new ExpressServer({port: 3000});
        producer = new KafkaProducer(kafka.instance(), {
            debug: true,
        });
        consumer = new KafkaConsumer(
            kafka.instance(),
            {groupId: "1", metadataMaxAge: 0},
            {debug: true}
        );
    });

    afterEach("shutdown services", async () => {
        clientSocket.disconnect();
        await producer.disconnect();
        await consumer.disconnect();
        socketServer.close();
    });

    it("should work with authentication turn off", async () => {
        socketServer = new SocketServer(
            expressServer.instance(),
            producer,
            consumer,
            {debug: true}
        );

        expressServer.listen();
        socketServer.listen();
        await createTopic(TOPIC.CHAT);
        await producer.startProducing();
        await consumer.startConsuming({topics: [TOPIC.CHAT]});

        clientSocket = ioc(`http://localhost:3000/${SocketNamespace.MESSAGE}`);
        await Promise.all([
            new Promise((resolve) =>
                clientSocket.on("connect", () => {
                    resolve("");
                })
            ),
        ]);
    });

    describe("should not work with authentication turn on", () => {
        it("with no token given", async () => {
            socketServer = new SocketServer(
                expressServer.instance(),
                producer,
                consumer,
                {
                    debug: true,
                    authServiceEndpoint: AUTH_ENDPOINT,
                }
            );

            expressServer.listen();
            socketServer.listen();
            await createTopic(TOPIC.CHAT);
            await producer.startProducing();
            await consumer.startConsuming({topics: [TOPIC.CHAT]});

            clientSocket = ioc(
                `http://localhost:3000/${SocketNamespace.MESSAGE}`
            );
            await Promise.all([
                new Promise((resolve) =>
                    clientSocket.on("connect_error", () => {
                        resolve("");
                    })
                ),
            ]);
        });

        it("with invalid token", async () => {
            socketServer = new SocketServer(
                expressServer.instance(),
                producer,
                consumer,
                {
                    debug: true,
                    authServiceEndpoint: AUTH_ENDPOINT,
                }
            );

            expressServer.listen();
            socketServer.listen();
            await createTopic(TOPIC.CHAT);
            await producer.startProducing();
            await consumer.startConsuming({topics: [TOPIC.CHAT]});

            clientSocket = ioc(
                `http://localhost:3000/${SocketNamespace.MESSAGE}`,
                {
                    auth: {token: "invalidtoken"},
                }
            );
            await Promise.all([
                new Promise((resolve) =>
                    clientSocket.on("connect_error", () => {
                        resolve("");
                    })
                ),
            ]);
        });
    });

    it("should work with valid token", async () => {
        const user = await addTempUser(db);

        expressServer.listen();
        socketServer.listen();
        await createTopic(TOPIC.CHAT);
        await producer.startProducing();
        await consumer.startConsuming({topics: [TOPIC.CHAT]});

        const payload: LoginPayload = {
            payload: {
                user: {
                    email: user.email,
                    password: user.password,
                },
            },
        };
        const response = await fetch(LOGIN_ENDPOINT, {
            method: "POST",
            headers: {
                Accept: "application/json, text/plain",
                "Content-Type": "application/json;charset=UTF-8",
            },
            body: JSON.stringify(payload),
        });
        console.debug("response: ", response);
        const data = (await response.json()) as LoginResponseBody;
        console.debug("data: ", data);
        clientSocket = ioc(`http://localhost:3000/${SocketNamespace.MESSAGE}`, {
            auth: {token: data.access_token},
        });

        await Promise.all([
            new Promise((resolve) =>
                clientSocket.on("connect", () => {
                    resolve("");
                })
            ),
        ]);

        await db.user.deleteMany();
    });
});
