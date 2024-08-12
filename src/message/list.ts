import {CallbackStatus} from "@/common/constants";
import {Message, Prisma, PrismaClient} from "@prisma/client";

type OrderByOption = "id:desc" | "id:asc";

interface Query {
    conversationId: string;
    after?: bigint;
    size?: number;
    orderBy?: OrderByOption;
}

type CallbackFunction = ({
    status,
    hasMore,
    data,
    error,
}: {
    status: CallbackStatus;
    hasMore?: boolean;
    data?: Message[];
    error?: unknown;
}) => void;

function listMessages(db: PrismaClient) {
    return async (query: Query, callback: CallbackFunction) => {
        const orderBy = query.orderBy ?? "id:desc";
        const [key, value] = orderBy.split(":");
        const whereQuery: Prisma.MessageWhereInput = {};

        if (query.after) {
            switch (orderBy) {
                case "id:desc":
                    whereQuery.id = {
                        lt: query.after,
                    };
                    break;
                case "id:asc":
                    whereQuery.id = {
                        gt: query.after,
                    };
                    break;
            }
        }

        try {
            const messages = await db.message.findMany({
                take: query.size ? query.size + 1 : undefined, // we add 1 more to check if the database has more messages than the amount of messages we requested. Later, we will remove the extra one before returning the result
                orderBy: {
                    [key]: value,
                },
                where: {
                    ...whereQuery,
                },
            });

            const hasMore: boolean =
                !query.size || messages.length > query.size;
            if (hasMore) {
                messages.pop();
            }

            callback({
                status: "OK",
                data: messages,
                hasMore,
            });
        } catch (error) {
            callback({
                status: "ERROR",
                error: error,
            });
        }
    };
}

export {Query, CallbackFunction, listMessages};
