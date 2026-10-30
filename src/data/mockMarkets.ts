import { Market, Category, Outcome, PricePoint } from '../types';

function createStepHistory(
  outcomes: { id: string; price: number }[],
  initialPrices: Record<string, number>,
  volumeTotal: number,
  points: number = 24
): PricePoint[] {
  const history: PricePoint[] = [];
  const now = Date.now();
  const hourMs = 3600 * 1000;

  for (let i = points - 1; i >= 0; i--) {
    const timestamp = now - i * hourMs;
    const date = new Date(timestamp);
    const timeLabel = `${date.getHours().toString().padStart(2, '0')}:00`;

    const prices: Record<string, number> = {};
    const progress = (points - 1 - i) / (points - 1); // 0.0 at start, 1.0 at now

    let sum = 0;
    outcomes.forEach((o) => {
      const startP = initialPrices[o.id] ?? o.price;
      const targetP = o.price;
      // Step-like progression with discrete intervals
      const stepInterval = Math.floor(progress * 6) / 6;
      const jitter = Math.sin(i * 1.5) * 0.02;
      const val = Math.max(0.02, Math.min(0.98, startP + (targetP - startP) * stepInterval + jitter));
      prices[o.id] = val;
      sum += val;
    });

    // Normalize so sum is exactly 1.0
    outcomes.forEach((o) => {
      prices[o.id] = Number((prices[o.id] / sum).toFixed(2));
    });

    history.push({
      timestamp,
      timeLabel: i === 0 ? 'Now' : timeLabel,
      prices,
      volume: Math.round((volumeTotal / points) * (points - i)),
    });
  }

  // Ensure current point matches exact final prices
  const finalPoint = history[history.length - 1];
  outcomes.forEach((o) => {
    finalPoint.prices[o.id] = o.price;
  });

  return history;
}

function buildBinaryMarket(params: {
  id: string;
  question: string;
  description: string;
  category: Category;
  yesPrice: number;
  initialYesPrice: number;
  volume: number;
  traders: number;
  b: number;
  source: string;
  rules: string;
  status?: Market['status'];
  winningOutcomeId?: string;
}): Market {
  const noPrice = Number((1 - params.yesPrice).toFixed(2));
  const initialNoPrice = Number((1 - params.initialYesPrice).toFixed(2));
  const spread = 0.01;

  const outcomes: Outcome[] = [
    {
      id: 'yes',
      name: 'YES',
      q: Math.round(params.b * Math.log(params.yesPrice / noPrice)),
      currentPrice: params.yesPrice,
      buyPrice: Number(Math.min(0.99, params.yesPrice + spread).toFixed(2)),
      sellPrice: Number(Math.max(0.01, params.yesPrice - spread).toFixed(2)),
      initialPrice: params.initialYesPrice,
      initialProbability: params.initialYesPrice,
      color: '#10b981',
      isWinner: params.winningOutcomeId === 'yes',
    },
    {
      id: 'no',
      name: 'NO',
      q: 0,
      currentPrice: noPrice,
      buyPrice: Number(Math.min(0.99, noPrice + spread).toFixed(2)),
      sellPrice: Number(Math.max(0.01, noPrice - spread).toFixed(2)),
      initialPrice: initialNoPrice,
      initialProbability: initialNoPrice,
      color: '#f43f5e',
      isWinner: params.winningOutcomeId === 'no',
    },
  ];

  const now = new Date();
  const close = new Date(now.getTime() + 180 * 24 * 3600 * 1000);
  const resolution = new Date(close.getTime() + 24 * 3600 * 1000);

  return {
    id: params.id,
    question: params.question,
    description: params.description,
    category: params.category,
    type: 'binary',
    status: params.status || 'open',
    outcomes,
    closeTime: close.toISOString(),
    resolutionTime: resolution.toISOString(),
    resolutionSource: params.source,
    resolutionRules: params.rules,
    liquidityParameter: params.b,
    commissionRate: 0.01,
    spread: 0.01,
    volume: 0,
    totalTraders: 0,
    totalTrades: 0,
    createdAt: new Date(now.getTime() - 14 * 24 * 3600 * 1000).toISOString(),
    priceHistory: createStepHistory(
      [
        { id: 'yes', price: params.yesPrice },
        { id: 'no', price: noPrice },
      ],
      { yes: params.initialYesPrice, no: initialNoPrice },
      0
    ),
    winningOutcomeId: params.winningOutcomeId,
  };
}

function buildMultiMarket(params: {
  id: string;
  question: string;
  description: string;
  category: Category;
  outcomesConfig: { id: string; name: string; price: number; initialPrice: number; color: string }[];
  volume: number;
  traders: number;
  b: number;
  source: string;
  rules: string;
}): Market {
  const spread = 0.01;
  const outcomes: Outcome[] = params.outcomesConfig.map((cfg) => ({
    id: cfg.id,
    name: cfg.name,
    q: Math.round(params.b * Math.log(cfg.price / 0.25)),
    currentPrice: cfg.price,
    buyPrice: Number(Math.min(0.99, cfg.price + spread).toFixed(2)),
    sellPrice: Number(Math.max(0.01, cfg.price - spread).toFixed(2)),
    initialPrice: cfg.initialPrice,
    initialProbability: cfg.initialPrice,
    color: cfg.color,
  }));

  const initialPricesMap: Record<string, number> = {};
  params.outcomesConfig.forEach((c) => {
    initialPricesMap[c.id] = c.initialPrice;
  });

  const now = new Date();
  const close = new Date(now.getTime() + 180 * 24 * 3600 * 1000);
  const resolution = new Date(close.getTime() + 24 * 3600 * 1000);

  return {
    id: params.id,
    question: params.question,
    description: params.description,
    category: params.category,
    type: 'multi',
    status: 'open',
    outcomes,
    closeTime: close.toISOString(),
    resolutionTime: resolution.toISOString(),
    resolutionSource: params.source,
    resolutionRules: params.rules,
    liquidityParameter: params.b,
    commissionRate: 0.01,
    spread: 0.01,
    volume: 0,
    totalTraders: 0,
    totalTrades: 0,
    createdAt: new Date(now.getTime() - 20 * 24 * 3600 * 1000).toISOString(),
    priceHistory: createStepHistory(
      params.outcomesConfig.map((c) => ({ id: c.id, price: c.price })),
      initialPricesMap,
      0
    ),
  };
}

export const CANONICAL_SEED_MARKETS: Market[] = [
  // 0. Retos del Grupo de Amigos (Resolución Rápida y Torneo)
  buildBinaryMarket({
    id: 'mkt-friends-llegada',
    question: '¿Alguien llegará más de 15 minutos tarde a la próxima salida o reunión del grupo?',
    description: 'Resuelve SÍ si cualquier integrante del grupo arriba con 15 minutos o más de retraso respecto a la hora pactada.',
    category: 'Friends',
    yesPrice: 0.68,
    initialYesPrice: 0.50,
    volume: 1240,
    traders: 8,
    b: 250,
    source: 'Consenso y hora de llegada acordada en el chat del grupo',
    rules: 'Tolerancia de 14 minutos y 59 segundos. A los 15:00 exactos de atraso resuelve SÍ.',
  }),

  buildMultiMarket({
    id: 'mkt-friends-reto-deportivo',
    question: '¿Quién ganará el próximo partido o reto interno del grupo (FIFA / Pádel / Fútbol)?',
    description: 'Predicción sobre el enfrentamiento directo programado para este fin de semana entre los amigos del grupo.',
    category: 'Friends',
    b: 300,
    volume: 1850,
    traders: 12,
    source: 'Resultado final del partido presencial o partida oficial',
    rules: 'Resuelve al ganador oficial al finalizar el tiempo reglamentario.',
    outcomesConfig: [
      { id: 'equipo-a', name: 'Equipo / Retador A', price: 0.48, initialPrice: 0.40, color: '#3b82f6' },
      { id: 'equipo-b', name: 'Equipo / Retador B', price: 0.42, initialPrice: 0.40, color: '#10b981' },
      { id: 'empate-otro', name: 'Empate / Se Posterga', price: 0.10, initialPrice: 0.20, color: '#f59e0b' },
    ],
  }),

  buildBinaryMarket({
    id: 'mkt-friends-chat-mensajes',
    question: '¿El grupo de WhatsApp superará los 50 mensajes de texto o memes antes de las 11:00 AM mañana?',
    description: 'Resuelve SÍ si el contador acumulado de mensajes en el grupo de chat supera 50 desde medianoche hasta las 11:00 AM.',
    category: 'Friends',
    yesPrice: 0.42,
    initialYesPrice: 0.50,
    volume: 890,
    traders: 7,
    b: 200,
    source: 'Captura de pantalla y contador oficial de mensajes del chat grupal',
    rules: 'Mensajes de texto, stickers, audios y memes suman como 1 mensaje individual.',
  }),

  // 1. Crypto
  buildBinaryMarket({
    id: 'mkt-btc-150k',
    question: 'Will Bitcoin reach $150,000 USD before December 31, 2026?',
    description: 'Resolves YES if any major spot index (Binance, Coinbase, Kraken) records BTC/USD >= 150,000.00 at any point before end of year 2026.',
    category: 'Crypto',
    yesPrice: 0.65,
    initialYesPrice: 0.48,
    volume: 38400,
    traders: 142,
    b: 500,
    source: 'Coinbase Pro & Binance Spot Index feeds',
    rules: 'Official 1-minute candlestick high prints above 150,000.00 USD before midnight UTC on Dec 31, 2026.',
  }),

  buildMultiMarket({
    id: 'mkt-l1-leader',
    question: 'Which Layer-1 blockchain network will have the highest market cap at year-end 2026?',
    description: 'Evaluates native network market capitalizations on CoinGecko / CoinMarketCap at 23:59:59 UTC on Dec 31, 2026.',
    category: 'Crypto',
    b: 600,
    volume: 24800,
    traders: 96,
    source: 'CoinGecko Top Market Capitalization Table',
    rules: 'Top market cap among selected networks at official snapshot.',
    outcomesConfig: [
      { id: 'eth', name: 'Ethereum', price: 0.48, initialPrice: 0.55, color: '#627eea' },
      { id: 'sol', name: 'Solana', price: 0.34, initialPrice: 0.25, color: '#14f195' },
      { id: 'bnb', name: 'BNB Chain', price: 0.12, initialPrice: 0.14, color: '#f3ba2f' },
      { id: 'other', name: 'Other L1s', price: 0.06, initialPrice: 0.06, color: '#94a3b8' },
    ],
  }),

  // 2. Technology
  buildBinaryMarket({
    id: 'mkt-tech-gpt5',
    question: 'Will OpenAI publicly release GPT-5 before November 2026?',
    description: 'Resolves YES if OpenAI makes a commercial model officially designated as GPT-5 accessible to ChatGPT or API subscribers.',
    category: 'Technology',
    yesPrice: 0.74,
    initialYesPrice: 0.52,
    volume: 42100,
    traders: 168,
    b: 600,
    source: 'Official OpenAI Blog and Product Releases',
    rules: 'Public announcement and active API availability designated as GPT-5 before Nov 1, 2026.',
  }),

  buildBinaryMarket({
    id: 'mkt-tech-apple-fold',
    question: 'Will Apple announce a foldable iPhone or iPad before end of 2026?',
    description: 'Resolves YES if Apple officially unveils any commercial product featuring a folding or bendable display screen.',
    category: 'Technology',
    yesPrice: 0.29,
    initialYesPrice: 0.35,
    volume: 18500,
    traders: 74,
    b: 400,
    source: 'Apple Keynote Events & Apple Newsroom Press Releases',
    rules: 'Official keynote demonstration and public shipping date announcement.',
  }),

  // 3. Economy
  buildMultiMarket({
    id: 'mkt-econ-fed',
    question: 'What will be the Federal Reserve interest rate policy decision at the next FOMC?',
    description: 'Resolves to the official Federal Open Market Committee target range policy rate change announced in the post-meeting statement.',
    category: 'Economy',
    b: 500,
    volume: 31200,
    traders: 118,
    source: 'Federal Reserve Board Monetary Policy Releases',
    rules: 'FOMC target federal funds rate upper bound change.',
    outcomesConfig: [
      { id: 'cut-25', name: '25 bps Rate Cut', price: 0.58, initialPrice: 0.45, color: '#10b981' },
      { id: 'hold', name: 'Hold / Pause (0 bps)', price: 0.31, initialPrice: 0.42, color: '#38bdf8' },
      { id: 'cut-50', name: '50+ bps Rate Cut', price: 0.08, initialPrice: 0.10, color: '#a855f7' },
      { id: 'hike', name: 'Rate Hike', price: 0.03, initialPrice: 0.03, color: '#f43f5e' },
    ],
  }),

  buildBinaryMarket({
    id: 'mkt-econ-cpi',
    question: 'Will US CPI Year-over-Year inflation drop below 2.5% in the next release?',
    description: 'Resolves YES if the Bureau of Labor Statistics publishes headline CPI YoY at 2.4% or lower in the upcoming monthly report.',
    category: 'Economy',
    yesPrice: 0.53,
    initialYesPrice: 0.46,
    volume: 22700,
    traders: 88,
    b: 450,
    source: 'U.S. Bureau of Labor Statistics (BLS) Consumer Price Index Summary',
    rules: 'Initial release value as published at 8:30 AM ET on release day.',
  }),

  // 4. Sports
  buildBinaryMarket({
    id: 'mkt-sports-ucl-madrid',
    question: 'Will Real Madrid win the UEFA Champions League 2025-2026?',
    description: 'Resolves YES if Real Madrid CF lifts the UEFA Champions League trophy in the official tournament final.',
    category: 'Sports',
    yesPrice: 0.36,
    initialYesPrice: 0.30,
    volume: 28900,
    traders: 135,
    b: 500,
    source: 'UEFA Official Tournament Results',
    rules: 'Trophy presentation at the final match.',
  }),

  buildMultiMarket({
    id: 'mkt-sports-epl',
    question: 'Who will win the English Premier League 2025-2026 championship?',
    description: 'Resolves to the club that finishes 1st in the Premier League table after 38 match rounds.',
    category: 'Sports',
    b: 550,
    volume: 34500,
    traders: 152,
    source: 'Premier League Official Table and Standings',
    rules: 'Final table standings following matchday 38.',
    outcomesConfig: [
      { id: 'mci', name: 'Manchester City', price: 0.38, initialPrice: 0.42, color: '#6cabdd' },
      { id: 'ars', name: 'Arsenal', price: 0.35, initialPrice: 0.30, color: '#ef0107' },
      { id: 'liv', name: 'Liverpool', price: 0.20, initialPrice: 0.22, color: '#c8102e' },
      { id: 'other-club', name: 'Other Club', price: 0.07, initialPrice: 0.06, color: '#64748b' },
    ],
  }),

  // 5. Weather
  buildBinaryMarket({
    id: 'mkt-weather-heat-record',
    question: 'Will official stations in Madrid or Lima record temperatures >= 38.5°C this season?',
    description: 'Resolves YES if certified meteorological stations (AEMET / SENAMHI) record peak temperature at or above 38.5°C.',
    category: 'Weather',
    yesPrice: 0.62,
    initialYesPrice: 0.44,
    volume: 16400,
    traders: 65,
    b: 350,
    source: 'AEMET (Spain) & SENAMHI (Peru) Certified Weather Observation Network',
    rules: 'Highest official temperature registered during the meteorological observation window.',
  }),

  buildBinaryMarket({
    id: 'mkt-weather-enso',
    question: 'Will NOAA confirm La Niña conditions persisting through Q3 2026?',
    description: 'Resolves YES if NOAA Climate Prediction Center ENSO Diagnostic Discussion maintains La Niña status through August 2026.',
    category: 'Weather',
    yesPrice: 0.56,
    initialYesPrice: 0.50,
    volume: 14200,
    traders: 58,
    b: 350,
    source: 'NOAA Climate Prediction Center (CPC) Diagnostic Reports',
    rules: 'Official Niño 3.4 index and CPC diagnostic bulletin.',
  }),

  // 6. Entertainment
  buildMultiMarket({
    id: 'mkt-ent-oscars',
    question: 'Which cinematic production will win Best Picture at the next Academy Awards?',
    description: 'Resolves to the winner announced by the Academy of Motion Picture Arts and Sciences during the live Oscar telecast.',
    category: 'Entertainment',
    b: 450,
    volume: 21500,
    traders: 92,
    source: 'Academy of Motion Picture Arts and Sciences (Oscars.org)',
    rules: 'Official envelope opening and Academy press record.',
    outcomesConfig: [
      { id: 'scifi', name: 'Sci-Fi Epic Feature', price: 0.41, initialPrice: 0.35, color: '#a855f7' },
      { id: 'bio', name: 'Biographical Drama', price: 0.34, initialPrice: 0.38, color: '#eab308' },
      { id: 'indie', name: 'Original Indie Feature', price: 0.16, initialPrice: 0.18, color: '#06b6d4' },
      { id: 'foreign', name: 'International Feature', price: 0.09, initialPrice: 0.09, color: '#ec4899' },
    ],
  }),

  // 7. Everyday Life
  buildBinaryMarket({
    id: 'mkt-life-remote',
    question: 'Will major tech companies maintain hybrid/remote work (>2 remote days/wk) through 2026?',
    description: 'Resolves YES if at least 4 of the top 7 tech employers (FAANG+M) continue official policies permitting 2+ remote days per week.',
    category: 'Everyday Life',
    yesPrice: 0.68,
    initialYesPrice: 0.60,
    volume: 27300,
    traders: 114,
    b: 400,
    source: 'Verified Corporate HR Policies and Tier 1 Business Reporting (WSJ, Bloomberg)',
    rules: 'Corporate policy active on Dec 31, 2026.',
  }),

  // 8. Resolved Market (Demonstrating settlement filter)
  buildBinaryMarket({
    id: 'mkt-crypto-etf-resolved',
    question: 'Did the US SEC approve the first spot Ethereum Exchange-Traded Funds (ETFs)?',
    description: 'Historical contract resolved following the SEC approval order approving 19b-4 exchange rule changes.',
    category: 'Crypto',
    yesPrice: 1.0,
    initialYesPrice: 0.45,
    volume: 84200,
    traders: 310,
    b: 800,
    source: 'US Securities and Exchange Commission (SEC) Release No. 34-99999',
    rules: 'Resolved in favor of YES upon official regulatory approval.',
    status: 'resolved',
    winningOutcomeId: 'yes',
  }),

  // 9. Closed Market (Demonstrating closed contract filter)
  buildBinaryMarket({
    id: 'mkt-tech-safety-closed',
    question: 'Global AI Safety Summit Treaty ratified by 20+ countries before Q1 2026',
    description: 'Contract closed for trading pending final diplomatic ratification verification.',
    category: 'Technology',
    yesPrice: 0.45,
    initialYesPrice: 0.40,
    volume: 19800,
    traders: 82,
    b: 400,
    source: 'Official Diplomatic Summit Secretariat Communique',
    rules: 'Market closed; currently in verification phase.',
    status: 'closed',
  }),
];
