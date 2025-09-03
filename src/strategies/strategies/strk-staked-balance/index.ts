import { BigNumberish } from '@ethersproject/bignumber';
import { formatUnits } from '@ethersproject/units';
import { Multicaller } from '../../utils';
import snapshotjs from '@snapshot-labs/snapshot.js';

export const supportedProtocols = ['starknet'];

const abi = [
  {
    name: 'get_pool_member_info',
    type: 'function',
    inputs: [
      {
        name: 'staker_address',
        type: 'core::starknet::contract_address::ContractAddress'
      }
    ],
    outputs: [
      {
        name: 'result',
        type: 'core::option::Option<(core::starknet::contract_address::ContractAddress, core::integer::u256, core::integer::u256, core::integer::u256, core::integer::u256, core::integer::u64)>'
      }
    ],
    state_mutability: 'view'
  }
];

// Whitelisted staking contracts (top 30 on sep 2nd)
const WHITELISTED_CONTRACTS = [
  '0x02cb02c72e8a0975e69e88298443e984d965a49eab38f5bdde1f5072daa09cfe',
  '0x07d695337550e96e1372dd03274965cca0284ded266efc1774d001d37fbca104',
  '0x01f170bafce432964d6cbaf2cb75355b2043f5640897e0623b7dbb029bf6b3ef',
  '0x02ecd9247f57a500414b9dbf2723e5a22ba152ea77c045129c38e799b56a6fc7',
  '0x0362dc7da60bfddc8e3146028dfd94941c6e22403c98b5947104e637543b475d',
  '0x03bd73e92891c26838a68379966fb0f23837aed7369d620f0fcc5d36ac44bd60',
  '0x060e069a86f89f1ab550a93baec20479341579308664fe9e192aed408d6a48ce',
  '0x051ca10c1fa0c9ba294c0fcf4ec657a73a5ba93bb8e1cc61cd38ae1e5c08a425',
  '0x03199ff0f152426280502dad5d554448ad211c3b62d82c01114986c421e65388',
  '0x044d7c8c9d03b79e298b844b7449a5f79c82b31e9697b6634b403bfe9f168216',
  '0x040f0a2d940fc7624abadaf06c26d3e1249e0fd4b3fcccf88db56a4b628b23f3',
  '0x025a2eeacf94ccb559ba58bb1fb335633ebf368f0eaa8ae05e7e078cfed18d18',
  '0x007e0247e9d36b8b23fea0ad2c1d8b7ddff41fcff9f5fd504f5bab6c360ef5b5',
  '0x00d1272ba59284d2f4770fc46ce82e01c84ff71009a62fa4c43fff0ccaa55d98',
  '0x0778707408dc62e14fee3d9bcdce2e281bdfc030e7f39067a48de3d1e97181dc',
  '0x07c744f9bfc2555505dd92399048ec792886a822b26a828496405a57e30a0e0d',
  '0x0712174ab962df1803ab93de4efc8a9423e825baf29b7067e5e2d24e9fc4e67e',
  '0x0234b7780f0d2850d46ad666d7192a1c89feb2d30fca9069d5262565cdcd8b62',
  '0x0050c48f149c2b09cf779cbc27de0b2127f3792c17584e457f5179541141e2a8',
  '0x069bd0141acecdc330ff8daf8f70f3ccad984ce3a8f015b7386f870309f7da63',
  '0x0557b05127c57cd84ad613e3f4f40e92c07ede972c4c253c2dd3d8ac73c873fb',
  '0x01c202d2a02866c57d4950a461c1e870ace37a07ebcf2d92c62764f768233692',
  '0x0640253121d5e70f08c9280d0091f1554cfd43bb51377521607efad33902793c',
  '0x00544d294d8b2e30585283a06e69ec3626a1d6ca5d4487d8825223593745867a',
  '0x030b0733dff76737c5146d858a159ba19fe17eeecd8a97b88c75135bea363e38',
  '0x00929e01a64b2dec1f0e6de3146bb709876c2def99d2ac566def7f05394500cd',
  '0x04283b57b27629a688f70ec2fef1b9b0c038357e082d7f36a8b72e124a42825e',
  '0x0627bab5af907c4e266c3045d8cb5b9c5820bddf466eb883b2f84eafe36c8619',
  '0x017a78d942fc48dc61e5be1496750b2810810183339cbd60760dba0ae5a207f7',
  '0x011f0147f3a6a41ff0ec82f92de6829a1f31fb785f7691ae8ad096438d23b745'
];

export async function strategy(
  space: string,
  network: string,
  provider,
  addresses: string[],
  options,
  snapshot: 'latest' | number
): Promise<Record<string, number>> {
  const formattedAddresses = addresses.map(a =>
    snapshotjs.utils.getFormattedAddress(a, 'starknet')
  );
  const blockTag = typeof snapshot === 'number' ? snapshot : 'latest';

  const multi = new Multicaller(network, provider, abi, { blockTag });

  // Loop through all whitelisted contracts and addresses to gather multicall data
  for (const contractAddress of WHITELISTED_CONTRACTS) {
    for (const voterAddress of formattedAddresses) {
      multi.call(
        `${contractAddress}-${voterAddress}`,
        contractAddress,
        'get_pool_member_info_v1',
        [voterAddress]
      );
    }
  }

  const result: Record<string, any> = await multi.execute();

  // Aggregate staked balances for each address across all contracts
  const addressBalances: Record<string, BigNumberish> = {};

  for (const [callKey, response] of Object.entries(result)) {
    const [, voterAddress] = callKey.split('-');

    if (!addressBalances[voterAddress]) {
      addressBalances[voterAddress] = '0';
    }

    // Parse the response to extract the staked amount
    if (response && Array.isArray(response) && response.length > 0) {
      if (response.length >= 3 && response[2] && response[2] !== '0x0') {
        const amount = response[2]; // The staked amount is at index 2
        const currentBalance = BigInt(addressBalances[voterAddress].toString());
        const stakeAmount = BigInt(amount);
        addressBalances[voterAddress] = (
          currentBalance + stakeAmount
        ).toString();
      }
    }
  }

  // Convert to final voting power format
  return Object.fromEntries(
    Object.entries(addressBalances).map(([address, balance]) => [
      address,
      parseFloat(formatUnits(balance, 18))
    ])
  );
}
