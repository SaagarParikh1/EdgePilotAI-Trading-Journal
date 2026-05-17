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
  LineChart as LineChartIcon,
  MessageSquareText,
  PieChart,
  Radar,
  ShieldCheck,
  Sparkles,
  Upload,
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
  const [importStatus, setImportStatus] = useState("Mock broker sync active");
  const [coachInput, setCoachInput] = useState("What is my biggest weakness?");
  const [coachMessages, setCoachMessages] = useState<CoachMessage[]>([
    {
      role: "ai",
      content:
        "I have reviewed the current trade sample. Your strongest edge is the morning trend playbook, while the biggest leak is emotional continuation after a loss."
    }
  ]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    () => [
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
    ],
    [strategies, summary.avgR, summary.maxDrawdown, summary.stopRespectRate]
  );
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

          <nav className="mt-8 space-y-1">
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
            <div className="mt-3 grid grid-cols-2 gap-2">
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
              <span className="rounded-full bg-signal-green/10 px-2 py-1 text-[11px] text-signal-green">Online</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-300">
              Tracking revenge loops, overtrading windows, and risk drift from trade history.
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

              <div className="flex flex-wrap items-center gap-2">
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
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
            >
              <MetricTile
                label="Net PnL"
                value={formatCurrency(summary.netPnl)}
                detail={`${summary.totalTrades} ${tradeCountLabel} / ${activeRangeLabel}`}
                icon={CircleDollarSign}
                trend={summary.netPnl >= 0 ? "up" : "down"}
              />
              <MetricTile
                label="Discipline Score"
                value={`${discipline.overall}`}
                detail={discipline.label}
                icon={ShieldCheck}
                trend={discipline.overall >= 70 ? "up" : "down"}
              />
              <MetricTile
                label="Win Rate"
                value={formatPercent(summary.winRate)}
                detail={`${summary.profitFactor.toFixed(2)} profit factor`}
                icon={Gauge}
                trend={summary.winRate >= 50 ? "up" : "down"}
              />
              <MetricTile
                label="Revenge Loss Share"
                value={formatPercent(summary.revengeLossShare)}
                detail="Primary psychology leak"
                icon={Flame}
                trend={summary.revengeLossShare > 30 ? "down" : "up"}
              />
            </motion.section>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
              <div className="min-w-0 space-y-5">
                <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
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
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <TimeRangeSelector activeRange={activeRange} onChange={setActiveRange} />
                            <StatusBadge
                              tone={summary.bestTrade ? "green" : "amber"}
                              label={summary.bestTrade ? `${formatCurrency(summary.bestTrade.pnl)} best trade` : "No trades"}
                            />
                          </div>
                        }
                      >
                        <div className="h-[320px]">
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
                        <ScopeHealthStrip items={scopeHealthItems} />
                      </Panel>

                      <div className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
                        <Panel title="Behavioral Pattern Detection" eyebrow="Highest signal findings">
                          <div className="space-y-3">
                            {insights.slice(0, 5).map((insight) => (
                              <InsightRow key={insight.title} insight={insight} />
                            ))}
                          </div>
                        </Panel>

                        <Panel title="Session Quality" eyebrow="Time-based performance split">
                          <div className="h-[265px]">
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

              <div className="space-y-5">
                <Panel title="Trader Discipline Rating" eyebrow="Composite score engine">
                  <div className="flex items-center gap-5">
                    <ScoreDial score={discipline.overall} />
                    <div className="min-w-0 flex-1 space-y-3">
                      <DiagnosticLine label="Risk management" value={`${discipline.riskManagement}`} progress={discipline.riskManagement} tone="green" />
                      <DiagnosticLine label="Stop respect" value={`${discipline.stopRespect}`} progress={discipline.stopRespect} tone="cyan" />
                      <DiagnosticLine label="Emotional control" value={`${discipline.emotionalControl}`} progress={discipline.emotionalControl} tone="amber" />
                      <DiagnosticLine label="Consistency" value={`${discipline.consistency}`} progress={discipline.consistency} tone="green" />
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
  trend
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Activity;
  trend: "up" | "down";
}) {
  return (
    <div className="panel-shell p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase text-zinc-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-50">{value}</p>
          <p className="mt-1 text-sm text-zinc-500">{detail}</p>
        </div>
        <div
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-md border",
            trend === "up"
              ? "border-signal-green/25 bg-signal-green/10 text-signal-green"
              : "border-signal-red/25 bg-signal-red/10 text-signal-red"
          )}
        >
          <Icon className="size-5" />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs">
        {trend === "up" ? <ArrowUpRight className="size-4 text-signal-green" /> : <ArrowDownRight className="size-4 text-signal-red" />}
        <span className={trend === "up" ? "text-signal-green" : "text-signal-red"}>
          {trend === "up" ? "Improving" : "Needs control"}
        </span>
      </div>
    </div>
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
          {indicator.score.toFixed(0)}
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
          style={{ width: `${Math.max(6, indicator.score)}%` }}
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

function ScoreDial({ score }: { score: number }) {
  return (
    <div className="relative grid size-32 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(#4dff88 ${score * 3.6}deg, rgba(255,255,255,0.08) 0deg)` }}>
      <div className="grid size-[104px] place-items-center rounded-full border border-white/10 bg-base-900">
        <div className="text-center">
          <p className="text-3xl font-semibold text-zinc-50">{score}</p>
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
