import snapshot from '@snapshot-labs/snapshot.js';
import { capture } from '@snapshot-labs/snapshot-sentry';

const HUB_URL = process.env.HUB_URL || 'https://hub.snapshot.org';

export let turboSpaces: Set<string> = new Set();

async function loadTurboSpaces(): Promise<boolean> {
  const query = {
    spaces: {
      __args: {
        where: {
          turbo: true
        }
      },
      id: true
    }
  };

  try {
    const response = await snapshot.utils.subgraphRequest(
      `${HUB_URL}/graphql`,
      query
    );

    turboSpaces = response.spaces.map(s => s.id);

    return true;
  } catch (e: any) {
    capture(e);
    return false;
  }
}

export default async function run(): Promise<void> {
  await loadTurboSpaces();
  await snapshot.utils.sleep(60e3);
  run();
}
