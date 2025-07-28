import { BigNumberish } from '@ethersproject/bignumber';
import { formatUnits } from '@ethersproject/units';
import { Multicaller } from '../../utils';
import { getAddress } from '@ethersproject/address';

export const author = 'snapshot-labs';
export const version = '0.1.0';

const abi = [
  'function lastValidatorID() external view returns (uint256)',
  'function getStake(address, uint256) external view returns (uint256)'
];

export async function strategy(
  space,
  network,
  provider,
  addresses,
  options,
  snapshot
): Promise<Record<string, number>> {
  const formattedAddresses = addresses.map(getAddress);
  const blockTag = typeof snapshot === 'number' ? snapshot : 'latest';
  const contractAddress = '0xFC00FACE00000000000000000000000000000000';
  const decimals = 18;

  // First, get the last validator ID
  const lastValidatorIdMulti = new Multicaller(network, provider, abi, {
    blockTag
  });
  lastValidatorIdMulti.call(
    'lastValidatorID',
    contractAddress,
    'lastValidatorID',
    []
  );
  const lastValidatorIdResult: Record<string, BigNumberish> =
    await lastValidatorIdMulti.execute();
  const lastValidatorID = parseInt(
    lastValidatorIdResult.lastValidatorID.toString()
  );

  // Then, get stakes for all addresses across all validators
  const multi = new Multicaller(network, provider, abi, { blockTag });

  formattedAddresses.forEach(address => {
    for (let validatorId = 1; validatorId <= lastValidatorID; validatorId++) {
      multi.call(`${address}-${validatorId}`, contractAddress, 'getStake', [
        address,
        validatorId
      ]);
    }
  });

  const result: Record<string, BigNumberish> = await multi.execute();

  // Aggregate stakes for each address
  const scores: Record<string, number> = {};

  formattedAddresses.forEach(address => {
    let totalStake = 0;
    for (let validatorId = 1; validatorId <= lastValidatorID; validatorId++) {
      const key = `${address}-${validatorId}`;
      const stake = result[key];
      if (stake) {
        totalStake += parseFloat(formatUnits(stake, decimals));
      }
    }
    scores[address] = totalStake;
  });

  return scores;
}
