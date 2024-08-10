import {debug, info} from "@/common/console";
import {
    Consumer,
    ConsumerConfig,
    ConsumerSubscribeTopics,
    EachMessagePayload,
    Kafka,
    PartitionAssigners,
} from "kafkajs";
import SocketServer from "./socket-server";

interface Option {
    debug?: boolean;
}

class KafkaConsumer {
    private _consumer: Consumer;
    private _socketHandler: SocketServer;
    private readonly _debug: boolean;

    constructor(kafka: Kafka, config: ConsumerConfig, opts?: Option) {
        this._debug = opts?.debug ?? false;
        this._consumer = kafka.consumer({
            partitionAssigners: [PartitionAssigners.roundRobin],
            sessionTimeout: 30000,
            rebalanceTimeout: 60000,
            metadataMaxAge: 5 * 60 * 60,
            allowAutoTopicCreation: false,
            maxBytesPerPartition: 1024 * 1024,
            minBytes: 1,
            maxBytes: 10 * 1024 * 1024,
            readUncommitted: false,
            ...config,
        });
    }

    public setSocketHandler(socketHandler: SocketServer) {
        this._socketHandler = socketHandler;
    }

    public async startConsuming(subscription: ConsumerSubscribeTopics) {
        await this._consumer.connect();
        info("[kafka consumer]: Connected to kafka broker");

        await this._consumer.subscribe({
            fromBeginning: false,
            ...subscription,
        });

        await this._consumer.run({
            eachMessage: async (payload: EachMessagePayload) => {
                this.debug("[kafka consumer]: Consumed payload: ", payload);
                this._socketHandler.consumeMessage(payload);
            },
        });
    }

    public async disconnect() {
        await this._consumer.disconnect();
        info("[kafka consumer]: Disconnected");
    }

    private debug(message?: any, ...optionalParams: any[]): void {
        this._debug && debug(message, optionalParams);
    }
}

export default KafkaConsumer;
