import { getAddress } from '@ethersproject/address';
import { getDelegationsData } from '../../utils/delegation';
import { getScoresDirect } from '../../utils';

export const author = 'snapshot-labs';
export const version = '0.1.0';

export async function strategy(
  space,
  network,
  provider,
  addresses,
  options,
  snapshot
) {
  addresses = addresses.map(getAddress);

  const sparkStrategies = [
    {
      name: 'erc20-balance-of',
      params: {
        address: '0xc20059e0317DE91738d13af027DfC4a50781b066',
        decimals: 18
      }
    },
    {
      name: 'contract-call',
      params: {
        address: '0xc6132FAF04627c8d05d6E759FAbB331Ef2D8F8fD',
        decimals: 18,
        methodABI: {
          name: 'slashableBalanceOf',
          type: 'function',
          stateMutability: 'view',
          inputs: [
            {
              name: 'account',
              type: 'address'
            }
          ],
          outputs: [
            {
              name: '',
              type: 'uint256'
            }
          ]
        }
      }
    }
  ];

  // Whitelisted delegates - only these addresses get delegated balance
  const whitelistedDelegates = (options.whitelistedDelegates || []).map(
    getAddress
  );

  const delegationsData = await getDelegationsData(
    space,
    '1',
    addresses,
    snapshot
  );
  const delegations = delegationsData.delegations;

  // Get scores for all addresses and delegators
  if (Object.keys(delegations).length === 0) return {};
  const allAddresses = Object.values(delegations).reduce(
    (a: string[], b: string[]) => a.concat(b),
    []
  );
  allAddresses.push(...addresses);
  const scores = (
    await getScoresDirect(
      space,
      sparkStrategies,
      '1',
      provider,
      allAddresses,
      snapshot
    )
  ).filter(score => Object.keys(score).length !== 0);

  const finalScore = Object.fromEntries(
    addresses.map(address => {
      // Check if address is whitelisted delegate
      const isWhitelistedDelegate = whitelistedDelegates.includes(address);

      let addressScore = 0;

      if (isWhitelistedDelegate && delegations[address]) {
        // Whitelisted delegates get delegated balance
        addressScore = delegations[address].reduce(
          (a, b) => a + scores.reduce((x, y) => (y[b] ? x + y[b] : x), 0),
          0
        );
      }

      return [address, addressScore];
    })
  );

  // Add own scores for all addresses (both whitelisted and non-whitelisted)
  // but only if they haven't delegated to anyone
  addresses.forEach(address => {
    if (!delegationsData.allDelegators.includes(address)) {
      finalScore[address] += scores.reduce(
        (a, b) => a + (b[address] ? b[address] : 0),
        0
      );
    }
  });

  return finalScore;
}
