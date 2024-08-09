export enum SocketEvent {
    CONNECT = "connection",
    DISCONNECT = "disconnect",
    CHAT = "chat",
    JOIN_ROOMS = "join rooms",
}

export enum SocketNamespace {
    MESSAGE = "message",
}

export enum SocketStatusMessage {
    AUTHORIZATION_FAILED = "Authorization failed",
}

export enum TOPIC {
    CHAT = "chat",
}
