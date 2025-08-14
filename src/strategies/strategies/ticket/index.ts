export const supportedProtocols = ['evm', 'starknet'];

export async function strategy(space, network, provider, addresses, options) {
  return Object.fromEntries(
    addresses.map(address => [address, options.value || 1])
  );
}
