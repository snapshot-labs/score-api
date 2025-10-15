import { Multicaller } from '../../utils';
import { subgraphRequest } from '../../utils';
import { formatUnits } from '@ethersproject/units';
interface Prices {
  [id: string]: number;
}

const AAVEGOTCHI_SUBGRAPH_URL = {
  8453: 'https://subgraph.satsuma-prod.com/tWYl5n5y04oz/aavegotchi/aavegotchi-core-base/api'
};

async function fetchItemTypePrices(
  subgraphUrl: string,
  blockTag: number | 'latest'
): Promise<Prices> {
  const first = 1000;
  let skip = 0;
  const prices: Prices = {};

  // Build block args once
  const blockArgs: { block?: { number: number } } = {};
  if (blockTag !== 'latest') blockArgs.block = { number: blockTag };

  // Paginate through all itemTypes
  // itemTypes schema: id, svgId, ghstPrice (BigInt)
  while (true) {
    const query = {
      itemTypes: {
        __args: {
          ...blockArgs,
          first,
          skip,
          orderBy: 'svgId',
          orderDirection: 'asc'
        },
        svgId: true,
        ghstPrice: true
      }
    } as const;

    const res = await subgraphRequest(subgraphUrl, query);
    const items = (res?.itemTypes ?? []) as Array<{
      svgId: string;
      ghstPrice: string;
    }>; // ghstPrice is BigInt string

    for (const it of items) {
      // Convert wei to GHST decimal number
      let price = 0;
      try {
        price = parseFloat(formatUnits(it.ghstPrice || '0', 18));
      } catch (e) {
        price = 0;
      }
      // Map by svgId to match equipped wearable and itemId references
      prices[parseInt(it.svgId)] = price;
    }

    if (items.length < first) break;
    skip += first;
  }

  return prices;
}

const tokenAbi = [
  'function balanceOf(address account) view returns (uint256)',
  {
    inputs: [{ internalType: 'address', name: '_account', type: 'address' }],
    name: 'itemBalances',
    outputs: [
      {
        components: [
          { internalType: 'uint256', name: 'itemId', type: 'uint256' },
          { internalType: 'uint256', name: 'balance', type: 'uint256' }
        ],
        internalType: 'struct ItemsFacet.ItemIdIO[]',
        name: 'bals_',
        type: 'tuple[]'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  }
];

const maxResultsPerQuery = 1000;

export async function strategy(
  _space,
  network,
  provider,
  addresses,
  options,
  snapshot
) {
  const blockTag = typeof snapshot === 'number' ? snapshot : 'latest';
  const args: {
    block?: { number: number };
  } = {};
  if (blockTag !== 'latest') args.block = { number: blockTag };

  const subgraphUrl =
    AAVEGOTCHI_SUBGRAPH_URL[network] || AAVEGOTCHI_SUBGRAPH_URL[8453];
  // Fetch dynamic GHST prices for itemTypes
  const prices = await fetchItemTypePrices(subgraphUrl, blockTag);

  const multi = new Multicaller(network, provider, tokenAbi, { blockTag });
  addresses.map((addr: string) => {
    multi.call(
      `${options.tokenAddress}.${addr.toLowerCase()}.itemBalances`,
      options.tokenAddress,
      'itemBalances',
      [addr]
    );
  });
  const multiRes = await multi.execute();

  const query = {
    users: {
      __args: {
        ...args,
        first: addresses.length,
        where: {
          id_in: addresses.map(addr => addr.toLowerCase())
        }
      },
      id: true
    }
  };

  for (let i = 0; i <= 5; i++) {
    query.users['gotchisOriginalOwned' + i] = {
      __aliasFor: 'gotchisOriginalOwned',
      __args: {
        first: maxResultsPerQuery,
        skip: i * maxResultsPerQuery,
        orderBy: 'gotchiId'
      },
      baseRarityScore: true,
      equippedWearables: true
    };
  }

  const subgraphRaw = await subgraphRequest(subgraphUrl, query);

  const result = Object.fromEntries(
    subgraphRaw.users.map(item => {
      const ownedEntries = Object.entries(item)
        .map(([key, value]) => {
          if (key.startsWith('gotchis')) return value;
          else return [];
        })
        .flat();
      return [item.id, ownedEntries];
    })
  );

  return Object.fromEntries(
    addresses.map((address: string) => {
      const lowercaseAddr = address.toLowerCase();

      let gotchisBrsEquipValue = 0;
      const allGotchiInfo = result[lowercaseAddr];
      if (allGotchiInfo?.length > 0) {
        gotchisBrsEquipValue = allGotchiInfo.reduce(
          (total, { baseRarityScore, equippedWearables }) =>
            total +
            Number(baseRarityScore) +
            equippedWearables.reduce(
              (currentValue, nextIter) =>
                currentValue + (prices[nextIter] || 0),
              0
            ),
          0
        );
      }

      let ownerItemValue = 0;
      const ownerItemInfo =
        multiRes[options.tokenAddress][lowercaseAddr]['itemBalances'];
      if (ownerItemInfo?.length > 0) {
        ownerItemValue = ownerItemInfo.reduce((total, { balance, itemId }) => {
          const amountOwned = Number(balance.toString());
          const id = Number(itemId.toString());
          const pricetag = prices[id] || 0;
          let cost = pricetag * amountOwned;
          if (isNaN(cost)) cost = 0;
          return total + cost;
        }, 0);
      }

      return [address, ownerItemValue + gotchisBrsEquipValue];
    })
  );
}
