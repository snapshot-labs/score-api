const strategies = require('../../src/strategies/strategies').default;
const { JsonRpcProvider } = require('@ethersproject/providers'); // استخدام provider متوافق مع ethers v5

const strategyName = process.argv[2];

(async () => {
  const strategyModule = strategies[strategyName];

  if (!strategyModule) {
    console.log('Available strategies:', Object.keys(strategies));
    throw new Error(`Strategy "${strategyName}" not found`);
  }

  // بعض الاستراتيجيات تكون مباشرة، وبعضها بداخل كائن فيه .strategy
  const strategy = strategyModule.strategy || strategyModule;

  const examples = require(`../../src/strategies/strategies/nato-uniswap-v3/examples.json`);

  // مزود شبكة Base
  const provider = new JsonRpcProvider('https://mainnet.base.org');

  for (const example of examples) {
    const scores = await strategy(
      'example-space',
      example.strategy.params.network,
      provider,
      example.addresses,
      example.strategy.params,
      example.snapshot
    );

    console.log(`\n--- Strategy: ${strategyName} ---`);
    console.log(JSON.stringify(scores, null, 2));
  }
})();
