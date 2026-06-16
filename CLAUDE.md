# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Financial data analysis project comparing A-share (新城控股 601155) and HK stock (新城发展 01030). Shows dual Y-axis price charts, market cap ratio, and percentile signals.

## Tech Stack

- **Backend**: Python + AkShare + Flask (CORS enabled)
- **Frontend**: HTML + JavaScript + ECharts 5.4.3
- **Data**: AkShare free API, cached to JSON in `data/` folder

## Commands

```bash
# Start API server (serves static web files too)
python backend/server.py

# Initialize/cache historical data
python backend/data_fetch.py

# Install dependencies
pip install -r requirements.txt
```

## Architecture

```
backend/
├── server.py      # Flask API, serves /api/* endpoints and static web files
└── data_fetch.py  # AkShare data fetching with JSON caching in data/

web/
├── index.html     # Main page (served by Flask at /)
├── js/
│   ├── main.js    # Data loading, ratio/percentile calculation, signal detection
│   └── charts.js  # ECharts dual Y-axis configuration with dataZoom
└── css/style.css  # Dark theme (#1a1a2e background)

data/              # JSON cache for 2-year historical data
```

## API Endpoints

- `GET /api/stock/a/601155` - A-share historical data
- `GET /api/stock/hk/01030` - HK stock historical data
- `GET /api/exchange/hkd` - Historical HKD/CNY exchange rate (SSE data)

## Key Algorithms

**Market Cap Ratio** (in `main.js`):
- `devMarketCapCNY = dev.close * SHARE_CAPITAL.development / exchangeRate`
- `ratio = devMarketCapCNY / (ctrl.close * SHARE_CAPITAL.control)`
- `percentile` = position of current ratio in sorted 3-year window

**Signal Detection** (in `main.js findExtremePeriods()`):
- Threshold = 10th and 90th percentile of all ratios
- Tracks continuous periods where ratio < p10 or > p90

**Exchange Rate** (in `main.js getExchangeRate()`):
- Date-matched from SSE historical data (`stock_sgt_settlement_exchange_rate_sse`)
- Falls back to nearest available date if exact match not found
