import { fetchUrl } from './fetchUrl.js';

export async function coingeckoPrice(
  coinIds: string[],
  vsCurrencies: string[] = ['usd'],
  allowedDomains: string[] = ['api.coingecko.com']
): Promise<string> {
  const ids = coinIds.join(',');
  const vs = vsCurrencies.join(',');
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=${encodeURIComponent(vs)}`;
  return fetchUrl(url, allowedDomains);
}
