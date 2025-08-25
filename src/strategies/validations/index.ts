import { readFileSync, readdirSync, existsSync } from 'fs';
import path from 'path';

const validationClasses: any = {};
const validationsDir = __dirname;

const dirs = readdirSync(validationsDir, { withFileTypes: true })
  .filter(dirent => dirent.isDirectory())
  .map(dirent => dirent.name);

for (const dirName of dirs) {
  try {
    const validationPath = path.join(validationsDir, dirName);
    const indexPath = path.join(validationPath, 'index');

    if (existsSync(indexPath + '.ts') || existsSync(indexPath + '.js')) {
      const module = require(`./${dirName}`);
      validationClasses[dirName] = module.default || module;
    }
  } catch (error) {
    console.warn(`Failed to load validation ${dirName}:`, error);
  }
}

const validations = {};
Object.keys(validationClasses).forEach(function (validationName) {
  let examples = null;
  let schema = null;
  let about = '';

  try {
    examples = JSON.parse(
      readFileSync(
        path.join(__dirname, validationName, 'examples.json'),
        'utf8'
      )
    );
  } catch (error) {
    examples = null;
  }

  try {
    schema = JSON.parse(
      readFileSync(path.join(__dirname, validationName, 'schema.json'), 'utf8')
    );
  } catch (error) {
    schema = null;
  }

  try {
    about = readFileSync(
      path.join(__dirname, validationName, 'README.md'),
      'utf8'
    );
  } catch (error) {
    about = '';
  }

  const validationClass = validationClasses[validationName];
  const validationInstance = new validationClass();

  validations[validationName] = {
    validation: validationClass,
    examples,
    schema,
    about,
    id: validationInstance.id,
    github: validationInstance.github,
    version: validationInstance.version,
    title: validationInstance.title,
    description: validationInstance.description,
    proposalValidationOnly: validationInstance.proposalValidationOnly,
    votingValidationOnly: validationInstance.votingValidationOnly,
    supportedProtocols: validationInstance.supportedProtocols
  };
});

export default validations;
