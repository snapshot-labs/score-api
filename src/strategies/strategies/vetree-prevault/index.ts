import { BigNumberish } from '@ethersproject/bignumber';
import { formatUnits } from '@ethersproject/units';
import { Multicaller } from '../../utils';

export const author = 'thinhthf';
export const version = '0.0.1';
export const dependOnOtherAddress = false;

const abi = [
  'function userDeposit(uint8 vaultId, address user) view returns (uint128)'
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

  const multi = new Multicaller(network, provider, abi, { blockTag });
  addresses.forEach(address => {
    [1, 2, 3, 4, 5, 6, 7, 8].forEach(vaultId => {
      multi.call(`${address}-${vaultId}`, options.address, 'userDeposit', [
        vaultId,
        address
      ]);
    });
  });

  const result: Record<string, BigNumberish> = await multi.execute();

  // Sum all vault balances for each address
  const balances: Record<string, number> = {};

  addresses.forEach(address => {
    let totalBalance = 0;
    [1, 2, 3, 4, 5, 6, 7, 8].forEach(vaultId => {
      const key = `${address}-${vaultId}`;
      if (result[key]) {
        totalBalance += parseFloat(formatUnits(result[key], options.decimals));
      }
    });
    balances[address] = Math.sqrt(totalBalance);
  });

  return balances;
}
