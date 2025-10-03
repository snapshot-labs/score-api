import { readFileSync, readdirSync, existsSync } from 'fs';
import path from 'path';
import { DEFAULT_SUPPORTED_PROTOCOLS } from '../constants';

// Auto-import all strategies dynamically
const strategies: any = {};
const strategiesDir = __dirname;

// Get all directories in the strategies folder
const dirs = readdirSync(strategiesDir, { withFileTypes: true })
  .filter(dirent => dirent.isDirectory())
  .map(dirent => dirent.name);

// Dynamically import each strategy
for (const dirName of dirs) {
  try {
    const strategyPath = path.join(strategiesDir, dirName);
    const indexPath = path.join(strategyPath, 'index');

    // Check if index file exists (either .ts or .js after compilation)
    if (existsSync(indexPath + '.ts') || existsSync(indexPath + '.js')) {
      // Use require to dynamically load the module
      strategies[dirName] = require(`./${dirName}`);
    }
  } catch (error) {
    console.warn(`Failed to load strategy ${dirName}:`, error);
  }
}

// Load metadata for each strategy
Object.keys(strategies).forEach(function (strategyName) {
  let examples = null;
  let schema = null;
  let about = '';
  let manifest: any = null;

  try {
    examples = JSON.parse(
      readFileSync(
        path.join(strategiesDir, strategyName, 'examples.json'),
        'utf8'
      )
    );
  } catch (error) {
    examples = null;
  }

  try {
    schema = JSON.parse(
      readFileSync(
        path.join(strategiesDir, strategyName, 'schema.json'),
        'utf8'
      )
    );
  } catch (error) {
    schema = null;
  }

  try {
    about = readFileSync(
      path.join(strategiesDir, strategyName, 'README.md'),
      'utf8'
    );
  } catch (error) {
    about = '';
  }

  try {
    manifest = JSON.parse(
      readFileSync(
        path.join(strategiesDir, strategyName, 'manifest.json'),
        'utf8'
      )
    );
  } catch (error) {
    manifest = null;
  }

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
