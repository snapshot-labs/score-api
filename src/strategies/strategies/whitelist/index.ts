import fetch from 'cross-fetch';

export const supportedProtocols = ['evm', 'starknet'];

export async function strategy(space, network, provider, addresses, options) {
  let whitelist = options?.addresses || [];

  if (options?.url) {
    const response = await fetch(options.url);
    const data = await response.json();
    whitelist = data.addresses || [];
  }

  whitelist = whitelist.map(address => address.toLowerCase());

  return Object.fromEntries(
    addresses.map(address => [
      address,
      whitelist.includes(address.toLowerCase()) ? 1 : 0
    ])
  );
}
