import { readFileSync, readdirSync } from 'fs';
import path from 'path';
import { DEFAULT_SUPPORTED_PROTOCOLS } from '../constants';

const strategies: Record<string, any> = {};
const strategiesDir = __dirname;

// اجلب كل المجلدات داخل strategies/ (كل مجلد = استراتيجية)
const dirs = readdirSync(strategiesDir, { withFileTypes: true })
  .filter(dirent => dirent.isDirectory())
  .map(dirent => dirent.name);

// حمّل كل استراتيجية ديناميكيًا
for (const dirName of dirs) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    strategies[dirName] = require(`./${dirName}`);
  } catch {
    // تجاهل أي مجلد ما فيه index صالح
  }
}

// حمّل الميتاداتا (examples / schema / README / manifest) لكل استراتيجية
Object.keys(strategies).forEach(strategyName => {
  let examples: any = null;
  let schema: any = null;
  let about = '';
  let manifest: any = null;

  const base = path.join(strategiesDir, strategyName);

  try {
    examples = JSON.parse(
      readFileSync(path.join(base, 'examples.json'), 'utf8')
    );
  } catch {}

  try {
    schema = JSON.parse(readFileSync(path.join(base, 'schema.json'), 'utf8'));
  } catch {}

  try {
    about = readFileSync(path.join(base, 'README.md'), 'utf8');
  } catch {}

  try {
    manifest = JSON.parse(
      readFileSync(path.join(base, 'manifest.json'), 'utf8')
    );
  } catch {}

  strategies[strategyName].examples = examples;
  strategies[strategyName].schema = schema;
  strategies[strategyName].about = about;
  strategies[strategyName].supportedProtocols ||= DEFAULT_SUPPORTED_PROTOCOLS;

  if (manifest) {
    if (manifest.name) strategies[strategyName].name = manifest.name;
    if (manifest.author) strategies[strategyName].author = manifest.author;
    if (manifest.version) strategies[strategyName].version = manifest.version;
    if (manifest.overriding)
      strategies[strategyName].dependOnOtherAddress = manifest.overriding;
  }
});

export default strategies;
