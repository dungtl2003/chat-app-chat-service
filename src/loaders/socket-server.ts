import {Server, Socket} from "socket.io";
import {Server as ExpressServer} from "node:http";
import {
    SocketEvent,
    SocketNamespace,
    SocketStatusMessage,
    TOPIC,
} from "@/common/constants";
import config from "@/common/config";
import {ExtendedError} from "socket.io/dist/namespace";
import {debug, info} from "@/common/console";
import {EachMessagePayload, IHeaders, KafkaMessage} from "kafkajs";
import KafkaProducer from "./producer";
import KafkaConsumer from "./consumer";
import {DefaultEventsMap} from "socket.io/dist/typed-events";

interface Option {
    debug?: boolean;
    needAuth?: boolean;
}

interface ClientMessageRecord {
    roomId: string;
    text: string;
}

type ConsumeMessageRecord = KafkaMessage & {
    headers: Metadata;
};

interface Metadata extends IHeaders {
    nodeId: string;
    roomId: string;
}

class SocketServer {
    private readonly _io: Server;
    private readonly _producer: KafkaProducer;
    private readonly _debug: boolean;
    private readonly _needAuth: boolean;

    public constructor(
        expressServer: ExpressServer,
        producer: KafkaProducer,
        consumer: KafkaConsumer,
        opts?: Option
    ) {
        this._io = new Server(expressServer, {
            cors: {
                origin: config.clientEndpoint,
            },
        });
        this._producer = producer;
        this._debug = opts?.debug || false;
        this._needAuth = opts?.needAuth || true;
        consumer.setSocketHandler(this);
    }

    public consumeMessage({message}: EachMessagePayload) {
        const record = message as ConsumeMessageRecord;
        if (record.headers.nodeId === config.nodeId || !record.value) {
            return;
        }

        this.debug(
            `[socket server]: Emit to room ${record.headers.roomId} message: ${record.value.toString()}`
        );

        this._io.to(record.headers.roomId).emit(record.value.toString());
    }

    public listen(): void {
        this._io
            .of(SocketNamespace.MESSAGE)
            .use((socket, next) => {
                if (!this._needAuth) {
                    next();
                }

                const token: string = socket.handshake.auth["token"];
                this.auth(token, next);
            })
            .on(SocketEvent.CONNECT, async (socket) => {
                this.debug(
                    `[socket server]: A client with ID of ${socket.id} connected`
                );

                socket.on(SocketEvent.JOIN_ROOMS, async (rooms: string[]) => {
                    this.onJoinRoomsEventHandler(socket, rooms);
                });

                socket.on(
                    SocketEvent.CHAT,
                    async (msg: ClientMessageRecord) => {
                        this.onChatEventHandler(socket, msg);
                    }
                );

                socket.on(SocketEvent.DISCONNECT, async () => {
                    this.onDisconnectEventHandler(socket);
                });
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
            DefaultEventsMap,
            DefaultEventsMap,
            DefaultEventsMap,
            any
        >,
        rooms: string[]
    ) {
        this.debug(
            `[socket server]: Add client with ID of ${socket.id} to rooms: `,
            rooms
        );
        socket.join(rooms);
    }

    private onChatEventHandler(
        socket: Socket<
            DefaultEventsMap,
            DefaultEventsMap,
            DefaultEventsMap,
            any
        >,
        msg: ClientMessageRecord
    ) {
        this.debug(
            `[socket server]: Received a message from client with ID of ${socket.id}`
        );
        if (!socket.rooms.has(msg.roomId)) {
            this.debug(
                `[socket server]: Client with ID of ${socket.id} is not in room ${msg.roomId}`
            );
            return;
        }

        socket.to(msg.roomId).emit(msg.text);
        this.produceMessage(msg.text, {
            nodeId: config.nodeId,
            roomId: msg.roomId,
        });
    }

    private onDisconnectEventHandler(
        socket: Socket<
            DefaultEventsMap,
            DefaultEventsMap,
            DefaultEventsMap,
            any
        >
    ) {
        this.debug(
            `[socket server]: A client with ID of ${socket.id} disconnected`
        );
    }

    private debug(message?: any, ...optionalParams: any[]): void {
        this._debug && debug(message, optionalParams);
    }

    private async auth(
        token: string,
        next: (err?: ExtendedError) => void
    ): Promise<void> {
        const res = await fetch(config.authServiceEndpoint, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        if (res.status !== 200) {
            console.debug("[socket server]: Authentication failed");
            next(new Error(SocketStatusMessage.AUTHORIZATION_FAILED));
        }
        next();
    }

    private async produceMessage(msg: string, metadata: Metadata) {
        await this._producer.sendMessages({
            topic: TOPIC.CHAT,
            messages: [{value: msg, headers: metadata}],
        });
    }
}

export default SocketServer;
