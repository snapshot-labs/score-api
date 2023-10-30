import snapshot from '@snapshot-labs/strategies';
import disabled from './disabled.json';
import { sha256, getCurrentBlockNum } from './utils';
import { cachedVp } from './helpers/cache';

interface GetVpRequestParams {
  address: string;
  network: string;
  strategies: any[];
  snapshot: number | 'latest';
  space: string;
  delegation?: boolean;
}

interface ValidateRequestParams {
  validation: string;
  author: string;
  space: string;
  network: string;
  snapshot: number | 'latest';
  params: any;
}

type VpResult = ReturnType<typeof snapshot.utils.getVp>;

const disableCachingForSpaces = ['magicappstore.eth', 'moonbeam-foundation.eth'];

export async function getVp(params: GetVpRequestParams) {
  if (['1319'].includes(params.network) || disabled.includes(params.space))
    throw 'something wrong with the strategies';

  if (typeof params.snapshot !== 'number') params.snapshot = 'latest';

  if (params.snapshot !== 'latest') {
    const currentBlockNum = await getCurrentBlockNum(params.snapshot, params.network);
    params.snapshot = currentBlockNum < params.snapshot ? 'latest' : params.snapshot;
  }

  return await cachedVp<VpResult>(
    sha256(JSON.stringify(params)),
    async () => {
      return await snapshot.utils.getVp(
        params.address,
        params.network,
        params.strategies,
        params.snapshot,
        params.space,
        params.delegation
      );
    },
    params.snapshot !== 'latest' && !disableCachingForSpaces.includes(params.space)
  );
}

export async function validate(params: ValidateRequestParams) {
  if (!params.validation || params.validation === 'any') return true;

  if (!snapshot.validations[params.validation]) throw 'Validation not found';

  const validation = new snapshot.validations[params.validation].validation(
    params.author,
    params.space,
    params.network,
    params.snapshot,
    params.params
  );

  return validation.validate();
}
