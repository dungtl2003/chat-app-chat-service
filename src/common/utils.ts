import {Message} from "@prisma/client";

function deserializeMessage(serializedMessage: string): Message {
    const deserializedMesssage = <Message>(
        JSON.parse(serializedMessage, (key, value) =>
            key === "receiverId" || key === "senderId" || key === "id"
                ? BigInt(value)
                : value
        )
    );

    return deserializedMesssage;
}

function serializeMessage(message: Message): string {
    return JSON.stringify(message, (_, value) =>
        typeof value === "bigint" ? value.toString(10) : value
    );
}

export {deserializeMessage, serializeMessage};
