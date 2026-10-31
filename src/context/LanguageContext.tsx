import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Language = 'es' | 'en';

export interface Translations {
  [key: string]: {
    es: string;
    en: string;
  };
}

export const dictionary: Translations = {
  // Navigation
  'nav.home': { es: 'Inicio', en: 'Home' },
  'nav.markets': { es: 'Mercados', en: 'Markets' },
  'nav.leaderboard': { es: 'Clasificación', en: 'Leaderboard' },
  'nav.tournaments': { es: 'Torneos', en: 'Tournaments' },
  'nav.portfolio': { es: 'Mi Portafolio', en: 'Portfolio' },
  'nav.history': { es: 'Historial', en: 'History' },
  'nav.admin': { es: 'Administración', en: 'Admin' },
  'nav.signIn': { es: 'Iniciar Sesión', en: 'Sign In' },
  'nav.signUp': { es: 'Registrarse', en: 'Sign Up' },
  'nav.signOut': { es: 'Cerrar Sesión', en: 'Sign Out' },
  'nav.balance': { es: 'Saldo Disponible', en: 'Available Balance' },

  // Banners & Header
  'banner.tournament': {
    es: '🏆 Torneo Alfa entre Amigos — Compite por el puesto #1 del ranking. Saldo virtual, ¡prestigio y premios reales!',
    en: '🏆 Friends Alpha Tournament — Compete for #1 in the leaderboard. Virtual credits, real bragging rights and prizes!',
  },
  'banner.demo': {
    es: 'Entorno de Prueba Privada (Beta). Los fondos son créditos virtuales de simulación.',
    en: 'Private Beta Test Environment. Balances are virtual simulation credits.',
  },

  // Home
  'home.heroTitle': { es: 'Mercados de Predicción entre Amigos', en: 'Friends Prediction Markets' },
  'home.heroSubtitle': {
    es: 'Pronostica sobre retos, deportes, finanzas y metas del grupo. Respaldado por liquidez matemática instantánea.',
    en: 'Forecast challenges, sports, crypto and group milestones. Powered by instant algorithmic liquidity.',
  },
  'home.trending': { es: 'En Tendencia', en: 'Trending' },
  'home.volume': { es: 'Más Operados', en: 'Most Traded' },
  'home.ending': { es: 'Por Finalizar', en: 'Ending Soon' },
  'home.new': { es: 'Nuevos Retos', en: 'New Challenges' },
  'home.viewAll': { es: 'Ver Todos', en: 'View All' },
  'home.sectors': { es: 'Sectores y Categorías', en: 'Contract Sectors' },
  'home.liveTape': { es: 'ÚLTIMOS TRADES:', en: 'LIVE TAPE:' },

  // Trading Panel
  'trading.buy': { es: 'Comprar Posición', en: 'Buy Shares' },
  'trading.sell': { es: 'Vender (Cerrar)', en: 'Sell (Exit)' },
  'trading.youPay': { es: 'Pagas ahora:', en: 'You pay:' },
  'trading.payoutIfWin': { es: 'Si ganas, cobras:', en: 'If you win, you receive:' },
  'trading.estProfit': { es: 'Ganancia estimada:', en: 'Estimated Profit:' },
  'trading.currentOdds': { es: 'Probabilidad actual:', en: 'Current Probability:' },
  'trading.slippage': { es: 'Impacto de precio:', en: 'Price Impact:' },
  'trading.executeBuy': { es: 'Confirmar Predicción', en: 'Confirm Prediction' },
  'trading.executeSell': { es: 'Vender y Cobrar', en: 'Sell & Cash Out' },
  'trading.sharesToSell': { es: 'Acciones a vender:', en: 'Shares to sell:' },
  'trading.proceeds': { es: 'Recibes hoy en saldo:', en: 'Proceeds to balance:' },
  'trading.noPosition': { es: 'No tienes acciones en esta opción para vender.', en: 'You hold no shares in this outcome to sell.' },
  'trading.successTrade': { es: '¡Operación ejecutada con éxito!', en: 'Order executed successfully!' },

  // Portfolio
  'portfolio.title': { es: 'Gestión de Portafolio', en: 'Portfolio Management' },
  'portfolio.subtitle': { es: 'Valoración en tiempo real de tus posiciones, historial auditado y rentabilidad.', en: 'Real-time positions valuation, audited history and returns.' },
  'portfolio.totalValue': { es: 'Valor Total de Cartera', en: 'Total Portfolio Value' },
  'portfolio.availableCash': { es: 'Efectivo Disponible', en: 'Available Cash' },
  'portfolio.invested': { es: 'Capital en Posiciones', en: 'Capital in Positions' },
  'portfolio.netPnl': { es: 'Rentabilidad Neta', en: 'Net P&L Return' },
  'portfolio.openPositions': { es: 'Posiciones Abiertas', en: 'Open Positions' },
  'portfolio.settledPositions': { es: 'Posiciones Finalizadas', en: 'Settled Positions' },

  // Leaderboard & Tournaments
  'leaderboard.title': { es: '🏆 Clasificación del Torneo', en: '🏆 Tournament Leaderboard' },
  'leaderboard.subtitle': {
    es: 'Compite con tus amigos. Quien termine con mayor retorno sobre su saldo inicial se lleva el premio.',
    en: 'Compete with your friends. The participant with the highest return on initial balance wins the prize.',
  },
  'leaderboard.prizeInfo': {
    es: 'Premio al 1er Lugar: Reconocimiento y premio acordado del grupo de amigos al finalizar el periodo.',
    en: '1st Place Prize: Hall of fame recognition and group-sponsored prize upon tournament close.',
  },
  'leaderboard.rank': { es: 'Posición', en: 'Rank' },
  'leaderboard.user': { es: 'Participante', en: 'Participant' },
  'leaderboard.totalEquity': { es: 'Patrimonio Total', en: 'Total Equity' },
  'leaderboard.roi': { es: 'Retorno (ROI)', en: 'Return (ROI)' },
  'leaderboard.tradesCount': { es: 'Operaciones', en: 'Trades' },
  'leaderboard.winRate': { es: 'Aciertos', en: 'Win Rate' },

  // Tournaments Arena
  'tourn.title': { es: 'Arena de Torneos & Pruebas Alfa', en: 'Tournament & Alpha Testing Arena' },
  'tourn.subtitle': {
    es: 'Espacio dedicado para organizar torneos de pronósticos entre amigos, poner fechas límites y competir por premios reales con saldo virtual.',
    en: 'Dedicated arena to organize prediction tournaments with friends, set deadlines, and compete for real rewards using virtual credits.',
  },
  'tourn.createBtn': { es: '+ Crear Torneo', en: '+ Create Tournament' },
  'tourn.all': { es: 'Todos los Torneos', en: 'All Tournaments' },
  'tourn.active': { es: 'En Curso', en: 'Active' },
  'tourn.upcoming': { es: 'Próximos', en: 'Upcoming' },
  'tourn.completed': { es: 'Finalizados', en: 'Completed' },
  'tourn.deadline': { es: 'Fecha Límite', en: 'Deadline' },
  'tourn.prize': { es: 'Premio Anunciado', en: 'Announced Prize' },
  'tourn.startingBankroll': { es: 'Saldo Inicial', en: 'Starting Bankroll' },
  'tourn.allowedCategory': { es: 'Mercados Habilitados', en: 'Eligible Markets' },
  'tourn.participants': { es: 'Participantes', en: 'Participants' },
  'tourn.joinBtn': { es: 'Unirme al Torneo', en: 'Join Tournament' },
  'tourn.joinedBadge': { es: '✓ Ya estás compitiendo', en: '✓ Already Competing' },
  'tourn.tradeBtn': { es: 'Operar en el Torneo', en: 'Trade in Tournament' },
  'tourn.rules': { es: 'Reglas y Criterios del Torneo', en: 'Tournament Rules & Criteria' },

  // Categories
  'cat.All': { es: 'Todos', en: 'All' },
  'cat.Friends': { es: 'Retos del Grupo', en: 'Group Challenges' },
  'cat.Sports': { es: 'Deportes', en: 'Sports' },
  'cat.Crypto': { es: 'Cripto', en: 'Crypto' },
  'cat.Technology': { es: 'Tecnología', en: 'Technology' },
  'cat.Entertainment': { es: 'Entretenimiento', en: 'Entertainment' },
  'cat.Economy': { es: 'Economía', en: 'Economy' },
  'cat.Everyday Life': { es: 'Vida Cotidiana', en: 'Everyday Life' },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('centra_language');
      if (saved === 'es' || saved === 'en') return saved;
    }
    return 'es'; // Default to Spanish as requested
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('centra_language', lang);
    }
  };

  const toggleLanguage = () => {
    setLanguage(language === 'es' ? 'en' : 'es');
  };

  const t = (key: string, fallback?: string): string => {
    const item = dictionary[key];
    if (!item) return fallback || key;
    return item[language] || fallback || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
