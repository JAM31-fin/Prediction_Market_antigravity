import { describe, it, expect, beforeAll } from 'vitest';
import { runMigrations } from '../src/server/migrate';
import { dbService } from '../src/server/dbService';
import { Tournament, Market } from '../src/types';

describe('Portfolio Tournament Integration - Zero Base Balance & Isolated Subwallets', () => {
  let adminId: string;
  let traderId: string;
  let tournament: Tournament;
  let market: Market;

  beforeAll(async () => {
    await runMigrations();

    const admin = await dbService.getUserByUsernameOrEmail('admin31');
    expect(admin).toBeDefined();
    adminId = admin!.id;

    // 1. Create a tournament with 100 initial tokens
    tournament = await dbService.createTournament(
      {
        title: 'Torneo Oficial Beta - 100 Tokens',
        description: 'Torneo oficial para pruebas con 100 tokens iniciales',
        prizePool: '$100 USD',
        initialBalance: 100.0,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000 * 7).toISOString(),
        status: 'active',
        categoryFilter: 'Technology',
      },
      adminId
    );
    expect(tournament.id).toBeDefined();
    expect(tournament.initialBalance).toBe(100.0);

    // 2. Create a market linked to this tournament
    market = await dbService.createMarket(
      {
        question: 'Will Quantum Computing achieve commercial advantage by 2027?',
        category: 'Technology',
        type: 'binary',
        closeTime: new Date(Date.now() + 86400000).toISOString(),
        resolutionTime: new Date(Date.now() + 172800000).toISOString(),
        liquidityParameter: 100,
        commissionRate: 0.01,
        spread: 0.015,
        tournamentId: tournament.id,
        outcomes: [
          { id: 'q-yes', name: 'YES', initialProbability: 0.5 },
          { id: 'q-no', name: 'NO', initialProbability: 0.5 },
        ],
      },
      adminId
    );
    expect(market.id).toBeDefined();
    expect(market.tournamentId).toBe(tournament.id);

    // 3. Register a new user who starts with strictly $0.00 base balance
    const authRes = await dbService.register('portfolio_trader_1', 'SecurePass123!', 'Portfolio Trader', undefined, '+15559998888');
    traderId = authRes.user.id;
    expect(authRes.user.virtualBalance).toBe(0.0);
  });

  it('new user has no tournament subwallets initially and starts with $0.00', async () => {
    const user = await dbService.getUserById(traderId);
    expect(user!.virtualBalance).toBe(0.0);

    const userTourns = await dbService.getUserTournaments(traderId);
    expect(userTourns).toHaveLength(0);
  });

  it('user joins tournament: receives exactly 100 tokens in tournament subwallet, base balance stays $0.00', async () => {
    await dbService.joinTournament(tournament.id, traderId);

    // Check user base balance remains strictly $0.00
    const user = await dbService.getUserById(traderId);
    expect(user!.virtualBalance).toBe(0.0);

    // Check user tournaments list returns the enrolled tournament with 100 tokens
    const userTourns = await dbService.getUserTournaments(traderId);
    expect(userTourns).toHaveLength(1);
    expect(userTourns[0].tournament.id).toBe(tournament.id);
    expect(userTourns[0].participant.tournamentBalance).toBe(100.0);
    expect(userTourns[0].participant.initialGrantedBalance).toBe(100.0);
  });

  it('executing a trade debits the tournament subwallet and links position to tournament', async () => {
    // Invest $30.00 in YES
    const tradeRes = await dbService.executeTrade({
      userId: traderId,
      marketId: market.id,
      outcomeId: 'q-yes',
      type: 'BUY',
      amountOrShares: 30.0,
    });

    expect(tradeRes.trade).toBeDefined();
    expect(tradeRes.trade.tournamentId).toBe(tournament.id);

    // Base balance is untouched
    const user = await dbService.getUserById(traderId);
    expect(user!.virtualBalance).toBe(0.0);

    // Tournament balance is reduced by gross amount ($30.00 -> $70.00)
    const userTourns = await dbService.getUserTournaments(traderId);
    expect(userTourns[0].participant.tournamentBalance).toBe(70.0);

    // Position is created and tied to tournament
    const positions = await dbService.getPositions(traderId);
    const tournamentPos = positions.find((p) => p.tournamentId === tournament.id);
    expect(tournamentPos).toBeDefined();
    expect(tournamentPos!.quantity).toBeGreaterThan(0);
    expect(tournamentPos!.currentCostBasis).toBeGreaterThan(0);

    // Tournament Leaderboard reports equity accurately (cash + position mark to market)
    const leaderboard = await dbService.getTournamentLeaderboard(tournament.id);
    const traderRank = leaderboard.find((u) => u.id === traderId);
    expect(traderRank).toBeDefined();
    expect(traderRank!.tournamentBalance).toBe(70.0);
    expect(traderRank!.totalEquity).toBeCloseTo(70.0 + tournamentPos!.currentValue, 1);
  });
});
