import { strategy as xdaiStakersAndHoldersStrategy } from '../xdai-stakers-and-holders';

export async function strategy(
  space,
  network,
  provider,
  addresses,
  options,
  snapshot
) {
  return xdaiStakersAndHoldersStrategy(
    space,
    network,
    provider,
    addresses,
    { ...options, userType: 'stakers' },
    snapshot
  );
}
