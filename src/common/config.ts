import dotenv from "dotenv";
import {resolve} from "path";
import {info} from "./console";

process.env.NODE_ENV = process.env.NODE_ENV || "development";
const env = process.env.NODE_ENV;
info(`Running app in ${env} environment`);

const ENV_FILE_PATH = resolve(
    "environments",
    env === "development" ? "dev" : "prod",
    ".env"
);
const isEnvFound = dotenv.config({
    path: ENV_FILE_PATH,
});

if (isEnvFound.error) {
    throw new Error(`Cannot find .env file from ${ENV_FILE_PATH}`);
}
info(`Load .env from ${ENV_FILE_PATH}`);

process.env.PORT = process.env.PORT || "8010";
process.env.AUTH_SERVICE_ENDPOINT = process.env.AUTH_SERVICE_ENDPOINT || "";
process.env.CLIENT_ENDPOINT = process.env.CLIENT_ENDPOINT || "";
process.env.NODE_ID = process.env.NODE_ID || "";

export default {
    serverPort: parseInt(process.env.PORT, 10),
    nodeId: process.env.NODE_ID,
    authServiceEndpoint: process.env.AUTH_SERVICE_ENDPOINT,
    clientEndpoint: process.env.CLIENT_ENDPOINT,
};
