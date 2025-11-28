import { formatUnits } from '@ethersproject/units';
import { getAddress } from '@ethersproject/address';
import fetch from 'cross-fetch';

interface IntendedStakeSnapshot {
  intendedStakedAmount: string;
  blockNumber: number;
}

const SUBGRAPH_URI =
  'https://api.goldsky.com/api/public/project_clch40o0v0d510huoey7g5yaz/subgraphs/aevo-staking-v2/snapshot/gn';

export async function strategy(
  space,
  network,
  provider,
  addresses,
  options,
  snapshot
): Promise<Record<string, number>> {
  // Handle 'latest' snapshot - get current block number
  let blockNumber = snapshot;
  if (snapshot === 'latest') {
    blockNumber = await provider.getBlockNumber();
  }

  // Build batched query using aliases for each address
  const queryParts = addresses.map((addr, index) => {
    const alias = `account${index}`;
    const addressLower = addr.toLowerCase();
    return `
      ${alias}: intendedStakeSnapshots(
        where: {
          account: "${addressLower}"
          blockNumber_lte: ${blockNumber}
        }
        orderBy: blockNumber
        orderDirection: desc
        first: 1
      ) {
        intendedStakedAmount
        blockNumber
      }
    `;
  });

  const query = `{${queryParts.join('')}}`;

  const response = await fetch(SUBGRAPH_URI, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query })
  });

  const data = await response.json();

  const result: Record<string, number> = {};

  // Initialize all addresses with 0 balance using checksum format
  addresses.forEach(address => {
    result[getAddress(address)] = 0;
  });

  // Process each account's snapshot
  addresses.forEach((address, index) => {
    const alias = `account${index}`;
    const snapshots = data.data[alias] as IntendedStakeSnapshot[];

    if (snapshots && snapshots.length > 0) {
      const stakeSnapshot = snapshots[0]; // Get the first (most recent) snapshot
      const intendedStakedAmount = BigInt(stakeSnapshot.intendedStakedAmount);

      // Convert to number with proper decimals and store with checksum address
      result[getAddress(address)] = parseFloat(
        formatUnits(intendedStakedAmount.toString(), options.decimals)
      );
    }
  });

  return result;
}
