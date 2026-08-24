export const USDT_TRC20_DEPOSIT_ADDRESS = "TKX1h9L4wWjimF8UVWHQLtFYvWv7TTHdnB";
export const USDC_SOLANA_DEPOSIT_ADDRESS = "5uFV6zUGS2X6pjxfcDjHXZcDsKprB9AwpWt2RwgwqWVH";

export function resolveCryptoDeposit(currency: "USDT" | "USDC"): { network: string; address: string } {
  if (currency === "USDT") return { network: "TRC20", address: USDT_TRC20_DEPOSIT_ADDRESS };
  return { network: String(process.env.USDC_NETWORK || "Solana"), address: String(process.env.USDC_SOLANA_DEPOSIT_ADDRESS || USDC_SOLANA_DEPOSIT_ADDRESS) };
}

export function cryptoOrderNumber(id: string, currency: string) {
  return `${currency}-${id.replace(/[^a-z0-9]/gi, "").slice(-10).toUpperCase()}`;
}
