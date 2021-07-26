import requireContext from 'node-require-context';
import fs from 'fs';
import path from 'path';

const strategiesPath = path.resolve(__dirname, '../node_modules/@snapshot-labs/snapshot.js/dist/strategies');
const strategiesPathSrc = path.resolve(__dirname, '../node_modules/@snapshot-labs/snapshot.js/dist/strategies');

const requireFile = requireContext(strategiesPath, true, /index\.js$/);
const requireExamplesJson = requireContext(strategiesPathSrc, true, /examples\.json$/);

export default Object.fromEntries(
  requireFile
    .keys()
    .filter(fileName => fileName !== './index.js')
    .map(fileName => {
      const key = fileName
        .replace('/index.js', '')
        .replace('\\index.js', '')
        .replace(strategiesPath, '')
        .replace('/', '')
        .replace('\\', '');
      const strategy = requireFile(fileName);
      fileName = fileName.replace('dist', 'src');
      strategy.key = key;
      try {
        strategy.about = fs.readFileSync(fileName.replace('index.js', 'README.md')).toString();
      } catch (error) {
        strategy.about = '';
      }
      try {
        strategy.examples = requireExamplesJson(fileName.replace('index.js', 'examples.json'));
      } catch (error) {
        strategy.examples = null;
      }
      return [key, strategy];
    })
);
