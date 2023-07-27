import * as AWS from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { capture } from './sentry';

const name = 'score-api';
const cb = '2';

let client;
const bucket = process.env.AWS_BUCKET_NAME;
const region = process.env.AWS_REGION;
const endpoint = process.env.AWS_ENDPOINT || undefined;
if (region) client = new AWS.S3({ region, endpoint });

async function streamToString(stream: Readable): Promise<string> {
  return await new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
  });
}

export async function set(key, value) {
  try {
    return await client.putObject({
      Bucket: bucket,
      Key: `public/${name}/${cb}/${key}.json`,
      Body: JSON.stringify(value),
      ContentType: 'application/json; charset=utf-8'
    });
  } catch (e: any) {
    capture(e, { context: { key } });
    console.log('[aws] Store cache failed', e);
  }
}

export async function get(key) {
  try {
    const { Body } = await client.getObject({
      Bucket: bucket,
      Key: `public/${name}/${cb}/${key}.json`
    });
    // @ts-ignore
    const str = await streamToString(Body);
    return JSON.parse(str);
  } catch (e) {
    return false;
  }
}
