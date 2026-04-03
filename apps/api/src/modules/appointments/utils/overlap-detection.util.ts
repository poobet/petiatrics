/**
 * Checks whether two time intervals overlap (inclusive of start, exclusive of end)
 * Overlap occurs when: startA < endB && startB < endA
 */
export function intervalsOverlap(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date,
): boolean {
  return startA < endB && startB < endA;
}

export function appointmentEnd(scheduledAt: Date, durationMinutes: number): Date {
  return new Date(scheduledAt.getTime() + durationMinutes * 60_000);
}
