import { getAddress } from '@ethersproject/address';
import { subgraphRequest, SNAPSHOT_SUBGRAPH_URL } from '../../utils';

// "snapshot.js" below refers to the @snapshot-labs/snapshot.js SDK, whose
// delegation helpers (buildSpaceIn, getDelegatesBySpace) this file mirrors so
// its output matches the canonical utils/delegation.getDelegations.

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
  // eslint-disable-next-line no-constant-condition
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
 * Each queried delegate's Snapshot delegators (delegate → delegators), read from
 * the Delegate Registry v1. Scoped via `delegate_in` to avoid paginating the
 * whole space; output matches `utils/delegation.getDelegations`.
 */
export async function getSnapshotDelegations(
  space: string,
  network: string,
  addresses: string[],
  snapshot: number | 'latest'
): Promise<Record<string, string[]>> {
  const subgraphUrl = SNAPSHOT_SUBGRAPH_URL[network];
  if (!subgraphUrl) {
    return {};
  }

  const addressesLc = addresses.map(address => address.toLowerCase());
  const spaceIn = buildSpaceIn(space);

  const rows = (
    await Promise.all(
      chunk(addressesLc, CHUNK_SIZE).map(part =>
        queryDelegations(
          subgraphUrl,
          { space_in: spaceIn, delegate_in: part },
          snapshot
        )
      )
    )
  ).flat();

  // Override + space precedence, identical to `utils/delegation.getDelegations`:
  // drop delegators that are themselves voting, and let a space-specific
  // delegation override a global ('') one.
  const delegations = rows.filter(
    delegation =>
      addressesLc.includes(delegation.delegate) &&
      !addressesLc.includes(delegation.delegator)
  );
  const delegationsReverse: Record<string, string> = {};
  delegations.forEach(
    delegation =>
      (delegationsReverse[delegation.delegator] = delegation.delegate)
  );
  delegations
    .filter(delegation => delegation.space !== '')
    .forEach(
      delegation =>
        (delegationsReverse[delegation.delegator] = delegation.delegate)
    );

  return Object.fromEntries(
    addresses.map(address => [
      address,
      Object.entries(delegationsReverse)
        .filter(([, delegate]) => address.toLowerCase() === delegate)
        .map(([delegator]) => getAddress(delegator))
    ])
  );
}

/**
 * The subset of `delegators` (lowercased) that have **any** Snapshot
 * delegation in the space — used to enforce "Snapshot wins": a Voting delegator
 * is only credited onchain if it has no Snapshot delegation. Address-scoped via
 * `delegator_in`, so it reads only these delegators' rows, not the whole space.
 */
export async function getSnapshotDelegatorSet(
  space: string,
  network: string,
  delegators: string[],
  snapshot: number | 'latest'
): Promise<Set<string>> {
  const subgraphUrl = SNAPSHOT_SUBGRAPH_URL[network];
  if (!subgraphUrl || delegators.length === 0) {
    return new Set();
  }

  const delegatorsLc = delegators.map(delegator => delegator.toLowerCase());
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

  return new Set(rows.map(delegation => delegation.delegator));
}
