import { formatUnits } from '@ethersproject/units';
import { customFetch } from '../../utils';

interface BeaconChainValidator {
  balance: string;
  validator: { withdrawal_credentials: string };
}
interface BeaconChainResponse {
  data: BeaconChainValidator[];
}

export async function strategy(
  _space,
  _network,
  provider,
  addresses: string[],
  options,
  snapshot
): Promise<Record<string, number>> {
  const BEACON_CHAIN_STRATEGY_ENDPOINT =
    process.env.BEACON_CHAIN_STRATEGY_ENDPOINT ||
    'https://rpc-gbc.gnosischain.com';
  const {
    clMultiplier = '32',
    decimals = 9,
    secondsPerSlot = 5,
    genesisTime = 1638968400
  } = options;

  const isLatest = snapshot === 'latest' || snapshot == null;
  let stateId: string;

  if (isLatest) {
    stateId = 'finalized';
  } else {
    const block = await provider.getBlock(snapshot);
    const ts = block.timestamp;
    if (ts <= genesisTime) {
      stateId = 'genesis';
    } else {
      const slot = Math.floor((ts - genesisTime) / secondsPerSlot);
      stateId = String(slot);
    }
  }

  const endpoint = `${BEACON_CHAIN_STRATEGY_ENDPOINT}/eth/v1/beacon/states/${stateId}/validators?status=active`;

  try {
    const response = await customFetch(
      endpoint,
      {
        headers: { accept: 'application/json', 'accept-encoding': 'gzip, br' }
      },
      80000
    );
    if (!response.ok)
      throw new Error(
        `HTTP ${response.status} - ${response.statusText} - ${endpoint}`
      );

    const json: BeaconChainResponse = await response.json();
    const validators = json.data ?? [];
    const multiplier = BigInt(clMultiplier);

    const norm = (addr: string) => addr.toLowerCase().replace(/^0x/, '');
    const addressSuffixes = addresses.map(norm);
    const suffixSet = new Set(addressSuffixes);

    const sumBySuffix = new Map<string, bigint>();
    for (const v of validators) {
      const wc = v.validator.withdrawal_credentials?.toLowerCase() ?? '';
      if (!(wc.startsWith('0x01') || wc.startsWith('0x02'))) continue;

      const suffix = wc.replace(/^0x/, '').slice(-40);
      if (!suffixSet.has(suffix)) continue;

      const bal = BigInt(v.balance);
      sumBySuffix.set(suffix, (sumBySuffix.get(suffix) ?? 0n) + bal);
    }

    const result: Record<string, number> = {};
    for (let i = 0; i < addresses.length; i++) {
      const original = addresses[i];
      const suffix = addressSuffixes[i];
      const totalGwei = sumBySuffix.get(suffix) ?? 0n;

      const scaled = totalGwei === 0n ? 0n : totalGwei / multiplier;
      result[original] =
        scaled === 0n
          ? 0
          : parseFloat(formatUnits(scaled.toString(), decimals));
    }

    return result;
  } catch (error) {
    console.error('Error fetching beacon chain data:', error);
    return Object.fromEntries(addresses.map(address => [address, 0]));
  }
}
