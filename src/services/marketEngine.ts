import { Market, Position, Trade, User, PlatformMetrics, NotificationItem, Outcome } from '../types';
import { LMSREngine } from './lmsrEngine';

export class MarketEngine {
  /**
   * Recalculate market probabilities from outstanding LMSR quantities
   */
  public static syncMarketPrices(market: Market): Market {
    const quantities: Record<string, number> = {};
    for (const outcome of market.outcomes) {
      quantities[outcome.id] = outcome.q;
    }

    const prices = LMSREngine.calculatePrices(quantities, market.liquidityParameter);

    const updatedOutcomes: Outcome[] = market.outcomes.map((outcome) => {
      const mid = prices[outcome.id] || 0.5;
      const spreadInfo = LMSREngine.getSpreadPrices(mid, market.spread);
      return {
        ...outcome,
        currentPrice: spreadInfo.mid,
        buyPrice: spreadInfo.buy,
        sellPrice: spreadInfo.sell,
      };
    });

    return {
      ...market,
      outcomes: updatedOutcomes,
    };
  }

  /**
   * Update position with latest market price
   */
  public static updatePositionValuation(position: Position, currentMarketPrice: number): Position {
    const currentValue = Number((position.quantity * currentMarketPrice).toFixed(2));
    const unrealizedPnL = Number((currentValue - position.currentCostBasis).toFixed(2));
    const unrealizedPnLPercent = position.currentCostBasis > 0
      ? Number(((unrealizedPnL / position.currentCostBasis) * 100).toFixed(1))
      : 0;

    return {
      ...position,
      currentPrice: currentMarketPrice,
      currentValue,
      unrealizedPnL,
      unrealizedPnLPercent,
    };
  }

  /**
   * Settle user positions when a market is resolved
   */
  public static settleMarketPositions(
    positions: Position[],
    marketId: string,
    winningOutcomeId: string
  ): {
    updatedPositions: Position[];
    settlementTrades: Trade[];
    totalPayoutToUser: number;
    realizedPnLDelta: number;
  } {
    let totalPayoutToUser = 0;
    let realizedPnLDelta = 0;
    const settlementTrades: Trade[] = [];

    const updatedPositions = positions.map((pos) => {
      if (pos.marketId !== marketId || pos.status !== 'OPEN') {
        return pos;
      }

      const isWinner = pos.outcomeId === winningOutcomeId;
      const payout = isWinner ? Number((pos.quantity * 1.0).toFixed(2)) : 0;
      const pnl = Number((payout - pos.currentCostBasis).toFixed(2));

      totalPayoutToUser += payout;
      realizedPnLDelta += pnl;

      const trade: Trade = {
        id: `stl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        userId: pos.userId,
        marketId: pos.marketId,
        marketQuestion: pos.marketQuestion,
        outcomeId: pos.outcomeId,
        outcomeName: pos.outcomeName,
        type: 'SETTLEMENT',
        price: isWinner ? 1.0 : 0.0,
        quantity: pos.quantity,
        amount: payout,
        fee: 0,
        spreadFee: 0,
        pnl,
        status: 'SETTLED',
        timestamp: new Date().toISOString(),
      };
      settlementTrades.push(trade);

      return {
        ...pos,
        currentPrice: isWinner ? 1.0 : 0.0,
        currentValue: payout,
        realizedPnL: Number((pos.realizedPnL + pnl).toFixed(2)),
        unrealizedPnL: 0,
        unrealizedPnLPercent: 0,
        status: isWinner ? ('SETTLED_WIN' as const) : ('SETTLED_LOSE' as const),
      };
    });

    return {
      updatedPositions,
      settlementTrades,
      totalPayoutToUser,
      realizedPnLDelta,
    };
  }

  /**
   * Cancel a market and refund invested cost basis to users
   */
  public static cancelMarketPositions(
    positions: Position[],
    marketId: string
  ): {
    updatedPositions: Position[];
    refundTrades: Trade[];
    totalRefundToUser: number;
  } {
    let totalRefundToUser = 0;
    const refundTrades: Trade[] = [];

    const updatedPositions = positions.map((pos) => {
      if (pos.marketId !== marketId || pos.status !== 'OPEN' || pos.quantity <= 0) {
        return pos;
      }

      const refundAmount = Number(pos.currentCostBasis.toFixed(2));
      totalRefundToUser += refundAmount;

      const trade: Trade = {
        id: `ref-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        userId: pos.userId,
        marketId: pos.marketId,
        marketQuestion: pos.marketQuestion,
        outcomeId: pos.outcomeId,
        outcomeName: pos.outcomeName,
        type: 'REFUND',
        price: pos.averagePrice,
        quantity: pos.quantity,
        amount: refundAmount,
        fee: 0,
        spreadFee: 0,
        pnl: 0,
        status: 'REFUNDED',
        timestamp: new Date().toISOString(),
      };
      refundTrades.push(trade);

      return {
        ...pos,
        quantity: 0,
        currentCostBasis: 0,
        currentValue: 0,
        unrealizedPnL: 0,
        unrealizedPnLPercent: 0,
        status: 'CANCELLED' as const,
      };
    });

    return {
      updatedPositions,
      refundTrades,
      totalRefundToUser,
    };
  }

  /**
   * Recompute platform-wide metrics
   */
  public static computeMetrics(
    markets: Market[],
    trades: Trade[],
    users: User[]
  ): PlatformMetrics {
    const totalVolume = trades.reduce((acc, t) => acc + t.amount, 0);
    const commissionRevenue = trades.reduce((acc, t) => acc + t.fee, 0);
    const spreadRevenue = trades.reduce((acc, t) => acc + t.spreadFee, 0);
    const totalRevenue = commissionRevenue + spreadRevenue;

    const activeMarkets = markets.filter((m) => m.status === 'open').length;
    const resolvedMarkets = markets.filter((m) => m.status === 'resolved').length;

    const totalVirtualCapital = users.reduce((acc, u) => acc + u.virtualBalance, 0);
    
    // Open exposure across markets
    const openExposure = markets
      .filter((m) => m.status === 'open')
      .reduce((acc, m) => acc + m.volume * 0.45, 0);

    const distinctTradersFromTrades = new Set(trades.map((t) => t.userId).filter(Boolean)).size;
    const maxMarketTraders = markets.reduce((max, m) => Math.max(max, m.totalTraders || 0), 0);
    const activeTraders = Math.max(distinctTradersFromTrades, maxMarketTraders, users.length > 0 ? 1 : 0);
    const totalUsersCount = Math.max(users.length, activeTraders);

    return {
      totalUsers: totalUsersCount,
      activeUsers: activeTraders,
      activeMarkets,
      totalVolume: Number(totalVolume.toFixed(2)),
      totalRevenue: Number(totalRevenue.toFixed(2)),
      netRevenue: Number(totalRevenue.toFixed(2)),
      commissionRevenue: Number(commissionRevenue.toFixed(2)),
      spreadRevenue: Number(spreadRevenue.toFixed(2)),
      totalVirtualCapital: Number(totalVirtualCapital.toFixed(2)),
      openExposure: Number(openExposure.toFixed(2)),
      resolvedMarkets,
    };
  }
}
