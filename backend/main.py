from __future__ import annotations

import os
from datetime import date, datetime
from typing import Literal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

try:
    from openai import OpenAI
except ImportError:  # pragma: no cover
    OpenAI = None


Emotion = Literal[
    "Fear",
    "FOMO",
    "Revenge",
    "Hesitation",
    "Greed",
    "Confidence",
    "Tilt",
    "Impulsive",
    "Disciplined",
]


class TradeIn(BaseModel):
    ticker: str
    asset_type: str = "Equity"
    setup: str
    pnl: float
    risk_percent: float = Field(ge=0, le=100)
    r_multiple: float = 0
    trade_date: date
    trade_time: str = "10:00"
    emotion_tags: list[Emotion] = ["Disciplined"]
    notes: str = ""
    stop_respected: bool = True
    rule_adherence: int = Field(default=75, ge=0, le=100)
    confidence: int = Field(default=6, ge=1, le=10)
    stress: int = Field(default=4, ge=1, le=10)
    sleep: int = Field(default=7, ge=1, le=10)
    focus: int = Field(default=7, ge=1, le=10)


class PsychologyLogIn(BaseModel):
    confidence: int = Field(ge=1, le=10)
    stress: int = Field(ge=1, le=10)
    sleep: int = Field(ge=1, le=10)
    focus: int = Field(ge=1, le=10)
    emotional_state: Emotion
    journal: str = ""


class CoachRequest(BaseModel):
    question: str
    trades: list[TradeIn]
    psychology_logs: list[PsychologyLogIn] = []


app = FastAPI(
    title="EdgePilot AI API",
    version="0.1.0",
    description="Behavioral analytics, discipline scoring, and AI coaching endpoints for active traders.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "edgepilot-api"}


@app.post("/analytics/summary")
def analytics_summary(trades: list[TradeIn]) -> dict[str, float | int]:
    wins = [trade for trade in trades if trade.pnl > 0]
    losses = [trade for trade in trades if trade.pnl < 0]
    gross_profit = sum(trade.pnl for trade in wins)
    gross_loss = abs(sum(trade.pnl for trade in losses))

    return {
        "total_trades": len(trades),
        "net_pnl": sum(trade.pnl for trade in trades),
        "win_rate": (len(wins) / len(trades) * 100) if trades else 0,
        "profit_factor": (gross_profit / gross_loss) if gross_loss else gross_profit,
        "avg_r": (sum(trade.r_multiple for trade in trades) / len(trades)) if trades else 0,
        "stop_respect_rate": (
            len([trade for trade in trades if trade.stop_respected]) / len(trades) * 100
        )
        if trades
        else 0,
    }


@app.post("/analytics/discipline-score")
def discipline_score(trades: list[TradeIn]) -> dict[str, int | str]:
    if not trades:
        return {"overall": 0, "label": "No data"}

    stop_score = len([trade for trade in trades if trade.stop_respected]) / len(trades) * 100
    rule_score = sum(trade.rule_adherence for trade in trades) / len(trades)
    revenge_rate = (
        len([trade for trade in trades if "Revenge" in trade.emotion_tags]) / len(trades) * 100
    )
    fomo_rate = len([trade for trade in trades if "FOMO" in trade.emotion_tags]) / len(trades) * 100
    risk_score = max(0, 100 - max(0, (sum(trade.risk_percent for trade in trades) / len(trades) - 3)) * 18)
    emotional_control = max(0, 100 - revenge_rate * 1.4 - fomo_rate * 0.7)
    overall = round(
        stop_score * 0.25 + rule_score * 0.25 + risk_score * 0.25 + emotional_control * 0.25
    )

    return {
        "overall": overall,
        "risk_management": round(risk_score),
        "stop_respect": round(stop_score),
        "emotional_control": round(emotional_control),
        "consistency": round(rule_score),
        "label": "Elite control" if overall >= 85 else "Tradable edge" if overall >= 72 else "At risk",
    }


@app.post("/coach/query")
def coach_query(request: CoachRequest) -> dict[str, str | datetime]:
    api_key = os.getenv("OPENAI_API_KEY")

    if api_key and OpenAI:
        client = OpenAI(api_key=api_key)
        trade_context = "\n".join(
            f"{trade.trade_date} {trade.ticker} {trade.setup} pnl={trade.pnl} risk={trade.risk_percent}% emotions={','.join(trade.emotion_tags)} notes={trade.notes}"
            for trade in request.trades[-40:]
        )
        response = client.responses.create(
            model=os.getenv("OPENAI_MODEL", "gpt-4.1-mini"),
            input=[
                {
                    "role": "system",
                    "content": "You are a direct but supportive AI trading psychology coach. Ground every answer in the user's trade history and avoid financial advice.",
                },
                {
                    "role": "user",
                    "content": f"Question: {request.question}\n\nTrade history:\n{trade_context}",
                },
            ],
        )
        answer = response.output_text
    else:
        summary = analytics_summary(request.trades)
        discipline = discipline_score(request.trades)
        answer = (
            f"Based on {summary['total_trades']} trades, net PnL is {summary['net_pnl']:.0f}, "
            f"win rate is {summary['win_rate']:.0f}%, and discipline is {discipline['overall']}/100. "
            "The first coaching priority is to reduce revenge and FOMO trades after losses."
        )

    return {"answer": answer, "generated_at": datetime.utcnow()}


@app.post("/trades/classify")
def classify_trade(trade: TradeIn) -> dict[str, str | float | list[str]]:
    labels: list[str] = []
    if trade.risk_percent > 3.5:
        labels.append("oversized")
    if trade.stress >= 8 and trade.pnl < 0:
        labels.append("tilt-risk")
    if "FOMO" in trade.emotion_tags:
        labels.append("fomo")
    if "Revenge" in trade.emotion_tags:
        labels.append("revenge")
    if trade.stop_respected and trade.rule_adherence >= 80:
        labels.append("disciplined")

    confidence = min(0.96, 0.55 + len(labels) * 0.09)
    return {"ticker": trade.ticker, "labels": labels or ["unclassified"], "confidence": confidence}
