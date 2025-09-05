import { customFetch } from '../../utils';

export async function strategy(
  _space,
  _network,
  provider,
  addresses: string[],
  options,
  snapshot
) {
  const {
    apiBase = 'https://gbc-snapshot.gnosischain.com',
    secondsPerSlot = 5,
    genesisTime = 1638993340
  } = options;

  const blockTag = typeof snapshot === 'number' ? snapshot : 'latest';
  const block = await provider.getBlock(blockTag);
  const slot =
    block.timestamp <= genesisTime
      ? 0
      : Math.floor((block.timestamp - genesisTime) / secondsPerSlot);

  try {
    const resp = await customFetch(
      `${apiBase}/v1/vp`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slot, addresses })
      },
      200000
    );

    if (!resp.ok) throw new Error(`HTTP ${resp.status} - ${resp.statusText}`);
    const json = await resp.json();

    const results = json?.results ?? {};
    const out = Object.fromEntries(
      addresses.map(a => [a, Number(results[a] ?? 0)])
    );
    return out;
  } catch (e) {
    console.error('VP API error at slot:', slot, e);
    return Object.fromEntries(addresses.map(a => [a, 0]));
  }
}
