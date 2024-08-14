import {DisconnectReason, Server, ServerOptions, Socket} from "socket.io";
import {Server as ExpressServer} from "node:http";
import {
    AckMessage,
    SocketEvent,
    SocketNamespace,
    TOPIC,
} from "@/common/constants";
import {debug, info} from "@/common/console";
import {EachMessagePayload} from "kafkajs";
import KafkaProducer from "./producer";
import KafkaConsumer from "./consumer";
import {Message, PrismaClient} from "@prisma/client";
import {
    ClientToServerEvents,
    InterServerEvents,
    ServerToClientEvents,
    SocketData,
} from "@/common/types";
import {listMessages} from "@/message/list";
import auth from "@/auth";

interface Option {
    config?: Partial<ServerOptions>;
    debug?: boolean;
    needAuth?: boolean;
    nodeId?: string;
    authServiceEndpoint?: string;
}

interface Metadata {
    nodeId: string;
}

interface KafkaMessageRecord {
    metadata: Metadata;
    serializedMessage: string;
}

class SocketServer {
    private readonly NODE_ID = "1";

    private readonly _io: Server<
        ClientToServerEvents,
        ServerToClientEvents,
        InterServerEvents,
        SocketData
    >;
    private readonly _producer: KafkaProducer;
    private readonly _debug: boolean;
    private readonly _nodeId: string;
    private readonly _authServiceEndpoint: string | undefined;
    private readonly _db: PrismaClient;

    public constructor(
        expressServer: ExpressServer,
        producer: KafkaProducer,
        consumer: KafkaConsumer,
        opts?: Option
    ) {
        this._io = new Server<
            ClientToServerEvents,
            ServerToClientEvents,
            InterServerEvents,
            SocketData
        >(expressServer, {
            connectionStateRecovery: {
                maxDisconnectionDuration: 2 * 60 * 1000,
                skipMiddlewares: true,
            },
            connectTimeout: 45000,
            path: "/socket.io/",
            serveClient: true,
            addTrailingSlash: true,
            allowEIO3: false,
            allowUpgrades: true,
            cors: {
                origin: "*",
            },
            maxHttpBufferSize: 1e6, // 1 MB
            pingInterval: 25000,
            pingTimeout: 20000,
            transports: ["polling", "websocket"],
            upgradeTimeout: 10000,
            ...opts?.config,
        });

        this._db = new PrismaClient();
        this._producer = producer;
        this._debug = opts?.debug ?? false;
        this._nodeId = opts?.nodeId ?? this.NODE_ID;
        this._authServiceEndpoint = opts?.authServiceEndpoint;

        consumer.setSocketHandler(this);
    }

    public consumeMessage({message}: EachMessagePayload) {
        if (!message.value) {
            return;
        }
        const serializedRecord = message.value.toString();
        const deserializedRecord = <KafkaMessageRecord>(
            JSON.parse(serializedRecord)
        );

        if (deserializedRecord.metadata.nodeId === this._nodeId) {
            return;
        }

        const serializedMessage: string = deserializedRecord.serializedMessage;
        const deserializedMessage = this.deserialize(serializedMessage);
        const roomId = deserializedMessage.receiverId.toString();

        this.debug(
            `[socket server]: Emit to room ${roomId} message: ${serializedMessage}`
        );

        this._io
            .of(SocketNamespace.MESSAGE)
            .to(roomId)
            .emit(SocketEvent.CHAT, serializedMessage);
    }

    public listen(): void {
        this._io
            .of(SocketNamespace.MESSAGE)
            .use(auth(this._authServiceEndpoint))
            .on(SocketEvent.CONNECTION, async (socket) => {
                this.debug(
                    `[socket server]: A client with ID of ${socket.id} connected`
                );

                socket.on("message:list", listMessages(this._db));

                socket.on(
                    SocketEvent.JOIN_ROOMS,
                    (rooms: string[], ack: (message: AckMessage) => void) => {
                        this.onJoinRoomsEventHandler(socket, rooms, ack);
                    }
                );

                socket.on(
                    SocketEvent.CHAT,
                    (
                        serializedMessage: string,
                        ack: (message: AckMessage) => void
                    ) => {
                        this.onChatEventHandler(socket, serializedMessage, ack);
                    }
                );

                socket.on(
                    SocketEvent.DISCONNECT,
                    (reason: DisconnectReason) => {
                        this.onDisconnectEventHandler(socket, reason);
                    }
                );
            });

        info("[socket server]: Server is listening");
    }

    public close(): void {
        this._io.close((error) => {
            if (error) throw error;

            info("[socket server]: Stopped");
        });
    }

    private onJoinRoomsEventHandler(
        socket: Socket<
            ClientToServerEvents,
            ServerToClientEvents,
            InterServerEvents,
            SocketData
        >,
        rooms: string[],
        ack: (message: AckMessage) => void
    ) {
        this.debug(
            `[socket server]: Add client with ID of ${socket.id} to rooms: `,
            rooms
        );
        socket.join(rooms);
        ack("ok");
    }

    private async onChatEventHandler(
        socket: Socket<
            ClientToServerEvents,
            ServerToClientEvents,
            InterServerEvents,
            SocketData
        >,
        serializedMessage: string,
        ack: (message: AckMessage) => void
    ) {
        this.debug(
            `[socket server]: Received a message from client with ID of ${socket.id}`
        );

        let deserializedMesssage: Message;
        try {
            deserializedMesssage = this.deserialize(serializedMessage);
        } catch (error) {
            this.debug(
                `[socket server]: the message received from ${socket.id} cannot be deserialized. Serialized message: ${serializedMessage}, error:  `,
                error
            );
            ack("wrong message format");
            return;
        }

        const roomId = deserializedMesssage.receiverId.toString();
        if (!socket.rooms.has(roomId)) {
            this.debug(
                `[socket server]: Client with ID of ${socket.id} is not in room ${roomId}`
            );

            ack("not allowed");
            return;
        }

        socket.to(roomId).emit(SocketEvent.CHAT, serializedMessage);
        this.produceMessage(serializedMessage, {
            nodeId: this._nodeId,
        });

        this.debug(
            `[socket server]: Forwarded message from client with ID of ${socket.id}`
        );
        ack("ok");
    }

    private deserialize(serializedMessage: string): Message {
        const deserializedMesssage = <Message>(
            JSON.parse(serializedMessage, (key, value) =>
                key === "receiverId" ? BigInt(value) : value
            )
        );

        return deserializedMesssage;
    }

    private onDisconnectEventHandler(
        socket: Socket<
            ClientToServerEvents,
            ServerToClientEvents,
            InterServerEvents,
            SocketData
        >,
        reason: DisconnectReason
    ) {
        this.debug(
            `[socket server]: A client with ID of ${socket.id} disconnected, reason: `,
            reason
        );
    }

    private debug(message?: any, ...optionalParams: any[]): void {
        this._debug && debug(message, ...optionalParams);
    }

    private async produceMessage(
        serializedMessage: string,
        metadata: Metadata
    ) {
        const record = {
            metadata: metadata,
            serializedMessage: serializedMessage,
        } as KafkaMessageRecord;
        const deserializedRecord = JSON.stringify(record);

        await this._producer.sendMessages({
            topic: TOPIC.CHAT,
            messages: [{value: deserializedRecord}],
            acks: -1,
        });
    }
}

export default SocketServer;
