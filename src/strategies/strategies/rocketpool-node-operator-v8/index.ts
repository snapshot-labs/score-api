import { BigNumberish } from '@ethersproject/bignumber';
import { formatUnits } from '@ethersproject/units';
import { Multicaller } from '../../utils';

const rocketNetworkVoting = '0x994A9C49230FEC0c127B8F42D6c5288F02610AeD';
const rocketNetworkVotingAbi = [
  'function getVotingPower(address _nodeAddress, uint32 _block) external view returns (uint256)'
];

export async function strategy(
  space,
  network,
  provider,
  addresses,
  options,
  snapshot
): Promise<Record<string, number>> {
  const blockTag =
    typeof snapshot === 'number' ? snapshot : await provider.getBlockNumber();

  const nodeVotingPower = new Multicaller(
    network,
    provider,
    rocketNetworkVotingAbi,
    { blockTag }
  );

  addresses.forEach(address => {
    nodeVotingPower.call(address, rocketNetworkVoting, 'getVotingPower', [
      address,
      blockTag
    ]);
  });

  const nodeVotingPowerResponse: Record<string, BigNumberish> =
    await nodeVotingPower.execute();

  const merged = addresses.map(address => {
    const votePower = nodeVotingPowerResponse[address];
    return {
      address: address,
      votePower: votePower
    };
  });

  const reduced: Record<string, BigNumberish> = merged.reduce((acc, obj) => {
    acc[obj.address] = obj.votePower;
    return acc;
  }, {});

  return Object.fromEntries(
    Object.entries(reduced).map(([address, votePower]) => [
      address,
      parseFloat(formatUnits(votePower, options.decimals))
    ])
  );
}
