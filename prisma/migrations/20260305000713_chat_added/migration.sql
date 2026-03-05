-- CreateTable
CREATE TABLE "support_chat_rooms" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "supportId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_chat_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_chat_messages" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "messageType" TEXT NOT NULL DEFAULT 'TEXT',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "support_chat_rooms_customerId_idx" ON "support_chat_rooms"("customerId");

-- CreateIndex
CREATE INDEX "support_chat_rooms_supportId_idx" ON "support_chat_rooms"("supportId");

-- CreateIndex
CREATE INDEX "support_chat_rooms_status_idx" ON "support_chat_rooms"("status");

-- CreateIndex
CREATE INDEX "support_chat_rooms_lastMessageAt_idx" ON "support_chat_rooms"("lastMessageAt");

-- CreateIndex
CREATE INDEX "support_chat_messages_roomId_createdAt_idx" ON "support_chat_messages"("roomId", "createdAt");

-- CreateIndex
CREATE INDEX "support_chat_messages_senderId_idx" ON "support_chat_messages"("senderId");

-- AddForeignKey
ALTER TABLE "support_chat_rooms" ADD CONSTRAINT "support_chat_rooms_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_chat_rooms" ADD CONSTRAINT "support_chat_rooms_supportId_fkey" FOREIGN KEY ("supportId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_chat_messages" ADD CONSTRAINT "support_chat_messages_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "support_chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_chat_messages" ADD CONSTRAINT "support_chat_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
