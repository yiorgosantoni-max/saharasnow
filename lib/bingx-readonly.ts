import { createHmac } from "node:crypto";

const BASE_URL = process.env.BINGX_BASE_URL || "https://open-api.bingx.com";

type BingXCredentialPair = {
  apiKey: string;
  secretKey: string;
};

export type BingXDeposit = {
  amount?: string | number;
  coin?: string;
  status?: string | number;
  txId?: string;
  insertTime?: number;
  network?: string;
  address?: string;
  [key: string]: unknown;
};

function getCredentials(): BingXCredentialPair {
  const apiKey = process.env.BINGX_API_KEY?.trim();
  const secretKey = process.env.BINGX_SECRET_KEY?.trim();
  if (!apiKey || !secretKey) {
    throw new Error("BingX read-only credentials are not configured.");
  }
  return { apiKey, secretKey };
}

export async function bingxGetDeposits(
  coin: "USDT" | "USDC",
  startTime: number,
  endTime: number,
): Promise<BingXDeposit[]> {
  const { apiKey, secretKey } = getCredentials();
  const params: Record<string, string> = {
    coin,
    startTime: String(startTime),
    endTime: String(endTime),
    limit: "1000",
    recvWindow: "60000",
    timestamp: String(Date.now()),
  };
  const query = new URLSearchParams(
    Object.entries(params).sort(([a], [b]) => a.localeCompare(b)),
  ).toString();
  const signature = createHmac("sha256", secretKey).update(query).digest("hex");
  const response = await fetch(
    `${BASE_URL}/openApi/api/v3/capital/deposit/hisrec?${query}&signature=${signature}`,
    {
      method: "GET",
      headers: { "X-BX-APIKEY": apiKey },
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error(`BingX deposit API returned HTTP ${response.status}.`);
  }
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object") return [];
  const body = payload as { code?: number; msg?: string; data?: unknown };
  if (body.code !== undefined && body.code !== 0) {
    throw new Error(body.msg || "BingX deposit API request failed.");
  }
  return Array.isArray(body.data) ? (body.data as BingXDeposit[]) : [];
}

export async function findBingXDepositByHash(
  txHash: string,
  coins: Array<"USDT" | "USDC"> = ["USDT", "USDC"],
): Promise<(BingXDeposit & { coin: "USDT" | "USDC" }) | null> {
  const normalized = txHash.trim().toLowerCase();
  if (!normalized || normalized.length < 20) return null;
  const end = Date.now();
  const start = end - 30 * 24 * 60 * 60 * 1000;
  for (const coin of coins) {
    const deposits = await bingxGetDeposits(coin, start, end);
    const match = deposits.find(
      (deposit) => String(deposit.txId || "").trim().toLowerCase() === normalized,
    );
    if (match) return { ...match, coin };
  }
  return null;
}
