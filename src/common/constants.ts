export enum SocketEvent {
    CONNECTION = "connection",
    CONNECT = "connect",
    DISCONNECT = "disconnect",
    CHAT = "chat",
    JOIN_ROOMS = "joinRooms",
}

export enum SocketNamespace {
    MESSAGE = "message",
}

export enum SocketStatus {
    OK = "ok",
    SEND_FAILED = "send failed",
    RECEIVED = "received",
    AUTHORIZATION_FAILED = "authorization failed",
}

export enum TOPIC {
    CHAT = "chat",
}

export type CallbackStatus = "OK" | "ERROR";

export type AckMessage =
    | "ok"
    | "not allowed"
    | "failed"
    | "wrong message format";
