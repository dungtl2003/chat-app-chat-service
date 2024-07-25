import ExpressServer from "./express-server";
import SocketServer from "./socket-server";

export default () => {
    const expressServer = new ExpressServer();
    const socketServer = new SocketServer(expressServer.instance(), {
        debug: true,
    });

    process
        .on("exit", () => {
            socketServer.close();
            expressServer.close();
        })
        .on("SIGINT", () => {
            socketServer.close();
            expressServer.close();
        });
};
