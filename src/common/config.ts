import dotenv from "dotenv";
import {resolve} from "path";

const ENV_FILE_PATH = resolve(".env");
const isEnvFound = dotenv.config({
    path: ENV_FILE_PATH,
});

if (isEnvFound.error) {
    throw new Error("Cannot find .env file");
}

process.env.NODE_ENV = process.env.NODE_ENV || "development";
process.env.PORT = process.env.PORT || "8000";
process.env.AUTH_SERVICE_ENDPOINT = process.env.AUTH_SERVICE_ENDPOINT || "";
process.env.CLIENT_ENDPOINT = process.env.CLIENT_ENDPOINT || "";

export default {
    serverPort: parseInt(process.env.PORT, 10),
    authServiceEndpoint: process.env.AUTH_SERVICE_ENDPOINT,
    clientEndpoint: process.env.CLIENT_ENDPOINT,
};
