import { BigNumber, BigNumberish } from '@ethersproject/bignumber';
import { formatUnits } from '@ethersproject/units';
import { Multicaller } from '../../utils';

export const author = 'mick00';
export const version = '0.1.0';

const nftAbi = [
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)'
];

const bondingAbi = [
  'function getNormalizedWeight(uint256 tokenId) view returns (uint256)'
];

export async function strategy(
  space: string,
  network: string,
  provider,
  addresses: string[],
  options,
  snapshot
): Promise<Record<string, number>> {
  const blockTag = typeof snapshot === 'number' ? snapshot : 'latest';
  const decimals = options.decimals ?? 2;
  const maxBondsPerAddress = options.maxBondsPerAddress ?? 10;

  const balancesCall = new Multicaller(network, provider, nftAbi, { blockTag });
  addresses.forEach((address) => {
    balancesCall.call(address, options.nftBondAddress, 'balanceOf', [address]);
  });
  const balances: Record<string, BigNumberish> = await balancesCall.execute();

  const tokenIdsCall = new Multicaller(network, provider, nftAbi, { blockTag });
  const ownerKeys: Array<{ owner: string; key: string }> = [];

  for (const owner of addresses) {
    const count = Math.min(Number(balances[owner] || 0), maxBondsPerAddress);
    for (let i = 0; i < count; i++) {
      const key = `${owner}-${i}`;
      ownerKeys.push({ owner, key });
      tokenIdsCall.call(key, options.nftBondAddress, 'tokenOfOwnerByIndex', [
        owner,
        i
      ]);
    }
  }

  if (ownerKeys.length === 0) {
    return Object.fromEntries(addresses.map((a) => [a, 0]));
  }

  const tokenIds: Record<string, BigNumberish> = await tokenIdsCall.execute();

  const weightCall = new Multicaller(network, provider, bondingAbi, {
    blockTag
  });
  for (const { key } of ownerKeys) {
    const tokenId = tokenIds[key];
    weightCall.call(key, options.governanceBondingAddress, 'getNormalizedWeight', [
      tokenId
    ]);
  }
  const weights: Record<string, BigNumberish> = await weightCall.execute();

  const totals: Record<string, BigNumber> = Object.fromEntries(
    addresses.map((a) => [a, BigNumber.from(0)])
  );
  for (const { owner, key } of ownerKeys) {
    totals[owner] = totals[owner].add(weights[key] ?? 0);
  }

  return Object.fromEntries(
    addresses.map((address) => [
      address,
      parseFloat(formatUnits(totals[address], decimals))
    ])
  );
}
