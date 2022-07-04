import { StaticJsonRpcProvider } from '@ethersproject/providers';
import networks from '@snapshot-labs/snapshot.js/src/networks.json';

// To test a different RPC node than networks.json
// networks['100'].rpc[0] = 'https://gno.getblock.io/mainnet/?api_key=6c1d1e6e-75d9-452f-a863-a694bff93d5c';
// networks['42161'].rpc[0] = 'https://speedy-nodes-nyc.moralis.io/9e03baabdc27be2a35bdec4a/arbitrum/mainnet';

const providers = {};

// TODO: use getProvider from @snapshot-labs/snapshot.js
export default function getProvider(network: string, type = 'archive') {
  let url: any = networks[network].rpc[0];
  if (type === 'light' && networks[network].light?.length) url = networks[network].light[0];
  if (type === 'brovider') url = `https://brovider.xyz/${network}`;
  const connectionInfo = typeof url === 'object' ? { ...url, timeout: 25000 } : { url, timeout: 25000 };
  if (!providers[network] || !providers[network][type]) {
    providers[network] = { ...providers[network] };
    providers[network][type] = new StaticJsonRpcProvider(connectionInfo);
  }
  return providers[network][type];
}
