import {Socket} from "socket.io";
import {ExtendedError} from "socket.io/dist/namespace";
import {SocketStatus} from "./common/constants";

function auth(endpoint?: string) {
    return function (socket: Socket, next: (err?: ExtendedError) => void) {
        if (!endpoint) {
            next();
            return;
        }

        const token: string = socket.handshake.auth["token"];
        (async () => {
            console.debug(`fetching auth service from ${endpoint}...`);
            const error = await fetchAuth(token, endpoint);
            console.debug("error auth: ", error);
            if (error) {
                next(new Error(error));
            } else {
                next();
            }
        })();
    };
}

async function fetchAuth(
    token: string,
    endpoint: string
): Promise<string | null> {
    const res = await fetch(endpoint, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    if (res.status !== 200) {
        return SocketStatus.AUTHORIZATION_FAILED;
    }

    return null;
}

export default auth;
