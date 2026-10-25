# Media Buying Desk

A browser app for TV media buying. Load four exports and it shows which channels, dayparts and programmes
deliver, and where a client can push on rate.

Your files never leave the browser. They are parsed on the device and kept in IndexedDB, so a reload keeps them.
The server only serves the app.

## What it reads

| Export | Used for |
|---|---|
| Channel Summary workbook (sheets `Target`, `A1`, `A2`, `A3`) | Channels, day of week, dayparts, the target audience and period |
| Nielsen spend (`Product Group`, `Advertiser`, `Brand`, `Channel`, `Tv (000Rs)`) | Industry view, spend against audience, budget planner |
| Programme TVR and Reach (`Rank, Data Set, Channel, Date, Day, Start, End, Program, Duration, Category, TVR, Total TVR, TVR Share %, Reach, Reach %, Avg Time`) | Programme league, categories, consistency |
| LMRB spots (`Product_Group, Advertiser, Product, Advt_Theme, Ads, Channel, Program, Dd, Mn, Yr, Day, Prog_time, Advt_time, AdPos, TotAds, BrkNo, PosinBrk, AdsinBrk, Lng, Dur, Cost`) | Negotiation desk |

Drop the files on the Data tab in any order. Each is recognised from its columns. Column templates for the
programme and LMRB files are in `public/templates/`.

## Tabs

- **Channels**: reach against share, plus a sortable channel table.
- **Channel profile**: which days and hours deliver for one channel, with a plain-English buying read.
- **Dayparts and prime time**: prime-time dependence and share of voice by daypart.
- **Industry**: category size by channel, spend share against audience share, category over-index, advertisers.
- **Budget planner**: pick a category or advertiser and a budget, get rate asks and a re-mixed plan.
- **Programmes**: programme league, depth against breadth, category strength, consistency.
- **Negotiation desk**: LMRB spots matched to programme airings by channel, date and advert time. Every
  programme is priced per rating point against its channel and slot, then labelled Overpriced, Must buy,
  Value, Cut or Fair, with an estimated saving and what to ask for.

## How the negotiation numbers work

1. A spot is matched to the programme airing on the same channel and date whose start and end contain the advert time.
2. Price is cost per 30 seconds (or per spot, your choice). Cost per rating point is price divided by the airing's TVR.
3. The norm is the median cost per rating point for that channel, split into prime and non-prime.
4. Cost index is a programme's cost per point against that norm (100 is normal).
5. Estimated saving per spot is its cost times the gap to the norm, capped by the largest ask you set.

Cost in the LMRB and spend in the Nielsen file are monitored values, not prices paid. Treat savings as leverage
and replace them with real rates when you have them. The Data tab sets whether LMRB cost is in rupees or rupees 000,
and which hours count as prime time.

## Run locally

```
npm install
npm start        # http://localhost:3000
```

## Deploy on Railway

1. Push this repo to GitHub.
2. In Railway choose New Project, Deploy from GitHub repo, and pick it.
3. Railway detects Node, runs `npm install` and `npm start`, and uses `/healthz` as the health check.
4. Open Settings, Networking, Generate Domain.

No environment variables or database are needed. The server reads `PORT` from Railway.
Because data lives in each user's browser, users must load their own files, and clearing site data removes them.
