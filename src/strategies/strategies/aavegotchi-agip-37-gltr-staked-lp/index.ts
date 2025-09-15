import { multicall } from '../../utils';

const tokenAbi = [
  'function balanceOf(address account) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function allUserInfo(address _user) view returns (tuple(address lpToken, uint256 allocPoint, uint256 pending, uint256 userBalance, uint256 poolBalance)[] _info)',
  'function convertToAssets(uint256 shares) view returns (uint)'
];

export async function strategy(
  _space,
  network,
  provider,
  addresses,
  options,
  snapshot
) {
  options.ghstAddress =
    options.ghstAddress || '0xcD2F22236DD9Dfe2356D7C543161D4d260FD9BcB';

  options.gltrStakingAddress =
    options.gltrStakingAddress || '0xaB449DcA14413a6ae0bcea9Ea210B57aCe280d2c';

  options.ghstFudAddress =
    options.ghstFudAddress || '0xeae2fB93e291C2eB69195851813DE24f97f1ce71';
  options.ghstFudPoolId = options.ghstFudPoolId || 1;

  options.ghstFomoAddress =
    options.ghstFomoAddress || '0x62ab7d558A011237F8a57ac0F97601A764e85b88';
  options.ghstFomoPoolId = options.ghstFomoPoolId || 2;

  options.ghstAlphaAddress =
    options.ghstAlphaAddress || '0x0Ba2A49aedf9A409DBB0272db7CDF98aEb1E1837';
  options.ghstAlphaPoolId = options.ghstAlphaPoolId || 3;

  options.ghstKekAddress =
    options.ghstKekAddress || '0x699B4eb36b95cDF62c74f6322AaA140E7958Dc9f';
  options.ghstKekPoolId = options.ghstKekPoolId || 4;
  // TODO: Update ghstUsdc
  options.ghstUsdcAddress =
    options.ghstUsdcAddress || '0x096c5ccb33cfc5732bcd1f3195c13dbefc4c82f4';
  options.ghstUsdcPoolId = options.ghstUsdcPoolId || 5;

  options.ghstWethAddress =
    options.ghstWethAddress || '0x0DFb9Cb66A18468850d6216fCc691aa20ad1e091';
  options.ghstWethPoolId = options.ghstWethPoolId || 6;

  options.ghstGltrAddress =
    options.ghstGltrAddress || '0xa83b31D701633b8EdCfba55B93dDBC202D8A4621';
  options.ghstGltrPoolId = options.ghstGltrPoolId || 7;

  const blockTag = typeof snapshot === 'number' ? snapshot : 'latest';

  const stakeQuery = addresses.map((address: string) => [
    options.gltrStakingAddress,
    'allUserInfo',
    [address]
  ]);

  let slicedStakedQueries: any = [stakeQuery];
  if (stakeQuery.length > 1) {
    const middle = stakeQuery.length / 2;
    slicedStakedQueries = [
      stakeQuery.slice(0, middle),
      stakeQuery.slice(middle, stakeQuery.length)
    ];
  }

  let res = await multicall(
    network,
    provider,
    tokenAbi,
    [
      [options.ghstFudAddress, 'totalSupply', []],
      [options.ghstAddress, 'balanceOf', [options.ghstFudAddress]],
      [options.ghstFomoAddress, 'totalSupply', []],
      [options.ghstAddress, 'balanceOf', [options.ghstFomoAddress]],
      [options.ghstAlphaAddress, 'totalSupply', []],
      [options.ghstAddress, 'balanceOf', [options.ghstAlphaAddress]],
      [options.ghstKekAddress, 'totalSupply', []],
      [options.ghstAddress, 'balanceOf', [options.ghstKekAddress]],
      [options.ghstGltrAddress, 'totalSupply', []],
      [options.ghstAddress, 'balanceOf', [options.ghstGltrAddress]],
      [options.ghstUsdcAddress, 'totalSupply', []],
      [options.ghstAddress, 'balanceOf', [options.ghstUsdcAddress]],
      [options.ghstWethAddress, 'totalSupply', []],
      [options.ghstAddress, 'balanceOf', [options.ghstWethAddress]],
      ...slicedStakedQueries[0]
    ],
    { blockTag }
  );

  if (slicedStakedQueries.length > 1) {
    const res2 = await multicall(
      network,
      provider,
      tokenAbi,
      [...slicedStakedQueries[1]],
      { blockTag }
    );

    res = [...res, ...res2];
  }

  const tokensPerUni = (balanceInUni: number, totalSupply: number) => {
    return balanceInUni / 1e18 / (totalSupply / 1e18);
  };

  const lpTokensStartIndex = 0;
  const lpTokensPerUni = {
    ghstFudLp: tokensPerUni(
      res[lpTokensStartIndex + 1],
      res[lpTokensStartIndex]
    ),
    ghstFomoLp: tokensPerUni(
      res[lpTokensStartIndex + 3],
      res[lpTokensStartIndex + 2]
    ),
    ghstAlphaLp: tokensPerUni(
      res[lpTokensStartIndex + 5],
      res[lpTokensStartIndex + 4]
    ),
    ghstKekLp: tokensPerUni(
      res[lpTokensStartIndex + 7],
      res[lpTokensStartIndex + 6]
    ),
    ghstGltrLp: tokensPerUni(
      res[lpTokensStartIndex + 9],
      res[lpTokensStartIndex + 8]
    ),
    ghstUsdcLp: tokensPerUni(
      res[lpTokensStartIndex + 11],
      res[lpTokensStartIndex + 10]
    ),
    ghstWethLp: tokensPerUni(
      res[lpTokensStartIndex + 13],
      res[lpTokensStartIndex + 12]
    )
  };

  const entries = {};
  for (let addressIndex = 0; addressIndex < addresses.length; addressIndex++) {
    const i = addressIndex + 14;
    const tokens = {
      staked: {
        ghstFudLp:
          Number(res[i]._info[options.ghstFudPoolId].userBalance.toString()) /
          1e18,
        ghstFomoLp:
          Number(res[i]._info[options.ghstFomoPoolId].userBalance.toString()) /
          1e18,
        ghstAlphaLp:
          Number(res[i]._info[options.ghstAlphaPoolId].userBalance.toString()) /
          1e18,
        ghstKekLp:
          Number(res[i]._info[options.ghstKekPoolId].userBalance.toString()) /
          1e18,
        ghstGltrLp:
          Number(res[i]._info[options.ghstGltrPoolId].userBalance.toString()) /
          1e18,
        ghstUsdcLp:
          Number(res[i]._info[options.ghstUsdcPoolId].userBalance.toString()) /
          1e18,
        ghstWethLp:
          Number(res[i]._info[options.ghstWethPoolId].userBalance.toString()) /
          1e18
      }
    };

    const votingPower = {
      staked: {
        ghstFudLp: tokens.staked.ghstFudLp * lpTokensPerUni.ghstFudLp,
        ghstFomoLp: tokens.staked.ghstFomoLp * lpTokensPerUni.ghstFomoLp,
        ghstAlphaLp: tokens.staked.ghstAlphaLp * lpTokensPerUni.ghstAlphaLp,
        ghstKekLp: tokens.staked.ghstKekLp * lpTokensPerUni.ghstKekLp,
        ghstGltrLp: tokens.staked.ghstGltrLp * lpTokensPerUni.ghstGltrLp,
        ghstUsdcLp: tokens.staked.ghstUsdcLp * lpTokensPerUni.ghstUsdcLp,
        ghstWethLp: tokens.staked.ghstWethLp * lpTokensPerUni.ghstWethLp
      }
    };

    let totalVotingPower = 0;
    for (let k = 0; k < Object.keys(votingPower.staked).length; k++) {
      const key = Object.keys(votingPower.staked)[k];
      totalVotingPower += votingPower.staked[key];
    }

    const address = addresses[addressIndex];

    // let loggedString = "TOKENS SUMMARY FOR " + address;
    // loggedString += "\nSTAKED TOKENS\n" + JSON.stringify(tokens.staked);
    // loggedString += "\nSTAKED VOTING POWER\n" + JSON.stringify(votingPower.staked);
    // loggedString += "\nTOTAL VOTING POWER\n" + totalVotingPower;
    // console.log(loggedString);

    entries[address] = totalVotingPower;
  }

  return entries;
}
