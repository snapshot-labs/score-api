import { getAddress } from '@ethersproject/address';
import { subgraphRequest } from '../../utils';

export const author = 'snapshot-labs';
export const version = '0.2.0';
export const dependOnOtherAddress = true;

const SUBGRAPH_URL =
  'https://api.studio.thegraph.com/query/24302/sonic-test-chaitu/v0.0.13';

export async function strategy(
  space,
  network,
  provider,
  addresses,
  options,
  snapshot
): Promise<Record<string, number>> {
  const formattedAddresses = addresses.map(getAddress);

  // Fetch deactivated validators (single request, no pagination needed)
  const deactivatedParams = {
    deactivatedValidators_collection: {
      __args: {
        first: 1000
      },
      id: true,
      validatorIds: true
    }
  };

  if (snapshot !== 'latest') {
    // @ts-ignore
    deactivatedParams.deactivatedValidators_collection.__args.block = {
      number: snapshot
    };
  }

  const deactivatedData = await subgraphRequest(
    SUBGRAPH_URL,
    deactivatedParams
  );

  // Fetch all validators with pagination
  let allValidators: any[] = [];
  let skip = 0;
  const pageSize = 1000;

  while (true) {
    const validatorParams = {
      validators: {
        __args: {
          first: pageSize,
          skip
        },
        id: true,
        address: true,
        totalDelegationReceived: true,
        status: true
      }
    };

    if (snapshot !== 'latest') {
      // @ts-ignore
      validatorParams.validators.__args.block = { number: snapshot };
    }

    const validatorData = await subgraphRequest(SUBGRAPH_URL, validatorParams);

    if (validatorData.validators && validatorData.validators.length > 0) {
      allValidators = allValidators.concat(validatorData.validators);

      if (validatorData.validators.length < pageSize) {
        break;
      }
      skip += pageSize;
    } else {
      break;
    }
  }

  // Get all deactivated validator IDs
  const deactivatedValidatorIds = new Set<string>();
  if (deactivatedData.deactivatedValidators_collection) {
    deactivatedData.deactivatedValidators_collection.forEach(item => {
      item.validatorIds.forEach(id => deactivatedValidatorIds.add(id));
    });
  }

  // Initialize scores
  const scores: Record<string, number> = {};
  formattedAddresses.forEach(address => {
    scores[address] = 0;
  });

  const validatorAddressMap: Record<string, string> = {};
  allValidators.forEach(validator => {
    validatorAddressMap[validator.id] = getAddress(validator.address);
  });

  // Process validators (assign totalDelegationReceived as voting power if not deactivated)
  allValidators.forEach(validator => {
    if (!deactivatedValidatorIds.has(validator.id)) {
      const address = getAddress(validator.address);
      if (formattedAddresses.includes(address)) {
        scores[address] = parseFloat(validator.totalDelegationReceived);
      }
    }
  });

  // Get remaining addresses that are not validators
  const validatorAddressSet = new Set(
    allValidators.map(v => getAddress(v.address))
  );
  const stakerAddresses = formattedAddresses.filter(
    addr => !validatorAddressSet.has(addr)
  );

  if (stakerAddresses.length > 0) {
    // Fetch all stakes for remaining addresses with pagination
    let allStakes: any[] = [];
    skip = 0;

    while (true) {
      const stakesParams = {
        stakes: {
          __args: {
            first: pageSize,
            skip,
            where: {
              id_in: stakerAddresses.map(addr => addr.toLowerCase())
            }
          },
          id: true,
          stakedTo: true
        }
      };

      if (snapshot !== 'latest') {
        // @ts-ignore
        stakesParams.stakes.__args.block = { number: snapshot };
      }

      const stakesData = await subgraphRequest(SUBGRAPH_URL, stakesParams);

      if (stakesData.stakes && stakesData.stakes.length > 0) {
        allStakes = allStakes.concat(stakesData.stakes);

        if (stakesData.stakes.length < pageSize) {
          break;
        }
        skip += pageSize;
      } else {
        break;
      }
    }

    // Process stakes for non-validator addresses
    allStakes.forEach(stake => {
      const address = getAddress(stake.id);
      let totalStake = 0;

      stake.stakedTo.forEach(stakeEntry => {
        const [validatorId, amount] = stakeEntry.split(':');

        // Only count if validator is not deactivated
        if (!deactivatedValidatorIds.has(validatorId)) {
          totalStake += parseFloat(amount);
        }

        if (validatorAddressMap[validatorId]) {
          const validatorAddress = validatorAddressMap[validatorId];
          scores[validatorAddress] -= parseFloat(amount);
        }
      });

      scores[address] = totalStake;
    });
  }

  return scores;
}
