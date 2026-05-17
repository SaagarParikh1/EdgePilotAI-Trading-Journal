# EdgePilot AI

An AI-powered behavioral analytics and performance intelligence platform for active traders.

This MVP is built as a portfolio-grade product surface: trade upload, performance dashboard, psychology tracking, discipline scoring, strategy diagnostics, trade replay, and an AI coach that answers questions from the current trade history.

## Tech Stack

- Next.js, TypeScript, Tailwind CSS
- Framer Motion, Recharts, Lucide icons
- FastAPI backend skeleton
- PostgreSQL schema in `backend/schema.sql`
- OpenAI-ready coach endpoint in `backend/main.py`

## Run The Web App

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Run The API

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Optional environment:

```bash
OPENAI_API_KEY=your_key
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/edgepilot
```

## CSV Import Fields

The front end replaces the demo dataset with the uploaded CSV so mock trades never get mixed into real performance.

For trade-journal exports, it accepts flexible realized PnL headers such as:

```csv
ticker,assetType,side,setup,entry,exit,size,pnl,risk,date,time,emotion,notes,broker
NVDA,Equity,Long,Opening Range Breakout,113.2,116.8,180,648,2.2,2026-05-15,09:42,Disciplined,Waited for volume,ThinkOrSwim
```

For Robinhood-style activity exports without a PnL column, it matches buy/sell rows by ticker and computes realized PnL with FIFO lots from fields like:

```csv
Activity Date,Instrument,Trans Code,Quantity,Amount
2026-01-01,AAPL,Buy,10,"($2,000.00)"
2026-01-08,AAPL,Sell,10,"$1,500.00"
```

Robinhood futures activity is supported through `FUTSWP` rows. These appear as `Futures Inter-Entity Cash Transfer` with no instrument or quantity, so the app treats the `Amount` as a realized futures cash-settlement event and labels it `Futures Cash Settlement`.

For account-value history exports, it derives the performance curve from `portfolio value`, `account value`, `equity`, or `net liquidation` columns. If the file includes a cash-flow column, deposits and withdrawals are adjusted out of the daily delta.

## Product Areas

- Trade import engine with mock broker support
- AI behavioral insight queue
- Daily and weekly discipline scoring model
- Psychology check-ins with emotional correlation analysis
- Strategy expectancy and market-regime diagnostics
- Trade replay view for planned versus actual behavior
- Conversational AI trading coach
