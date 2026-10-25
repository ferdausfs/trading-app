# TradeLite — ফ্রি রিয়েল-টাইম ট্রেডিং চার্ট অ্যাপ্লিকেশন

TradingView-এর মতো একটি সম্পূর্ণ ফ্রি চার্টিং অ্যাপ্লিকেশন — **Web (Next.js)** ও **Android (React Native/Expo)** উভয় প্ল্যাটফর্মে কাজ করে। Binance লাইভ মার্কেট ডেটা, Socket.IO রিয়েল-টাইম কমিউনিকেশন এবং EMA / RSI / MACD / Bollinger Bands ইন্ডিকেটর সহ।

## ✨ মূল ফিচার

- **রিয়েল-টাইম ক্যান্ডেলস্টিক চার্ট** — TradingView Lightweight Charts v5 (canvas-based)
- **৪টি কাস্টম ইন্ডিকেটর** — EMA (দ্বৈত লাইন), RSI, MACD (হিস্টোগ্রামসহ), Bollinger Bands — প্যারামিটার কাস্টমাইজযোগ্য
- **মাল্টি-পেইন চার্ট** — মূল পেইনে ক্যান্ডেল+ভলিউম+ওভারলে, আলাদা পেইনে RSI ও MACD
- **লাইভ মার্কেট ডেটা** — Binance public API (API key ছাড়াই, সীমাহীন মার্কেট ডেটা)
- **Socket.IO রিয়েল-টাইম** — একটি upstream Binance WebSocket শেয়ার করে সব ক্লায়েন্টকে broadcast
- **স্মার্ট ফলব্যাক** — রিলে সার্ভার নাগালের বাইরে থাকলে ব্রাউজার সরাসরি Binance WebSocket-এ যায়
- **ওয়াচলিস্ট ও ইন্ডিকেটর সেটিংস** — SQLite (Prisma ORM) তে সংরক্ষিত
- **ডার্ক ট্রেডিং থিম** — বাংলা UI, মোবাইল রেসপনসিভ

## 🏗️ আর্কিটেকচার

```
                    ┌─────────────────────────────────────┐
   ব্রাউজার ────────▶ │  Caddy/গেটওয়ে (একটিমাত্র এক্সটার্নাল পোর্ট)  │
                    └──────┬───────────────────┬──────────┘
                           │                   │ XTransformPort=3003
                           ▼                   ▼
              ┌──────────────────┐   ┌───────────────────────────┐
              │ Next.js 16 (3000)│   │ market-relay Socket.IO    │
              │  • ট্রেডিং UI     │   │ (3003, mini-services/)    │
              │  • REST API রুট  │   │  • Binance WS upstream    │
              │  • Prisma SQLite │   │  • ref-counted streams    │
              └──────┬───────────┘   │  • reconnect + backoff    │
                     │               └──────────┬────────────────┘
                     │ REST (ক্যাশসহ)            │ wss://data-stream.binance.vision
                     ▼                          ▼
              ┌──────────────────────────────────────────┐
              │        Binance Public Market Data API     │
              └──────────────────────────────────────────┘
```

### স্পেসিফিকেশন ম্যাপিং

| মূল স্পেসিফিকেশন | এই প্রজেক্টে বাস্তবায়ন |
|---|---|
| `backend/server.js` (Express + Socket.IO) | `mini-services/market-relay/index.ts` — Socket.IO সার্ভার + Binance WS ম্যানেজার |
| `backend/market-fetcher.js` | `src/lib/binance.ts` — হোস্ট-ফলব্যাক REST ক্লায়েন্ট + TTL ক্যাশ |
| `backend/indicator.js` | `src/lib/indicators.ts` (ওয়েব) + `mobile/src/lib/indicators.js` (মোবাইল, একই সূত্র) |
| `backend/database.js` | `prisma/schema.prisma` — SQLite (WatchlistItem, IndicatorConfig) |
| `backend/routes.js` | `src/app/api/market/klines`, `.../ticker`, `.../watchlist`, `.../indicators` |
| `frontend-web/chart.js` | `src/components/trading/PriceChart.tsx` (Lightweight Charts v5) |
| `frontend-web/socket-client.js` | `src/lib/market-feed.ts` (Socket.IO + Direct-WS ফলব্যাক) |
| `frontend-web/indicators.js` | PriceChart-এর ভিতরেই — series তৈরি/আপডেট/টগল |
| `mobile/` (React Native) | `mobile/` ফোল্ডার — Expo + react-native-svg কাস্টম ক্যান্ডেল চার্ট |

**কেন এক সার্ভিসে Next.js?** Express ব্যাকএন্ড ও স্ট্যাটিক ফ্রন্টএন্ড আলাদা হোস্ট করার বদলে Next.js fullstack বেছে নিয়েছি — এতে API রুট, UI ও ডাটাবেস একসাথে থাকে, ডিপ্লয়মেন্ট সহজ হয় (একটি সার্ভিস), CORS সমস্যা থাকে না। Socket.IO রিয়েল-টাইম লেয়ারটি স্বতন্ত্র mini-service হিসেবে চলে, ফলে মূল স্পেসিফিকেশনের স্থাপত্য অক্ষুণ্ণ থাকে।

## 📁 প্রজেক্ট স্ট্রাকচার

```
├── mini-services/market-relay/     # Socket.IO রিয়েল-টাইম সার্ভিস (পোর্ট 3003)
│   └── index.ts                    # Binance WS upstream + stream ref-counting
├── src/
│   ├── app/
│   │   ├── page.tsx                # মূল ড্যাশবোর্ড
│   │   └── api/
│   │       ├── market/klines/      # হিস্টরিক্যাল ক্যান্ডেল (20s ক্যাশ)
│   │       ├── market/ticker/      # ২৪ঘ টিকার (10s ক্যাশ)
│   │       ├── watchlist/          # ওয়াচলিস্ট CRUD
│   │       └── indicators/         # ইন্ডিকেটর সেটিংস GET/PUT
│   ├── components/trading/         # PriceChart, TopBar, WatchlistPanel, IndicatorPanel, MarketStats
│   ├── hooks/                      # useMarketData, useIndicatorSettings, useWatchlist
│   └── lib/                        # indicators, binance, market-feed, rate-limit, types, format
├── mobile/                         # Expo React Native অ্যাপ
│   ├── App.js                      # Bottom-tab নেভিগেশন
│   └── src/                        # ChartScreen, SettingsScreen, CandleChart (svg), indicators, api
├── prisma/schema.prisma            # SQLite স্কিমা
└── scripts/test-indicators.ts      # ইন্ডিকেটর ম্যাথ টেস্ট (২৯টি assertion)
```

## 🚀 লোকাল ডেভেলপমেন্ট

প্রয়োজন: Node.js 20+ (বা Bun), npm

```bash
# ১. ডিপেন্ডেন্সি
npm install

# ২. ডাটাবেস স্কিমা পুশ
npm run db:push

# ৩. Socket.IO রিলে সার্ভিস (টার্মিনাল ১)
cd mini-services/market-relay && npm install && npm run dev
# ডিফল্ট পোর্ট 3003

# ৪. Next.js অ্যাপ (টার্মিনাল ২)
npm run dev
# http://localhost:3000
```

`.env` ফাইল:

```env
DATABASE_URL=file:./db/custom.db
# Binance মার্কেট ডেটার জন্য কোনো API key লাগে না!
```

### ইন্ডিকেটর ম্যাথ টেস্ট চালান

```bash
bun scripts/test-indicators.ts   # ২৯টি গাণিতিক assertion
```

## 📱 মোবাইল অ্যাপ (Android/iOS)

```bash
cd mobile
npm install
npx expo start          # Expo Go দিয়ে QR স্ক্যান করে সাথে সাথেই টেস্ট
```

**APK বিল্ড (ফ্রি):**

```bash
npm install -g eas-cli
eas login
eas build -p android --profile preview   # EAS ফ্রি টিয়ারে APK বিল্ড
```

> `mobile/src/config.js` এ API_BASE ও SOCKET_URL পরিবর্তন করে নিজের ডিপ্লয়ড সার্ভারে সংযোগ করান। লোকাল টেস্টে Android Emulator হলে `10.0.2.2` ব্যবহার করুন (হোস্টের localhost)।

## ☁️ ডিপ্লয়মেন্ট (সব ফ্রি টিয়ার)

### অপশন A — একটিই সার্ভিস (সবচেয়ে সহজ): Render.com

1. GitHub রিপো তৈরি করে কোড push করুন
2. Render → **New Web Service** → রিপো সংযুক্ত করুন
3. Build: `bun install; bun run build` — একটাই কমান্ড; `postinstall` নিজে থেকেই `prisma generate` চালায়, build-এর শুরুতে `prisma db push` (টেবিল তৈরি) হয় (npm হলে: `npm install && npm run build`)
4. Start: `bun run start` (npm হলে `npm start`) — standalone সার্ভার চালু হয়
5. এনভায়রনমেন্ট ভেরিয়েবল: `DATABASE_URL=file:/opt/render/project/src/db/prod.db` (absolute পাথ সবচেয়ে নির্ভরযোগ্য; relative দিলেও চলবে — অ্যাপ নিজেই ফোল্ডার বানিয়ে নেয়)
6. Render এর ফ্রি প্ল্যানে WebSocket কাজ করে; তবে ১৫ মিনিট নিষ্ক্রিয় থাকলে সার্ভিস ঘুমিয়ে যায় (কোনো ভিজিটর এলে জেগে ওঠে)

> ⚠️ ফ্রি প্ল্যানের ডিস্ক এফেমারাল — প্রতি deploy/restart-এ SQLite ডেটা (ওয়াচলিস্ট, ইন্ডিকেটর সেটিংস) রিসেট হয়। চার্ট ও লাইভ মার্কেট ডেটায় কোনো প্রভাব নেই।
>
> 🛠️ ট্রাবলশুটিং: deploy-এ `Cannot find module '.prisma/client/default'` দেখলে — পুরনো কমিটে `prisma generate` বাদ ছিল; বর্তমান কোডে `postinstall`-এ ঠিক করা আছে। Render-এ **Manual Deploy → Clear build cache & deploy** চালান।

> মোবাইল অ্যাপে `https://your-app.onrender.com` দিয়ে সংযোগ করুন।

### অপশন B — Vercel (UI + API) + আলাদা রিলে হোস্ট

- Next.js অ্যাপ → Vercel ফ্রি (REST API রুটগুলো সার্ভারলেসে চলে)
- `mini-services/market-relay` → Render ফ্রি Web Service (WebSocket দরকার বলে এটি আলাদা নোডে)
- ক্লায়েন্টের `src/lib/market-feed.ts` এ socket URL পরিবর্তন করে রিলে হোস্টে পয়েন্ট করুন

### Cloudflare DNS (ফ্রি)

```
CNAME  app.yourdomain.com  →  your-app.onrender.com
```

## 🔐 সিকিউরিটি

- **API key ছাড়াই চলে** — Binance পাবলিক মার্কেট ডেটায় key প্রয়োজন হয় না; তাই কোনো কী কোডে হার্ডকোড করার ঝুঁকিই নেই
- **ভ্যালিডেশন** — প্রতিটি API রুটে symbol/interval/params যাচাই (zod-শৈলী ম্যানুয়াল ভ্যালিডেটর)
- **Rate limiting** — প্রতি IP-তে স্লাইডিং-উইন্ডো লিমিট (klines: 60/min)
- **.env** — গোপন মান কেবল এনভায়রনমেন্ট ভেরিয়েবলে; `.env` কখনো রিপোতে কমিট করবেন না
- **HTTPS/WSS** — প্রোডাকশনে রিভার্স প্রক্সি (Caddy/Cloudflare) দিয়ে TLS নিশ্চিত করুন
- ⚠️ **গুরুত্বপূর্ণ**: চ্যাটে শেয়ার করা যেকোনো GitHub token সাথে সাথেই revoke করুন (GitHub → Settings → Developer settings → Personal access tokens) — সাধারণ টেক্সটে লিক হওয়া token দিয়ে রিপো দুর্ঘটনার ঝুঁকি থাকে

## ⚡ পারফরম্যান্স কৌশল (বাস্তবায়িত)

| কৌশল | বাস্তবায়ন |
|---|---|
| Incremental রেন্ডার | টিক আপডেটে `series.update()` — শুধু শেষ বার; `setData()` শুধু নতুন বার/প্যারাম পরিবর্তনে |
| টিক থ্রটলিং | WebSocket টিক ২৫০ms ব্যাচে setState (use-market-data.ts) |
| সার্ভার ক্যাশ | klines 20s, ticker 10s TTL — একাধিক ভিজিটর একই REST কল শেয়ার করে |
| একক upstream WS | সব ক্লায়েন্ট এক Binance কানেকশন শেয়ার করে (ref-counting, dynamic SUBSCRIBE/UNSUBSCRIBE) |
| মেমরি সীমা | ক্লায়েন্টে সর্বোচ্চ ১৫০০ বার রাখা হয় |
| হার্ডওয়্যার এক্সিলারেশন | Lightweight Charts নিজেই canvas-এ রেন্ডার করে; CSS `translateZ(0)` হেল্পার globals.css এ |

**Web Worker কেন নয়?** ৫০০ ক্যান্ডেলে ৪টি ইন্ডিকেটরের গণনা <১ms — Worker-এর async জটিলতা (race condition, serialization) এখানে অপ্রয়োজনীয়। ডেটা ৫,০০০+ বার হলে `src/lib/indicators.ts` (pure functions) সরাসরি Worker-এ সরানো যাবে।

## 📐 ইন্ডিকেটর সূত্র রেফারেন্স

```
EMA:        EMA = (Close − EMA_prev) × k + EMA_prev,   k = 2/(period+1)
            (প্রথম মান SMA(period) দিয়ে সিড — ট্রেডিং প্ল্যাটফর্মের স্ট্যান্ডার্ড)

RSI:        RSI = 100 − 100/(1+RS),   RS = AvgGain/AvgLoss
            Wilder smoothing: avg = (prev×(n−1) + current)/n

MACD:       MACD = EMA12 − EMA26
            Signal = EMA9(MACD),   Histogram = MACD − Signal

Bollinger:  Middle = SMA20,   Upper/Lower = Middle ± 2×StdDev (population)
```

## 📊 ফ্রি টিয়ার সীমা

| সেবা | সীমা | খরচ |
|------|------|-----|
| Binance Market API | মার্কেট ডেটায় কার্যত সীমাহীন (key ছাড়া) | ফ্রি |
| Render.com | ৭৫০ ঘণ্টা/মাস (WebSocket সাপোর্ট) | ফ্রি |
| Vercel | হবি-না-হবি (Hobby) প্ল্যান | ফ্রি |
| SQLite | লোকাল ফাইল, সীমা নেই | ফ্রি |
| Expo EAS | ৩০ বিল্ড/মাস | ফ্রি |
| Cloudflare DNS | সীমাহীন | ফ্রি |

## ✅ সাফল্যের মেট্রিক্স

- ✅ চার্ট ১ সেকেন্ডে লোড (ক্যাশড রেসপন্স ~২০ms)
- ✅ রিয়েল-টাইম আপডেট ~১ সেকেন্ড (Binance kline স্ট্রিম ফ্রিকোয়েন্সি), UI ফ্লাশ ২৫০ms ব্যাচ
- ✅ ৪টি কাস্টম ইন্ডিকেটর কাজ করে (২৯টি ম্যাথ টেস্ট পাস)
- ✅ Web ও Android (Expo) উভয়ে চলে
- ✅ মাসিক খরচ ০ টাকা

## 🛣️ পরবর্তী ধাপ (রোডম্যাপ)

- Alpha Vantage/Finnhub প্রোভাইডার যোগ করে স্টক মার্কেট (`src/lib/binance.ts` এর `fetchKlines` ইন্টারফেস ধরে নতুন প্রোভাইডার)
- ক্যান্ডেলস্টিক প্যাটার্ন সনাক্তকরণ, ড্রইং টুল
- মাল্টি-ইউজার অথ (NextAuth) — ইউজারভিত্তিক ওয়াচলিস্ট
- Price alerts (push notification)
- Web Worker-এ ইন্ডিকেটর (বড় ডেটাসেটে)
