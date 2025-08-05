import { getAddress } from '@ethersproject/address';
import { subgraphRequest } from '../../utils';

export const author = 'snapshot-labs';
export const version = '0.2.0';
export const dependOnOtherAddress = true;

const SUBGRAPH_URL =
  'https://subgrapher.snapshot.org/subgraph/arbitrum/ERTXqMeMv8DLan3CEKb177qwj2AuNUWbAmxoXn8Z1Zqd';

export async function strategy(
  space,
  network,
  provider,
  addresses,
  options,
  snapshot
): Promise<Record<string, number>> {
  const formattedAddresses = addresses.map(getAddress);

  // Initialize scores
  const scores: Record<string, number> = {};
  formattedAddresses.forEach(address => {
    scores[address] = 0;
  });

  // Fetch deactivated validators using validators query with status_not: "0"
  const deactivatedValidatorIds = new Set<string>();
  let skip = 0;
  const pageSize = 1000;

  while (true) {
    const deactivatedParams = {
      validators: {
        __args: {
          first: pageSize,
          skip,
          where: {
            status_not: '0'
          }
        },
        id: true
      }
    };

    if (snapshot !== 'latest') {
      // @ts-ignore
      deactivatedParams.validators.__args.block = { number: snapshot };
    }

    const deactivatedData = await subgraphRequest(
      SUBGRAPH_URL,
      deactivatedParams
    );

    if (deactivatedData.validators && deactivatedData.validators.length > 0) {
      deactivatedData.validators.forEach(validator => {
        deactivatedValidatorIds.add(validator.id);
      });

      if (deactivatedData.validators.length < pageSize) {
        break;
      }
      skip += pageSize;
    } else {
      break;
    }
  }

  // Fetch validators only for input addresses with address-based batching
  const validatorAddressMap: Record<string, string> = {};
  const validatorAddressSet = new Set<string>();
  const batchSize = 1000;

  for (let i = 0; i < formattedAddresses.length; i += batchSize) {
    const addressBatch = formattedAddresses
      .slice(i, i + batchSize)
      .map(addr => addr.toLowerCase());

    const validatorParams = {
      validators: {
        __args: {
          first: 1000,
          where: {
            address_in: addressBatch
          }
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
      validatorData.validators.forEach(validator => {
        const address = getAddress(validator.address);
        validatorAddressMap[validator.id] = address;
        validatorAddressSet.add(address);
        if (!deactivatedValidatorIds.has(validator.id)) {
          scores[address] = parseFloat(validator.totalDelegationReceived);
        }
      });
    }
  }

  // Filter out validator addresses to get only staker addresses
  const stakerAddresses = formattedAddresses.filter(
    address => !validatorAddressSet.has(address)
  );

  // Fetch stakes only for staker addresses (not validators) with address-based batching
  const stakesMap: Record<string, any> = {};
  const stakeBatchSize = 1000;

  for (let i = 0; i < stakerAddresses.length; i += stakeBatchSize) {
    const addressBatch = stakerAddresses
      .slice(i, i + stakeBatchSize)
      .map(addr => addr.toLowerCase());

    const stakesParams = {
      stakes: {
        __args: {
          first: 1000,
          where: {
            id_in: addressBatch
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
      stakesData.stakes.forEach(stake => {
        stakesMap[stake.id.toLowerCase()] = stake;
      });
    }
  }

  // Process stakes for all formatted addresses (both validators and stakers)
  stakerAddresses.forEach(address => {
    const stake = stakesMap[address.toLowerCase()];
    if (stake) {
      stake.stakedTo.forEach(stakeEntry => {
        const [validatorId, amount] = stakeEntry.split(':');

        // Only count if validator is not deactivated
        if (!deactivatedValidatorIds.has(validatorId)) {
          scores[address] += parseFloat(amount);
        }

        // If this stake is to a validator in our address list, subtract from validator's score
        if (validatorAddressMap[validatorId]) {
          const validatorAddress = validatorAddressMap[validatorId];
          scores[validatorAddress] -= parseFloat(amount);
        }
      });
    }
  });

  return scores;
}
