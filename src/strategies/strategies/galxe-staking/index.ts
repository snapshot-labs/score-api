import { BigNumberish } from '@ethersproject/bignumber';
import { Multicaller } from '../../utils';
import { formatUnits } from '@ethersproject/units';

const stakingAbi = [
  'function getStakeAmount(address) external view returns (uint256)'
];

const tokenAbi = [
  'function balanceOf(address account) external view returns (uint256)'
];

export async function strategy(
  space,
  network,
  provider,
  addresses,
  options,
  snapshot
): Promise<Record<string, number>> {
  const blockTag = typeof snapshot === 'number' ? snapshot : 'latest';

  const stakingMulti = new Multicaller(network, provider, stakingAbi, {
    blockTag
  });
  const tokenMulti = new Multicaller(network, provider, tokenAbi, {
    blockTag
  });

  addresses.forEach(address => {
    stakingMulti.call(address, options.address, 'getStakeAmount', [address]);
    tokenMulti.call(address, options.tokenAddress, 'balanceOf', [address]);
  });

  const [stakingResult, tokenResult]: [
    Record<string, BigNumberish>,
    Record<string, BigNumberish>
  ] = await Promise.all([stakingMulti.execute(), tokenMulti.execute()]);

  return Object.fromEntries(
    addresses.map(address => [
      address,
      parseFloat(formatUnits(stakingResult[address], options.decimals)) +
        parseFloat(formatUnits(tokenResult[address], options.decimals))
    ])
  );
}
