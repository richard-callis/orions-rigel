export function tallyOf(responses: { selectedIndex: number }[]): number[] {
  const tally: number[] = [];
  for (const r of responses) {
    tally[r.selectedIndex] = (tally[r.selectedIndex] ?? 0) + 1;
  }
  return tally;
}
