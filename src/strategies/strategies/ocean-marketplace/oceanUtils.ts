export function verifyResultsLength(
  result: number,
  expectedResults: number,
  type: string
): void {
  if (result === expectedResults) {
    console.log(`>>> SUCCESS: ${type} match expected results - length`);
  } else {
    console.error(`>>> ERROR: ${type} do not match expected results - length`);
  }
}

export function verifyResults(
  result: string,
  expectedResults: string,
  type: string
): void {
  if (result === expectedResults) {
    console.log(`>>> SUCCESS: ${type} match expected results`);
  } else {
    console.error(`>>> ERROR: ${type} do not match expected results`);
  }
}
