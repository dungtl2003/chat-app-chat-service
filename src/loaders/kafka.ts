import {debug} from "@/common/console";
import {KafkaConfig, Kafka as Kk, logLevel} from "kafkajs";

interface Option {
    debug?: boolean;
    logLevel?: logLevel;
}

class Kafka {
    private readonly _kafka: Kk;
    private readonly _debug: boolean;

    constructor(config: KafkaConfig, opts?: Option) {
        this._debug = opts?.debug || false;
        this._kafka = new Kk({
            clientId: "chat-service",
            ssl: false, // TODO: need to be true
            connectionTimeout: 3000,
            retry: {
                maxRetryTime: 30000,
                initialRetryTime: 300,
                factor: 0.2,
                multiplier: 2,
                retries: 8,
                restartOnFailure: async (error) => {
                    this.debug("[kafka]: Error occurs: ", error.message);
                    return true;
                },
            },
            logLevel: opts?.logLevel ?? logLevel.INFO,
            ...config,
        });
    }

    public instance() {
        return this._kafka;
    }

    private debug(message?: any, ...optionalParams: any[]): void {
        this._debug && debug(message, optionalParams);
    }
}

export default Kafka;
