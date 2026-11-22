const DAY_MS = 24 * 60 * 60 * 1000;

const addDays = (date, n) => new Date(date.getTime() + n * DAY_MS);

const addYears = (date, n) => {
  const result = new Date(date.getTime());
  result.setUTCFullYear(result.getUTCFullYear() + n);
  // 29 Feb + 1 year হলে মাস গড়িয়ে যায়, তখন আগের মাসের শেষ দিনে ফেরাও
  if (result.getUTCDate() !== date.getUTCDate()) result.setUTCDate(0);
  return result;
};

const toIso = (date) => date.toISOString().slice(0, 10);
const round2 = (n) => Math.round(n * 100) / 100;

const todayUtc = () => {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
};

// 15 বছর মেয়াদ, 1 Jan 2026 থেকে শুরু => শেষ 31 Dec 2040
const getEndDate = (effectiveFrom, validityYears) =>
  addDays(addYears(effectiveFrom, validityYears), -1);

/**
 * প্রতি `everyYears` বছরে `percent`% বাড়ে (আগের rent-এর উপর)
 */
const buildSchedule = ({
  monthlyRent,
  effectiveFrom,
  endDate,
  everyYears,
  percent,
}) => {
  if (!(everyYears > 0) || !(percent > 0)) {
    return [
      {
        period: 1,
        from: toIso(effectiveFrom),
        to: toIso(endDate),
        monthlyRent: round2(monthlyRent),
        increasePercent: 0,
      },
    ];
  }

  const periods = [];
  for (let i = 0; ; i++) {
    const from = i === 0 ? effectiveFrom : addYears(effectiveFrom, everyYears * i);
    if (from > endDate) break;

    const lastDay = addDays(addYears(effectiveFrom, everyYears * (i + 1)), -1);
    const to = lastDay > endDate ? endDate : lastDay;

    periods.push({
      period: i + 1,
      from: toIso(from),
      to: toIso(to),
      monthlyRent: round2(monthlyRent * Math.pow(1 + percent / 100, i)),
      increasePercent: i === 0 ? 0 : percent,
    });
  }
  return periods;
};

module.exports = { buildSchedule, getEndDate, todayUtc, toIso };