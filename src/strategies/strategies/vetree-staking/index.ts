import { formatUnits } from '@ethersproject/units';
import { Multicaller } from '../../utils';

const abi = [
  'function undelegatedBalance(address delegator) view returns (uint256)',
  'function getDelegatorPanelists(address delegator) view returns (address[])',
  'function delegatorPanelistActiveStake(address delegator, address panelist) view returns (uint256)',
  'function delegatorRedemptionCount(address delegator) view returns (uint256)',
  'function delegatorRedemptions(address delegator, uint256 index) view returns (address panelist, uint256 amount, uint256 claimableAt)'
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

  // ── Round 1: undelegated balance, panelist list, redemption count ──
  const round1 = new Multicaller(network, provider, abi, { blockTag });
  addresses.forEach((address: string) => {
    round1.call(
      `${address}-undelegated`,
      options.address,
      'undelegatedBalance',
      [address]
    );
    round1.call(
      `${address}-panelists`,
      options.address,
      'getDelegatorPanelists',
      [address]
    );
    round1.call(
      `${address}-redemptionCount`,
      options.address,
      'delegatorRedemptionCount',
      [address]
    );
  });
  const r1: Record<string, any> = await round1.execute();

  // ── Round 2: panelist stakes + pending redemptions in one batch ──
  const round2 = new Multicaller(network, provider, abi, { blockTag });
  let hasRound2Calls = false;
  addresses.forEach((address: string) => {
    const panelists: string[] = r1[`${address}-panelists`] || [];
    panelists.forEach((panelist: string, idx: number) => {
      round2.call(
        `${address}-stake-${idx}`,
        options.address,
        'delegatorPanelistActiveStake',
        [address, panelist]
      );
      hasRound2Calls = true;
    });

    const count = Number(r1[`${address}-redemptionCount`] || 0);
    for (let i = 0; i < count; i++) {
      round2.call(
        `${address}-redemption-${i}`,
        options.address,
        'delegatorRedemptions',
        [address, i]
      );
      hasRound2Calls = true;
    }
  });
  const r2: Record<string, any> = hasRound2Calls ? await round2.execute() : {};

  // ── Aggregate totals ──
  const balances: Record<string, number> = {};
  addresses.forEach((address: string) => {
    let total = 0;

    // Bucket 1: undelegated balance
    const undelegated = r1[`${address}-undelegated`];
    if (undelegated) {
      total += parseFloat(formatUnits(undelegated, options.decimals));
    }

    // Bucket 2: active panelist stakes
    const panelists: string[] = r1[`${address}-panelists`] || [];
    panelists.forEach((_: string, idx: number) => {
      const stake = r2[`${address}-stake-${idx}`];
      if (stake) {
        total += parseFloat(formatUnits(stake, options.decimals));
      }
    });

    // Bucket 3: pending redemptions
    const count = Number(r1[`${address}-redemptionCount`] || 0);
    for (let i = 0; i < count; i++) {
      const redemption = r2[`${address}-redemption-${i}`];
      if (redemption) {
        // delegatorRedemptions returns (panelist, amount, claimableAt)
        const amount = Array.isArray(redemption)
          ? redemption[1]
          : redemption.amount;
        if (amount) {
          total += parseFloat(formatUnits(amount, options.decimals));
        }
      }
    }

    balances[address] = Math.sqrt(total);
  });

  return balances;
}
