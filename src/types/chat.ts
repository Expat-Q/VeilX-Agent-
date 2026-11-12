export type MessageRole = "user" | "assistant" | "system";

export type RadarStepStatus = "pending" | "processing" | "completed" | "failed";

export interface RadarStep {
  id: string;
  label: string;
  status: RadarStepStatus;
  txHash?: string;
  chain?: string;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: Date;
  actionCard?: {
    type: "tip" | "invoice" | "claim" | "confirm_tip" | "faucet" | "confirm_direct" | "pay_invoice" | "cross_chain_intent";
    data: Record<string, any>;
    radar?: RadarStep[];
  };
}
