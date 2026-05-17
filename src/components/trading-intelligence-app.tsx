"use client";

import { ChangeEvent, FormEvent, type ReactNode, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  BrainCircuit,
  ChevronRight,
  CircleDollarSign,
  Flame,
  Gauge,
  Info,
  LineChart as LineChartIcon,
  MessageSquareText,
  PieChart,
  Radar,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
  Zap
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import {
  buildBehaviorIndicators,
  buildBurnoutSignal,
  buildCoachResponse,
  buildEquityCurve,
  buildStrategyRecommendations,
  calculateDisciplineScore,
  calculateEmotionStats,
  calculatePsychologyMatrix,
  calculateSummary,
  detectInsights,
  groupByMarketRegime,
  groupBySession,
  groupByStrategy,
  parseImportedTrades
} from "@/lib/analytics";
import {
  brokerOptions,
  samplePsychologyLogs,
  sampleTrades,
  strategyOptions,
  type PsychologyLog,
  type Trade
} from "@/lib/trading-data";
import { cn, formatCompactCurrency, formatCurrency, formatPercent } from "@/lib/utils";

type ActiveView = "overview" | "psychology" | "strategy" | "replay";
type TimeRange = "1W" | "1M" | "3M" | "6M" | "1Y" | "ALL";
type TradeScope = "ALL" | "FUTURES" | "POSITIONS";
type CoachMessage = { role: "ai" | "user"; content: string };
type ScopeHealthItem = {
  label: string;
  value: string;
  detail: string;
  tone: "green" | "amber" | "red";
};
type MetricTrend = "up" | "down" | "neutral";
type MetricCalculation = {
  title: string;
  description: string;
  formula: string;
  inputs: string[];
  note?: string;
};

const navItems: Array<{ id: ActiveView; label: string; icon: typeof Activity }> = [
  { id: "overview", label: "Command", icon: Activity },
  { id: "psychology", label: "Psychology", icon: BrainCircuit },
  { id: "strategy", label: "Strategy", icon: PieChart },
  { id: "replay", label: "Replay", icon: Radar }
];

const promptChips = [
  "What is my biggest weakness?",
  "When should I stop trading?",
  "Analyze my psychology this month.",
  "What setups work best for me?"
];

const marketTape = [
  { label: "SPY", value: "+0.42%", tone: "up" },
  { label: "QQQ", value: "+0.71%", tone: "up" },
  { label: "VIX", value: "-3.8%", tone: "up" },
  { label: "Regime", value: "Trend Up", tone: "neutral" },
  { label: "Volume", value: "High", tone: "neutral" }
];

const timeRangeOptions: Array<{ id: TimeRange; label: string; days?: number }> = [
  { id: "1W", label: "1W", days: 7 },
  { id: "1M", label: "1M", days: 30 },
  { id: "3M", label: "3M", days: 90 },
  { id: "6M", label: "6M", days: 180 },
  { id: "1Y", label: "1Y", days: 365 },
  { id: "ALL", label: "All" }
];

const tradeScopeOptions: Array<{ id: TradeScope; label: string; detail: string }> = [
  { id: "ALL", label: "All", detail: "Every imported trade" },
  { id: "FUTURES", label: "Futures", detail: "Futures trades and settlements" },
  { id: "POSITIONS", label: "Stocks & Options", detail: "Equity, options, and crypto trades" }
];

export function TradingIntelligenceApp() {
  const [trades, setTrades] = useState<Trade[]>(sampleTrades);
  const [psychologyLogs] = useState<PsychologyLog[]>(samplePsychologyLogs);
  const [activeView, setActiveView] = useState<ActiveView>("overview");
  const [activeRange, setActiveRange] = useState<TimeRange>("ALL");
  const [activeScope, setActiveScope] = useState<TradeScope>("ALL");
  const [selectedTrade, setSelectedTrade] = useState<Trade>(sampleTrades[sampleTrades.length - 1]);
  const [hasImportedCsv, setHasImportedCsv] = useState(false);
  const [importStatus, setImportStatus] = useState("Import a CSV to activate analytics");
  const [activeCalculation, setActiveCalculation] = useState<MetricCalculation | null>(null);
  const [coachInput, setCoachInput] = useState("What is my biggest weakness?");
  const [coachMessages, setCoachMessages] = useState<CoachMessage[]>([
    {
      role: "ai",
      content:
        "I have reviewed the current trade sample. Your strongest edge is the morning trend playbook, while the biggest leak is emotional continuation after a loss."
    }
  ]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewLocked = !hasImportedCsv;

  const scopeCounts = useMemo(() => buildScopeCounts(trades), [trades]);
  const scopeTrades = useMemo(() => filterTradesByScope(trades, activeScope), [trades, activeScope]);
  const activeTrades = useMemo(() => filterTradesByRange(scopeTrades, activeRange), [scopeTrades, activeRange]);
  const scopedTrades = activeTrades;
  const activeRangeLabel =
    activeRange === "ALL" ? "All time" : (timeRangeOptions.find((option) => option.id === activeRange)?.label ?? "All time");
  const activeScopeDetailLabel =
    activeScope === "ALL" ? "All trades" : activeScope === "FUTURES" ? "Futures trades" : "Stocks & options";
  const emptyScopeLabel =
    activeScope === "ALL" ? "trades" : activeScope === "FUTURES" ? "futures trades" : "stocks/options trades";
  const tradeCountLabel = activeScope === "ALL" ? "trades" : activeScope === "FUTURES" ? "futures" : "stocks/options";
  const hasScopedTrades = scopedTrades.length > 0;
  const rangeDetail = useMemo(() => formatRangeDetail(scopedTrades), [scopedTrades]);
  const summary = useMemo(() => calculateSummary(scopedTrades), [scopedTrades]);
  const discipline = useMemo(() => calculateDisciplineScore(scopedTrades), [scopedTrades]);
  const equityCurve = useMemo(() => buildEquityCurve(scopedTrades), [scopedTrades]);
  const zeroPlaneCurve = useMemo(() => buildZeroPlaneCurve(equityCurve), [equityCurve]);
  const insights = useMemo(() => detectInsights(scopedTrades), [scopedTrades]);
  const strategies = useMemo(() => groupByStrategy(scopedTrades), [scopedTrades]);
  const sessions = useMemo(() => groupBySession(scopedTrades), [scopedTrades]);
  const emotions = useMemo(() => calculateEmotionStats(scopedTrades), [scopedTrades]);
  const psychologyMatrix = useMemo(() => calculatePsychologyMatrix(scopedTrades), [scopedTrades]);
  const regimes = useMemo(() => groupByMarketRegime(scopedTrades), [scopedTrades]);
  const behaviorIndicators = useMemo(() => buildBehaviorIndicators(scopedTrades), [scopedTrades]);
  const strategyRecommendations = useMemo(() => buildStrategyRecommendations(scopedTrades), [scopedTrades]);
  const burnout = useMemo(() => buildBurnoutSignal(scopedTrades, psychologyLogs), [scopedTrades, psychologyLogs]);
  const ledgerTrades = useMemo(() => [...scopedTrades].sort((a, b) => tradeTime(b) - tradeTime(a)), [scopedTrades]);
  const scopeHealthItems = useMemo<ScopeHealthItem[]>(
    () => {
      if (!hasScopedTrades) {
        return [
          {
            label: "Max Drawdown",
            value: "No sample",
            detail: "Needs closed trades in this view",
            tone: "amber"
          },
          {
            label: "Expectancy",
            value: "No sample",
            detail: "Average R appears after import/filter data",
            tone: "amber"
          },
          {
            label: "Stop Respect",
            value: "No sample",
            detail: "Requires trades with risk-plan status",
            tone: "amber"
          },
          {
            label: "Best Setup",
            value: "No setup",
            detail: "No setup bucket in the selected view",
            tone: "amber"
          }
        ];
      }

      return [
      {
        label: "Max Drawdown",
        value: formatCurrency(summary.maxDrawdown),
        detail: "Worst closed-trade equity dip",
        tone: summary.maxDrawdown < -1000 ? "red" : summary.maxDrawdown < 0 ? "amber" : "green"
      },
      {
        label: "Expectancy",
        value: `${summary.avgR.toFixed(2)}R`,
        detail: "Average R per trade",
        tone: summary.avgR >= 0.8 ? "green" : summary.avgR >= 0 ? "amber" : "red"
      },
      {
        label: "Stop Respect",
        value: formatPercent(summary.stopRespectRate),
        detail: "Closed trades honoring risk plan",
        tone: summary.stopRespectRate >= 75 ? "green" : summary.stopRespectRate >= 55 ? "amber" : "red"
      },
      {
        label: "Best Setup",
        value: strategies[0]?.name ?? "None",
        detail: strategies[0] ? `${formatCurrency(strategies[0].pnl)} net in scope` : "No setup sample yet",
        tone: (strategies[0]?.pnl ?? 0) >= 0 ? "green" : "red"
      }
      ];
    },
    [hasScopedTrades, strategies, summary.avgR, summary.maxDrawdown, summary.stopRespectRate]
  );
  const metricCalculations = useMemo<Record<string, MetricCalculation>>(
    () => ({
      netPnl: {
        title: "Net PnL",
        description: "Total realized profit and loss for the selected dataset and time range.",
        formula: "sum(trade PnL)",
        inputs: hasScopedTrades
          ? [
              `${summary.totalTrades} closed trades in scope`,
              `Gross profit: ${formatCurrency(summary.grossProfit)}`,
              `Gross loss: ${summary.grossLoss ? formatCurrency(-summary.grossLoss) : "No losses"}`
            ]
          : ["No closed trades in the selected dataset and time range."],
        note: hasScopedTrades ? undefined : "Import a CSV or expand the selected range to calculate realized PnL."
      },
      discipline: {
        title: "Discipline Score",
        description: "Composite execution quality score based on risk, stops, emotional control, selectivity, and consistency.",
        formula: "risk mgmt 24% + stop respect 24% + emotional control 22% + selectivity 12% + consistency 18%",
        inputs: hasScopedTrades
          ? [
              `Risk management: ${discipline.riskManagement}`,
              `Stop respect: ${discipline.stopRespect}`,
              `Emotional control: ${discipline.emotionalControl}`,
              `Selectivity: ${discipline.selectivity}`,
              `Consistency: ${discipline.consistency}`
            ]
          : ["No closed trades in the selected view, so the score is paused."],
        note: hasScopedTrades ? undefined : "The score only appears after there is enough execution data in scope."
      },
      winRate: {
        title: "Win Rate",
        description: "Share of closed trades with positive realized PnL.",
        formula: "(winning trades / total trades) x 100",
        inputs: hasScopedTrades
          ? [
              `Winning trades: ${summary.winningTrades}`,
              `Losing trades: ${summary.losingTrades}`,
              `Total trades: ${summary.totalTrades}`
            ]
          : ["No closed trades in the selected view."],
        note: hasScopedTrades ? undefined : "No trades in the selected view yet."
      },
      revengeLossShare: {
        title: "Revenge Loss Share",
        description: "How much of total realized losses came from trades classified as revenge trades.",
        formula: "abs(revenge trade losses) / abs(all losing trade PnL) x 100",
        inputs: summary.grossLoss
          ? [
              `Revenge-trade losses: ${
                summary.revengeLossAmount ? formatCurrency(-summary.revengeLossAmount) : "None"
              }`,
              `Total realized losses: ${formatCurrency(-summary.grossLoss)}`,
              `Revenge loss share: ${summary.revengeLossAmount ? formatPercent(summary.revengeLossShare) : "None"}`
            ]
          : ["No realized losses in the selected view."],
        note: summary.grossLoss
          ? "Only losing revenge trades count toward this metric. Winning revenge trades are excluded from loss share."
          : "No realized losses in this view, so loss share is not calculated."
      }
    }),
    [discipline, hasScopedTrades, summary]
  );
  const netPnlValue = hasScopedTrades ? formatCurrency(summary.netPnl) : "No trades";
  const disciplineValue = hasScopedTrades ? `${discipline.overall}` : "No data";
  const winRateValue = hasScopedTrades ? formatPercent(summary.winRate) : "No sample";
  const profitFactorLabel = formatProfitFactor(summary);
  const metricTradeDetail = hasScopedTrades
    ? `${summary.totalTrades} ${tradeCountLabel} / ${activeRangeLabel}`
    : "No trades in view";
  const winRateDetail = !hasScopedTrades
    ? "No trades in view"
    : profitFactorLabel === "No losses"
      ? "Profit factor: no losses"
      : `${profitFactorLabel} profit factor`;
  const revengeLossShareValue = formatRevengeLossShareValue(summary);
  const revengeLossShareDetail = !summary.grossLoss
    ? "No realized losses"
    : summary.revengeLossAmount
      ? "Primary psychology leak"
      : "No revenge losses detected";
  const selectedLedgerTrade = ledgerTrades.find((trade) => trade.id === selectedTrade.id) ?? ledgerTrades[0];
  const weakestSession = useMemo(
    () => sessions.filter((session) => session.trades).sort((a, b) => a.pnl - b.pnl)[0],
    [sessions]
  );
  const sessionReview = scopedTrades.length
    ? `${activeScopeDetailLabel} view is ${formatCurrency(summary.netPnl)} across ${summary.totalTrades} trades. The weakest window is ${
        weakestSession?.name ?? "unconfirmed"
      }, so size should stay capped there until the data improves.`
    : `No ${emptyScopeLabel} are available inside this time range. Expand the window or switch the dataset scope to review execution.`;

  function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const importResult = parseImportedTrades(results.data);
        const imported = importResult.trades;

        if (!imported.length) {
          setImportStatus(importResult.message);
          return;
        }

        setTrades(imported);
        setSelectedTrade(imported[imported.length - 1]);
        setHasImportedCsv(true);
        setActiveScope("ALL");
        setActiveRange("ALL");
        setImportStatus(
          `${imported.length} trades from ${file.name}. ${importResult.source}; ${importResult.ignoredRows} rows ignored.`
        );
      }
    });

    event.target.value = "";
  }

  function handleCoachSubmit(event?: FormEvent, override?: string) {
    event?.preventDefault();
    const question = (override ?? coachInput).trim();
    if (!question) return;

    const answer = buildCoachResponse(question, scopedTrades, psychologyLogs);
    setCoachMessages((current) => [
      ...current,
      { role: "user", content: question },
      { role: "ai", content: answer }
    ]);
    setCoachInput("");
  }

  return (
    <main className="min-h-screen overflow-hidden bg-base-950 text-zinc-100">
      <div className="terminal-grid fixed inset-0 opacity-60" />
      <div className="scanline fixed inset-0 pointer-events-none" />
      <AnimatePresence>
        {activeCalculation && (
          <CalculationPopup info={activeCalculation} onClose={() => setActiveCalculation(null)} />
        )}
      </AnimatePresence>

      <div className="relative flex min-h-screen">
        <aside className="hidden w-[248px] shrink-0 border-r border-white/10 bg-base-900/82 px-4 py-5 backdrop-blur-xl lg:flex lg:flex-col">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md border border-signal-green/35 bg-signal-green/10 text-signal-green">
              <BrainCircuit className="size-5" />
            </div>
            <div>
              <p className="text-[11px] uppercase text-zinc-500">Behavioral Trading AI</p>
              <h1 className="text-xl font-semibold">EdgePilot</h1>
            </div>
          </div>

          <nav className={cn("mt-8 space-y-1 transition", previewLocked && "pointer-events-none select-none opacity-35 grayscale")}>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  className={cn(
                    "group flex w-full items-center justify-between rounded-md px-3 py-2.5 text-sm transition",
                    activeView === item.id
                      ? "bg-white text-base-950"
                      : "text-zinc-400 hover:bg-white/[0.07] hover:text-white"
                  )}
                >
                  <span className="flex items-center gap-3">
                    <Icon className="size-4" />
                    {item.label}
                  </span>
                  <ChevronRight className="size-4 opacity-50 transition group-hover:translate-x-0.5" />
                </button>
              );
            })}
          </nav>

          <div className="mt-8 border-t border-white/10 pt-5">
            <p className="text-xs uppercase text-zinc-500">Import Engine</p>
            <div className={cn("mt-3 grid grid-cols-2 gap-2 transition", previewLocked && "opacity-55 grayscale")}>
              {brokerOptions.map((broker) => (
                <span key={broker} className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5 text-[11px] text-zinc-400">
                  {broker}
                </span>
              ))}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-signal-green px-3 py-2.5 text-sm font-semibold text-base-950 transition hover:bg-white"
            >
              <Upload className="size-4" />
              Import CSV
            </button>
            <input ref={fileInputRef} className="hidden" type="file" accept=".csv" onChange={handleImport} />
            <p className="mt-3 text-xs leading-5 text-zinc-500">{importStatus}</p>
          </div>

          <div className="mt-auto border-t border-white/10 pt-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">AI Memory</span>
              <span
                className={cn(
                  "rounded-full px-2 py-1 text-[11px]",
                  previewLocked ? "bg-white/[0.04] text-zinc-500" : "bg-signal-green/10 text-signal-green"
                )}
              >
                {previewLocked ? "Waiting" : "Online"}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-300">
              {previewLocked
                ? "Import closed trade history to unlock behavioral memory and coaching."
                : "Tracking revenge loops, overtrading windows, and risk drift from trade history."}
            </p>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-white/10 bg-base-950/80 px-4 py-3 backdrop-blur-xl md:px-6">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-xs uppercase text-zinc-500">AI-powered behavioral analytics and performance intelligence</p>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-semibold md:text-3xl">Trader Decision Intelligence</h2>
                  <span className="rounded-full border border-signal-cyan/25 bg-signal-cyan/10 px-3 py-1 text-xs text-signal-cyan">
                    Scope-aware AI coaching
                  </span>
                </div>
              </div>

              <div className={cn("flex flex-wrap items-center gap-2 transition", previewLocked && "opacity-40 grayscale")}>
                {marketTape.map((item) => (
                  <div key={item.label} className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2">
                    <span className="mr-2 text-xs text-zinc-500">{item.label}</span>
                    <span
                      className={cn(
                        "text-sm font-medium",
                        item.tone === "up" ? "text-signal-green" : "text-zinc-200"
                      )}
                    >
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </header>

          <div className="space-y-5 px-4 py-5 md:px-6">
            {previewLocked && <PreviewGateBanner onImport={() => fileInputRef.current?.click()} />}

            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className={cn(
                "grid gap-3 transition md:grid-cols-2 xl:grid-cols-4",
                previewLocked && "pointer-events-none select-none opacity-35 grayscale"
              )}
            >
              <MetricTile
                label="Net PnL"
                value={netPnlValue}
                detail={metricTradeDetail}
                icon={CircleDollarSign}
                trend={hasScopedTrades ? (summary.netPnl >= 0 ? "up" : "down") : "neutral"}
                calculation={metricCalculations.netPnl}
                onOpenCalculation={setActiveCalculation}
              />
              <MetricTile
                label="Discipline Score"
                value={disciplineValue}
                detail={discipline.label}
                icon={ShieldCheck}
                trend={hasScopedTrades ? (discipline.overall >= 70 ? "up" : "down") : "neutral"}
                calculation={metricCalculations.discipline}
                onOpenCalculation={setActiveCalculation}
              />
              <MetricTile
                label="Win Rate"
                value={winRateValue}
                detail={winRateDetail}
                icon={Gauge}
                trend={hasScopedTrades ? (summary.winRate >= 50 ? "up" : "down") : "neutral"}
                calculation={metricCalculations.winRate}
                onOpenCalculation={setActiveCalculation}
              />
              <MetricTile
                label="Revenge Loss Share"
                value={revengeLossShareValue}
                detail={revengeLossShareDetail}
                icon={Flame}
                trend={summary.grossLoss ? (summary.revengeLossShare > 30 ? "down" : "up") : "neutral"}
                calculation={metricCalculations.revengeLossShare}
                onOpenCalculation={setActiveCalculation}
              />
            </motion.section>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
              <div className="min-w-0 space-y-5">
                <div
                  className={cn(
                    "flex flex-col gap-3 transition 2xl:flex-row 2xl:items-center 2xl:justify-between",
                    previewLocked && "pointer-events-none select-none opacity-35 grayscale"
                  )}
                >
                  <SegmentedNav activeView={activeView} onChange={setActiveView} />
                  <TradeScopeSelector
                    activeScope={activeScope}
                    counts={scopeCounts}
                    onChange={setActiveScope}
                  />
                </div>

                <AnimatePresence mode="wait">
                  {activeView === "overview" && (
                    <motion.div
                      key="overview"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.25 }}
                      className="space-y-5"
                    >
                      <Panel
                        title="Performance Intelligence"
                        eyebrow={`Equity, drawdown, and execution quality / ${activeScopeDetailLabel} / ${rangeDetail}`}
                        action={
                          <div
                            className={cn(
                              "flex flex-wrap items-center justify-end gap-2 transition",
                              previewLocked && "pointer-events-none select-none opacity-35 grayscale"
                            )}
                          >
                            <TimeRangeSelector activeRange={activeRange} onChange={setActiveRange} />
                            <StatusBadge
                              tone={summary.bestTrade ? "green" : "amber"}
                              label={summary.bestTrade ? `${formatCurrency(summary.bestTrade.pnl)} best trade` : "No trades"}
                            />
                          </div>
                        }
                      >
                        <div className="relative h-[320px]">
                          <div
                            className={cn(
                              "h-full transition",
                              previewLocked && "pointer-events-none select-none opacity-25 grayscale"
                            )}
                          >
                            {equityCurve.length ? (
                              <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={zeroPlaneCurve} margin={{ top: 12, right: 16, left: -12, bottom: 0 }}>
                                  <defs>
                                    <linearGradient id="equityPositiveFill" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#4dff88" stopOpacity={0.35} />
                                      <stop offset="95%" stopColor="#4dff88" stopOpacity={0.02} />
                                    </linearGradient>
                                    <linearGradient id="equityNegativeFill" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#ff5f73" stopOpacity={0.05} />
                                      <stop offset="95%" stopColor="#ff5f73" stopOpacity={0.35} />
                                    </linearGradient>
                                  </defs>
                                  <CartesianGrid stroke="#ffffff12" vertical={false} />
                                  <XAxis
                                    dataKey="label"
                                    stroke="#71717a"
                                    tickLine={false}
                                    axisLine={false}
                                    fontSize={12}
                                    minTickGap={34}
                                  />
                                  <YAxis
                                    stroke="#71717a"
                                    tickLine={false}
                                    axisLine={false}
                                    fontSize={12}
                                    domain={[(dataMin: number) => Math.min(0, dataMin), (dataMax: number) => Math.max(0, dataMax)]}
                                    tickFormatter={(value) => formatCompactCurrency(Number(value))}
                                  />
                                  <Tooltip content={<EquityChartTooltip />} cursor={{ stroke: "#ffffff26", strokeWidth: 1 }} />
                                  <ReferenceLine y={0} stroke="#ffffff45" strokeDasharray="5 5" />
                                  <Area
                                    type="monotone"
                                    dataKey="positiveEquity"
                                    name="Equity"
                                    stroke="#4dff88"
                                    fill="url(#equityPositiveFill)"
                                    strokeWidth={2.5}
                                    baseValue={0}
                                    dot={false}
                                    activeDot={{ r: 5, fill: "#4dff88", stroke: "#050705", strokeWidth: 2 }}
                                  />
                                  <Area
                                    type="monotone"
                                    dataKey="negativeEquity"
                                    name="Equity"
                                    stroke="#ff5f73"
                                    fill="url(#equityNegativeFill)"
                                    strokeWidth={2.5}
                                    baseValue={0}
                                    dot={false}
                                    activeDot={{ r: 5, fill: "#ff5f73", stroke: "#050705", strokeWidth: 2 }}
                                  />
                                  <Line type="monotone" dataKey="discipline" stroke="#4ad8ff" strokeWidth={1.5} dot={false} />
                                </AreaChart>
                              </ResponsiveContainer>
                            ) : (
                              <EmptyState
                                title="No performance data"
                                detail="Change the dataset scope or time range to plot closed trades."
                              />
                            )}
                          </div>
                          {previewLocked && <ImportCsvPrompt onImport={() => fileInputRef.current?.click()} />}
                        </div>
                        <div className={cn("transition", previewLocked && "pointer-events-none select-none opacity-35 grayscale")}>
                          <ScopeHealthStrip items={scopeHealthItems} />
                        </div>
                      </Panel>

                      <div
                        className={cn(
                          "grid gap-5 transition xl:grid-cols-[0.92fr_1.08fr]",
                          previewLocked && "pointer-events-none select-none opacity-35 grayscale"
                        )}
                      >
                        <Panel title="Behavioral Pattern Detection" eyebrow="Highest signal findings">
                          <div className="space-y-3">
                            {insights.slice(0, 5).map((insight) => (
                              <InsightRow key={insight.title} insight={insight} />
                            ))}
                          </div>
                        </Panel>

                        <Panel title="Session Quality" eyebrow="Time-based performance split">
                          <div className="h-[265px]">
                            {hasScopedTrades ? (
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={sessions} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                                  <CartesianGrid stroke="#ffffff12" vertical={false} />
                                  <XAxis dataKey="name" stroke="#71717a" tickLine={false} axisLine={false} fontSize={12} />
                                  <YAxis
                                    stroke="#71717a"
                                    tickLine={false}
                                    axisLine={false}
                                    fontSize={12}
                                    tickFormatter={(value) => formatCompactCurrency(Number(value))}
                                  />
                                  <Tooltip content={<ChartTooltip valuePrefix="$" />} />
                                  <Bar dataKey="pnl" radius={[6, 6, 0, 0]}>
                                    {sessions.map((session) => (
                                      <Cell key={session.name} fill={session.pnl >= 0 ? "#4dff88" : "#ff5f73"} />
                                    ))}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            ) : (
                              <EmptyState title="No session sample" detail="Session splits appear after this view has closed trades." />
                            )}
                          </div>
                        </Panel>
                      </div>
                    </motion.div>
                  )}

                  {activeView === "psychology" && (
                    <motion.div
                      key="psychology"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.25 }}
                      className="space-y-5"
                    >
                      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
                        <Panel title="Emotional Correlation" eyebrow="PnL impact by logged state">
                          <div className="space-y-3">
                            {emotions.length ? (
                              emotions.map((emotion) => <EmotionRow key={emotion.emotion} emotion={emotion} />)
                            ) : (
                              <EmptyState title="No emotional tags" detail="This scope has no trades with psychology data yet." />
                            )}
                          </div>
                        </Panel>

                        <Panel
                          title="Psychology Matrix"
                          eyebrow="Stress bands against outcome quality"
                          action={<StatusBadge tone={burnout.score > 65 ? "red" : "amber"} label={burnout.label} />}
                        >
                          <div className="h-[300px]">
                            {hasScopedTrades ? (
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={psychologyMatrix} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
                                  <CartesianGrid stroke="#ffffff12" vertical={false} />
                                  <XAxis dataKey="name" stroke="#71717a" tickLine={false} axisLine={false} fontSize={12} />
                                  <YAxis
                                    stroke="#71717a"
                                    tickLine={false}
                                    axisLine={false}
                                    fontSize={12}
                                    tickFormatter={(value) => formatCompactCurrency(Number(value))}
                                  />
                                  <Tooltip content={<ChartTooltip valuePrefix="$" />} />
                                  <Bar dataKey="pnl" radius={[6, 6, 0, 0]}>
                                    {psychologyMatrix.map((bucket) => (
                                      <Cell key={bucket.name} fill={bucket.pnl >= 0 ? "#4ad8ff" : "#ff5f73"} />
                                    ))}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            ) : (
                              <EmptyState title="No psychology sample" detail="Stress-band diagnostics need closed trades in this view." />
                            )}
                          </div>
                          <p className="mt-3 text-sm leading-6 text-zinc-400">{burnout.detail}</p>
                        </Panel>
                      </div>

                      <Panel title="Behavioral Risk Indicators" eyebrow="Execution behaviors correlated with losses">
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          {behaviorIndicators.map((indicator) => (
                            <BehaviorIndicatorTile key={indicator.label} indicator={indicator} />
                          ))}
                        </div>
                      </Panel>
                    </motion.div>
                  )}

                  {activeView === "strategy" && (
                    <motion.div
                      key="strategy"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.25 }}
                      className="space-y-5"
                    >
                      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
                        <Panel title="Strategy Expectancy" eyebrow="Setup profitability and average R">
                          <div className="h-[330px]">
                            {strategies.length ? (
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={strategies} layout="vertical" margin={{ top: 8, right: 16, left: 70, bottom: 0 }}>
                                  <CartesianGrid stroke="#ffffff12" horizontal={false} />
                                  <XAxis
                                    type="number"
                                    stroke="#71717a"
                                    tickLine={false}
                                    axisLine={false}
                                    fontSize={12}
                                    tickFormatter={(value) => formatCompactCurrency(Number(value))}
                                  />
                                  <YAxis dataKey="name" type="category" stroke="#a1a1aa" tickLine={false} axisLine={false} fontSize={12} />
                                  <Tooltip content={<ChartTooltip valuePrefix="$" />} />
                                  <Bar dataKey="pnl" radius={[0, 6, 6, 0]}>
                                    {strategies.map((strategy) => (
                                      <Cell key={strategy.name} fill={strategy.pnl >= 0 ? "#4dff88" : "#ff5f73"} />
                                    ))}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            ) : (
                              <EmptyState title="No strategy sample" detail="Strategy expectancy will appear when this scope has trades." />
                            )}
                          </div>
                        </Panel>

                        <Panel title="Market Context" eyebrow="Regime-aware performance diagnostics">
                          <div className="space-y-3">
                            {regimes.length ? (
                              regimes.map((regime) => (
                                <DiagnosticLine
                                  key={regime.name}
                                  label={regime.name}
                                  value={formatCurrency(regime.pnl)}
                                  helper={`${regime.trades} trades, ${formatPercent(regime.winRate)} win rate`}
                                  progress={Math.min(100, Math.abs(regime.pnl) / 18)}
                                  tone={regime.pnl >= 0 ? "green" : "red"}
                                />
                              ))
                            ) : (
                              <EmptyState title="No market context" detail="Market regime diagnostics need trades in the selected view." />
                            )}
                          </div>
                        </Panel>
                      </div>

                      <Panel title="Loss Reduction Playbook" eyebrow="Rules generated from the selected trade window">
                        <div className="grid gap-3 lg:grid-cols-2">
                          {strategyRecommendations.map((recommendation) => (
                            <StrategyRecommendationCard key={recommendation.title} recommendation={recommendation} />
                          ))}
                        </div>
                      </Panel>

                      <Panel title="Strategy Rules Library" eyebrow="Current playbook monitored by the AI coach">
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                          {strategyOptions.slice(0, 8).map((strategy) => (
                            <div key={strategy} className="rounded-md border border-white/10 bg-white/[0.03] p-4">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-zinc-200">{strategy}</p>
                                <Sparkles className="size-4 text-signal-cyan" />
                              </div>
                              <p className="mt-3 text-xs leading-5 text-zinc-500">
                                AI classifies trades, checks rule adherence, and compares planned versus actual execution.
                              </p>
                            </div>
                          ))}
                        </div>
                      </Panel>
                    </motion.div>
                  )}

                  {activeView === "replay" && (
                    <motion.div
                      key="replay"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.25 }}
                      className="space-y-5"
                    >
                      <Panel
                        title="Trade Replay"
                        eyebrow="Planned behavior versus actual execution"
                        action={
                          <StatusBadge
                            tone={selectedLedgerTrade ? (selectedLedgerTrade.pnl >= 0 ? "green" : "red") : "amber"}
                            label={selectedLedgerTrade?.id ?? "No trade selected"}
                          />
                        }
                      >
                        {selectedLedgerTrade ? (
                          <TradeReplay trade={selectedLedgerTrade} />
                        ) : (
                          <EmptyState
                            title="No replay available"
                            detail="Change the dataset scope or time range to select a trade replay."
                          />
                        )}
                      </Panel>

                      <Panel
                        title="Trade Ledger"
                        eyebrow={`${activeScopeDetailLabel} in selected range / ${rangeDetail}`}
                        action={
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <TimeRangeSelector activeRange={activeRange} onChange={setActiveRange} />
                            <StatusBadge tone="cyan" label={`${ledgerTrades.length} trades`} />
                          </div>
                        }
                      >
                        <TradeLedger trades={ledgerTrades} selectedTrade={selectedLedgerTrade} onSelect={setSelectedTrade} />
                      </Panel>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className={cn("space-y-5 transition", previewLocked && "pointer-events-none select-none opacity-35 grayscale")}>
                <Panel title="Trader Discipline Rating" eyebrow="Composite score engine">
                  <div className="flex items-center gap-5">
                    <ScoreDial score={discipline.overall} label={hasScopedTrades ? `${discipline.overall}` : "No sample"} />
                    <div className="min-w-0 flex-1 space-y-3">
                      <DiagnosticLine
                        label="Risk management"
                        value={hasScopedTrades ? `${discipline.riskManagement}` : "No sample"}
                        progress={discipline.riskManagement}
                        tone="green"
                      />
                      <DiagnosticLine
                        label="Stop respect"
                        value={hasScopedTrades ? `${discipline.stopRespect}` : "No sample"}
                        progress={discipline.stopRespect}
                        tone="cyan"
                      />
                      <DiagnosticLine
                        label="Emotional control"
                        value={hasScopedTrades ? `${discipline.emotionalControl}` : "No sample"}
                        progress={discipline.emotionalControl}
                        tone="amber"
                      />
                      <DiagnosticLine
                        label="Consistency"
                        value={hasScopedTrades ? `${discipline.consistency}` : "No sample"}
                        progress={discipline.consistency}
                        tone="green"
                      />
                    </div>
                  </div>
                </Panel>

                <Panel
                  title="AI Trade Coach"
                  eyebrow="Ask questions against trade history"
                  action={<StatusBadge tone="cyan" label="Memory enabled" />}
                >
                  <div className="flex h-[420px] flex-col">
                    <div className="scrollbar-thin flex-1 space-y-3 overflow-y-auto pr-1">
                      {coachMessages.map((message, index) => (
                        <motion.div
                          key={`${message.role}-${index}-${message.content.slice(0, 12)}`}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={cn(
                            "rounded-md border px-3 py-3 text-sm leading-6",
                            message.role === "ai"
                              ? "border-signal-cyan/20 bg-signal-cyan/[0.08] text-zinc-200"
                              : "ml-8 border-white/10 bg-white/[0.04] text-zinc-300"
                          )}
                        >
                          <div className="mb-2 flex items-center gap-2 text-xs uppercase text-zinc-500">
                            {message.role === "ai" ? <Bot className="size-3.5" /> : <MessageSquareText className="size-3.5" />}
                            {message.role === "ai" ? "Coach" : "You"}
                          </div>
                          {message.content}
                        </motion.div>
                      ))}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {promptChips.map((prompt) => (
                        <button
                          key={prompt}
                          onClick={() => handleCoachSubmit(undefined, prompt)}
                          className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400 transition hover:border-signal-cyan/50 hover:text-white"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>

                    <form onSubmit={handleCoachSubmit} className="mt-3 flex gap-2">
                      <input
                        value={coachInput}
                        onChange={(event) => setCoachInput(event.target.value)}
                        placeholder="Ask about performance, psychology, or risk"
                        className="min-w-0 flex-1 rounded-md border border-white/10 bg-base-900 px-3 py-2.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-signal-cyan/60"
                      />
                      <button className="rounded-md bg-signal-cyan px-4 py-2.5 text-sm font-semibold text-base-950 transition hover:bg-white">
                        Ask
                      </button>
                    </form>
                  </div>
                </Panel>

                <Panel title="AI Session Review" eyebrow="Generated after close">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="grid size-9 shrink-0 place-items-center rounded-md border border-signal-amber/30 bg-signal-amber/10 text-signal-amber">
                        <Zap className="size-4" />
                      </div>
                      <p className="text-sm leading-6 text-zinc-300">
                        {sessionReview}
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <MiniStat label="Best setup" value={strategies[0]?.name ?? "None"} />
                      <MiniStat label="Worst window" value={weakestSession?.name ?? "None"} />
                      <MiniStat label="Risk cap" value={activeScope === "FUTURES" ? "Contracts" : "3%"} />
                    </div>
                  </div>
                </Panel>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function SegmentedNav({ activeView, onChange }: { activeView: ActiveView; onChange: (view: ActiveView) => void }) {
  return (
    <div className="flex flex-wrap gap-2 rounded-md border border-white/10 bg-white/[0.03] p-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            className={cn(
              "relative flex items-center gap-2 rounded px-3 py-2 text-sm transition",
              activeView === item.id ? "text-base-950" : "text-zinc-400 hover:text-white"
            )}
          >
            {activeView === item.id && (
              <motion.span
                layoutId="active-view"
                className="absolute inset-0 rounded bg-white"
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
              />
            )}
            <span className="relative flex items-center gap-2">
              <Icon className="size-4" />
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function TimeRangeSelector({
  activeRange,
  onChange
}: {
  activeRange: TimeRange;
  onChange: (range: TimeRange) => void;
}) {
  return (
    <div className="flex rounded-md border border-white/10 bg-base-900/80 p-1">
      {timeRangeOptions.map((option) => (
        <button
          key={option.id}
          onClick={() => onChange(option.id)}
          className={cn(
            "relative min-w-10 rounded px-2.5 py-1.5 text-xs font-medium transition",
            activeRange === option.id ? "text-base-950" : "text-zinc-500 hover:text-white"
          )}
        >
          {activeRange === option.id && (
            <motion.span
              layoutId="active-time-range"
              className="absolute inset-0 rounded bg-signal-green"
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
            />
          )}
          <span className="relative">{option.label}</span>
        </button>
      ))}
    </div>
  );
}

function TradeScopeSelector({
  activeScope,
  counts,
  onChange
}: {
  activeScope: TradeScope;
  counts: Record<TradeScope, number>;
  onChange: (scope: TradeScope) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-white/10 bg-base-900/80 p-1.5">
      <span className="px-2 text-[11px] uppercase tracking-[0.18em] text-zinc-500">Dataset</span>
      <div className="flex flex-wrap gap-1">
        {tradeScopeOptions.map((option) => (
          <button
            key={option.id}
            onClick={() => onChange(option.id)}
            title={option.detail}
            className={cn(
              "relative rounded px-3 py-2 text-left text-xs transition sm:min-w-[112px]",
              activeScope === option.id ? "text-base-950" : "text-zinc-400 hover:text-white"
            )}
          >
            {activeScope === option.id && (
              <motion.span
                layoutId="active-trade-scope"
                className="absolute inset-0 rounded bg-signal-cyan"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative flex items-center justify-between gap-3">
              <span className="font-semibold">{option.label}</span>
              <span className={cn("text-[11px]", activeScope === option.id ? "text-base-950/70" : "text-zinc-600")}>
                {counts[option.id]}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Panel({
  title,
  eyebrow,
  action,
  children
}: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel-shell">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          {eyebrow && <p className="text-xs uppercase text-zinc-500">{eyebrow}</p>}
          <h3 className="mt-1 text-lg font-semibold text-zinc-100">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function MetricTile({
  label,
  value,
  detail,
  icon: Icon,
  trend,
  calculation,
  onOpenCalculation
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Activity;
  trend: MetricTrend;
  calculation?: MetricCalculation;
  onOpenCalculation?: (calculation: MetricCalculation) => void;
}) {
  const isPositive = trend === "up";
  const isNegative = trend === "down";

  return (
    <button
      type="button"
      onClick={() => calculation && onOpenCalculation?.(calculation)}
      className="panel-shell group w-full p-4 text-left outline-none transition hover:border-white/20 focus-visible:border-signal-cyan/60 focus-visible:ring-2 focus-visible:ring-signal-cyan/20"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs uppercase text-zinc-500">
            {label}
            {calculation && <Info className="size-3.5 text-zinc-600 transition group-hover:text-signal-cyan" />}
          </p>
          <p className="mt-2 text-2xl font-semibold text-zinc-50">{value}</p>
          <p className="mt-1 text-sm text-zinc-500">{detail}</p>
        </div>
        <div
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-md border",
            isPositive && "border-signal-green/25 bg-signal-green/10 text-signal-green",
            isNegative && "border-signal-red/25 bg-signal-red/10 text-signal-red",
            trend === "neutral" && "border-white/10 bg-white/[0.04] text-zinc-500"
          )}
        >
          <Icon className="size-5" />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-xs">
        <span className="flex items-center gap-2">
          {isPositive && <ArrowUpRight className="size-4 text-signal-green" />}
          {isNegative && <ArrowDownRight className="size-4 text-signal-red" />}
          {trend === "neutral" && <Info className="size-4 text-zinc-500" />}
          <span
            className={cn(
              isPositive && "text-signal-green",
              isNegative && "text-signal-red",
              trend === "neutral" && "text-zinc-500"
            )}
          >
            {isPositive ? "Improving" : isNegative ? "Needs control" : "No sample"}
          </span>
        </span>
        <span className="text-zinc-600 transition group-hover:text-zinc-400">Formula</span>
      </div>
    </button>
  );
}

function PreviewGateBanner({ onImport }: { onImport: () => void }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="relative overflow-hidden rounded-md border border-signal-cyan/20 bg-base-900/92 p-4 shadow-terminal"
    >
      <div className="absolute inset-y-0 left-0 w-1 bg-signal-cyan" />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="grid size-11 shrink-0 place-items-center rounded-md border border-signal-cyan/30 bg-signal-cyan/10 text-signal-cyan">
            <Upload className="size-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-semibold text-zinc-50">Connect trade history to activate analytics</p>
              <span className="rounded-full border border-signal-amber/25 bg-signal-amber/10 px-2.5 py-1 text-[11px] text-signal-amber">
                Preview locked
              </span>
            </div>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-400">
              The dashboard is muted until a CSV is imported, so performance, psychology, and AI coaching are based on
              your real trades.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="grid grid-cols-3 gap-2 text-center">
            {["PnL", "Discipline", "Coach"].map((item) => (
              <div key={item} className="min-w-[84px] rounded-md border border-white/10 bg-white/[0.03] px-3 py-2">
                <p className="text-[11px] uppercase text-zinc-500">{item}</p>
                <p className="mt-1 text-xs text-zinc-300">Paused</p>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={onImport}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-signal-green px-4 text-sm font-semibold text-base-950 transition hover:bg-white"
          >
            <Upload className="size-4" />
            Import CSV
          </button>
        </div>
      </div>
    </motion.section>
  );
}

function CalculationPopup({ info, onClose }: { info: MetricCalculation; onClose: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-center bg-black/45 px-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <button type="button" aria-label="Close calculation details" className="absolute inset-0 cursor-default" onClick={onClose} />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={`${info.title} calculation`}
        className="relative w-full max-w-[430px] rounded-md border border-white/12 bg-base-900 p-5 shadow-terminal"
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ duration: 0.18 }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-signal-cyan">Calculation</p>
            <h4 className="mt-1 text-lg font-semibold text-zinc-50">{info.title}</h4>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 shrink-0 place-items-center rounded-md border border-white/10 text-zinc-500 transition hover:border-white/25 hover:text-white"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>
        <p className="mt-3 text-sm leading-6 text-zinc-400">{info.description}</p>
        <div className="mt-4 rounded-md border border-white/10 bg-base-950/80 p-3">
          <p className="text-[11px] uppercase text-zinc-500">Formula</p>
          <p className="mt-1 text-sm font-medium text-zinc-100">{info.formula}</p>
        </div>
        <div className="mt-4 space-y-2">
          {info.inputs.map((input) => (
            <div key={input} className="flex items-start gap-2 text-sm text-zinc-400">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-signal-cyan" />
              <span>{input}</span>
            </div>
          ))}
        </div>
        {info.note && <p className="mt-4 text-xs leading-5 text-zinc-500">{info.note}</p>}
      </motion.div>
    </motion.div>
  );
}

function StatusBadge({ label, tone }: { label: string; tone: "green" | "cyan" | "amber" | "red" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs",
        tone === "green" && "border-signal-green/25 bg-signal-green/10 text-signal-green",
        tone === "cyan" && "border-signal-cyan/25 bg-signal-cyan/10 text-signal-cyan",
        tone === "amber" && "border-signal-amber/25 bg-signal-amber/10 text-signal-amber",
        tone === "red" && "border-signal-red/25 bg-signal-red/10 text-signal-red"
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

function InsightRow({ insight }: { insight: ReturnType<typeof detectInsights>[number] }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-3 transition hover:border-white/20">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px]",
                insight.severity === "critical" && "bg-signal-red/10 text-signal-red",
                insight.severity === "warning" && "bg-signal-amber/10 text-signal-amber",
                insight.severity === "positive" && "bg-signal-green/10 text-signal-green"
              )}
            >
              {insight.category}
            </span>
            <span className="text-xs text-zinc-500">{insight.metric}</span>
          </div>
          <p className="mt-2 text-sm font-semibold text-zinc-100">{insight.title}</p>
          <p className="mt-1 text-sm leading-6 text-zinc-500">{insight.detail}</p>
        </div>
        <LineChartIcon className="mt-1 size-4 shrink-0 text-zinc-600" />
      </div>
    </div>
  );
}

function EmotionRow({ emotion }: { emotion: ReturnType<typeof calculateEmotionStats>[number] }) {
  const strength = Math.min(100, Math.abs(emotion.pnl) / 18);
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-zinc-100">{emotion.emotion}</p>
          <p className="text-xs text-zinc-500">
            {emotion.trades} trades / {formatPercent(emotion.winRate)} win rate / {emotion.expectancy.toFixed(2)}R
          </p>
        </div>
        <span className={cn("text-sm font-semibold", emotion.pnl >= 0 ? "text-signal-green" : "text-signal-red")}>
          {formatCurrency(emotion.pnl)}
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className={cn("h-full rounded-full", emotion.pnl >= 0 ? "bg-signal-green" : "bg-signal-red")}
          style={{ width: `${Math.max(8, strength)}%` }}
        />
      </div>
    </div>
  );
}

function BehaviorIndicatorTile({ indicator }: { indicator: ReturnType<typeof buildBehaviorIndicators>[number] }) {
  const hasScore = indicator.value !== "No sample" && indicator.label !== "No behavior sample";

  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-zinc-100">{indicator.label}</p>
          <p
            className={cn(
              "mt-2 text-2xl font-semibold",
              indicator.tone === "green" && "text-signal-green",
              indicator.tone === "cyan" && "text-signal-cyan",
              indicator.tone === "amber" && "text-signal-amber",
              indicator.tone === "red" && "text-signal-red"
            )}
          >
            {indicator.value}
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-base-900 px-2 py-1 text-xs text-zinc-500">
          {hasScore ? indicator.score.toFixed(0) : "N/A"}
        </span>
      </div>
      <p className="mt-3 text-xs leading-5 text-zinc-500">{indicator.detail}</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className={cn(
            "h-full rounded-full",
            indicator.tone === "green" && "bg-signal-green",
            indicator.tone === "cyan" && "bg-signal-cyan",
            indicator.tone === "amber" && "bg-signal-amber",
            indicator.tone === "red" && "bg-signal-red"
          )}
          style={{ width: hasScore ? `${Math.max(6, indicator.score)}%` : "0%" }}
        />
      </div>
    </div>
  );
}

function ScopeHealthStrip({
  items
}: {
  items: ScopeHealthItem[];
}) {
  return (
    <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-md border border-white/10 bg-base-900/70 px-3 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase text-zinc-500">{item.label}</p>
              <p
                className={cn(
                  "mt-1 truncate text-sm font-semibold",
                  item.tone === "green" && "text-signal-green",
                  item.tone === "amber" && "text-signal-amber",
                  item.tone === "red" && "text-signal-red"
                )}
              >
                {item.value}
              </p>
            </div>
            <span
              className={cn(
                "mt-1 size-2 rounded-full",
                item.tone === "green" && "bg-signal-green",
                item.tone === "amber" && "bg-signal-amber",
                item.tone === "red" && "bg-signal-red"
              )}
            />
          </div>
          <p className="mt-2 text-xs leading-5 text-zinc-500">{item.detail}</p>
        </div>
      ))}
    </div>
  );
}

function StrategyRecommendationCard({
  recommendation
}: {
  recommendation: ReturnType<typeof buildStrategyRecommendations>[number];
}) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-zinc-100">{recommendation.title}</p>
          <p className="mt-2 text-sm leading-6 text-zinc-400">{recommendation.detail}</p>
        </div>
        <span
          className={cn(
            "mt-0.5 size-2.5 shrink-0 rounded-full",
            recommendation.tone === "green" && "bg-signal-green",
            recommendation.tone === "cyan" && "bg-signal-cyan",
            recommendation.tone === "amber" && "bg-signal-amber",
            recommendation.tone === "red" && "bg-signal-red"
          )}
        />
      </div>
      <div className="mt-4 rounded-md border border-white/10 bg-base-900/80 p-3">
        <p className="text-[11px] uppercase text-zinc-500">Rule</p>
        <p className="mt-1 text-sm leading-6 text-zinc-200">{recommendation.rule}</p>
      </div>
      <p className="mt-3 text-xs leading-5 text-zinc-500">{recommendation.impact}</p>
    </div>
  );
}

function DiagnosticLine({
  label,
  value,
  helper,
  progress,
  tone
}: {
  label: string;
  value: string;
  helper?: string;
  progress: number;
  tone: "green" | "cyan" | "amber" | "red";
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-zinc-400">{label}</span>
        <span className="font-semibold text-zinc-100">{value}</span>
      </div>
      {helper && <p className="mt-1 text-xs text-zinc-500">{helper}</p>}
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className={cn(
            "h-full rounded-full",
            tone === "green" && "bg-signal-green",
            tone === "cyan" && "bg-signal-cyan",
            tone === "amber" && "bg-signal-amber",
            tone === "red" && "bg-signal-red"
          )}
          style={{ width: `${Math.max(6, Math.min(100, progress))}%` }}
        />
      </div>
    </div>
  );
}

function ScoreDial({ score, label }: { score: number; label?: string }) {
  const displayLabel = label ?? `${score}`;
  const hasScore = displayLabel !== "No sample";

  return (
    <div
      className="relative grid size-32 shrink-0 place-items-center rounded-full"
      style={{ background: `conic-gradient(${hasScore ? "#4dff88" : "rgba(255,255,255,0.16)"} ${score * 3.6}deg, rgba(255,255,255,0.08) 0deg)` }}
    >
      <div className="grid size-[104px] place-items-center rounded-full border border-white/10 bg-base-900">
        <div className="text-center">
          <p className={cn("font-semibold text-zinc-50", hasScore ? "text-3xl" : "px-3 text-sm")}>{displayLabel}</p>
          <p className="text-[11px] uppercase text-zinc-500">Score</p>
        </div>
      </div>
    </div>
  );
}

function TradeLedger({
  trades,
  selectedTrade,
  onSelect
}: {
  trades: Trade[];
  selectedTrade?: Trade;
  onSelect: (trade: Trade) => void;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-white/10 bg-base-900/70">
      <div className="scrollbar-thin max-h-[460px] overflow-auto">
        <div className="min-w-[920px]">
          <div className="sticky top-0 z-10 grid grid-cols-[126px_70px_84px_104px_minmax(180px,1fr)_96px_124px_104px] gap-3 border-b border-white/10 bg-base-900 px-3 py-2.5 text-[11px] uppercase text-zinc-500">
            <span>Date</span>
            <span>Time</span>
            <span>Ticker</span>
            <span>Asset</span>
            <span>Setup</span>
            <span>Session</span>
            <span>Psychology</span>
            <span className="text-right">PnL</span>
          </div>

          <div className="divide-y divide-white/10">
            {trades.length ? (
              trades.map((trade) => {
                const isSelected = selectedTrade?.id === trade.id;

                return (
                  <button
                    key={trade.id}
                    onClick={() => onSelect(trade)}
                    className={cn(
                      "grid w-full grid-cols-[126px_70px_84px_104px_minmax(180px,1fr)_96px_124px_104px] gap-3 px-3 py-3 text-left text-sm transition",
                      isSelected ? "bg-signal-green/10 text-zinc-50" : "text-zinc-300 hover:bg-white/[0.04]"
                    )}
                  >
                    <span className="font-medium text-zinc-200">{formatTradeDate(trade.date)}</span>
                    <span className="text-zinc-500">{trade.time}</span>
                    <span className="font-semibold text-zinc-100">{trade.ticker}</span>
                    <span className="inline-flex w-fit items-center rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] text-zinc-400">
                      {trade.assetType}
                    </span>
                    <span className="truncate text-zinc-400">
                      {trade.side} / {trade.setup}
                    </span>
                    <span className="text-zinc-500">{trade.session}</span>
                    <span className="truncate text-zinc-500">{trade.emotionTags.join(", ")}</span>
                    <span className={cn("text-right font-semibold", trade.pnl >= 0 ? "text-signal-green" : "text-signal-red")}>
                      {formatCurrency(trade.pnl)}
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="p-4">
                <EmptyState title="No trades in this view" detail="Switch dataset scope or expand the time range." />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TradeReplay({ trade }: { trade: Trade }) {
  const favorable = trade.pnl >= 0;
  const adherenceTone = trade.ruleAdherence >= 75 ? "green" : trade.ruleAdherence >= 55 ? "amber" : "red";

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_310px]">
      <div className="relative min-h-[330px] overflow-hidden rounded-md border border-white/10 bg-base-900">
        <div className="absolute inset-0 replay-grid" />
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 900 360" preserveAspectRatio="none" aria-hidden="true">
          <path
            d={
              favorable
                ? "M0 245 C110 230 150 215 220 225 C295 238 330 170 410 172 C500 174 540 112 635 118 C725 124 760 72 900 74"
                : "M0 118 C120 120 145 160 230 150 C305 142 335 205 420 198 C515 188 540 258 630 250 C720 242 770 300 900 310"
            }
            fill="none"
            stroke={favorable ? "#4dff88" : "#ff5f73"}
            strokeWidth="4"
          />
          <path
            d="M0 188 C120 188 190 190 280 186 C390 180 500 186 620 184 C740 182 810 180 900 176"
            fill="none"
            stroke="#4ad8ff"
            strokeDasharray="10 10"
            strokeWidth="2"
            opacity="0.8"
          />
        </svg>
        <div className="absolute left-[16%] top-[55%] rounded-md border border-signal-cyan/30 bg-signal-cyan/10 px-3 py-2 text-xs text-signal-cyan">
          Entry {trade.entryPrice}
        </div>
        <div
          className={cn(
            "absolute right-[12%] rounded-md border px-3 py-2 text-xs",
            favorable
              ? "top-[18%] border-signal-green/30 bg-signal-green/10 text-signal-green"
              : "bottom-[10%] border-signal-red/30 bg-signal-red/10 text-signal-red"
          )}
        >
          Exit {trade.exitPrice}
        </div>
        <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2">
          {trade.emotionTags.map((tag) => (
            <span key={tag} className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-zinc-300">
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-xs uppercase text-zinc-500">{trade.ticker}</p>
          <h4 className="mt-1 text-2xl font-semibold text-zinc-50">{trade.setup}</h4>
          <p className="mt-2 text-sm leading-6 text-zinc-400">{trade.notes}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <MiniStat label="PnL" value={formatCurrency(trade.pnl)} tone={favorable ? "green" : "red"} />
          <MiniStat label="R multiple" value={`${trade.rMultiple.toFixed(2)}R`} tone={favorable ? "green" : "red"} />
          <MiniStat label="Risk" value={`${trade.riskPercent}%`} />
          <MiniStat label="Duration" value={`${trade.durationMinutes}m`} />
        </div>
        <DiagnosticLine label="Rule adherence" value={`${trade.ruleAdherence}`} progress={trade.ruleAdherence} tone={adherenceTone} />
        <DiagnosticLine
          label="Planned vs actual risk"
          value={`${formatCurrency(trade.plannedRisk)} / ${formatCurrency(trade.actualRisk)}`}
          progress={Math.min(100, (trade.plannedRisk / Math.max(trade.actualRisk, 1)) * 100)}
          tone={trade.actualRisk <= trade.plannedRisk * 1.1 ? "green" : "red"}
        />
      </div>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: "green" | "red" }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-3">
      <p className="text-[11px] uppercase text-zinc-500">{label}</p>
      <p
        className={cn(
          "mt-1 truncate text-sm font-semibold text-zinc-100",
          tone === "green" && "text-signal-green",
          tone === "red" && "text-signal-red"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="grid h-full min-h-[180px] place-items-center rounded-md border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center">
      <div>
        <LineChartIcon className="mx-auto size-5 text-zinc-600" />
        <p className="mt-3 text-sm font-semibold text-zinc-200">{title}</p>
        <p className="mt-1 max-w-sm text-xs leading-5 text-zinc-500">{detail}</p>
      </div>
    </div>
  );
}

function ImportCsvPrompt({ onImport }: { onImport: () => void }) {
  return (
    <div className="absolute inset-0 grid place-items-center rounded-md bg-base-950/62 px-4 backdrop-blur-[3px]">
      <div className="w-full max-w-[430px] overflow-hidden rounded-md border border-white/15 bg-base-900/95 text-left shadow-terminal">
        <div className="border-b border-white/10 bg-white/[0.035] px-5 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Preview mode</span>
            <span className="rounded-full border border-signal-amber/25 bg-signal-amber/10 px-2.5 py-1 text-[11px] text-signal-amber">
              CSV required
            </span>
          </div>
        </div>
        <div className="p-5">
          <div className="flex items-start gap-4">
            <div className="grid size-12 shrink-0 place-items-center rounded-md border border-signal-cyan/30 bg-signal-cyan/10 text-signal-cyan">
              <Upload className="size-5" />
            </div>
            <div>
              <p className="text-lg font-semibold text-zinc-50">Import your trade CSV</p>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Analytics are muted until real trade history is connected. Upload a broker export to unlock performance,
                psychology, and coaching.
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {["PnL", "Behavior", "Coach"].map((item) => (
              <div key={item} className="rounded-md border border-white/10 bg-base-950/70 px-3 py-2 text-center">
                <p className="text-[11px] uppercase text-zinc-500">{item}</p>
                <p className="mt-1 text-xs text-zinc-300">Locked</p>
              </div>
            ))}
          </div>
          <button
            onClick={onImport}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-signal-green px-4 py-2.5 text-sm font-semibold text-base-950 transition hover:bg-white"
          >
            <Upload className="size-4" />
            Import CSV
          </button>
        </div>
      </div>
    </div>
  );
}

type ChartPayload = {
  dataKey: string;
  name: string;
  value: number | string;
  color?: string;
  fill?: string;
  payload?: {
    discipline?: number;
    equity?: number;
    pnl?: number;
  };
};

function EquityChartTooltip({
  active,
  payload,
  label
}: {
  active?: boolean;
  payload?: ChartPayload[];
  label?: string;
}) {
  const point = payload?.find((item) => item.payload?.equity !== undefined)?.payload;
  if (!active || !point) return null;

  const isPositive = (point.equity ?? 0) >= 0;

  return (
    <div className="rounded-md border border-white/10 bg-base-900 px-3 py-2 text-xs shadow-terminal">
      <p className="mb-1 text-zinc-400">{label}</p>
      <p className={cn("font-semibold", isPositive ? "text-signal-green" : "text-signal-red")}>
        Equity: {formatCurrency(point.equity ?? 0)}
      </p>
      <p className="mt-1 text-zinc-400">Day PnL: {formatCurrency(point.pnl ?? 0)}</p>
      <p className="text-zinc-400">Discipline: {(point.discipline ?? 0).toFixed(0)}</p>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  valuePrefix = ""
}: {
  active?: boolean;
  payload?: ChartPayload[];
  label?: string;
  valuePrefix?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-md border border-white/10 bg-base-900 px-3 py-2 text-xs shadow-terminal">
      <p className="mb-1 text-zinc-400">{label}</p>
      {payload.map((item) => (
        <p key={item.dataKey} className="font-semibold" style={{ color: item.color || item.fill }}>
          {item.name}: {valuePrefix}
          {Number(item.value).toLocaleString()}
        </p>
      ))}
    </div>
  );
}

function formatProfitFactor(summary: ReturnType<typeof calculateSummary>) {
  if (!summary.totalTrades) return "No sample";
  if (!summary.grossLoss) return "No losses";
  return summary.profitFactor.toFixed(2);
}

function formatRevengeLossShareValue(summary: ReturnType<typeof calculateSummary>) {
  if (!summary.totalTrades) return "No sample";
  if (!summary.grossLoss) return "No losses";
  if (!summary.revengeLossAmount) return "None";
  return formatPercent(summary.revengeLossShare);
}

function buildZeroPlaneCurve(points: ReturnType<typeof buildEquityCurve>) {
  const curve: Array<(typeof points)[number] & { negativeEquity: number | null; positiveEquity: number | null }> = [];

  points.forEach((point, index) => {
    const previous = points[index - 1];

    if (previous && previous.equity !== 0 && point.equity !== 0 && Math.sign(previous.equity) !== Math.sign(point.equity)) {
      curve.push({
        ...point,
        label: "Zero",
        equity: 0,
        pnl: 0,
        negativeEquity: 0,
        positiveEquity: 0
      });
    }

    curve.push({
      ...point,
      negativeEquity: point.equity <= 0 ? point.equity : null,
      positiveEquity: point.equity >= 0 ? point.equity : null
    });
  });

  return curve;
}

function buildScopeCounts(trades: Trade[]): Record<TradeScope, number> {
  return {
    ALL: trades.length,
    FUTURES: trades.filter((trade) => trade.assetType === "Futures").length,
    POSITIONS: trades.filter((trade) => trade.assetType !== "Futures").length
  };
}

function filterTradesByScope(trades: Trade[], scope: TradeScope) {
  if (scope === "FUTURES") {
    return trades.filter((trade) => trade.assetType === "Futures");
  }

  if (scope === "POSITIONS") {
    return trades.filter((trade) => trade.assetType !== "Futures");
  }

  return trades;
}

function filterTradesByRange(trades: Trade[], range: TimeRange) {
  const option = timeRangeOptions.find((item) => item.id === range);
  const sortedTrades = [...trades].sort((a, b) => tradeTime(a) - tradeTime(b));

  if (!option?.days || !sortedTrades.length) {
    return sortedTrades;
  }

  const latestTime = Math.max(...sortedTrades.map(tradeTime));
  const startTime = latestTime - (option.days - 1) * 24 * 60 * 60 * 1000;

  return sortedTrades.filter((trade) => tradeTime(trade) >= startTime);
}

function formatRangeDetail(trades: Trade[]) {
  if (!trades.length) return "No trades in window";

  const sortedTrades = [...trades].sort((a, b) => tradeTime(a) - tradeTime(b));
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });

  return `${formatter.format(new Date(`${sortedTrades[0].date}T12:00:00`))} - ${formatter.format(
    new Date(`${sortedTrades[sortedTrades.length - 1].date}T12:00:00`)
  )}`;
}

function formatTradeDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(`${date}T12:00:00`));
}

function tradeTime(trade: Trade) {
  return new Date(`${trade.date}T${trade.time || "12:00"}`).getTime();
}
