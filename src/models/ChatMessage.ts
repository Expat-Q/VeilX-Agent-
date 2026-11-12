// src/models/ChatMessage.ts
import mongoose, { Schema, Document, Model } from "mongoose";

export interface IChatMessageDoc extends Document {
  userHandle: string;
  role: "user" | "assistant";
  content: string;
  actionCard?: Record<string, any>;
  channel?: string;
  createdAt: Date;
}

const ChatMessageSchema = new Schema<IChatMessageDoc>(
  {
    userHandle: { type: String, required: true, index: true },
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    actionCard: { type: Schema.Types.Mixed },
    channel: { type: String, default: "social", index: true },
  },
  { timestamps: true }
);

export const ChatMessageModel: Model<IChatMessageDoc> =
  mongoose.models.ChatMessage ||
  mongoose.model<IChatMessageDoc>("ChatMessage", ChatMessageSchema);
