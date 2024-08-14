import {type Socket as ClientSocket} from "socket.io-client";
import SocketServer from "@/loaders/socket-server";
import {setup} from "../utils";
import {ClientToServerEvents, ServerToClientEvents} from "@/common/types";
import {
    Conversation,
    ConversationType,
    Gender,
    Message,
    MessageType,
    PrismaClient,
    Role,
    User,
    UserStatus,
} from "@prisma/client";
import {assert} from "chai";
import {serializeMessage} from "@/common/utils";
import "@/patch";

async function addTempMessages(
    db: PrismaClient,
    conversationId: bigint,
    size: number
) {
    const fakeUser: User = {
        id: 1n,
        email: "test@gmail.com",
        username: "test",
        firstName: "test",
        lastName: "test",
        password: "somehashedpassword",
        birthday: new Date(2012, 1, 3),
        gender: Gender.MALE,
        role: Role.USER,
        phoneNumber: "0123456789",
        privacy: null,
        status: UserStatus.ONLINE,
        lastActiveAt: new Date(),
        avatarUrl: null,
        refreshTokens: [],
        createdAt: new Date(),
        deletedAt: null,
        updatedAt: null,
    };
    await db.user.create({data: fakeUser});

    const conversation: Conversation = {
        id: conversationId,
        type: ConversationType.GROUP,
        createdAt: new Date(),
        deletedAt: null,
    };
    await db.conversation.create({data: conversation});

    const tempMessages: Message[] = Array(size)
        .fill(0)
        .map((_, i) => {
            return {
                id: BigInt(i),
                senderId: 1n,
                receiverId: conversationId,
                message: String(i),
                type: MessageType.TEXT,
                createdAt: new Date(),
                updatedAt: null,
                deletedAt: null,
            } as Message;
        });

    await db.message.createMany({
        data: tempMessages,
    });

    return tempMessages;
}

async function cleanDb(db: PrismaClient) {
    await db.user.deleteMany();
    await db.conversation.deleteMany();
    await db.message.deleteMany();
}

describe("message:list", () => {
    let socketServer: SocketServer;

    let clientSocket: ClientSocket<ServerToClientEvents, ClientToServerEvents>;

    let cleanup: () => Promise<void>;

    const db = new PrismaClient();
    const conversationId = 1n;
    const size = 500;
    let tempMessages: Message[];

    before("init services and add temp messages to database", async () => {
        const result = await setup();

        socketServer = result.socketServer1;
        clientSocket = result.clientSocket1;
        cleanup = result.cleanup;

        await cleanDb(db);
        tempMessages = await addTempMessages(db, conversationId, size);
    });

    after("shutdown services and clean database", async () => {
        await cleanup();
        await cleanDb(db);
    });

    afterEach("remove client's listener", () => {
        clientSocket.removeAllListeners();
    });

    it("should return all messages if not specific size or the size is bigger than total existed messages in correct order", async () => {
        let result = await clientSocket.emitWithAck("message:list", {
            orderBy: "id:asc",
            conversationId: conversationId,
            size: 600, // pass max messages
        });
        assert.strictEqual(result.status, "OK");
        assert.strictEqual(result.data!.length, size);
        result.data!.forEach((msg, i) => {
            assert.strictEqual(
                serializeMessage(msg),
                serializeMessage(tempMessages[i])
            );
        });

        result = await clientSocket.emitWithAck("message:list", {
            orderBy: "id:desc",
            conversationId: conversationId,
        });
        assert.strictEqual(result.status, "OK");
        assert.strictEqual(result.data!.length, size);
        result.data!.reverse().forEach((msg, i) => {
            assert.strictEqual(
                serializeMessage(msg),
                serializeMessage(tempMessages[i])
            );
        });
    });

    it("should return correct amount of messages in correct order", async () => {
        let result = await clientSocket.emitWithAck("message:list", {
            orderBy: "id:asc",
            conversationId: conversationId,
            size: 300,
        });
        assert.strictEqual(result.status, "OK");
        assert.strictEqual(result.data!.length, 300);
        result.data!.forEach((msg, i) => {
            assert.strictEqual(
                serializeMessage(msg),
                serializeMessage(tempMessages[i])
            );
        });

        result = await clientSocket.emitWithAck("message:list", {
            orderBy: "id:desc",
            conversationId: conversationId,
            size: 200, // must be from 499n to 300n
        });
        assert.strictEqual(result.status, "OK");
        assert.strictEqual(result.data!.length, 200);
        result.data!.reverse().forEach((msg, i) => {
            assert.strictEqual(
                serializeMessage(msg),
                serializeMessage(tempMessages[i + 300])
            );
        });
    });

    it("should return ok status with no message if conversation ID does not exist", async () => {
        let result = await clientSocket.emitWithAck("message:list", {
            conversationId: -1n,
        });
        assert.strictEqual(result.status, "OK");
        assert.strictEqual(result.data!.length, 0);
    });

    it("should return messages after a given message ID in correct order", async () => {
        let result = await clientSocket.emitWithAck("message:list", {
            orderBy: "id:asc",
            conversationId: conversationId,
            size: 300,
            after: 99n, // must be from 100n to 399n
        });
        assert.strictEqual(result.status, "OK");
        assert.strictEqual(result.data!.length, 300);
        result.data!.forEach((msg, i) => {
            assert.strictEqual(
                serializeMessage(msg),
                serializeMessage(tempMessages[i + 100])
            );
        });

        result = await clientSocket.emitWithAck("message:list", {
            orderBy: "id:desc",
            conversationId: conversationId,
            size: 200,
            after: 301n, // must be from 300n to 101n
        });
        assert.strictEqual(result.status, "OK");
        assert.strictEqual(result.data!.length, 200);
        result.data!.reverse().forEach((msg, i) => {
            assert.strictEqual(
                serializeMessage(msg),
                serializeMessage(tempMessages[i + 101])
            );
        });

        result = await clientSocket.emitWithAck("message:list", {
            orderBy: "id:asc",
            conversationId: conversationId,
            size: 200,
            after: 399n, // must be from 400n to 499n
        });
        assert.strictEqual(result.status, "OK");
        assert.strictEqual(result.data!.length, 100);
        result.data!.forEach((msg, i) => {
            assert.strictEqual(
                serializeMessage(msg),
                serializeMessage(tempMessages[i + 400])
            );
        });
    });
});
