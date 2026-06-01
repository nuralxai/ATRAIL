/*
  Warnings:

  - A unique constraint covering the columns `[key]` on the table `Conversation` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_key_key" ON "Conversation"("key");
