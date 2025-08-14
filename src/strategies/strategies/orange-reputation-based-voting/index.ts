import { customFetch } from '../../utils';

export async function strategy(
  space,
  network,
  provider,
  addresses,
  options,
  snapshot
): Promise<Record<string, number>> {
  const query = `{
    getBasedVotingStrategy(
      addrs: ${JSON.stringify(addresses)},
      space: "${space}",
      snapshot: "${snapshot}",
      network: "${network}",
      options: { address: "${options.address}", symbol: "${options.symbol}" }
    )
    { address score }
  }`;
  const data = {
    operationName: '',
    query,
    variables: {}
  };
  const rawResponse = await customFetch(
    'https://api.orangeprotocol.io/orange2c/query',
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    }
  );
  const content = await rawResponse.json();
  const list = content.data.getBasedVotingStrategy;
  return Object.fromEntries(list.map(item => [item.address, item.score]));
}
