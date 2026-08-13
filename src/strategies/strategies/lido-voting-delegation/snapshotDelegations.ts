import { SNAPSHOT_SUBGRAPH_URL, subgraphRequest } from '../../utils';

// Mirrors the snapshot.js delegation helpers (buildSpaceIn, getDelegatesBySpace),
// but resolves precedence like `utils/delegation.getDelegationsData` rather than
// `getDelegations`: the latter drops rows whose delegate is not being scored
// before applying the override, so a space-specific delegation pointing outside
// the scored set cannot win. Scores here can differ from the `delegation`
// strategy for that reason.

const PAGE_SIZE = 1000;
const CHUNK_SIZE = 500; // max addresses per `_in` filter

// Snapshot delegations are scoped to the space, its `.eth`-less alias, or
// global (''). Mirrors snapshot.js `buildSpaceIn`.
function buildSpaceIn(space: string): string[] {
  const spaces = ['', space];
  if (space.includes('.eth')) {
    spaces.push(space.replace('.eth', ''));
  }
  return spaces;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }

  return out;
}

// Paginate the `delegations` query matching `where` (timestamp pivot + dedup),
// like snapshot.js `getDelegatesBySpace`.
async function queryDelegations(
  subgraphUrl: string,
  where: Record<string, any>,
  snapshot: number | 'latest'
): Promise<any[]> {
  const byKey = new Map<string, any>();
  let pivot = 0;
  while (true) {
    const params: any = {
      delegations: {
        __args: {
          where: { ...where, timestamp_gte: pivot },
          first: PAGE_SIZE,
          skip: 0,
          orderBy: 'timestamp',
          orderDirection: 'asc'
        },
        delegator: true,
        space: true,
        delegate: true,
        timestamp: true
      }
    };
    if (snapshot !== 'latest') {
      params.delegations.__args.block = { number: snapshot };
    }

    const page: any[] =
      (await subgraphRequest(subgraphUrl, params))?.delegations || [];

    // Same guard as snapshot.js: a full page whose first and last rows share a
    // timestamp can't be paged past, so bail instead of looping forever.
    if (
      page.length === PAGE_SIZE &&
      page[0].timestamp === page[page.length - 1].timestamp
    ) {
      throw new Error('Unable to paginate Snapshot delegations');
    }

    page.forEach(delegation => {
      byKey.set(
        `${delegation.delegator}-${delegation.delegate}-${delegation.space}`,
        delegation
      );
      pivot = delegation.timestamp;
    });
    if (page.length < PAGE_SIZE) {
      break;
    }
  }
  return [...byKey.values()];
}

/**
 * Delegators (lowercased) with at least one delegation row pointing at one of
 * `addresses`, minus those voting directly. A superset of who gets credited: a
 * row here can still lose to a space-specific one pointing elsewhere, which only
 * `getSnapshotEffectiveDelegates` sees.
 */
export async function getSnapshotDelegationCandidates(
  space: string,
  network: string,
  addresses: string[],
  snapshot: number | 'latest'
): Promise<string[]> {
  const subgraphUrl = SNAPSHOT_SUBGRAPH_URL[network];
  if (!subgraphUrl || addresses.length === 0) {
    return [];
  }

  const addressesLc = new Set(addresses.map(address => address.toLowerCase()));
  const spaceIn = buildSpaceIn(space);

  const rows = (
    await Promise.all(
      chunk([...addressesLc], CHUNK_SIZE).map(part =>
        queryDelegations(
          subgraphUrl,
          { space_in: spaceIn, delegate_in: part },
          snapshot
        )
      )
    )
  ).flat();

  return [
    ...new Set(
      rows
        .map(delegation => delegation.delegator)
        .filter(delegator => !addressesLc.has(delegator))
    )
  ];
}

/**
 * Effective Snapshot delegate per delegator, both lowercased; no entry means no
 * delegation in the space. Reads every row of each delegator via `delegator_in`,
 * which is what makes the precedence below correct: a `delegate_in` scoped read
 * cannot see a competing space-specific row and would credit the wrong delegate.
 *
 * Also serves the "Snapshot wins" rule: a Voting delegator counts onchain only
 * when it has no entry here.
 */
export async function getSnapshotEffectiveDelegates(
  space: string,
  network: string,
  delegators: string[],
  snapshot: number | 'latest'
): Promise<Map<string, string>> {
  const subgraphUrl = SNAPSHOT_SUBGRAPH_URL[network];
  if (!subgraphUrl || delegators.length === 0) {
    return new Map();
  }

  const delegatorsLc = [
    ...new Set(delegators.map(delegator => delegator.toLowerCase()))
  ];
  const spaceIn = buildSpaceIn(space);

  const rows = (
    await Promise.all(
      chunk(delegatorsLc, CHUNK_SIZE).map(part =>
        queryDelegations(
          subgraphUrl,
          { space_in: spaceIn, delegator_in: part },
          snapshot
        )
      )
    )
  ).flat();

  // Space precedence, as in `utils/delegation.getDelegations`: space-specific
  // rows overwrite global ('') ones regardless of which came first.
  const delegateByDelegator = new Map<string, string>();
  rows.forEach(delegation =>
    delegateByDelegator.set(delegation.delegator, delegation.delegate)
  );
  rows
    .filter(delegation => delegation.space !== '')
    .forEach(delegation =>
      delegateByDelegator.set(delegation.delegator, delegation.delegate)
    );

  return delegateByDelegator;
}
