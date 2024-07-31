import express, {Express} from "express";
import config from "@/common/config";
import {createServer, Server} from "node:http";
import cors from "cors";
import {info} from "@/common/console";

class ExpressServer {
    private static readonly PORT = 8000;

    private _app: Express;
    private _server: Server;
    private _port: number;

    public constructor() {
        this.listen();
    }

    private listen(): void {
        this._app = express();
        this._app.use(cors());

        this._port = config.serverPort || ExpressServer.PORT;
        this._server = createServer(this._app);
        this._server.listen(this._port, () => {
            info(`[express server]: Server is running at port ${this._port}`);
        });
    }

    public close(): void {
        this._server.close((error) => {
            if (error) throw error;

            info("[express server]: Stopped");
        });
    }

    public instance(): Server {
        return this._server;
    }
}

export default ExpressServer;
