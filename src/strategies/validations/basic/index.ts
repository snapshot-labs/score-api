import { Protocol } from '../../types';
import { getProvider, getScoresDirect } from '../../utils';
import Validation from '../validation';

export default class extends Validation {
  public id = 'basic';
  public github = 'bonustrack';
  public version = '0.3.0';
  public title = 'Basic';
  public description = 'Use any strategy to determine if a user can vote.';
  public supportedProtocols: Protocol[] = ['evm', 'starknet'];
  public hasInnerStrategies = true;

  protected async doValidate(): Promise<boolean> {
    const minScore = this.params.minScore;

    if (!minScore) return true;

    if (this.params.useLatestBlock) {
      const hasBlockRange = (this.params.strategies || []).some(
        strategy => strategy.params?.start || strategy.params?.end
      );
      if (hasBlockRange) {
        throw new Error(
          'useLatestBlock cannot be combined with strategies that define start or end'
        );
      }
      this.snapshot = 'latest';
    }

    const scores = await getScoresDirect(
      this.space,
      this.params.strategies,
      this.network,
      getProvider(this.network),
      [this.author],
      this.snapshot || 'latest'
    );
    const totalScore: any = scores
      .map((score: any) => Object.values(score).reduce((a, b: any) => a + b, 0))
      .reduce((a, b: any) => a + b, 0);

    return totalScore >= minScore;
  }
}
