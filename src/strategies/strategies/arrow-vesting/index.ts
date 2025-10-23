import { Contract } from '@ethersproject/contracts';
import { formatUnits } from '@ethersproject/units';
import { Multicaller } from '../../utils';

const vestingFactoryAbi = [
  'function escrows_length() public view returns (uint256)',
  'function escrows(uint256 index) public view returns (address)'
];

const vestingContractAbi = [
  'function recipient() public view returns (address)',
  'function total_locked() public view returns (uint256)',
  'function start_time() public view returns (uint256)',
  'function unclaimed() public view returns (uint256)'
  // don't need to check initialized?
  // don't need to check admin?
  // don't need to check future_admin?
];

export async function strategy(
  space,
  network,
  provider,
  addresses,
  options,
  snapshot
): Promise<Record<string, number>> {
  const blockTag = typeof snapshot === 'number' ? snapshot : 'latest';

  // Get all vesting contract addresses.
  const vestingFactory = new Contract(
    options.vestingFactory,
    vestingFactoryAbi,
    provider
  );

  const vestingContractCount = await vestingFactory.escrows_length({
    blockTag: blockTag
  });

  const totalContracts = vestingContractCount.toNumber();
  const batchSize = 30; // Process contracts in batches of 20 to avoid RPC timeouts
  const maxContracts = 200; // Limit total contracts to prevent excessive processing time
  const contractsToProcess = Math.min(totalContracts, maxContracts);
  const vestingContracts: Record<number, string> = {};

  // Process vesting contracts in parallel batches
  const batchPromises = [];
  for (let startIdx = 0; startIdx < contractsToProcess; startIdx += batchSize) {
    const endIdx = Math.min(startIdx + batchSize, contractsToProcess);
    const batchPromise = (async () => {
      let batchResults;
      let retries = 3;
      while (retries > 0) {
        try {
          const vestingFactoryMulti = new Multicaller(
            network,
            provider,
            vestingFactoryAbi,
            { blockTag }
          );

          for (
            let contractIdx = startIdx;
            contractIdx < endIdx;
            contractIdx++
          ) {
            vestingFactoryMulti.call(
              contractIdx,
              options.vestingFactory,
              'escrows',
              [contractIdx]
            );
          }

          batchResults = await vestingFactoryMulti.execute();
          break; // Success, exit retry loop
        } catch (error) {
          retries--;
          if (retries === 0) {
            // Continue with next batch instead of throwing
            batchResults = {};
          } else {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      return batchResults;
    })();

    batchPromises.push(batchPromise);
  }

  // Wait for all batches to complete and merge results
  const batchResults = await Promise.all(batchPromises);
  batchResults.forEach(results => Object.assign(vestingContracts, results));

  // Get all vesting contract parameters in parallel batches
  const vestingContractAddresses = Object.values(vestingContracts);
  const vestingContractParameters: Record<string, object> = {};

  const parameterBatchPromises = [];
  for (
    let startIdx = 0;
    startIdx < vestingContractAddresses.length;
    startIdx += batchSize
  ) {
    const endIdx = Math.min(
      startIdx + batchSize,
      vestingContractAddresses.length
    );
    const batchAddresses = vestingContractAddresses.slice(startIdx, endIdx);

    const parameterBatchPromise = (async () => {
      let batchResults;
      let retries = 3;

      while (retries > 0) {
        try {
          const vestingContractMulti = new Multicaller(
            network,
            provider,
            vestingContractAbi,
            { blockTag }
          );

          batchAddresses.forEach(vestingContractAddress => {
            vestingContractMulti.call(
              `${vestingContractAddress}.recipient`,
              vestingContractAddress,
              'recipient',
              []
            );
            vestingContractMulti.call(
              `${vestingContractAddress}.total_locked`,
              vestingContractAddress,
              'total_locked',
              []
            );
            vestingContractMulti.call(
              `${vestingContractAddress}.start_time`,
              vestingContractAddress,
              'start_time',
              []
            );
            vestingContractMulti.call(
              `${vestingContractAddress}.unclaimed`,
              vestingContractAddress,
              'unclaimed',
              []
            );
          });

          batchResults = await vestingContractMulti.execute();
          break; // Success, exit retry loop
        } catch (error) {
          retries--;
          if (retries === 0) {
            console.warn(
              `Failed to fetch vesting parameters batch ${startIdx}-${endIdx} after 3 retries:`,
              error.message
            );
            // Continue with next batch instead of throwing
            batchResults = {};
          } else {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      return batchResults;
    })();

    parameterBatchPromises.push(parameterBatchPromise);
  }

  // Wait for all parameter batches to complete and merge results
  const parameterBatchResults = await Promise.all(parameterBatchPromises);
  parameterBatchResults.forEach(results =>
    Object.assign(vestingContractParameters, results)
  );

  // Sum all vesting contract balances by recipient over requested addresses.
  const block = await provider.getBlock(blockTag);
  const time = block.timestamp;
  const addressBalances: Record<string, number> = {};

  addresses.forEach(address => {
    addressBalances[address] = 0;
  });

  Object.entries(vestingContractParameters).forEach(([, params]) => {
    const recipient = params['recipient'];
    const start = params['start_time'];

    if (recipient in addressBalances && time > start) {
      const unclaimedTokens = parseFloat(
        formatUnits(params['unclaimed'], options.decimals)
      );

      // Vested arrow that can be claimed is all that is counted in this strategy
      addressBalances[recipient] += unclaimedTokens;
    }
  });

  return addressBalances;
}
