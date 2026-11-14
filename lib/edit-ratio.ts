/** Share of words changed between two texts (0 = identical, 1 = fully rewritten). */
export function editRatio(before: string, after: string): number {
  if (before === after) return 0;
  const a = before.split(/\s+/).filter(Boolean);
  const b = after.split(/\s+/).filter(Boolean);
  if (!a.length || !b.length) return 1;
  // Longest common subsequence over words (O(n·m), captions are short).
  const dp = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let prev = 0;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev + 1 : Math.max(dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return Math.round((1 - (2 * dp[b.length]) / (a.length + b.length)) * 1000) / 1000;
}
