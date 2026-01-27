import { Multicaller } from '../../utils';
import { BigNumber } from '@ethersproject/bignumber';

const abi = [
  'function getTier(uint256 _tokenId) external pure returns (uint8)'
];

const lockerAbi = [
  'function lockedNft(address _holder) external view returns (tuple(uint256 lockedAt, uint256 tokenId))'
];

export async function strategy(
  space,
  network,
  provider,
  addresses,
  options,
  snapshot
) {
  const blockTag = typeof snapshot === 'number' ? snapshot : 'latest';

  if (options.tokenIdWeightRanges && options.tokenIdWeightRanges.length > 100) {
    throw new Error('tokenIdWeightRanges must be less than or equal to 100');
  }

  // Get locked NFT info from locker
  const callLocker = new Multicaller(network, provider, lockerAbi, {
    blockTag
  });
  for (const walletAddress of addresses) {
    callLocker.call(walletAddress, options.locker, 'lockedNft', [
      walletAddress
    ]);
  }
  const walletToLockedNft: Record<string, [BigNumber, BigNumber]> =
    await callLocker.execute();

  // Get tier for each locked tokenId
  const callTier = new Multicaller(network, provider, abi, {
    blockTag
  });
  for (const [address, [tokenId]] of Object.entries(walletToLockedNft)) {
    if (tokenId.gt(0)) {
      callTier.call(address, options.address, 'getTier', [tokenId]);
    }
  }
  const addressToTier: Record<string, number> = await callTier.execute();

  // Set voting power to the weight based on tier ranges
  const walletToLpBalance = {} as Record<string, BigNumber>;
  for (const [address, [tokenId]] of Object.entries(walletToLockedNft)) {
    if (tokenId.gt(0)) {
      const tier = addressToTier[address];
      let weight = options.defaultWeight;
      for (const { start, end, weight: w } of options.tokenIdWeightRanges) {
        if (tier >= start && tier <= end) {
          weight = w;
          break;
        }
      }
      walletToLpBalance[address] = BigNumber.from(weight);
    }
  }

  return Object.fromEntries(
    Object.entries(walletToLpBalance).map(([address, balance]) => [
      address,
      balance.toNumber()
    ])
  );
}
