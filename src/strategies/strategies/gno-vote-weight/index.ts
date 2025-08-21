import { strategy as gnoStrategy } from '../gno';

export async function strategy(
  space,
  network,
  provider,
  addresses,
  options,
  snapshot
) {
  return gnoStrategy(space, network, provider, addresses, options, snapshot);
}
