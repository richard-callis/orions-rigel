/**
 * Pure functions for computing engagement metrics from LessonProgress timestamps.
 */

/**
 * Normalizes a Date to midnight UTC for grouping by calendar day.
 */
function getDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Computes engagement metrics from an array of completion timestamps.
 *
 * @param completedDates Array of Date objects representing lesson completion times
 * @returns Object with currentStreak, totalActiveDays, and thisWeekCompletions
 */
export function getStreaks(completedDates: Date[]) {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6); // Last 7 days inclusive

  // Group completions by calendar day (UTC)
  const uniqueDays = new Set<string>();
  let thisWeekCompletions = 0;

  for (const date of completedDates) {
    const key = getDateKey(date);
    uniqueDays.add(key);

    // Count completions in the last 7 days
    const completionDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    if (completionDate >= sevenDaysAgo && completionDate <= today) {
      thisWeekCompletions++;
    }
  }

  const totalActiveDays = uniqueDays.size;

  // Compute current streak: consecutive days from today backwards (or yesterday if no activity today)
  let currentStreak = 0;
  const streakDate = new Date(today);

  // If we have activity today, start the streak today; otherwise, it starts from yesterday
  if (!uniqueDays.has(getDateKey(today)) && uniqueDays.size > 0) {
    streakDate.setUTCDate(streakDate.getUTCDate() - 1);
  }

  // Count consecutive days backwards from streakDate
  while (uniqueDays.has(getDateKey(streakDate))) {
    currentStreak++;
    streakDate.setUTCDate(streakDate.getUTCDate() - 1);
  }

  return {
    currentStreak,
    totalActiveDays,
    thisWeekCompletions,
  };
}
