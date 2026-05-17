import type { EmotionTag, PsychologyLog, Session, Trade } from "@/lib/trading-data";
import { clamp, formatCurrency, formatPercent } from "@/lib/utils";

export interface SummaryMetrics {
  totalTrades: number;
  netPnl: number;
  winRate: number;
  profitFactor: number;
  avgR: number;
  maxDrawdown: number;
  bestTrade?: Trade;
  worstTrade?: Trade;
  averageRisk: number;
  stopRespectRate: number;
  revengeLossShare: number;
  fomoWinRate: number;
}

export interface DisciplineScore {
  overall: number;
  riskManagement: number;
  stopRespect: number;
  emotionalControl: number;
  selectivity: number;
  consistency: number;
  label: string;
}

export interface Insight {
  title: string;
  detail: string;
  metric: string;
  category: "Psychology" | "Execution" | "Risk" | "Strategy" | "Timing";
  severity: "critical" | "warning" | "positive";
}

export interface EquityPoint {
  label: string;
  date: string;
  equity: number;
  pnl: number;
  discipline: number;
}

export interface SegmentStat {
  name: string;
  trades: number;
  pnl: number;
  winRate: number;
  avgR: number;
  profitFactor: number;
}

export interface EmotionStat {
  emotion: EmotionTag;
  trades: number;
  pnl: number;
  winRate: number;
  expectancy: number;
}

export interface ImportResult {
  trades: Trade[];
  source: "trade-pnl" | "broker-transactions" | "portfolio-equity" | "unknown";
  ignoredRows: number;
  message: string;
}

export interface BehaviorIndicator {
  label: string;
  value: string;
  detail: string;
  score: number;
  tone: "green" | "cyan" | "amber" | "red";
}

export interface StrategyRecommendation {
  title: string;
  detail: string;
  rule: string;
  impact: string;
  tone: "green" | "cyan" | "amber" | "red";
}

type CsvRow = Record<string, string>;
type TransactionAction = "buy" | "sell";
type Lot = {
  ticker: string;
  assetType: Trade["assetType"];
  side: Trade["side"];
  quantity: number;
  price: number;
  date: string;
  time: string;
  broker: string;
};

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

const average = (values: number[]) => (values.length ? sum(values) / values.length : 0);

const sortTrades = (trades: Trade[]) =>
  [...trades].sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));

const dayName = (date: string) =>
  new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(new Date(`${date}T12:00:00`));

export function calculateSummary(trades: Trade[]): SummaryMetrics {
  const wins = trades.filter((trade) => trade.pnl > 0);
  const losses = trades.filter((trade) => trade.pnl < 0);
  const netPnl = sum(trades.map((trade) => trade.pnl));
  const grossProfit = sum(wins.map((trade) => trade.pnl));
  const grossLoss = Math.abs(sum(losses.map((trade) => trade.pnl)));
  const revengeLosses = trades.filter((trade) => trade.isRevenge && trade.pnl < 0);
  const fomoTrades = trades.filter((trade) => trade.isFomo);

  let peak = 0;
  let running = 0;
  let maxDrawdown = 0;
  for (const trade of sortTrades(trades)) {
    running += trade.pnl;
    peak = Math.max(peak, running);
    maxDrawdown = Math.min(maxDrawdown, running - peak);
  }

  return {
    totalTrades: trades.length,
    netPnl,
    winRate: trades.length ? (wins.length / trades.length) * 100 : 0,
    profitFactor: grossLoss ? grossProfit / grossLoss : grossProfit,
    avgR: average(trades.map((trade) => trade.rMultiple)),
    maxDrawdown,
    bestTrade: [...trades].sort((a, b) => b.pnl - a.pnl)[0],
    worstTrade: [...trades].sort((a, b) => a.pnl - b.pnl)[0],
    averageRisk: average(trades.map((trade) => trade.riskPercent)),
    stopRespectRate: trades.length
      ? (trades.filter((trade) => trade.stopRespected).length / trades.length) * 100
      : 0,
    revengeLossShare: grossLoss ? (Math.abs(sum(revengeLosses.map((trade) => trade.pnl))) / grossLoss) * 100 : 0,
    fomoWinRate: fomoTrades.length
      ? (fomoTrades.filter((trade) => trade.pnl > 0).length / fomoTrades.length) * 100
      : 0
  };
}

export function calculateDisciplineScore(trades: Trade[]): DisciplineScore {
  if (!trades.length) {
    return {
      overall: 0,
      riskManagement: 0,
      stopRespect: 0,
      emotionalControl: 0,
      selectivity: 0,
      consistency: 0,
      label: "No data"
    };
  }

  const riskDeviation = average(
    trades.map((trade) => Math.abs(trade.actualRisk - trade.plannedRisk) / Math.max(trade.plannedRisk, 1))
  );
  const stopRespect = trades.length
    ? (trades.filter((trade) => trade.stopRespected).length / trades.length) * 100
    : 0;
  const revengeRate = trades.length ? (trades.filter((trade) => trade.isRevenge).length / trades.length) * 100 : 0;
  const tiltRate = trades.length
    ? (trades.filter((trade) => trade.emotionTags.includes("Tilt") || trade.emotionTags.includes("Impulsive")).length /
        trades.length) *
      100
    : 0;
  const dailyCounts = Object.values(
    trades.reduce<Record<string, number>>((days, trade) => {
      days[trade.date] = (days[trade.date] ?? 0) + 1;
      return days;
    }, {})
  );
  const overtradeRate = dailyCounts.length
    ? (dailyCounts.filter((count) => count > 4).length / dailyCounts.length) * 100
    : 0;
  const ruleScore = average(trades.map((trade) => trade.ruleAdherence));

  const riskManagement = clamp(100 - riskDeviation * 100, 0, 100);
  const emotionalControl = clamp(100 - revengeRate * 1.6 - tiltRate * 0.55, 0, 100);
  const selectivity = clamp(100 - overtradeRate * 0.9, 0, 100);
  const consistency = clamp(ruleScore, 0, 100);
  const overall = Math.round(
    riskManagement * 0.24 + stopRespect * 0.24 + emotionalControl * 0.22 + selectivity * 0.12 + consistency * 0.18
  );

  return {
    overall,
    riskManagement: Math.round(riskManagement),
    stopRespect: Math.round(stopRespect),
    emotionalControl: Math.round(emotionalControl),
    selectivity: Math.round(selectivity),
    consistency: Math.round(consistency),
    label: overall >= 85 ? "Elite control" : overall >= 72 ? "Tradable edge" : overall >= 60 ? "Fragile" : "At risk"
  };
}

export function buildEquityCurve(trades: Trade[]): EquityPoint[] {
  let running = 0;

  const grouped = sortTrades(trades).reduce<Record<string, Trade[]>>((days, trade) => {
    days[trade.date] = [...(days[trade.date] ?? []), trade];
    return days;
  }, {});

  return Object.entries(grouped).map(([date, dailyTrades]) => {
    const pnl = sum(dailyTrades.map((trade) => trade.pnl));
    running += pnl;

    return {
      label: `${dayName(date)} ${date.slice(5).replace("-", "/")}`,
      date,
      equity: running,
      pnl,
      discipline: calculateDisciplineScore(dailyTrades).overall
    };
  });
}

export function groupByStrategy(trades: Trade[]): SegmentStat[] {
  const grouped = trades.reduce<Record<string, Trade[]>>((groups, trade) => {
    const key = trade.setup === "ORB" ? "Opening Range Breakout" : trade.setup;
    groups[key] = [...(groups[key] ?? []), trade];
    return groups;
  }, {});

  return Object.entries(grouped)
    .map(([name, group]) => toSegmentStat(name, group))
    .sort((a, b) => b.pnl - a.pnl);
}

export function groupBySession(trades: Trade[]): SegmentStat[] {
  const order: Session[] = ["Open", "Midday", "Power Hour"];
  const grouped = trades.reduce<Record<string, Trade[]>>((groups, trade) => {
    groups[trade.session] = [...(groups[trade.session] ?? []), trade];
    return groups;
  }, {});

  return order.map((session) => toSegmentStat(session, grouped[session] ?? []));
}

export function groupByMarketRegime(trades: Trade[]): SegmentStat[] {
  const grouped = trades.reduce<Record<string, Trade[]>>((groups, trade) => {
    groups[trade.marketRegime] = [...(groups[trade.marketRegime] ?? []), trade];
    return groups;
  }, {});

  return Object.entries(grouped)
    .map(([name, group]) => toSegmentStat(name, group))
    .sort((a, b) => b.pnl - a.pnl);
}

export function calculateEmotionStats(trades: Trade[]): EmotionStat[] {
  const grouped = trades.reduce<Record<string, Trade[]>>((groups, trade) => {
    for (const emotion of trade.emotionTags) {
      groups[emotion] = [...(groups[emotion] ?? []), trade];
    }

    return groups;
  }, {});

  return Object.entries(grouped)
    .map(([emotion, group]) => ({
      emotion: emotion as EmotionTag,
      trades: group.length,
      pnl: sum(group.map((trade) => trade.pnl)),
      winRate: group.length ? (group.filter((trade) => trade.pnl > 0).length / group.length) * 100 : 0,
      expectancy: average(group.map((trade) => trade.rMultiple))
    }))
    .sort((a, b) => a.pnl - b.pnl);
}

export function calculatePsychologyMatrix(trades: Trade[]) {
  const buckets = [
    { name: "Low stress", min: 0, max: 4 },
    { name: "Medium stress", min: 5, max: 7 },
    { name: "High stress", min: 8, max: 10 }
  ];

  return buckets.map((bucket) => {
    const bucketTrades = trades.filter((trade) => trade.stress >= bucket.min && trade.stress <= bucket.max);
    return {
      name: bucket.name,
      pnl: sum(bucketTrades.map((trade) => trade.pnl)),
      winRate: bucketTrades.length
        ? (bucketTrades.filter((trade) => trade.pnl > 0).length / bucketTrades.length) * 100
        : 0,
      trades: bucketTrades.length
    };
  });
}

export function buildBehaviorIndicators(trades: Trade[]): BehaviorIndicator[] {
  if (!trades.length) {
    return [
      {
        label: "No behavior sample",
        value: "0 trades",
        detail: "Change the dataset scope or time range to calculate behavior indicators.",
        score: 0,
        tone: "cyan"
      }
    ];
  }

  const sorted = sortTrades(trades);
  const losses = trades.filter((trade) => trade.pnl < 0);
  const winners = trades.filter((trade) => trade.pnl > 0);
  const futures = trades.filter((trade) => trade.assetType === "Futures");
  const afterLossTrades = sorted.filter((_, index) => sorted[index - 1]?.pnl < 0);
  const afterLossPnl = sum(afterLossTrades.map((trade) => trade.pnl));
  const dailyCounts = Object.values(
    trades.reduce<Record<string, number>>((days, trade) => {
      days[trade.date] = (days[trade.date] ?? 0) + 1;
      return days;
    }, {})
  );
  const oversized = trades.filter((trade) => trade.riskPercent > 3);
  const highStress = trades.filter((trade) => trade.stress >= 8);
  const lowFocus = trades.filter((trade) => trade.focus <= 4);
  const avgWinnerHold = average(winners.map((trade) => trade.durationMinutes));
  const avgLoserHold = average(losses.map((trade) => trade.durationMinutes));
  const futuresPnl = sum(futures.map((trade) => trade.pnl));
  const maxTrades = dailyCounts.length ? Math.max(...dailyCounts) : 0;

  return [
    {
      label: "Loss-chasing",
      value: formatCurrency(afterLossPnl),
      detail: `${afterLossTrades.length} trades taken immediately after a loss`,
      score: clamp(100 - afterLossTrades.length * 5 - Math.max(0, -afterLossPnl) / 25, 0, 100),
      tone: afterLossPnl < 0 ? "red" : "amber"
    },
    {
      label: "Overtrading pressure",
      value: `${maxTrades}/day`,
      detail: `${dailyCounts.filter((count) => count > 4).length} days exceeded the 4-trade review threshold`,
      score: clamp(100 - Math.max(0, maxTrades - 3) * 14, 0, 100),
      tone: maxTrades > 5 ? "red" : maxTrades > 3 ? "amber" : "green"
    },
    {
      label: "Oversized risk",
      value: `${oversized.length}`,
      detail: `${formatPercent(trades.length ? (oversized.length / trades.length) * 100 : 0)} of trades risked more than 3%`,
      score: clamp(100 - oversized.length * 8, 0, 100),
      tone: oversized.length ? "amber" : "green"
    },
    {
      label: "High-stress trading",
      value: `${highStress.length}`,
      detail: `${formatCurrency(sum(highStress.map((trade) => trade.pnl)))} while stress was 8 or higher`,
      score: clamp(100 - highStress.length * 9, 0, 100),
      tone: highStress.length ? "red" : "green"
    },
    {
      label: "Low-focus entries",
      value: `${lowFocus.length}`,
      detail: `${formatCurrency(sum(lowFocus.map((trade) => trade.pnl)))} while focus was 4 or lower`,
      score: clamp(100 - lowFocus.length * 9, 0, 100),
      tone: lowFocus.length ? "red" : "green"
    },
    {
      label: "Loser hold time",
      value: `${(avgLoserHold / Math.max(avgWinnerHold, 1)).toFixed(1)}x`,
      detail: `Average loser hold ${avgLoserHold.toFixed(0)}m versus ${avgWinnerHold.toFixed(0)}m for winners`,
      score: clamp(100 - Math.max(0, avgLoserHold / Math.max(avgWinnerHold, 1) - 1) * 35, 0, 100),
      tone: avgLoserHold > avgWinnerHold * 1.7 ? "red" : "amber"
    },
    {
      label: "Futures drag",
      value: formatCurrency(futuresPnl),
      detail: `${futures.length} futures settlement rows included from the broker CSV`,
      score: futures.length ? clamp(65 + futuresPnl / 35, 0, 100) : 100,
      tone: futuresPnl < 0 ? "red" : futures.length ? "green" : "cyan"
    }
  ];
}

export function buildStrategyRecommendations(trades: Trade[]): StrategyRecommendation[] {
  if (!trades.length) {
    return [
      {
        title: "No trades in selected view",
        detail: "This dataset and time-range combination has no closed trades to diagnose yet.",
        rule: "Switch to All, expand the time range, or import more closed trades before changing the playbook.",
        impact: "Keeps strategy recommendations tied to actual trade evidence.",
        tone: "cyan"
      }
    ];
  }

  const sessions = groupBySession(trades);
  const strategies = groupByStrategy(trades);
  const summary = calculateSummary(trades);
  const futures = trades.filter((trade) => trade.assetType === "Futures");
  const futuresPnl = sum(futures.map((trade) => trade.pnl));
  const losses = trades.filter((trade) => trade.pnl < 0);
  const avgLoss = Math.abs(average(losses.map((trade) => trade.pnl)));
  const worstSession = [...sessions].sort((a, b) => a.pnl - b.pnl)[0];
  const bestStrategy = strategies[0];
  const worstStrategy = [...strategies].sort((a, b) => a.pnl - b.pnl)[0];

  return [
    {
      title: "Install a hard daily loss circuit breaker",
      detail: `Your max drawdown in the selected range is ${formatCurrency(summary.maxDrawdown)}. Cap the day before one poor sequence becomes a behavior loop.`,
      rule: `Stop for the day at ${formatCurrency(-Math.max(avgLoss * 1.5, 150))} realized PnL or after two closed losses.`,
      impact: "Limits revenge trades and prevents drawdown acceleration.",
      tone: "red"
    },
    {
      title: "Separate futures from equity and options review",
      detail:
        futures.length && futuresPnl < 0
          ? `Futures settlement rows are net ${formatCurrency(futuresPnl)}, so they need their own rules instead of being blended into stock/option results.`
          : "Futures rows are tracked separately so you can judge whether they are helping or dragging the account.",
      rule: "Use a futures-only daily max loss, max contracts, and no re-entry window after a red settlement.",
      impact: "Makes futures risk visible and easier to control.",
      tone: futuresPnl < 0 ? "red" : "cyan"
    },
    {
      title: `Protect the strongest setup: ${bestStrategy?.name ?? "N/A"}`,
      detail: `${bestStrategy?.name ?? "Your best setup"} is the highest-performing bucket in this window. Keep it clean instead of mixing it with low-quality attempts.`,
      rule: "Only scale up after one full week where this setup stays profitable with no stop violations.",
      impact: "Improves edge quality without increasing random trade volume.",
      tone: "green"
    },
    {
      title: `Quarantine the weakest bucket: ${worstStrategy?.name ?? "N/A"}`,
      detail: `${worstStrategy?.name ?? "The weakest bucket"} is net ${formatCurrency(worstStrategy?.pnl ?? 0)} in the selected range.`,
      rule: "Cut size by 50% or paper-trade this bucket until it shows 20 clean samples with positive expectancy.",
      impact: "Reduces repeated losses while preserving learning data.",
      tone: "amber"
    },
    {
      title: `${worstSession?.name ?? "Midday"} needs tighter filters`,
      detail: `${worstSession?.name ?? "The weakest session"} is net ${formatCurrency(worstSession?.pnl ?? 0)} across ${worstSession?.trades ?? 0} trades.`,
      rule: "Require trend, volume, and setup confirmation during weak windows; otherwise no trade.",
      impact: "Reduces forced entries when conditions are lower quality.",
      tone: (worstSession?.pnl ?? 0) < 0 ? "red" : "amber"
    }
  ];
}

export function detectInsights(trades: Trade[]): Insight[] {
  if (!trades.length) {
    return [
      {
        title: "No trades in selected view",
        detail: "Change the dataset scope or time range to generate behavioral and performance insights.",
        metric: "0 trades",
        category: "Execution",
        severity: "warning"
      }
    ];
  }

  const summary = calculateSummary(trades);
  const sessions = groupBySession(trades);
  const strategies = groupByStrategy(trades);
  const emotionStats = calculateEmotionStats(trades);
  const sorted = sortTrades(trades);
  const afterTwoLosses = sorted.filter((_, index) => sorted[index - 1]?.pnl < 0 && sorted[index - 2]?.pnl < 0);
  const noonTrades = trades.filter((trade) => Number(trade.time.split(":")[0]) >= 12);
  const lowRiskTrades = trades.filter((trade) => trade.riskPercent <= 3);
  const fridayTrades = trades.filter((trade) => dayName(trade.date) === "Fri");
  const winners = trades.filter((trade) => trade.pnl > 0);
  const losers = trades.filter((trade) => trade.pnl < 0);
  const avgWinnerHold = average(winners.map((trade) => trade.durationMinutes));
  const avgLoserHold = average(losers.map((trade) => trade.durationMinutes));
  const bestStrategy = strategies[0];
  const worstEmotion = emotionStats[0];
  const openSession = sessions.find((session) => session.name === "Open");
  const middaySession = sessions.find((session) => session.name === "Midday");

  const insights: Insight[] = [
    {
      title: "Revenge trades are absorbing loss capacity",
      detail: `Revenge-labeled trades represent ${formatPercent(summary.revengeLossShare)} of realized losses while making up a much smaller share of total volume.`,
      metric: `${formatPercent(summary.revengeLossShare)} loss share`,
      category: "Psychology",
      severity: summary.revengeLossShare > 30 ? "critical" : "warning"
    },
    {
      title: "Post-loss sequences need a hard stop rule",
      detail: afterTwoLosses.length
        ? `Trades after two consecutive losses produced ${formatCurrency(sum(afterTwoLosses.map((trade) => trade.pnl)))} across ${afterTwoLosses.length} entries.`
        : "No trades were taken after two consecutive losses in this sample.",
      metric: `${afterTwoLosses.length} triggered`,
      category: "Execution",
      severity: afterTwoLosses.length ? "critical" : "positive"
    },
    {
      title: "Risk under 3 percent is your cleanest operating zone",
      detail: `Trades at or below 3 percent risk produced ${formatCurrency(sum(lowRiskTrades.map((trade) => trade.pnl)))} with ${formatPercent(
        lowRiskTrades.length
          ? (lowRiskTrades.filter((trade) => trade.pnl > 0).length / lowRiskTrades.length) * 100
          : 0
      )} win rate.`,
      metric: "<= 3% risk",
      category: "Risk",
      severity: "positive"
    },
    {
      title: "Midday execution is the largest timing leak",
      detail: `Midday trades are at ${formatCurrency(middaySession?.pnl ?? 0)} compared with ${formatCurrency(openSession?.pnl ?? 0)} during the open.`,
      metric: `${formatCurrency(middaySession?.pnl ?? 0)}`,
      category: "Timing",
      severity: (middaySession?.pnl ?? 0) < 0 ? "critical" : "warning"
    },
    {
      title: `${bestStrategy.name} is the current edge`,
      detail: `${bestStrategy.name} has generated ${formatCurrency(bestStrategy.pnl)} with ${bestStrategy.avgR.toFixed(2)} average R.`,
      metric: `${bestStrategy.avgR.toFixed(2)}R avg`,
      category: "Strategy",
      severity: "positive"
    },
    {
      title: `${worstEmotion.emotion} is statistically expensive`,
      detail: `Trades tagged ${worstEmotion.emotion} are net ${formatCurrency(worstEmotion.pnl)} with ${formatPercent(worstEmotion.winRate)} win rate.`,
      metric: formatCurrency(worstEmotion.pnl),
      category: "Psychology",
      severity: worstEmotion.pnl < 0 ? "critical" : "warning"
    },
    {
      title: "Friday needs a stricter noon cutoff",
      detail: `Friday trades are net ${formatCurrency(sum(fridayTrades.map((trade) => trade.pnl)))} and the damage clusters after the morning plan is finished.`,
      metric: `${fridayTrades.length} trades`,
      category: "Timing",
      severity: "warning"
    },
    {
      title: "Losers are being held materially longer",
      detail: `Average loser hold is ${avgLoserHold.toFixed(0)} minutes versus ${avgWinnerHold.toFixed(0)} minutes for winners.`,
      metric: `${(avgLoserHold / Math.max(avgWinnerHold, 1)).toFixed(1)}x longer`,
      category: "Execution",
      severity: avgLoserHold > avgWinnerHold * 1.7 ? "critical" : "warning"
    },
    {
      title: "After noon, selectivity drops sharply",
      detail: `Trades after noon have a ${formatPercent(
        noonTrades.length ? (noonTrades.filter((trade) => trade.pnl > 0).length / noonTrades.length) * 100 : 0
      )} win rate and lower rule adherence than morning trades.`,
      metric: `${noonTrades.length} trades`,
      category: "Timing",
      severity: "warning"
    }
  ];

  return insights.sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity));
}

export function buildBurnoutSignal(trades: Trade[], logs: PsychologyLog[]) {
  if (!trades.length) {
    return {
      score: 0,
      label: "No trade sample",
      detail: "There are no trades in the selected view, so fatigue detection is paused for this slice."
    };
  }

  const recentTrades = sortTrades(trades).slice(-8);
  const stress = average(recentTrades.map((trade) => trade.stress));
  const focus = average(recentTrades.map((trade) => trade.focus));
  const violations = recentTrades.filter((trade) => trade.ruleAdherence < 55 || trade.isRevenge || trade.isFomo).length;
  const recentLog = logs[logs.length - 1];
  const score = clamp(Math.round(stress * 8 + violations * 6 - focus * 4 + (recentLog?.distractions ?? 0) * 2), 0, 100);

  return {
    score,
    label: score >= 70 ? "Elevated fatigue" : score >= 45 ? "Watch zone" : "Stable",
    detail:
      score >= 70
        ? "Recent behavior resembles prior deterioration periods: high stress, lower focus, and repeated rule breaks."
        : score >= 45
          ? "The profile is workable, but risk should stay capped until focus improves."
          : "Recent execution is controlled enough to keep normal playbook conditions active."
  };
}

export function buildCoachResponse(question: string, trades: Trade[], logs: PsychologyLog[]) {
  if (!trades.length) {
    return "I do not have any trades in the current dataset and time range. Switch to All, expand the time range, or import more closed trades and I can diagnose the behavior in that slice.";
  }

  const normalized = question.toLowerCase();
  const summary = calculateSummary(trades);
  const discipline = calculateDisciplineScore(trades);
  const insights = detectInsights(trades);
  const strategies = groupByStrategy(trades);
  const emotions = calculateEmotionStats(trades);
  const burnout = buildBurnoutSignal(trades, logs);
  const worstEmotion = emotions[0];
  const bestStrategy = strategies[0];

  if (normalized.includes("losing") || normalized.includes("lately")) {
    return `Your recent losses are less about setup quality and more about sequence control. The largest leak is ${insights[0].title.toLowerCase()}. Net PnL is still ${formatCurrency(
      summary.netPnl
    )}, but your drawdown expanded when actual risk exceeded planned risk and trades moved into the midday session.`;
  }

  if (normalized.includes("weakness") || normalized.includes("mistake")) {
    return `Your biggest weakness is emotional continuation after a bad outcome. Discipline is ${discipline.overall}/100, but emotional control is ${discipline.emotionalControl}/100. I would install a two-loss lockout and require position size under 3 percent until the next session.`;
  }

  if (normalized.includes("setup") || normalized.includes("strategy")) {
    return `${bestStrategy.name} is your best current edge: ${formatCurrency(bestStrategy.pnl)}, ${bestStrategy.avgR.toFixed(
      2
    )} average R, and ${formatPercent(bestStrategy.winRate)} win rate. Avoid forcing mean reversion in trend regimes because that bucket is not paying you right now.`;
  }

  if (normalized.includes("stop") || normalized.includes("when")) {
    return `Stop trading after two consecutive losses, after 12:00 PM on Fridays, or when stress is 8 or higher. Your data shows those conditions overlap with oversizing, weaker stop respect, and lower rule adherence.`;
  }

  if (normalized.includes("psychology") || normalized.includes("emotion")) {
    return `${worstEmotion.emotion} is the most expensive emotional tag: ${formatCurrency(worstEmotion.pnl)} net with ${formatPercent(
      worstEmotion.winRate
    )} win rate. Your best results come from medium confidence plus high focus, not maximum confidence.`;
  }

  if (normalized.includes("burnout") || normalized.includes("fatigue")) {
    return `Burnout signal is ${burnout.score}/100: ${burnout.label}. ${burnout.detail} Keep risk capped and reduce optional trades until focus moves back above 7.`;
  }

  return `The current read: ${summary.totalTrades} trades, ${formatCurrency(summary.netPnl)} net PnL, ${formatPercent(
    summary.winRate
  )} win rate, and a ${discipline.overall}/100 discipline score. The next improvement with the highest payoff is cutting revenge and FOMO trades after midday.`;
}

export function parseImportedTrades(rows: CsvRow[]): ImportResult {
  const usableRows = rows.filter((row) => Object.values(row).some((value) => String(value ?? "").trim()));
  const equityTrades = buildPortfolioEquityTrades(usableRows);

  if (equityTrades.length) {
    return {
      trades: equityTrades,
      source: "portfolio-equity",
      ignoredRows: usableRows.length - equityTrades.length - 1,
      message: `Imported ${equityTrades.length} account-value deltas from portfolio history.`
    };
  }

  const explicitPnlRows = usableRows.filter((row) => getField(row, pnlAliases) !== undefined);
  if (explicitPnlRows.length) {
    const trades = explicitPnlRows
      .map((row, index) => toImportedTrade(row, index))
      .filter((trade) => Number.isFinite(trade.pnl));

    return {
      trades,
      source: "trade-pnl",
      ignoredRows: usableRows.length - trades.length,
      message: `Imported ${trades.length} rows with explicit realized PnL.`
    };
  }

  const futuresSettlementTrades = buildFuturesSettlementTrades(usableRows);
  const transactionTrades = buildTransactionTrades(usableRows);
  const brokerTrades = [...transactionTrades, ...futuresSettlementTrades].sort((a, b) =>
    `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)
  );

  if (brokerTrades.length) {
    return {
      trades: brokerTrades,
      source: "broker-transactions",
      ignoredRows: Math.max(0, usableRows.length - transactionTrades.length - futuresSettlementTrades.length),
      message: `Computed ${transactionTrades.length} realized buy/sell trades and ${futuresSettlementTrades.length} futures settlement rows.`
    };
  }

  return {
    trades: [],
    source: "unknown",
    ignoredRows: usableRows.length,
    message:
      "No realized PnL, account value, or matched buy/sell transaction columns were found. Check the CSV headers."
  };
}

export function toImportedTrade(row: CsvRow, index: number): Trade {
  const pnl = parseCsvNumber(getField(row, pnlAliases)) ?? 0;
  const riskPercent = parseCsvNumber(getField(row, ["risk", "risk percent", "risk %", "riskPercent"])) ?? 2.5;
  const setup = getField(row, ["setup", "strategy", "strategy tag", "playbook"]) || "Imported Setup";
  const emotion = normalizeEmotion(getField(row, ["emotion", "emotion tags", "emotion_tags", "tag"]));
  const entryPrice = parseCsvNumber(getField(row, ["entry", "entry price", "entryPrice", "avg entry"])) ?? 0;
  const exitPrice = parseCsvNumber(getField(row, ["exit", "exit price", "exitPrice", "avg exit"])) ?? 0;
  const positionSize = parseCsvNumber(getField(row, ["size", "quantity", "qty", "position size", "positionSize"])) ?? 1;
  const actualRisk = parseCsvNumber(getField(row, ["actual risk", "actualRisk", "loss risk"])) ?? Math.max(Math.abs(pnl), 1);
  const plannedRisk = parseCsvNumber(getField(row, ["planned risk", "plannedRisk", "risk amount"])) ?? Math.max(actualRisk * 0.8, 1);
  const date = normalizeDate(
    getField(row, ["date", "trade date", "trade_date", "activity date", "process date", "executed at"])
  );
  const time = normalizeTime(getField(row, ["time", "trade time", "executed at", "created at"]));

  return {
    id: `IMP-${Date.now()}-${index}`,
    ticker: (getField(row, ["ticker", "symbol", "instrument", "underlying"]) || "SPY").toUpperCase(),
    assetType: normalizeAsset(getField(row, ["assetType", "asset type", "asset", "instrument type"]) || "Equity"),
    side: (getField(row, ["side", "direction"]) || "").toLowerCase() === "short" ? "Short" : "Long",
    setup,
    entryPrice,
    exitPrice,
    positionSize,
    pnl,
    riskPercent,
    plannedRisk,
    actualRisk,
    rMultiple:
      parseCsvNumber(getField(row, ["rMultiple", "r multiple", "r", "r-multiple"])) ??
      Number((pnl / Math.max(actualRisk, 1)).toFixed(2)),
    durationMinutes: parseCsvNumber(getField(row, ["duration", "duration minutes", "durationMinutes", "hold time"])) ?? 45,
    date,
    time,
    session: normalizeSession(getField(row, ["session"]) || time),
    marketRegime: "Chop",
    volumeRegime: "Normal",
    emotionTags: [emotion],
    notes: getField(row, ["notes", "note", "journal", "description"]) || "Imported trade awaiting AI review.",
    ruleAdherence:
      parseCsvNumber(getField(row, ["rule adherence", "ruleAdherence", "discipline"])) ?? (pnl >= 0 ? 82 : 48),
    stopRespected: normalizeBoolean(getField(row, ["stop respected", "stopRespected", "stop_respected"])) ?? pnl >= 0,
    confidence: parseCsvNumber(getField(row, ["confidence"])) ?? 6,
    stress: parseCsvNumber(getField(row, ["stress"])) ?? (pnl >= 0 ? 4 : 7),
    sleep: parseCsvNumber(getField(row, ["sleep"])) ?? 7,
    focus: parseCsvNumber(getField(row, ["focus"])) ?? (pnl >= 0 ? 7 : 5),
    broker: getField(row, ["broker", "source"]) || "CSV Import",
    isRevenge: normalizeBoolean(getField(row, ["revenge", "isRevenge", "is revenge"])) || emotion === "Revenge",
    isFomo: normalizeBoolean(getField(row, ["fomo", "isFomo", "is fomo"])) || emotion === "FOMO"
  };
}

function toSegmentStat(name: string, trades: Trade[]): SegmentStat {
  const wins = trades.filter((trade) => trade.pnl > 0);
  const grossProfit = sum(wins.map((trade) => trade.pnl));
  const grossLoss = Math.abs(sum(trades.filter((trade) => trade.pnl < 0).map((trade) => trade.pnl)));

  return {
    name,
    trades: trades.length,
    pnl: sum(trades.map((trade) => trade.pnl)),
    winRate: trades.length ? (wins.length / trades.length) * 100 : 0,
    avgR: average(trades.map((trade) => trade.rMultiple)),
    profitFactor: grossLoss ? grossProfit / grossLoss : grossProfit
  };
}

function severityWeight(severity: Insight["severity"]) {
  if (severity === "critical") return 3;
  if (severity === "warning") return 2;
  return 1;
}

const pnlAliases = [
  "pnl",
  "p/l",
  "p&l",
  "pl",
  "profit",
  "profit loss",
  "profit/loss",
  "gain loss",
  "gain/loss",
  "realized pnl",
  "realized p/l",
  "realized p&l",
  "realized gain loss",
  "realized gain/loss",
  "net pnl",
  "net p/l",
  "net profit",
  "total pnl"
];

function buildPortfolioEquityTrades(rows: CsvRow[]): Trade[] {
  const equityAliases = [
    "portfolio value",
    "portfolio_value",
    "account value",
    "account_value",
    "account balance",
    "equity",
    "net liquidation",
    "net liquidation value",
    "total value"
  ];
  const valueRows = rows
    .map((row) => ({
      row,
      date: normalizeDate(getField(row, ["date", "activity date", "as of date", "timestamp", "time"])),
      value: parseCsvNumber(getField(row, equityAliases)),
      cashFlow:
        parseCsvNumber(
          getField(row, ["cash flow", "cashflow", "net contribution", "deposit withdrawal", "deposit/withdrawal"])
        ) ?? 0
    }))
    .filter((item) => item.value !== undefined)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (valueRows.length < 2) return [];

  return valueRows.slice(1).map((item, index) => {
    const previous = valueRows[index];
    const pnl = Number(((item.value ?? 0) - (previous.value ?? 0) - item.cashFlow).toFixed(2));
    const actualRisk = Math.max(Math.abs(pnl), Math.abs(previous.value ?? 0) * 0.01, 1);

    return createImportedTrade({
      id: `EQ-${index + 1}`,
      ticker: "ACCT",
      assetType: "Equity",
      side: pnl >= 0 ? "Long" : "Short",
      setup: "Account Equity Delta",
      entryPrice: previous.value ?? 0,
      exitPrice: item.value ?? 0,
      positionSize: 1,
      pnl,
      plannedRisk: actualRisk,
      actualRisk,
      riskPercent: Math.min(100, (actualRisk / Math.max(Math.abs(previous.value ?? 0), 1)) * 100),
      rMultiple: pnl / Math.max(actualRisk, 1),
      durationMinutes: 390,
      date: item.date,
      time: "16:00",
      broker: getField(item.row, ["broker", "source"]) || "Portfolio CSV",
      notes: "Derived from account value change. Cash-flow adjustment is applied when the CSV includes a cash-flow column."
    });
  });
}

function buildFuturesSettlementTrades(rows: CsvRow[]): Trade[] {
  return rows
    .filter((row) => {
      const code = getField(row, ["trans code", "transaction code", "activity type", "type"])?.toUpperCase();
      const description = getField(row, ["description", "details", "notes"])?.toLowerCase() ?? "";
      return code === "FUTSWP" || description.includes("futures inter-entity cash transfer");
    })
    .map((row, index) => {
      const pnl = parseCsvNumber(getField(row, ["amount", "net amount", "total amount", "cash amount"])) ?? 0;
      const actualRisk = Math.max(Math.abs(pnl), 25);

      return createImportedTrade({
        id: `FUT-${index + 1}`,
        ticker: "FUTURES",
        assetType: "Futures",
        side: pnl >= 0 ? "Long" : "Short",
        setup: "Futures Cash Settlement",
        entryPrice: 0,
        exitPrice: 0,
        positionSize: 1,
        pnl,
        plannedRisk: actualRisk,
        actualRisk,
        riskPercent: Math.min(100, (actualRisk / 1000) * 100),
        rMultiple: pnl / Math.max(actualRisk, 1),
        durationMinutes: 390,
        date: normalizeDate(getField(row, ["activity date", "date", "process date", "settle date"])),
        time: "16:00",
        broker: "Robinhood Futures",
        notes:
          "Robinhood FUTSWP futures inter-entity cash transfer. Treated as realized futures PnL/cash settlement."
      });
    })
    .filter((trade) => trade.pnl !== 0);
}

function buildTransactionTrades(rows: CsvRow[]): Trade[] {
  const lots = new Map<string, { long: Lot[]; short: Lot[] }>();
  const trades: Trade[] = [];
  const sortedRows = [...rows].sort((a, b) => normalizeDateForSort(a).localeCompare(normalizeDateForSort(b)));

  for (const row of sortedRows) {
    const parsed = parseTransactionRow(row);
    if (!parsed) continue;

    const book = lots.get(parsed.ticker) ?? { long: [], short: [] };
    lots.set(parsed.ticker, book);

    if (parsed.action === "buy") {
      closeLots({
        queue: book.short,
        closing: parsed,
        closeSide: "buy",
        trades
      });

      if (parsed.quantity > 0) {
        book.long.push({
          ticker: parsed.ticker,
          assetType: parsed.assetType,
          side: "Long",
          quantity: parsed.quantity,
          price: parsed.price,
          date: parsed.date,
          time: parsed.time,
          broker: parsed.broker
        });
      }
    }

    if (parsed.action === "sell") {
      closeLots({
        queue: book.long,
        closing: parsed,
        closeSide: "sell",
        trades
      });

      if (parsed.quantity > 0) {
        book.short.push({
          ticker: parsed.ticker,
          assetType: parsed.assetType,
          side: "Short",
          quantity: parsed.quantity,
          price: parsed.price,
          date: parsed.date,
          time: parsed.time,
          broker: parsed.broker
        });
      }
    }
  }

  return trades;
}

function closeLots({
  queue,
  closing,
  closeSide,
  trades
}: {
  queue: Lot[];
  closing: ParsedTransaction;
  closeSide: TransactionAction;
  trades: Trade[];
}) {
  while (closing.quantity > 0 && queue.length) {
    const lot = queue[0];
    const quantity = Math.min(lot.quantity, closing.quantity);
    const pnl =
      lot.side === "Long"
        ? Number(((closing.price - lot.price) * quantity).toFixed(2))
        : Number(((lot.price - closing.price) * quantity).toFixed(2));
    const notional = Math.max(lot.price * quantity, closing.price * quantity, 1);
    const actualRisk = Math.max(Math.abs(pnl), notional * 0.02, 1);

    trades.push(
      createImportedTrade({
        id: `TX-${trades.length + 1}`,
        ticker: closing.ticker,
        assetType: closing.assetType,
        side: lot.side,
        setup: lot.side === "Long" ? "Imported Long Close" : "Imported Short Cover",
        entryPrice: lot.price,
        exitPrice: closing.price,
        positionSize: quantity,
        pnl,
        riskPercent: Math.min(100, (actualRisk / notional) * 100),
        plannedRisk: Math.max(notional * 0.02, 1),
        actualRisk,
        rMultiple: pnl / Math.max(actualRisk, 1),
        durationMinutes: estimateDurationMinutes(lot.date, lot.time, closing.date, closing.time),
        date: closing.date,
        time: closing.time,
        broker: closing.broker,
        notes: `FIFO realized PnL from ${lot.side.toLowerCase()} lot opened ${lot.date} and closed by ${closeSide}.`
      })
    );

    lot.quantity = Number((lot.quantity - quantity).toFixed(8));
    closing.quantity = Number((closing.quantity - quantity).toFixed(8));

    if (lot.quantity <= 0.00000001) {
      queue.shift();
    }
  }
}

type ParsedTransaction = {
  action: TransactionAction;
  ticker: string;
  assetType: Trade["assetType"];
  quantity: number;
  price: number;
  date: string;
  time: string;
  broker: string;
};

function parseTransactionRow(row: CsvRow): ParsedTransaction | undefined {
  const text = [
    getField(row, ["trans code", "transaction code", "activity type", "type", "action", "side"]),
    getField(row, ["description", "details", "notes"])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    /(dividend|interest|deposit|withdraw|transfer|ach|fee|gold|margin|sweep|cash management)/i.test(text)
  ) {
    return undefined;
  }

  const quantity = Math.abs(parseCsvNumber(getField(row, ["quantity", "qty", "shares", "contracts"])) ?? 0);
  if (!quantity) return undefined;

  const amount = parseCsvNumber(getField(row, ["amount", "net amount", "total amount", "proceeds", "cash amount"]));
  const listedPrice = parseCsvNumber(getField(row, ["price", "average price", "avg price", "execution price"]));
  const price = amount !== undefined ? Math.abs(amount) / quantity : listedPrice;
  if (!price || !Number.isFinite(price)) return undefined;

  const action = normalizeTransactionAction(text, amount);
  if (!action) return undefined;

  const description = getField(row, ["description", "details", "instrument", "symbol", "ticker"]) || "";
  const ticker = (
    getField(row, ["ticker", "symbol", "instrument", "underlying"]) ||
    extractTicker(description) ||
    "UNKNOWN"
  ).toUpperCase();
  if (ticker === "UNKNOWN") return undefined;

  return {
    action,
    ticker,
    assetType: normalizeAsset(`${getField(row, ["asset type", "instrument type", "asset"]) || ""} ${description}`),
    quantity,
    price,
    date: normalizeDate(getField(row, ["activity date", "date", "process date", "trade date"])),
    time: normalizeTime(getField(row, ["time", "created at", "executed at"])),
    broker: getField(row, ["broker", "source"]) || "Broker CSV"
  };
}

function createImportedTrade(input: Omit<Trade, "session" | "marketRegime" | "volumeRegime" | "emotionTags" | "ruleAdherence" | "stopRespected" | "confidence" | "stress" | "sleep" | "focus" | "isRevenge" | "isFomo">): Trade {
  const pnl = Number(input.pnl.toFixed(2));

  return {
    ...input,
    pnl,
    rMultiple: Number(input.rMultiple.toFixed(2)),
    riskPercent: Number(input.riskPercent.toFixed(2)),
    session: normalizeSession(input.time),
    marketRegime: "Chop",
    volumeRegime: "Normal",
    emotionTags: pnl < 0 ? ["Tilt"] : ["Disciplined"],
    ruleAdherence: pnl < 0 ? 48 : 82,
    stopRespected: pnl >= 0,
    confidence: pnl < 0 ? 5 : 6,
    stress: pnl < 0 ? 7 : 4,
    sleep: 7,
    focus: pnl < 0 ? 5 : 7,
    isRevenge: false,
    isFomo: false
  };
}

function parseCsvNumber(value?: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  const raw = String(value).trim();
  if (!raw) return undefined;

  const normalized = raw.replace(/[−–—]/g, "-");
  const negative = /\(.+\)/.test(normalized) || normalized.includes("-");
  const numeric = normalized.replace(/[^0-9.]/g, "");
  if (!numeric) return undefined;

  const parsed = Number(numeric);
  if (!Number.isFinite(parsed)) return undefined;

  return negative ? -Math.abs(parsed) : parsed;
}

function getField(row: CsvRow, aliases: string[]): string | undefined {
  const normalizedAliases = aliases.map(normalizeKey);

  for (const [key, value] of Object.entries(row)) {
    if (normalizedAliases.includes(normalizeKey(key)) && String(value ?? "").trim()) {
      return String(value).trim();
    }
  }

  return undefined;
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeBoolean(value?: string): boolean | undefined {
  if (!value) return undefined;
  const clean = value.toLowerCase().trim();
  if (["true", "yes", "y", "1"].includes(clean)) return true;
  if (["false", "no", "n", "0"].includes(clean)) return false;
  return undefined;
}

function normalizeDate(value?: string): string {
  if (!value) return new Date().toISOString().slice(0, 10);
  const clean = value.trim();
  const isoMatch = clean.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const slashMatch = clean.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (slashMatch) {
    const [, month, day, rawYear] = slashMatch;
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const parsed = new Date(clean);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString().slice(0, 10) : parsed.toISOString().slice(0, 10);
}

function normalizeDateForSort(row: CsvRow) {
  return `${normalizeDate(getField(row, ["activity date", "date", "process date", "trade date"]))}T${normalizeTime(
    getField(row, ["time", "created at", "executed at"])
  )}`;
}

function normalizeTime(value?: string): string {
  if (!value) return "10:00";
  const match = value.match(/(\d{1,2}):(\d{2})/);
  if (!match) return "10:00";
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function normalizeSession(value: string): Session {
  const hour = Number(value.split(":")[0] || 10);
  if (value === "Open" || hour < 11) return "Open";
  if (value === "Power Hour" || hour >= 15) return "Power Hour";
  return "Midday";
}

function normalizeEmotion(value?: string): EmotionTag {
  const clean = (value ?? "").toLowerCase();
  if (clean.includes("fomo")) return "FOMO";
  if (clean.includes("revenge")) return "Revenge";
  if (clean.includes("tilt")) return "Tilt";
  if (clean.includes("greed")) return "Greed";
  if (clean.includes("fear")) return "Fear";
  if (clean.includes("hesitation")) return "Hesitation";
  if (clean.includes("confidence")) return "Confidence";
  if (clean.includes("impulsive")) return "Impulsive";
  return "Disciplined";
}

function normalizeAsset(value: string): Trade["assetType"] {
  const clean = value.toLowerCase();
  if (clean.includes("future")) return "Futures";
  if (clean.includes("crypto")) return "Crypto";
  if (clean.includes("option") || clean.includes(" call") || clean.includes(" put")) return "Options";
  return "Equity";
}

function normalizeTransactionAction(text: string, amount?: number): TransactionAction | undefined {
  if (/\b(buy|bought|bto|btc)\b|buy to (open|close)/i.test(text)) return "buy";
  if (/\b(sell|sold|sto|stc)\b|sell to (open|close)/i.test(text)) return "sell";
  if (amount !== undefined) return amount < 0 ? "buy" : "sell";
  return undefined;
}

function extractTicker(description: string) {
  const match = description.match(/\b[A-Z]{1,6}\b/);
  return match?.[0];
}

function estimateDurationMinutes(openDate: string, openTime: string, closeDate: string, closeTime: string) {
  const start = new Date(`${openDate}T${openTime}`).getTime();
  const end = new Date(`${closeDate}T${closeTime}`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 45;
  return Math.max(1, Math.round((end - start) / 60000));
}
