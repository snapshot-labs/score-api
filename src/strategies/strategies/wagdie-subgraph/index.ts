import { getAddress } from '@ethersproject/address';
import { subgraphRequest } from '../../utils';

const SUBGRAPH_URL = {
  // Default to the WAGDIE World Subgraph
  '1': 'https://gateway.thegraph.com/api/subgraphs/id/CiuchCqNbcNs88KkbQqs7PwuaD2DrPqHqxuDVKrJ5ESM'
};

export async function strategy(
  _space,
  network,
  _provider,
  addresses,
  options,
  snapshot
) {
  // initialize scores
  const scores = {};
  for (const address of addresses) {
    scores[getAddress(address)] = 0;
  }

  // If no subgraph URL is provided or known for this network, return
  if (!options?.subGraphURL && !SUBGRAPH_URL[network]) {
    return scores;
  }

  const params = {
    characters: {
      __args: {
        where: {
          owner_in: addresses.map(address => address.toLowerCase()),
          id_gt: '',
          burned: false
        },
        orderBy: 'id',
        orderDirection: 'asc',
        first: 1000
      },
      id: true,
      owner: {
        id: true
      },
      location: {
        id: true
      },
      searedConcord: {
        id: true
      }
    }
  };

  if (snapshot !== 'latest') {
    // @ts-ignore
    params.characters.__args.block = { number: snapshot };
  }

  let hasNext = true;
  while (hasNext) {
    const url = options?.subGraphURL || SUBGRAPH_URL[network];
    const requestOptions = options?.apiKey
      ? { headers: { Authorization: `Bearer ${options.apiKey}` } }
      : undefined;
    const result = await subgraphRequest(url, params, requestOptions);

    const characters = result && result.characters ? result.characters : [];
    const latest = characters[characters.length - 1];

    for (const character of characters) {
      const userAddress = getAddress(character.owner.id);
      const charId = character?.location?.id;
      let characterValue = options.scoreMultiplier;
      if (
        options.location.includes('all') ||
        options.location.includes(charId)
      ) {
        // Staked character 1 bonus point
        if (character.location?.id) {
          characterValue += 1;
        }
        // Seared character 4 bonus points
        if (character.searedConcord?.id) {
          characterValue += 4;
        }
        scores[userAddress] = (scores[userAddress] ?? 0) + characterValue;
      }
    }

    hasNext = characters.length === params.characters.__args.first;
    params.characters.__args.where.id_gt = latest ? latest.id : '';
  }

  return scores || {};
}
