import { strategy as apiV2Strategy } from '../api-v2';

export async function strategy(
  space,
  network,
  provider,
  addresses,
  options,
  snapshot
) {
  return apiV2Strategy(space, network, provider, addresses, options, snapshot);
}
