import {debug, info} from "@/common/console";
import {Kafka, Producer, ProducerConfig, ProducerRecord} from "kafkajs";

interface Option {
    debug?: boolean;
}

class KafkaProducer {
    private readonly _producer: Producer;
    private readonly _debug: boolean;

    constructor(kafka: Kafka, config: ProducerConfig, opts?: Option) {
        this._debug = opts?.debug || false;
        this._producer = kafka.producer({
            metadataMaxAge: 5 * 60 * 60,
            allowAutoTopicCreation: false,
            transactionTimeout: 60000,
            idempotent: true,
            ...config,
        });
    }

    public async startProducing() {
        await this._producer.connect();
        info("[kafka producer]: Connected to kafka broker");
    }

    public async sendMessages(record: ProducerRecord) {
        this.debug("[kafka producer]: Produce record: ", record);
        await this._producer.send(record);
    }

    public async disconnect() {
        await this._producer.disconnect();
        info("[kafka producer]: Disconnected");
    }

    private debug(message?: any, ...optionalParams: any[]): void {
        this._debug && debug(message, optionalParams);
    }
}

export default KafkaProducer;
