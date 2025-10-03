import { BigNumberish } from '@ethersproject/bignumber';
import { getAddress } from '@ethersproject/address';
import { Multicaller } from '../../utils';
import { getDelegations } from '../../utils/delegation';

export const author = 'specter';
export const version = '1.0.0';

// ABI for Soulbound Token (ERC-721 standard)
const sbtAbi = [
  'function balanceOf(address owner) external view returns (uint256)',
  'function ownerOf(uint256 tokenId) external view returns (address)',
  'function totalSupply() external view returns (uint256)'
];

// ABI for on-chain delegation contract (optional)
const delegationAbi = [
  'function delegates(address account) external view returns (address)',
  'function getVotes(address account) external view returns (uint256)'
];

export async function strategy(
  space: string,
  network: string,
  provider: any,
  addresses: string[],
  options: {
    address: string;
    additionalBlacklist?: string[];
    delegationSpace?: string;
    useOnChainDelegation?: boolean;
    delegationContract?: string;
  },
  snapshot: string | number
): Promise<Record<string, number>> {
  // Validate required parameter
  if (!options.address) {
    throw new Error('address parameter is required');
  }

  // Normalize addresses
  const normalizedAddresses = addresses.map(address => getAddress(address));

  // Filter out Snapshot-configured blacklisted addresses (additional layer)
  const blacklist = (options.additionalBlacklist || []).map((addr: string) =>
    addr.toLowerCase()
  );

  const eligibleAddresses = normalizedAddresses.filter(
    address => !blacklist.includes(address.toLowerCase())
  );

  if (eligibleAddresses.length === 0) {
    return Object.fromEntries(addresses.map(address => [address, 0]));
  }

  // Check SBT ownership for eligible addresses
  // Note: SBT contract also burns tokens from contract-blacklisted users automatically
  const blockTag = typeof snapshot === 'number' ? snapshot : 'latest';

  // Get SBT balances for all eligible addresses
  const sbtMulti = new Multicaller(network, provider, sbtAbi, { blockTag });
  eligibleAddresses.forEach(address =>
    sbtMulti.call(address, options.address, 'balanceOf', [address])
  );

  const sbtBalances: Record<string, BigNumberish> = await sbtMulti.execute();

  // Filter addresses that have at least 1 SBT
  const sbtHolders = eligibleAddresses.filter(address => {
    const balance = sbtBalances[address];
    return balance && balance.toString() !== '0';
  });

  if (sbtHolders.length === 0) {
    return Object.fromEntries(addresses.map(address => [address, 0]));
  }

  // Get delegation data
  const delegations: Record<string, string[]> = {};
  const delegationMappings: Record<string, string> = {}; // delegator -> delegate

  // Networks with known delegation subgraph support
  const supportedDelegationNetworks = [
    '1', // Ethereum Mainnet
    '5', // Goerli
    '10', // Optimism
    '56', // BSC
    '100', // Gnosis
    '137', // Polygon
    '250', // Fantom
    '42161', // Arbitrum
    '43114', // Avalanche
    '11155111' // Sepolia
  ];

  if (options.useOnChainDelegation && options.delegationContract) {
    // Use on-chain delegation
    const delegationMulti = new Multicaller(network, provider, delegationAbi, {
      blockTag
    });
    sbtHolders.forEach(address =>
      delegationMulti.call(address, options.delegationContract!, 'delegates', [
        address
      ])
    );

    const onChainDelegates: Record<string, string> =
      await delegationMulti.execute();

    // Build delegation mappings
    Object.entries(onChainDelegates).forEach(([delegator, delegate]) => {
      if (
        delegate &&
        delegate !== '0x0000000000000000000000000000000000000000'
      ) {
        const normalizedDelegate = getAddress(delegate);
        delegationMappings[delegator] = normalizedDelegate;

        if (!delegations[normalizedDelegate]) {
          delegations[normalizedDelegate] = [];
        }
        delegations[normalizedDelegate].push(delegator);
      }
    });
  } else if (options.delegationSpace) {
    // Only check delegation support if delegation space is explicitly specified
    // Check if Snapshot delegation is supported on this network
    if (!supportedDelegationNetworks.includes(network)) {
      throw new Error(
        `Delegation subgraph not available for network ${network}. ` +
          `Use on-chain delegation (useOnChainDelegation: true) or ` +
          `use a supported network: ${supportedDelegationNetworks.join(', ')}`
      );
    }

    // Use Snapshot delegation system
    const delegationSpace = options.delegationSpace || space;
    const snapshotDelegations = await getDelegations(
      delegationSpace,
      network,
      addresses,
      snapshot as any
    );

    // Convert Snapshot delegations to our format
    Object.entries(snapshotDelegations).forEach(([delegate, delegators]) => {
      delegations[delegate] = delegators as string[];
      (delegators as string[]).forEach(delegator => {
        delegationMappings[delegator] = delegate;
      });
    });
  }
  // If no delegation options are specified, skip delegation entirely

  // Calculate voting power
  const votingPower: Record<string, number> = {};

  // Initialize all addresses with 0 voting power
  addresses.forEach(address => {
    votingPower[address] = 0;
  });

  // Assign voting power to each SBT holder
  sbtHolders.forEach(address => {
    const delegate = delegationMappings[address];

    if (delegate) {
      // This address has delegated to someone else
      // Check if delegate is also an SBT holder (optional, for added security)
      if (sbtHolders.includes(delegate)) {
        votingPower[delegate] = (votingPower[delegate] || 0) + 1;
      }
    } else {
      // This address votes for themselves
      votingPower[address] = (votingPower[address] || 0) + 1;
    }
  });

  // Ensure all original addresses are included in the result
  return Object.fromEntries(
    addresses.map(address => [address, votingPower[address] || 0])
  );
}
