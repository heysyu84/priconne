const amount = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;

export function dailyHistoryBars({summary, members = [], membership = {}, dayCount = 5, through = dayCount, clanView = false}) {
  const rows = Array.from({length:dayCount}, (_,index) => {
    const day = index + 1;
    const recorded = day <= through ? summary?.byDay?.[day] : null;
    const eligible = members.filter(member => {
      const period = membership[member.memberId] || {};
      return member.byDay?.[day] !== undefined ||
        (day >= Number(period.fromDay ?? 1) && day <= Number(period.toDay ?? dayCount));
    });
    const total = day <= through ? eligible.reduce((sum, member) => sum + amount(member.byDay?.[day]?.contribution), 0) : 0;
    const averageContribution = eligible.length ? total / eligible.length : 0;
    const contribution = amount(recorded?.contribution);
    // The clan-wide view shows totals; a clan total is not an individual surplus.
    const reference = clanView ? contribution : averageContribution;
    return {
      day, damage:amount(recorded?.damage), contribution, averageContribution,
      base:Math.min(contribution, reference),
      shortfall:Math.max(0, reference - contribution),
      excess:Math.max(0, contribution - reference),
    };
  });
  const maxDamage = Math.max(1, ...rows.map(row => row.damage));
  const maxContribution = Math.max(1, ...rows.map(row => row.base + row.shortfall + row.excess));
  return rows.map(row => ({...row,
    damageWidth:row.damage / maxDamage * 100,
    baseWidth:row.base / maxContribution * 100,
    shortfallWidth:row.shortfall / maxContribution * 100,
    excessWidth:row.excess / maxContribution * 100,
  }));
}
