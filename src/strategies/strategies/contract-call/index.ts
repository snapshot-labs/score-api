import { formatRawScores, multicall } from '../../utils';

function getArgs(options, address: string) {
  const args: Array<string | number> = options.args || ['%{address}'];
  return args.map(arg =>
    typeof arg === 'string' ? arg.replace(/%{address}/g, address) : arg
  );
}

// Exact: the integer returned by the call, in base units
export async function rawStrategy(
  _space,
  network,
  provider,
  addresses,
  options,
  snapshot
): Promise<Record<string, bigint>> {
  const blockTag = typeof snapshot === 'number' ? snapshot : 'latest';
  const response = await multicall(
    network,
    provider,
    [options.methodABI],
    addresses.map((address: any) => [
      options.address,
      options.methodABI.name,
      getArgs(options, address)
    ]),
    { blockTag }
  );

  return Object.fromEntries(
    response.map((value, i) => [
      addresses[i],
      BigInt(
        options?.output ? value[options.output].toString() : value.toString()
      )
    ])
  );
}

export async function strategy(
  space,
  network,
  provider,
  addresses,
  options,
  snapshot
) {
  return formatRawScores(
    await rawStrategy(space, network, provider, addresses, options, snapshot),
    options.decimals
  );
}
