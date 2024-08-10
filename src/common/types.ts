import {AckMessage} from "./constants";

interface ServerToClientEvents {
    chat: (serializedMessage: string) => void;
}

interface ClientToServerEvents {
    joinRooms: (rooms: string[], ack: (message: AckMessage) => void) => void;
    chat: (
        serializedMessage: string,
        ack: (message: AckMessage) => void
    ) => void;
    disconnect: () => void;
}

interface InterServerEvents {
    ping: () => void;
}

interface SocketData {
    age: number;
}

export {
    ServerToClientEvents,
    ClientToServerEvents,
    InterServerEvents,
    SocketData,
};
