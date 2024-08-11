import config from "@/common/config";
import KafkaConsumer from "./consumer";
import ExpressServer from "./express-server";
import Kafka from "./kafka";
import KafkaProducer from "./producer";
import SocketServer from "./socket-server";
import {TOPIC} from "@/common/constants";
import {logLevel} from "kafkajs";

export default () => {
    const expressServer = new ExpressServer();
    const kafka = new Kafka(
        {
            brokers: ["localhost:9092"], // TODO: cannot use fixed value like this!!!
        },
        {
            debug: true,
            logLevel: logLevel.INFO,
        }
    );
    const producer = new KafkaProducer(kafka.instance(), {
        debug: true,
    });
    const consumer = new KafkaConsumer(
        kafka.instance(),
        {
            groupId: config.nodeId,
        },
        {debug: true}
    );
    const socketServer = new SocketServer(
        expressServer.instance(),
        producer,
        consumer,
        {
            debug: true,
            needAuth: false,
        }
    );

    expressServer.listen();
    socketServer.listen();
    producer.startProducing();
    consumer.startConsuming({topics: [TOPIC.CHAT]});

    process
        .on("exit", () => {
            producer.disconnect();
            consumer.disconnect();
            socketServer.close();
        })
        .on("SIGINT", () => {
            producer.disconnect();
            consumer.disconnect();
            socketServer.close();
        });
};
