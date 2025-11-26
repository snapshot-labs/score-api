import strategies from '..';

export async function strategy(
  space,
  network,
  provider,
  addresses,
  options,
  snapshot
): Promise<Record<string, number>> {
  const weight = options.weight ?? 1;

  const result = await strategies[options.strategy.name].strategy(
    space,
    network,
    provider,
    addresses,
    options.strategy.params,
    snapshot
  );

  return Object.fromEntries(
    Object.entries(result).map(([address, value]) => [
      address,
      (value as number) * weight
    ])
  );
}
