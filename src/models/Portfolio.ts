import mongoose, { Schema, Document, Model } from "mongoose";

export interface IPortfolio extends Document {
  handle: string;
  nearAccountId: string;
  cashUsd: number;
  paperCashUsd: number;
  mode: "simulation" | "mainnet";
  watchlist: string[];
  positions: Array<{
    symbol: string;
    name: string;
    shares: number;
    avgEntryPrice: number;
    currentPrice: number;
    currentValueUsd: number;
    pnlUsd: number;
    pnlPercent: number;
    allocationPercent: number;
  }>;
  riskPolicy: {
    maxSingleAssetPercent: number;
    minCashReservePercent: number;
    stopLossPercent: number;
    takeProfitPercent: number;
    strategyMode: "dca" | "smart";
    isAutonomousEnabled: boolean;
  };
  decisionHistory: Array<any>;
  rules: Array<{
    id: string;
    symbol: string;
    type: string;
    condition: string;
    triggerPrice?: number;
    triggerProfitPercent?: number;
    amountUsd: number;
    cadence?: string;
    lastTriggeredAt?: string;
    executionsCount?: number;
    maxExecutions?: number;
    status: string;
    createdAt: string;
  }>;
  orderHistory: Array<{
    id: string;
    ruleId?: string;
    symbol: string;
    type: string;
    side: "buy" | "sell";
    shares: number;
    price: number;
    amountUsd: number;
    timestamp: string;
    mode: "simulation" | "mainnet";
    status: "filled" | "cancelled";
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const PortfolioSchema = new Schema<IPortfolio>(
  {
    handle: { type: String, required: true, unique: true, index: true },
    nearAccountId: { type: String, required: true },
    cashUsd: { type: Number, default: 0.0 },
    paperCashUsd: { type: Number, default: 10000.0 },
    mode: { type: String, enum: ["simulation", "mainnet"], default: "simulation" },
    watchlist: {
      type: [String],
      default: ["NVDAon", "TSLAon", "SPYon", "NEAR"],
    },
    positions: {
      type: [
        {
          symbol: String,
          name: String,
          shares: Number,
          avgEntryPrice: Number,
          currentPrice: Number,
          currentValueUsd: Number,
          pnlUsd: Number,
          pnlPercent: Number,
          allocationPercent: Number,
        },
      ],
      default: [],
    },
    riskPolicy: {
      maxSingleAssetPercent: { type: Number, default: 25 },
      minCashReservePercent: { type: Number, default: 20 },
      stopLossPercent: { type: Number, default: 5 },
      takeProfitPercent: { type: Number, default: 10 },
      strategyMode: { type: String, enum: ["dca", "smart"], default: "dca" },
      isAutonomousEnabled: { type: Boolean, default: true },
    },
    decisionHistory: {
      type: [Schema.Types.Mixed as any],
      default: [],
    },
    rules: {
      type: [
        {
          id: String,
          symbol: String,
          type: { type: String },
          condition: String,
          triggerPrice: Number,
          triggerProfitPercent: Number,
          amountUsd: Number,
          cadence: String,
          lastTriggeredAt: String,
          executionsCount: { type: Number, default: 0 },
          maxExecutions: Number,
          status: { type: String, default: "active" },
          createdAt: { type: String, default: () => new Date().toISOString() },
        },
      ],
      default: [],
    },
    orderHistory: {
      type: [
        {
          id: String,
          ruleId: String,
          symbol: String,
          type: { type: String },
          side: { type: String, enum: ["buy", "sell"] },
          shares: Number,
          price: Number,
          amountUsd: Number,
          timestamp: { type: String, default: () => new Date().toISOString() },
          mode: { type: String, default: "simulation" },
          status: { type: String, default: "filled" },
        },
      ],
      default: [],
    },
  },
  { timestamps: true, bufferCommands: true }
);

export const Portfolio: Model<IPortfolio> =
  mongoose.models.Portfolio || mongoose.model<IPortfolio>("Portfolio", PortfolioSchema);
