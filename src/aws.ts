import * as AWS from '@aws-sdk/client-s3';
import { Readable } from 'stream';

const cb = '4';

async function streamToString(stream: Readable): Promise<string> {
  return await new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    stream.on('data', chunk => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
  });
}

const client = new AWS.S3({
  region: process.env.AWS_REGION
});

export async function set(key, value) {
  try {
    return await client.putObject({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: `public/snapshot/${cb}/${key}.json`,
      Body: JSON.stringify(value),
      ContentType: 'application/json; charset=utf-8'
    });
  } catch (e) {
    console.log(e);
    throw e;
  }
}

export async function get(key) {
  try {
    const { Body } = await client.getObject({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: `public/snapshot/${cb}/${key}.json`
    });
    // @ts-ignore
    const str = await streamToString(Body);
    return JSON.parse(str);
  } catch (e) {
    return false;
  }
}
