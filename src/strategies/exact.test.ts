import { readdirSync, readFileSync } from 'fs';
import path from 'path';

// A strategy exporting rawStrategy is exact: its voting power can be signed by the oracle, so it must be
// a pure function of (network, params, block, address), read from the chain only
const STRATEGIES_DIR = path.join(__dirname, 'strategies');
const EXACT_STRATEGIES = [
  'comp-like-votes',
  'contract-call',
  'erc1155-balance-of',
  'erc20-balance-of',
  'erc20-votes',
  'erc721',
  'eth-balance'
];
// Anything reaching outside the chain at the given block, or depending on time or randomness
const FORBIDDEN = [
  'fetch',
  'axios',
  'subgraphRequest',
  'customFetch',
  'ipfsGet',
  'getSnapshots',
  'getProvider',
  'getScoresDirect',
  'getDelegations',
  'getDelegatesBySpace',
  'Date.now',
  'new Date',
  'Math.random',
  'process.env'
];

const sources = readdirSync(STRATEGIES_DIR, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => ({
    name: entry.name,
    source: readFileSync(
      path.join(STRATEGIES_DIR, entry.name, 'index.ts'),
      'utf8'
    )
  }))
  .filter(({ source }) => source.includes('rawStrategy'));

describe('exact strategies', () => {
  it('are the reviewed ones', () => {
    expect(sources.map(s => s.name).sort()).toEqual(EXACT_STRATEGIES);
  });

  describe.each(sources)('$name', ({ source }) => {
    it('reads nothing outside the chain', () => {
      for (const word of FORBIDDEN) expect(source).not.toContain(word);
    });

    it('ignores the space', () => {
      const raw = source.slice(
        source.indexOf('export async function rawStrategy('),
        source.indexOf('export async function strategy(')
      );
      const [space] = raw
        .slice(raw.indexOf('(') + 1)
        .split(',')
        .map(param => param.trim());

      expect(space).toMatch(/^_/);
      expect(raw.split(space)).toHaveLength(2);
    });

    it('derives its floats from the raw values', () => {
      expect(source).toMatch(
        /export async function strategy\([\s\S]*formatRawScores\(\s*await rawStrategy\(/
      );
    });
  });
});
