import { Market, Outcome } from '../types';
import { Language } from '../context/LanguageContext';

export interface MarketTranslationEntry {
  question: { es: string; en: string };
  description: { es: string; en: string };
  rules?: { es: string; en: string };
  source?: { es: string; en: string };
  outcomes?: Record<string, { es: string; en: string }>;
}

export const marketDictionary: Record<string, MarketTranslationEntry> = {
  'mkt-friends-llegada': {
    question: {
      es: '¿Alguien llegará más de 15 minutos tarde a la próxima salida o reunión del grupo?',
      en: 'Will anyone arrive more than 15 minutes late to the next group hangout or meeting?',
    },
    description: {
      es: 'Resuelve SÍ si cualquier integrante del grupo arriba con 15 minutos o más de retraso respecto a la hora pactada.',
      en: 'Resolves YES if any group member arrives 15 minutes or more past the agreed meeting time.',
    },
    rules: {
      es: 'Tolerancia de 14 minutos y 59 segundos. A los 15:00 exactos de atraso resuelve SÍ.',
      en: 'Grace period of 14 minutes 59 seconds. At 15:00 or more past schedule, resolves YES.',
    },
    source: {
      es: 'Consenso y hora de llegada acordada en el chat del grupo',
      en: 'Group chat timestamp and consensus arrival time',
    },
  },
  'mkt-friends-reto-deportivo': {
    question: {
      es: '¿Quién ganará el próximo partido o reto interno del grupo (FIFA / Pádel / Fútbol)?',
      en: 'Who will win the next group match or challenge (FIFA / Padel / Soccer)?',
    },
    description: {
      es: 'Predicción sobre el enfrentamiento directo programado para este fin de semana entre los amigos del grupo.',
      en: 'Forecast on the direct matchup scheduled for this weekend among group members.',
    },
    outcomes: {
      'equipo-a': { es: 'Equipo / Retador A', en: 'Team / Player A' },
      'equipo-b': { es: 'Equipo / Retador B', en: 'Team / Player B' },
      'empate-otro': { es: 'Empate / Se Posterga', en: 'Draw / Postponed' },
    },
  },
  'mkt-friends-chat-mensajes': {
    question: {
      es: '¿El grupo de WhatsApp superará los 50 mensajes de texto o memes antes de las 11:00 AM mañana?',
      en: 'Will the WhatsApp group chat exceed 50 texts or memes before 11:00 AM tomorrow?',
    },
    description: {
      es: 'Resuelve SÍ si el contador acumulado de mensajes en el grupo de chat supera 50 desde medianoche hasta las 11:00 AM.',
      en: 'Resolves YES if the total messages sent in the group chat exceed 50 from midnight to 11:00 AM.',
    },
  },
  'mkt-btc-150k': {
    question: {
      es: '¿Superará Bitcoin los $150,000 USD antes del 31 de diciembre de 2026?',
      en: 'Will Bitcoin reach $150,000 USD before December 31, 2026?',
    },
    description: {
      es: 'Resuelve SÍ si cualquier índice spot principal (Coinbase, Binance, Kraken) registra BTC/USD >= 150,000.00 en cualquier momento antes de fin de año 2026.',
      en: 'Resolves YES if any major spot index (Binance, Coinbase, Kraken) records BTC/USD >= 150,000.00 at any point before end of year 2026.',
    },
    rules: {
      es: 'Vela oficial de 1 minuto con precio máximo sobre 150,000.00 USD antes de medianoche UTC del 31 de dic de 2026.',
      en: 'Official 1-minute candlestick high prints above 150,000.00 USD before midnight UTC on Dec 31, 2026.',
    },
    source: {
      es: 'Índices spot de Coinbase Pro y Binance',
      en: 'Coinbase Pro & Binance Spot Index feeds',
    },
  },
  'mkt-l1-leader': {
    question: {
      es: '¿Qué red blockchain Layer-1 tendrá la mayor capitalización de mercado a fin de 2026?',
      en: 'Which Layer-1 blockchain network will have the highest market cap at year-end 2026?',
    },
    description: {
      es: 'Evalúa las capitalizaciones de mercado en CoinGecko a las 23:59:59 UTC del 31 de diciembre de 2026.',
      en: 'Evaluates native network market capitalizations on CoinGecko / CoinMarketCap at 23:59:59 UTC on Dec 31, 2026.',
    },
    outcomes: {
      eth: { es: 'Ethereum', en: 'Ethereum' },
      sol: { es: 'Solana', en: 'Solana' },
      bnb: { es: 'BNB Chain', en: 'BNB Chain' },
      other: { es: 'Otras L1s', en: 'Other L1s' },
    },
  },
  'mkt-tech-gpt5': {
    question: {
      es: '¿Lanzará OpenAI GPT-5 públicamente antes de noviembre de 2026?',
      en: 'Will OpenAI publicly release GPT-5 before November 2026?',
    },
    description: {
      es: 'Resuelve SÍ si OpenAI pone a disposición de suscriptores de ChatGPT o API un modelo comercial designado oficialmente como GPT-5.',
      en: 'Resolves YES if OpenAI makes a commercial model officially designated as GPT-5 accessible to ChatGPT or API subscribers.',
    },
    source: {
      es: 'Blog oficial y lanzamientos de productos de OpenAI',
      en: 'Official OpenAI Blog and Product Releases',
    },
  },
  'mkt-tech-apple-fold': {
    question: {
      es: '¿Anunciará Apple un iPhone o iPad con pantalla plegable antes de que termine 2026?',
      en: 'Will Apple announce a foldable iPhone or iPad before end of 2026?',
    },
    description: {
      es: 'Resuelve SÍ si Apple presenta oficialmente cualquier producto comercial que incluya una pantalla plegable o flexible.',
      en: 'Resolves YES if Apple officially unveils any commercial product featuring a folding or bendable display screen.',
    },
  },
  'mkt-sports-superbowl': {
    question: {
      es: '¿Ganarán los Kansas City Chiefs el próximo campeonato de la NFL / Super Bowl?',
      en: 'Will the Kansas City Chiefs win Super Bowl LXI in February 2027?',
    },
    description: {
      es: 'Resuelve SÍ si los Kansas City Chiefs ganan el juego de campeonato de la NFL en febrero.',
      en: 'Resolves YES if Kansas City Chiefs win the NFL championship game in February.',
    },
  },
  'mkt-sports-champions': {
    question: {
      es: '¿Qué club ganará la UEFA Champions League en la final de 2026?',
      en: 'Which club will win the 2026 UEFA Champions League Final?',
    },
    description: {
      es: 'Resuelve al club que levante el trofeo de la UEFA Champions League según la web oficial uefa.com.',
      en: 'Resolves to the winner of the UEFA Champions League official tournament as verified by uefa.com.',
    },
    outcomes: {
      real: { es: 'Real Madrid', en: 'Real Madrid' },
      city: { es: 'Manchester City', en: 'Manchester City' },
      bayern: { es: 'Bayern Múnich', en: 'Bayern Munich' },
      other: { es: 'Otro Club', en: 'Other Club' },
    },
  },
  'mkt-econ-fed-cut': {
    question: {
      es: '¿Reducirá la Reserva Federal de EE.UU. la tasa de interés en su próxima reunión?',
      en: 'Will the Federal Reserve cut target interest rates at its next FOMC meeting?',
    },
    description: {
      es: 'Resuelve SÍ si el rango superior de la tasa de fondos federales se reduce en al menos 25 puntos básicos.',
      en: 'Resolves YES if the upper bound of the target federal funds rate is lowered by >= 25 bps at the official FOMC statement.',
    },
  },
  'mkt-econ-inflation-sub3': {
    question: {
      es: '¿Caerá la inflación interanual de EE.UU. (CPI) por debajo del 2.5% este año?',
      en: 'Will US Headline CPI annual inflation print below 2.5% before year-end?',
    },
    description: {
      es: 'Resuelve SÍ si cualquier informe mensual de la Oficina de Estadísticas Laborales de EE.UU. reporta un CPI anual menor a 2.5%.',
      en: 'Resolves YES if any monthly US Bureau of Labor Statistics headline CPI report registers below 2.5% YoY.',
    },
  },
  'mkt-weather-paris-heat': {
    question: {
      es: '¿Superará París los 40.0°C de temperatura oficial registrada este verano?',
      en: 'Will Paris record an official temperature above 40.0°C this summer?',
    },
    description: {
      es: 'Resuelve SÍ si la estación meteorológica oficial Paris-Montsouris registra 40.1°C o más.',
      en: 'Resolves YES if the official Météo-France Paris-Montsouris weather station records 40.1°C or higher.',
    },
  },
  'mkt-ent-avatar3': {
    question: {
      es: '¿Recaudará Avatar 3 más de $2,000 millones de dólares en taquilla global?',
      en: 'Will Avatar 3 gross over $2.0 Billion USD at the global box office?',
    },
    description: {
      es: 'Resuelve SÍ si Box Office Mojo reporta una recaudación acumulada mundial superior a $2,000,000,000 USD.',
      en: 'Resolves YES if Box Office Mojo reports worldwide cumulative box office gross exceeding $2,000,000,000 USD.',
    },
  },
  'mkt-life-coffee-5': {
    question: {
      es: '¿Superará el precio promedio de un café espresso los $5.00 USD en grandes ciudades?',
      en: 'Will the average standard Starbucks espresso beverage reach $5.00 in major metro areas?',
    },
    description: {
      es: 'Resuelve SÍ si el precio de venta minorista sugerido promedio supera $5.00 antes de impuestos.',
      en: 'Resolves YES if the average retail menu price for a standard espresso beverage exceeds $5.00 pre-tax.',
    },
  },
  'mkt-fed-rate-resolved': {
    question: {
      es: '[RESUELTO] ¿Redujo la Reserva Federal la tasa de interés en 50 puntos básicos?',
      en: '[RESOLVED] Did the Federal Reserve cut interest rates by 50 basis points at September FOMC?',
    },
    description: {
      es: 'Mercado resuelto positivamente a SÍ tras el anuncio oficial de la Reserva Federal.',
      en: 'Contract resolved to YES following the Federal Reserve official statement reducing target rate by 50 bps.',
    },
  },
  'mkt-crypto-etf-resolved': {
    question: {
      es: '[RESUELTO] ¿Aprobó la SEC de EE.UU. los fondos ETF spot de Ethereum?',
      en: '[RESOLVED] Did the US SEC approve Spot Ethereum ETFs before August 2026?',
    },
    description: {
      es: 'Mercado resuelto positivamente a SÍ tras la aprobación formal de los formularios 19b-4 y S-1 por parte de la SEC.',
      en: 'Contract resolved to YES following SEC formal approval of spot Ethereum ETF registration filings.',
    },
  },
  'mkt-weather-storm-resolved': {
    question: {
      es: '[RESUELTO] ¿Tocó tierra un huracán de categoría 4 o mayor en la costa este?',
      en: '[RESOLVED] Did a Category 4 or higher Hurricane make US landfall this season?',
    },
    description: {
      es: 'Mercado resuelto positivamente a SÍ según los reportes del Centro Nacional de Huracanes (NHC).',
      en: 'Contract resolved to YES per official National Hurricane Center landfall reports.',
    },
  },
};

/**
 * Returns a localized copy of a Market based on user language.
 */
export function getLocalizedMarket(market: Market, lang: Language): Market {
  const entry = marketDictionary[market.id];
  if (!entry) {
    // If not in dictionary, check if outcomes need YES/NO translation
    const localizedOutcomes = market.outcomes.map((o) => ({
      ...o,
      name: getLocalizedOutcomeName(o.name, lang),
    }));
    return { ...market, outcomes: localizedOutcomes };
  }

  const localizedOutcomes = market.outcomes.map((o) => {
    let outcomeName = o.name;
    if (entry.outcomes && entry.outcomes[o.id]) {
      outcomeName = entry.outcomes[o.id][lang] || o.name;
    } else {
      outcomeName = getLocalizedOutcomeName(o.name, lang);
    }
    return {
      ...o,
      name: outcomeName,
    };
  });

  return {
    ...market,
    question: entry.question[lang] || market.question,
    description: entry.description[lang] || market.description,
    resolutionRules: entry.rules ? entry.rules[lang] || market.resolutionRules : market.resolutionRules,
    resolutionSource: entry.source ? entry.source[lang] || market.resolutionSource : market.resolutionSource,
    outcomes: localizedOutcomes,
  };
}

/**
 * Translates outcome names like YES / NO to SÍ / NO when in Spanish.
 */
export function getLocalizedOutcomeName(name: string, lang: Language): string {
  if (lang === 'es') {
    if (name.toUpperCase() === 'YES') return 'SÍ';
    if (name.toUpperCase() === 'NO') return 'NO';
  } else {
    if (name.toUpperCase() === 'SÍ' || name.toUpperCase() === 'SI') return 'YES';
    if (name.toUpperCase() === 'NO') return 'NO';
  }
  return name;
}
