export type MarketType = 'binary' | 'multi' | 'range';

export type MarketStatus = 'open' | 'closed' | 'resolving' | 'resolved' | 'paused' | 'cancelled';

export type Category = 
  | 'Friends'
  | 'Sports'
  | 'Crypto'
  | 'Economy'
  | 'Technology'
  | 'Weather'
  | 'Entertainment'
  | 'Everyday Life'
  | 'Other';

export interface Outcome {
  id: string;
  name: string; // e.g. "YES", "NO", "Team A", "$100k-$125k"
  label?: string;
  q: number; // outstanding shares in LMSR state
  currentPrice: number; // 0.00 to 1.00 (e.g. 0.64)
  buyPrice: number; // includes spread margin
  sellPrice: number; // bid price (after spread)
  initialPrice?: number; // Starting price/probability before trades
  initialProbability?: number; // Starting probability (0.00 - 1.00)
  initialQ?: number; // Initial LMSR inventory state q_0,i
  color?: string;
  isWinner?: boolean;
}

export interface PricePoint {
  timestamp: number;
  timeLabel: string;
  prices: Record<string, number>; // outcomeId -> price
  volume: number;
}

export interface Market {
  id: string;
  question: string;
  description: string;
  category: Category;
  type: MarketType;
  status: MarketStatus;
  outcomes: Outcome[];
  closeTime: string; // ISO string
  resolutionTime: string; // ISO string
  resolutionSource: string;
  resolutionRules: string;
  liquidityParameter: number; // LMSR b parameter (e.g. 1000)
  subsidyBudget?: number; // Maximum platform USD subsidy budget allocated for LMSR
  commissionRate: number; // e.g. 0.01 for 1%
  spread: number; // half-spread e.g. 0.015 for 1.5%
  volume: number; // total virtual volume in USD
  totalTraders: number;
  totalTrades?: number;
  proposedOutcomeId?: string; // Outcome proposed during optimistic dispute window
  resolutionProof?: string; // Official oracle verification source or proof
  disputeDeadline?: string; // ISO timestamp when dispute window expires
  disputedAt?: string; // Timestamp if market was disputed
  disputeReason?: string; // Explanation if disputed
  winningOutcomeId?: string;
  resolvedOutcomeId?: string;
  createdAt: string;
  priceHistory: PricePoint[];
  tags?: string[];
  initialProbabilities?: Record<string, number>;
  initialQuantities?: Record<string, number>; // Starting LMSR state q_0
  cumulativeLmsrCashFlow?: number; // Total net cash collected by LMSR from trades
  totalCommissionRevenue?: number; // Cumulative commission fees earned
  totalSpreadRevenue?: number; // Cumulative spread fees earned
  settlementPayout?: number; // Total winning payout distributed at resolution
  realizedMMPnL?: number; // Net LMSR cash flow - settlement payouts
  realizedPlatformResult?: number; // realizedMMPnL + commissions + spreads
  tournamentId?: string; // Optional direct tournament binding
}

export interface Position {
  id: string;
  userId: string;
  marketId: string;
  marketQuestion: string;
  marketCategory: Category;
  outcomeId: string;
  outcomeName: string;
  quantity: number; // shares held
  averagePrice: number; // average purchase price per share
  currentPrice: number; // latest market price
  currentCostBasis: number; // quantity * averagePrice
  currentValue: number; // quantity * currentPrice
  realizedPnL: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  status: 'OPEN' | 'CLOSED' | 'SETTLED_WIN' | 'SETTLED_LOSE' | 'CANCELLED' | 'REFUNDED';
  tournamentId?: string;
}

export interface Trade {
  id: string;
  userId: string;
  userName?: string;
  marketId: string;
  marketQuestion: string;
  outcomeId: string;
  outcomeName: string;
  type: 'BUY' | 'SELL' | 'SETTLEMENT' | 'REFUND' | 'RESOLUTION';
  price: number; // execution price per share
  quantity: number; // number of shares
  amount: number; // total cash value ($)
  fee: number; // commission fee ($)
  spreadFee: number; // operator spread capture ($)
  lmsrCashFlow?: number; // exact net cash paid into or refunded by the LMSR: +buy, -sell
  pnl?: number; // for SELL, SETTLEMENT, or REFUND
  status: 'EXECUTED' | 'SETTLED' | 'REFUNDED';
  timestamp: string; // ISO
  tournamentId?: string;
  isAnonymous?: boolean;
}

export interface User {
  id: string;
  username?: string;
  name: string;
  email: string;
  phoneNumber?: string;
  role: 'user' | 'admin';
  virtualBalance: number; // Base virtual USD balance (default 0.0)
  avatar?: string;
  createdAt?: string;
}

export interface StoredUserAccount extends User {
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}

export type TournamentStatus = 'upcoming' | 'active' | 'completed' | 'cancelled';

export interface Tournament {
  id: string;
  title: string;
  description: string;
  prizePool: string;
  initialBalance: number;
  status: TournamentStatus;
  startDate: string; // ISO string
  endDate: string; // ISO string (Deadline)
  categoryFilter: Category | 'ALL';
  rules: string;
  createdById?: string;
  createdAt: string;
  participantsCount?: number;
  marketsCount?: number;
  winnerUserId?: string;
  winnerName?: string;
  winnerEquity?: number;
  marketIds?: string[];
  markets?: Market[];
}

export interface TournamentMarket {
  tournamentId: string;
  marketId: string;
  createdAt: string;
}

export interface TournamentParticipant {
  tournamentId: string;
  userId: string;
  username?: string;
  name?: string;
  tournamentBalance: number;
  initialGrantedBalance: number;
  joinedAt: string;
}

export interface LeaderboardUser {
  id: string;
  username: string;
  name: string;
  avatar?: string;
  virtualBalance: number;
  tournamentBalance?: number;
  initialGrantedBalance?: number;
  openPositionsValue: number;
  totalEquity: number;
  totalPnl: number;
  roiPercent: number;
  tradesCount: number;
  winsCount: number;
  winRate: number;
  rank?: number;
}

export interface PlatformMetrics {
  totalUsers: number;
  activeUsers: number;
  activeMarkets: number;
  totalVolume: number;
  totalRevenue: number;
  netRevenue: number;
  commissionRevenue: number;
  spreadRevenue: number;
  totalVirtualCapital: number;
  openExposure: number;
  resolvedMarkets: number;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'trade' | 'resolution' | 'pnl' | 'system' | 'market';
  read: boolean;
  timestamp: string;
  marketId?: string;
}

export interface TradeQuote {
  outcomeId: string;
  shares: number;
  grossAmount: number;
  commission: number;
  spreadCost: number;
  netAmount: number;
  effectivePricePerShare: number;
  potentialPayout: number;
  potentialProfit: number;
  lmsrCashFlow: number; // Signed LMSR cash flow delta
  newProbabilities: Record<string, number>;
}

export type LedgerTransactionType =
  | 'INITIAL_DEMO_CREDIT'
  | 'BUY'
  | 'SELL'
  | 'COMMISSION'
  | 'SETTLEMENT'
  | 'REFUND'
  | 'RESET_DEMO_CREDIT';

export interface LedgerEntry {
  id: string;
  userId: string;
  userEmail: string;
  type: LedgerTransactionType;
  amount: number;
  balanceAfter: number;
  marketId?: string;
  marketQuestion?: string;
  tradeId?: string;
  description: string;
  timestamp: string;
}

