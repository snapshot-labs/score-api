import { BigNumberish, BigNumber } from '@ethersproject/bignumber';
import { formatUnits, parseUnits } from '@ethersproject/units';
import { Multicaller, subgraphRequest } from '../../utils';
import { getAllReserves } from '../uniswap-v3/helper';

// signatures of the methods we need
const abi = [
  // LockerFactory
  'function getUserLocker(address user) external view returns (bool isCreated, address lockerAddress)',
  // Locker
  'function getAvailableBalance() external view returns(uint256)',
  'function getStakedBalance() external view returns(uint256)',
  'function fontaineCount() external view returns(uint16)',
  'function fontaines(uint256 unlockId) external view returns(address)',
  // Token
  'function balanceOf(address account) external view returns (uint256)'
];

// Super Tokens always have 18 decimals
const DECIMALS = 18;

// we must bound the number of fontaines per locker to avoid RPC timeouts
const MAX_FONTAINES_PER_LOCKER = 100;

const UNISWAP_V3_SUBGRAPH_URL = {
  '1': 'https://subgrapher.snapshot.org/subgraph/arbitrum/5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV',
  '8453':
    'https://subgrapher.snapshot.org/subgraph/arbitrum/43Hwfi3dJSoGpyas9VwNoDAv55yjgGrPpNSmbQZArzMG',
  '42161':
    'https://subgrapher.snapshot.org/subgraph/arbitrum/FbCGRftH4a3yZugY7TnbYgPJVEv2LvMT6oF1fxPe9aJM'
};

interface LockerState {
  availableBalance: BigNumber;
  stakedBalance: BigNumber;
  fontaineCount: number;
}

export async function strategy(
  space,
  network,
  provider,
  addresses,
  options,
  snapshot
): Promise<Record<string, number>> {
  const blockTag = typeof snapshot === 'number' ? snapshot : 'latest';

  // 1. GET LOCKER ADDRESSES
  const mCall2 = new Multicaller(network, provider, abi, { blockTag });
  // lockerFactory.getUserLocker(). Returns the deterministic address and a bool "exists".
  addresses.forEach(address =>
    mCall2.call(address, options.lockerFactoryAddress, 'getUserLocker', [
      address
    ])
  );
  const mCall2Result: Record<string, any> = await mCall2.execute();
  const lockerByAddress = Object.fromEntries(
    Object.entries(mCall2Result)
      .filter(([, { isCreated }]) => isCreated)
      .map(([addr, { lockerAddress }]) => [addr, lockerAddress])
  );
  const existingLockers = Object.values(lockerByAddress);

  // 2. GET LOCKER STATE (available balance, staked balance, fontaine count)
  const mCall3 = new Multicaller(network, provider, abi, { blockTag });
  existingLockers.forEach(lockerAddress => {
    mCall3.call(
      `available-${lockerAddress}`,
      lockerAddress,
      'getAvailableBalance',
      []
    );
    mCall3.call(
      `staked-${lockerAddress}`,
      lockerAddress,
      'getStakedBalance',
      []
    );
    mCall3.call(
      `fontaineCount-${lockerAddress}`,
      lockerAddress,
      'fontaineCount',
      []
    );
  });
  const mCall3Result: Record<string, BigNumberish> = await mCall3.execute();
  // Transform raw results into structured data
  const lockerStates: Record<string, LockerState> = {};
  existingLockers.forEach(lockerAddress => {
    lockerStates[lockerAddress] = {
      availableBalance: BigNumber.from(
        mCall3Result[`available-${lockerAddress}`] || 0
      ),
      stakedBalance: BigNumber.from(
        mCall3Result[`staked-${lockerAddress}`] || 0
      ),
      fontaineCount: Number(mCall3Result[`fontaineCount-${lockerAddress}`])
    };
  });

  // 3. GET ALL THE FONTAINES
  const mCall4 = new Multicaller(network, provider, abi, { blockTag });
  existingLockers.forEach(lockerAddress => {
    const fontaineCount = lockerStates[lockerAddress].fontaineCount;
    // iterate backwards, so we have fontaines ordered by creation time (most recent first).
    // this makes it unlikely to miss fontaines which are still active.
    for (
      let i = fontaineCount - 1;
      i >= 0 && i >= fontaineCount - MAX_FONTAINES_PER_LOCKER;
      i--
    ) {
      mCall4.call(`${lockerAddress}-${i}`, lockerAddress, 'fontaines', [i]);
    }
  });
  const fontaineAddrs: Record<string, string> = await mCall4.execute();

  // 4. GET UNLOCKED BALANCES AND FONTAINE BALANCES
  const mCall5 = new Multicaller(network, provider, abi, { blockTag });
  addresses.forEach(address =>
    mCall5.call(`unlocked-${address}`, options.tokenAddress, 'balanceOf', [
      address
    ])
  );
  existingLockers.forEach(lockerAddress => {
    for (let i = 0; i < lockerStates[lockerAddress].fontaineCount; i++) {
      const fontaineAddress = fontaineAddrs[`${lockerAddress}-${i}`];
      mCall5.call(
        `fontaine-${lockerAddress}-${i}`,
        options.tokenAddress,
        'balanceOf',
        [fontaineAddress]
      );
    }
  });
  const balanceResults: Record<string, BigNumberish> = await mCall5.execute();
  // Split results: remove prefixes to match expected key formats
  const unlockedBalances: Record<string, BigNumberish> = {};
  const fontaineBalances: Record<string, BigNumberish> = {};
  Object.entries(balanceResults).forEach(([key, value]) => {
    if (key.startsWith('unlocked-')) {
      unlockedBalances[key.replace('unlocked-', '')] = value;
    } else if (key.startsWith('fontaine-')) {
      fontaineBalances[key.replace('fontaine-', '')] = value;
    }
  });

  // 5. GET UNISWAP V3 POSITIONS FOR LOCKERS
  const uniswapV3Balances: Record<string, number> = {};
  if (options.poolAddress && existingLockers.length > 0) {
    const tokenReserve =
      options.tokenReserve === 0 ? 'token0Reserve' : 'token1Reserve';
    const _lockerAddresses = existingLockers.map(addr => addr.toLowerCase());

    const params = {
      positions: {
        __args: {
          where: {
            pool: options.poolAddress.toLowerCase(),
            owner_in: _lockerAddresses
          }
        },
        id: true,
        owner: true,
        liquidity: true,
        tickLower: { tickIdx: true },
        tickUpper: { tickIdx: true },
        pool: { tick: true, sqrtPrice: true, liquidity: true, feeTier: true },
        token0: { symbol: true, decimals: true, id: true },
        token1: { symbol: true, decimals: true, id: true }
      }
    };

    if (snapshot !== 'latest') {
      // @ts-ignore
      params.positions.__args.block = { number: snapshot };
    }

    const rawData = await subgraphRequest(
      options.subgraph || UNISWAP_V3_SUBGRAPH_URL[network],
      params
    );

    // Map positions to lockers (same structure as uniswap-v3 strategy)
    const lockerPositions: Record<string, any[]> = {};
    rawData?.positions?.forEach((position: any) => {
      const lockerAddr = position.owner.toLowerCase();
      if (!lockerPositions[lockerAddr]) {
        lockerPositions[lockerAddr] = [];
      }
      lockerPositions[lockerAddr].push(position);
    });

    // Calculate reserves for each locker
    Object.entries(lockerPositions).forEach(([lockerAddr, positions]) => {
      const reserves = getAllReserves(positions);
      const supAmount = reserves.reduce(
        (sum: number, pos: any) => sum + (pos[tokenReserve] || 0),
        0
      );

      // Find user address for this locker
      const userAddr = Object.entries(lockerByAddress).find(
        ([, addr]) => addr.toLowerCase() === lockerAddr
      )?.[0];

      if (userAddr) {
        uniswapV3Balances[userAddr] =
          (uniswapV3Balances[userAddr] || 0) + supAmount;
      }
    });
  }

  // SUM UP ALL THE BALANCES
  const balances = Object.fromEntries(
    addresses.map(address => {
      const lockerAddress: string = lockerByAddress[address];
      const unlockedBalance = BigNumber.from(unlockedBalances[address] || 0);

      // if no locker -> return unlocked balance
      if (!lockerAddress) {
        return [address, unlockedBalance];
      }

      // else add all balances in locker and related fontaines
      const availableBalance = lockerStates[lockerAddress].availableBalance;
      const stakedBalance = lockerStates[lockerAddress].stakedBalance;
      const fontaineBalanceSum = getFontaineBalancesForLocker(
        lockerAddress,
        lockerStates[lockerAddress].fontaineCount,
        fontaineBalances
      );

      const uniswapV3Balance = parseUnits(
        (uniswapV3Balances[address] || 0).toFixed(18),
        DECIMALS
      );

      const totalBalance = unlockedBalance
        .add(availableBalance)
        .add(stakedBalance)
        .add(fontaineBalanceSum)
        .add(uniswapV3Balance);

      return [address, totalBalance];
    })
  );

  // Return in the required format
  return Object.fromEntries(
    Object.entries(balances).map(([address, balance]) => [
      address,
      parseFloat(formatUnits(balance, DECIMALS))
    ])
  );
}

// helper function to sum up the fontaine balances for a given locker
function getFontaineBalancesForLocker(
  lockerAddress: string,
  fontaineCount: number,
  balances: Record<string, BigNumberish>
): BigNumber {
  return Array.from({ length: fontaineCount })
    .map((_, i) => BigNumber.from(balances[`${lockerAddress}-${i}`] || 0))
    .reduce((sum, balance) => sum.add(balance), BigNumber.from(0));
}
