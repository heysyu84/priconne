export function dayClosures(month) {
  let day = 1;
  return [...(month.dayBreaks || [])].sort((a, b) => a.afterSeq - b.afterSeq).map(boundary => {
    const closure = { ...boundary, day, shift: Number(boundary.nextDay) - day };
    day = Number(boundary.nextDay);
    return closure;
  });
}

// Remove a saved boundary, without removing or reordering any attack.
export function cancelDayClosure(month, id) {
  const closures = dayClosures(month);
  const index = closures.findIndex(b => b.id === id);
  const closure = closures[index];
  if (!closure || !(closure.shift > 0)) return null;
  const laterIds = new Set(closures.slice(index + 1).map(b => b.id));
  month.dayBreaks = month.dayBreaks.filter(b => b.id !== id).map(b => laterIds.has(b.id) ? { ...b, nextDay: Number(b.nextDay) - closure.shift } : b);
  const mergedDay = value => Number.isSafeInteger(Number(value)) && Number(value) > closure.day ? Math.max(closure.day, Number(value) - closure.shift) : value;
  for (const period of Object.values(month.membership || {})) {
    if (period.fromDay != null) period.fromDay = mergedDay(period.fromDay);
    if (period.toDay != null) period.toDay = mergedDay(period.toDay);
  }
  return closure;
}
