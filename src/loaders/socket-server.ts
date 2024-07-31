import {Server} from "socket.io";
import {Server as ExpressServer} from "node:http";
import {
    SocketEvent,
    SocketNamespace,
    SocketStatusMessage,
} from "@/common/constants";
import config from "@/common/config";
import {ExtendedError} from "socket.io/dist/namespace";
import {debug, info} from "@/common/console";

interface Option {
    debug: boolean;
}

class SocketServer {
    private _io: Server;
    private _debug: boolean;

    public constructor(expressServer: ExpressServer, opts?: Option) {
        this._io = new Server(expressServer, {
            cors: {
                origin: config.clientEndpoint,
            },
        });
        this._debug = opts?.debug || false;

        this.listen();
    }

    private debug(msg: string): void {
        this._debug && debug(`[socket server]: ${msg}`);
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
            console.debug("error");
            next(new Error(SocketStatusMessage.AUTHORIZATION_FAILED));
        }
        next();
    }

    private listen(): void {
        this._io
            .of(SocketNamespace.MESSAGE)
            .use((socket, next) => {
                const token: string = socket.handshake.auth["token"];
                this.auth(token, next);
            })
            .on(SocketEvent.CONNECT, (socket) => {
                this.debug(`An user with socket ID of ${socket.id} connected`);

                socket.on(SocketEvent.DISCONNECT, () => {
                    this.debug(
                        `An user with socket ID of ${socket.id} disconnected`
                    );
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
}

export default SocketServer;
