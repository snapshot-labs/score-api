import snapshot from '@snapshot-labs/strategies';
import { clone } from '../utils';

let validationsCache;
const hiddenValidations = ['passport-weighted'];

export default function getValidations() {
  if (validationsCache) {
    return validationsCache;
  }

  validationsCache = Object.fromEntries(
    Object.entries(clone(snapshot.validations))
      .filter(validationName => !hiddenValidations.includes(validationName[0]))
      .map(([key, validation]) => [
        key,
        // @ts-ignore
        { key, ...validation }
      ])
  );

  return validationsCache;
}
