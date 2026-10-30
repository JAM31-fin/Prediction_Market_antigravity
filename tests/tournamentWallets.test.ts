import { describe, it, expect, beforeAll } from 'vitest';
import { runMigrations } from '../src/server/migrate';
import { dbService } from '../src/server/dbService';
import { dbTransaction } from '../src/server/db';
import { Tournament, Market } from '../src/types';

describe('Tournament Isolated Subwallets & Bidirectional Market Association', () => {
  let adminId: string;
  let bobId: string;
  let tournamentA: Tournament;
  let tournamentB: Tournament;
  let marketInTorneoA: Market;
  let globalMarket: Market;

  beforeAll(async () => {
    await runMigrations();

    const admin = await dbService.getUserByUsernameOrEmail('admin31');
    expect(admin).toBeDefined();
    adminId = admin!.id;

    // Register a new test user 'bob_trader'
    const bobAuth = await dbService.register('bob_trader', 'Secret123!', 'Bob Trader');
    bobId = bobAuth.user.id;
    expect(bobAuth.user.virtualBalance).toBe(0.0);

    // Give Bob $5,000 in his GLOBAL account (simulating money from before or from other sources)
    await dbTransaction(async (client) => {
      await client.query('UPDATE users SET virtual_balance = 5000.0 WHERE id = $1;', [bobId]);
    });
    const bobUpdated = await dbService.getUserById(bobId);
    expect(bobUpdated!.virtualBalance).toBe(5000.0);
  });

  it('admin creates Tournament A ($1,000 bankroll) and Tournament B ($500 bankroll)', async () => {
    tournamentA = await dbService.createTournament(
      {
        title: 'Torneo Alpha Privado',
        description: 'Torneo cerrado de pronosticos tech con $1000 de saldo virtual',
        prizePool: '$100 USD en efectivo',
        initialBalance: 1000.0,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000 * 7).toISOString(),
        status: 'active',
        categoryFilter: 'Technology',
      },
      adminId
    );
    expect(tournamentA.id).toBeDefined();
    expect(tournamentA.initialBalance).toBe(1000.0);

    tournamentB = await dbService.createTournament(
      {
        title: 'Torneo Beta Amigos',
        description: 'Torneo secundario con $500 de bankroll',
        prizePool: '$50 USD',
        initialBalance: 500.0,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000 * 3).toISOString(),
        status: 'active',
        categoryFilter: 'Sports',
      },
      adminId
    );
    expect(tournamentB.id).toBeDefined();
    expect(tournamentB.initialBalance).toBe(500.0);
  });

  it('admin creates a market directly linked to Tournament A', async () => {
    marketInTorneoA = await dbService.createMarket(
      {
        question: 'Will OpenAI announce GPT-5 before Q4?',
        description: 'Mercado oficial del Torneo Alpha Privado',
        category: 'Technology',
        type: 'binary',
        closeTime: new Date(Date.now() + 86400000).toISOString(),
        resolutionTime: new Date(Date.now() + 172800000).toISOString(),
        liquidityParameter: 100,
        commissionRate: 0.01,
        spread: 0.015,
        tournamentId: tournamentA.id,
        outcomes: [
          { id: 'gpt-yes', name: 'YES', initialProbability: 0.5 },
          { id: 'gpt-no', name: 'NO', initialProbability: 0.5 },
        ],
      },
      adminId
    );

    expect(marketInTorneoA.id).toBeDefined();
    expect(marketInTorneoA.tournamentId).toBe(tournamentA.id);

    // Verify tournament markets link
    const marketsA = await dbService.getTournamentMarkets(tournamentA.id);
    expect(marketsA.some((m) => m.id === marketInTorneoA.id)).toBe(true);
  });

  it('admin links an existing global market to Tournament A', async () => {
    globalMarket = await dbService.createMarket(
      {
        question: 'Will SpaceX Starship catch booster on flight 7?',
        description: 'Mercado global abierto',
        category: 'Technology',
        type: 'binary',
        closeTime: new Date(Date.now() + 86400000).toISOString(),
        resolutionTime: new Date(Date.now() + 172800000).toISOString(),
        liquidityParameter: 100,
        commissionRate: 0.01,
        spread: 0.015,
        outcomes: [
          { id: 'star-yes', name: 'YES', initialProbability: 0.6 },
          { id: 'star-no', name: 'NO', initialProbability: 0.4 },
        ],
      },
      adminId
    );

    expect(globalMarket.tournamentId).toBeUndefined();

    // Link it to Tournament A
    await dbService.addMarketToTournament(tournamentA.id, globalMarket.id);

    const marketsA = await dbService.getTournamentMarkets(tournamentA.id);
    expect(marketsA.some((m) => m.id === globalMarket.id)).toBe(true);
    expect(marketsA).toHaveLength(2);
  });

  it('user joins Tournament A: subwallet receives $1,000 and global balance ($5,000) is NOT modified', async () => {
    await dbService.joinTournament(tournamentA.id, bobId);

    // Check Bob global balance remains strictly $5,000
    const bob = await dbService.getUserById(bobId);
    expect(bob!.virtualBalance).toBe(5000.0);

    // Check Bob tournament participant subwallet
    const participant = await dbService.getUserTournamentParticipant(tournamentA.id, bobId);
    expect(participant).toBeDefined();
    expect(participant!.tournamentBalance).toBe(1000.0);
    expect(participant!.initialGrantedBalance).toBe(1000.0);
  });

  it('leaderboard calculates profit/ROI strictly on tournament subwallet with zero leakage from global balance', async () => {
    const leaderboard = await dbService.getTournamentLeaderboard(tournamentA.id);
    expect(leaderboard.length).toBeGreaterThan(0);

    const bobRank = leaderboard.find((u) => u.id === bobId);
    expect(bobRank).toBeDefined();

    // Bob has $5,000 in global balance, but tournament equity is strictly his subwallet ($1,000)
    expect(bobRank!.totalEquity).toBe(1000.0);
    expect(bobRank!.tournamentBalance).toBe(1000.0);
    expect(bobRank!.totalPnl).toBe(0.0);
    expect(bobRank!.roiPercent).toBe(0.0); // Exactly 0.00%, NOT 400% or 500% profit!
  });

  it('user executes trade in Tournament A market: tournament subwallet is debited, global balance untouched', async () => {
    const tradeRes = await dbService.executeTrade({
      userId: bobId,
      marketId: marketInTorneoA.id,
      outcomeId: 'gpt-yes',
      type: 'BUY',
      amountOrShares: 200.0,
    });

    expect(tradeRes.trade).toBeDefined();

    // Tournament subwallet should have $1,000 - $200 = $800
    const participantAfter = await dbService.getUserTournamentParticipant(tournamentA.id, bobId);
    expect(participantAfter!.tournamentBalance).toBe(800.0);

    // Global balance MUST STILL BE $5,000.00
    const bobUser = await dbService.getUserById(bobId);
    expect(bobUser!.virtualBalance).toBe(5000.0);

    // Check trade recorded with tournament_id
    const trades = await dbService.getTrades(bobId);
    const lastTrade = trades[0];
    expect(lastTrade.tournamentId).toBe(tournamentA.id);

    // Check position recorded with tournament_id
    const positions = await dbService.getPositions(bobId);
    const pos = positions.find((p) => p.marketId === marketInTorneoA.id);
    expect(pos).toBeDefined();
    expect(pos!.tournamentId).toBe(tournamentA.id);
  });

  it('user joins Tournament B: receives isolated $500 subwallet, completely independent from Tournament A', async () => {
    await dbService.joinTournament(tournamentB.id, bobId);

    // Bob subwallet in Tournament B has $500
    const partB = await dbService.getUserTournamentParticipant(tournamentB.id, bobId);
    expect(partB).toBeDefined();
    expect(partB!.tournamentBalance).toBe(500.0);
    expect(partB!.initialGrantedBalance).toBe(500.0);

    // Bob subwallet in Tournament A remains $800 (from previous trade)
    const partA = await dbService.getUserTournamentParticipant(tournamentA.id, bobId);
    expect(partA!.tournamentBalance).toBe(800.0);

    // Bob global balance remains $5000
    const bob = await dbService.getUserById(bobId);
    expect(bob!.virtualBalance).toBe(5000.0);

    // Tournament B leaderboard shows Bob at $500 equity and 0% ROI
    const leaderboardB = await dbService.getTournamentLeaderboard(tournamentB.id);
    const bobRankB = leaderboardB.find((u) => u.id === bobId);
    expect(bobRankB!.totalEquity).toBe(500.0);
    expect(bobRankB!.roiPercent).toBe(0.0);
  });

  it('market resolution in tournament routes winnings strictly to tournament subwallet', async () => {
    // Resolve market in favor of YES
    const resolveResult = await dbService.resolveMarket({
      marketId: marketInTorneoA.id,
      winningOutcomeId: 'gpt-yes',
      adminUserId: adminId,
      resolutionProof: 'OpenAI official keynote announcement',
    });
    expect(resolveResult.market.status).toBe('resolved');

    // Bob should receive payout into Tournament A subwallet
    const partAAfterResolve = await dbService.getUserTournamentParticipant(tournamentA.id, bobId);
    expect(partAAfterResolve!.tournamentBalance).toBeGreaterThan(800.0);

    // Global balance remains strictly untouched ($5,000.00)
    const bob = await dbService.getUserById(bobId);
    expect(bob!.virtualBalance).toBe(5000.0);
  });
});
