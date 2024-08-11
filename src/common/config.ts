import {info} from "./console";

process.env.NODE_ENV = process.env.NODE_ENV || "development";
const env = process.env.NODE_ENV;
info(`Running app in ${env} environment`);

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
