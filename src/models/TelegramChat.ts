// src/models/TelegramChat.ts
import mongoose, { Schema, Document, Model } from "mongoose";

export interface ITelegramChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

export interface ITelegramChatDoc extends Document {
  chatId: number;
  history: ITelegramChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const TelegramChatMessageSchema = new Schema<ITelegramChatMessage>(
  {
    role: { type: String, enum: ["user", "assistant", "system"], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const TelegramChatSchema = new Schema<ITelegramChatDoc>(
  {
    chatId: { type: Number, required: true, unique: true, index: true },
    history: { type: [TelegramChatMessageSchema], default: [] },
  },
  { timestamps: true, bufferCommands: false }
);

// TASK-TG-03: 24h TTL index so Telegram multi-turn conversations expire automatically
TelegramChatSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 86400 });

export const TelegramChat: Model<ITelegramChatDoc> =
  mongoose.models.TelegramChat ||
  mongoose.model<ITelegramChatDoc>("TelegramChat", TelegramChatSchema);
