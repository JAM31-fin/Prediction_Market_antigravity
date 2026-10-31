import { describe, it, expect, beforeAll } from 'vitest';
import { runMigrations } from '../src/server/migrate';
import { dbService } from '../src/server/dbService';
import { dbTransaction } from '../src/server/db';
import { Money } from '../src/server/money';

describe('Centralized Prediction Market - Full Lifecycle & Accounting Invariants', () => {
  let adminId: string;
  let aliceId: string;
  let marketId: string;

  beforeAll(async () => {
    // Run schema migrations and seed canonical accounts
    await runMigrations();

    const admin = await dbService.getUserByUsernameOrEmail('admin31');
    expect(admin).toBeDefined();
    expect(admin!.role).toBe('admin');
    adminId = admin!.id;

    // Register a test trader by username without email (starts with $0.00 base balance)
    const traderAuth = await dbService.register('alice_trader', 'Pass123!');
    expect(traderAuth.user).toBeDefined();
    expect(traderAuth.user.virtualBalance).toBe(0.0);
    aliceId = traderAuth.user.id;

    // Grant Alice $1,000.00 virtual trading balance and double-entry ledger credit
    await dbTransaction(async (client) => {
      await client.query('UPDATE users SET virtual_balance = 1000.0 WHERE id = $1;', [aliceId]);
      await client.query(
        `INSERT INTO ledger_transactions (id, user_id, user_email, type, amount, balance_after, description, timestamp)
         VALUES ($1, $2, $3, 'INITIAL_DEMO_CREDIT', 1000.0, 1000.0, 'Test bankroll funding', NOW());`,
        [`ledg-alice-${Date.now()}`, aliceId, 'alice_trader@centra.internal']
      );
    });
  });

  it('admin creates a centralized binary market with LMSR parameter b = 100', async () => {
    const market = await dbService.createMarket(
      {
        question: 'Will AI reach AGI by end of year?',
        category: 'Technology',
        type: 'binary',
        closeTime: new Date(Date.now() + 86400000).toISOString(),
        resolutionTime: new Date(Date.now() + 172800000).toISOString(),
        liquidityParameter: 100,
        commissionRate: 0.01, // 1% fee
        spread: 0.015, // 1.5% half spread
        outcomes: [
          { id: 'out-1', name: 'YES', initialProbability: 0.5 },
          { id: 'out-2', name: 'NO', initialProbability: 0.5 },
        ],
      },
      adminId
    );

    expect(market.id).toBeDefined();
    expect(market.status).toBe('open');
    expect(market.outcomes).toHaveLength(2);
    expect(market.cumulativeLmsrCashFlow).toBe(0);
    expect(market.volume).toBe(0);

    marketId = market.id;
  });

  it('user buys YES shares from the House: cash flows into LMSR escrow and fees to the House', async () => {
    const userBefore = await dbService.getUserById(aliceId);
    const initialBal = userBefore!.virtualBalance;

    const investmentAmount = 100.0; // User invests $100

    const tradeRes = await dbService.executeTrade({
      userId: aliceId,
      marketId,
      outcomeId: 'out-1', // YES
      type: 'BUY',
      amountOrShares: investmentAmount,
    });

    expect(tradeRes.trade).toBeDefined();
    expect(tradeRes.trade.amount).toBe(100.0);
    expect(tradeRes.trade.fee).toBe(1.0); // 1% commission
    expect(tradeRes.trade.spreadFee).toBe(1.5); // 1.5% spread
    expect(tradeRes.trade.lmsrCashFlow).toBe(97.5); // Net cash collected by LMSR

    // User balance must decrease by exactly $100.00
    const userAfter = tradeRes.updatedUser;
    expect(userAfter.virtualBalance).toBe(Money.subtract(initialBal, investmentAmount));

    // Position must be recorded
    expect(tradeRes.updatedPosition.quantity).toBeGreaterThan(0);
    expect(tradeRes.updatedPosition.currentCostBasis).toBe(97.5);

    // Market volume and cumulative cash flow must increase
    expect(tradeRes.updatedMarket.volume).toBe(100.0);
    expect(tradeRes.updatedMarket.cumulativeLmsrCashFlow).toBe(97.5);
    expect(tradeRes.updatedMarket.totalCommissionRevenue).toBe(1.0);
    expect(tradeRes.updatedMarket.totalSpreadRevenue).toBe(1.5);

    // YES probability must rise above 50%
    const yesOutcome = tradeRes.updatedMarket.outcomes.find((o) => o.id === 'out-1');
    expect(yesOutcome!.currentPrice).toBeGreaterThan(0.5);

    // Price history must record the trade timestamp and new outcome price
    expect(tradeRes.updatedMarket.priceHistory).toBeDefined();
    expect(tradeRes.updatedMarket.priceHistory.length).toBeGreaterThanOrEqual(1);
    const latestPoint = tradeRes.updatedMarket.priceHistory[tradeRes.updatedMarket.priceHistory.length - 1];
    expect(latestPoint.timestamp).toBeGreaterThan(0);
    expect(latestPoint.prices['out-1']).toBeGreaterThan(0.5);
    expect(latestPoint.volume).toBe(100.0);
  });

  it('user sells back a portion of shares to the House: House refunds net value minus fees', async () => {
    const userBefore = await dbService.getUserById(aliceId);
    const balanceBefore = userBefore!.virtualBalance;

    const positions = await dbService.getPositions(aliceId);
    const pos = positions.find((p) => p.marketId === marketId && p.outcomeId === 'out-1');
    expect(pos).toBeDefined();
    expect(pos!.quantity).toBeGreaterThan(10);

    const sharesToSell = 20;

    const tradeRes = await dbService.executeTrade({
      userId: aliceId,
      marketId,
      outcomeId: 'out-1',
      type: 'SELL',
      amountOrShares: sharesToSell,
    });

    expect(tradeRes.trade.type).toBe('SELL');
    expect(tradeRes.trade.quantity).toBe(sharesToSell);
    expect(tradeRes.trade.lmsrCashFlow).toBeLessThan(0); // Negative cash flow: LMSR refunds user

    // User balance must increase by net proceeds
    const userAfter = tradeRes.updatedUser;
    expect(userAfter.virtualBalance).toBeGreaterThan(balanceBefore);

    // Remaining position quantity is reduced by exactly sharesToSell
    expect(tradeRes.updatedPosition.quantity).toBeCloseTo(pos!.quantity - sharesToSell, 2);
  });

  it('resolves market: settles winning shares to $1.00, losing to $0.00, and calculates House P&L', async () => {
    const userBefore = await dbService.getUserById(aliceId);
    const balBeforeResolution = userBefore!.virtualBalance;

    const positions = await dbService.getPositions(aliceId);
    const openPos = positions.find((p) => p.marketId === marketId && p.status === 'OPEN');
    expect(openPos).toBeDefined();
    const remainingYesShares = openPos!.quantity;

    // Admin resolves market with YES ('out-1') as winner
    const resolutionRes = await dbService.resolveMarket({
      adminUserId: adminId,
      marketId,
      winningOutcomeId: 'out-1',
    });

    expect(resolutionRes.market.status).toBe('resolved');
    expect(resolutionRes.market.resolvedOutcomeId).toBe('out-1');

    // Winning user must receive exactly $1.00 per share
    const expectedPayout = Money.round(remainingYesShares * 1.0);
    const userAfter = await dbService.getUserById(aliceId);
    expect(userAfter!.virtualBalance).toBe(Money.add(balBeforeResolution, expectedPayout));

    // House P&L verification:
    // Realized MM P&L = Cumulative LMSR Cash Flow - Total Payout
    const finalMarket = resolutionRes.market;
    const expectedMMPnL = Money.subtract(
      Number(finalMarket.cumulativeLmsrCashFlow),
      Number(finalMarket.settlementPayout)
    );
    expect(finalMarket.realizedMMPnL).toBe(expectedMMPnL);

    // Net platform result includes commission + spread
    const totalFees = Money.add(
      Number(finalMarket.totalCommissionRevenue),
      Number(finalMarket.totalSpreadRevenue)
    );
    const expectedPlatformResult = Money.add(expectedMMPnL, totalFees);
    expect(finalMarket.realizedPlatformResult).toBe(expectedPlatformResult);
  });

  it('audits House solvency & double-entry ledger integrity', async () => {
    const audit = await dbService.getHouseSolvencyAudit();

    expect(audit).toBeDefined();
    expect(audit.solvencyStatus).toBe('HEALTHY');
    expect(audit.ledgerIntegrity.isBalanced).toBe(true);
    expect(Math.abs(audit.ledgerIntegrity.difference)).toBeLessThan(0.05);

    // Sum of all users' virtual balance matches sum of credits/debits in ledger
    expect(audit.totalUserBalances).toBeCloseTo(audit.ledgerIntegrity.totalCreditsAndDebits, 1);
  });

  it('accurately increments active traders count when multiple users execute trades', async () => {
    // 1. Create a fresh test market
    const testMarket = await dbService.createMarket({
      question: 'Will Humanoid Robots work in factories by 2027?',
      category: 'Technology',
      type: 'binary',
      closeTime: new Date(Date.now() + 86400000).toISOString(),
      resolutionTime: new Date(Date.now() + 172800000).toISOString(),
      liquidityParameter: 100,
      commissionRate: 0.01,
      spread: 0.015,
      outcomes: [
        { id: 'bot-yes', name: 'YES', initialProbability: 0.5 },
        { id: 'bot-no', name: 'NO', initialProbability: 0.5 },
      ],
    }, adminId);

    // Initial traders count is 0
    expect(testMarket.totalTraders).toBe(0);

    // 2. Register Trader 1 and execute a trade
    const t1 = await dbService.register('trader_one_test', 'Pass123!');
    await dbTransaction(async (client) => {
      await client.query('UPDATE users SET virtual_balance = 1000.0 WHERE id = $1;', [t1.user.id]);
    });

    const trade1Res = await dbService.executeTrade({
      userId: t1.user.id,
      marketId: testMarket.id,
      outcomeId: 'bot-yes',
      type: 'BUY',
      amountOrShares: 50.0,
    });
    expect(trade1Res.updatedMarket.totalTraders).toBe(1);

    // 3. Register Trader 2 and execute a trade on the same market
    const t2 = await dbService.register('trader_two_test', 'Pass123!');
    await dbTransaction(async (client) => {
      await client.query('UPDATE users SET virtual_balance = 1000.0 WHERE id = $1;', [t2.user.id]);
    });

    const trade2Res = await dbService.executeTrade({
      userId: t2.user.id,
      marketId: testMarket.id,
      outcomeId: 'bot-no',
      type: 'BUY',
      amountOrShares: 75.0,
    });
    expect(trade2Res.updatedMarket.totalTraders).toBe(2);

    // 4. Verify getPlatformMetrics reflects multiple active users
    const platformMetrics = await dbService.getPlatformMetrics();
    expect(platformMetrics.activeUsers).toBeGreaterThanOrEqual(2);
    expect(platformMetrics.totalUsers).toBeGreaterThanOrEqual(3); // admin + trader1 + trader2
  });

  describe('Phase 1 - Subsidy Budget Calibration & Optimistic Resolution Window', () => {
    let optMarketId: string;
    let bobId: string;
    let bobInitialBal: number;
    let bobSharesHeld: number;

    it('creates a market with calibrated subsidy budget S and derives liquidity parameter b', async () => {
      // 1. Specify subsidyBudget = $150 USD with asymmetric probabilities 70% / 30%
      // b = 150 / ln(1 / 0.3) ~= 124.59
      const market = await dbService.createMarket({
        question: 'Will SpaceX Starship land on Mars before 2029?',
        category: 'Technology',
        type: 'binary',
        closeTime: new Date(Date.now() + 86400000).toISOString(),
        resolutionTime: new Date(Date.now() + 172800000).toISOString(),
        subsidyBudget: 150,
        commissionRate: 0.01,
        spread: 0.015,
        outcomes: [
          { id: 'star-yes', name: 'YES', initialProbability: 0.7 },
          { id: 'star-no', name: 'NO', initialProbability: 0.3 },
        ],
      }, adminId);

      expect(market.id).toBeDefined();
      expect(market.subsidyBudget).toBe(150);
      expect(market.liquidityParameter).toBeCloseTo(124.59, 1);

      optMarketId = market.id;

      // 2. Register Bob, fund him, and execute a BUY trade
      const bobAuth = await dbService.register('bob_trader', 'Pass123!');
      bobId = bobAuth.user.id;
      await dbTransaction(async (client) => {
        await client.query('UPDATE users SET virtual_balance = 500.0 WHERE id = $1;', [bobId]);
      });

      const tradeRes = await dbService.executeTrade({
        userId: bobId,
        marketId: optMarketId,
        outcomeId: 'star-yes',
        type: 'BUY',
        amountOrShares: 100.0,
      });

      bobInitialBal = tradeRes.updatedUser.virtualBalance;
      bobSharesHeld = tradeRes.updatedPosition.quantity;
      expect(bobSharesHeld).toBeGreaterThan(0);
    });

    it('proposes optimistic resolution: sets status to resolving and sets disputeDeadline WITHOUT transferring funds or settling positions', async () => {
      // Propose YES ('star-yes') as winner with a 300-second dispute window
      const proposeRes = await dbService.proposeMarketResolution({
        marketId: optMarketId,
        proposedOutcomeId: 'star-yes',
        resolutionProof: 'https://spacex.com/official-mission-log',
        disputeWindowSeconds: 300,
        adminUserId: adminId,
      });

      expect(proposeRes.market.status).toBe('resolving');
      expect(proposeRes.market.proposedOutcomeId).toBe('star-yes');
      expect(proposeRes.market.resolutionProof).toBe('https://spacex.com/official-mission-log');
      expect(proposeRes.disputeDeadline).toBeDefined();

      const deadlineMs = new Date(proposeRes.disputeDeadline).getTime();
      expect(deadlineMs).toBeGreaterThan(Date.now() + 250 * 1000);

      // INVARIANT CHECK: Zero balance transfers occurred during proposal
      const bobAfterProposal = await dbService.getUserById(bobId);
      expect(bobAfterProposal!.virtualBalance).toBe(bobInitialBal);

      // Positions must still be OPEN
      const positions = await dbService.getPositions(bobId);
      const bobPos = positions.find((p) => p.marketId === optMarketId);
      expect(bobPos!.status).toBe('OPEN');

      // Trading must be strictly rejected while in resolving state
      await expect(
        dbService.executeTrade({
          userId: bobId,
          marketId: optMarketId,
          outcomeId: 'star-no',
          type: 'BUY',
          amountOrShares: 20.0,
        })
      ).rejects.toThrow(/Trading is disabled/i);
    });

    it('disputes proposed resolution: reverts market to open/closed and clears proposed outcome and deadline', async () => {
      const disputeRes = await dbService.disputeMarketResolution({
        marketId: optMarketId,
        reason: 'Reported conflicting telemetry; re-evaluating landing footage.',
        adminUserId: adminId,
      });

      expect(disputeRes.market.status).toBe('open');
      expect(disputeRes.market.proposedOutcomeId).toBeUndefined();
      expect(disputeRes.market.disputeDeadline).toBeUndefined();
      expect(disputeRes.market.disputeReason).toContain('telemetry');

      // Attempting to finalize a non-resolving market must fail
      await expect(
        dbService.finalizeMarketResolution({
          marketId: optMarketId,
          adminUserId: adminId,
        })
      ).rejects.toThrow(/No winning outcome has been proposed/i);
    });

    it('finalizes optimistic resolution after dispute deadline: atomically transfers payouts and sets status to resolved', async () => {
      // 1. Propose resolution again with a 1-second window
      await dbService.proposeMarketResolution({
        marketId: optMarketId,
        proposedOutcomeId: 'star-yes',
        resolutionProof: 'https://spacex.com/official-mission-log-verified',
        disputeWindowSeconds: 1,
        adminUserId: adminId,
      });

      // 2. Wait 1.1s for dispute window to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // 3. Finalize without force
      const finalRes = await dbService.finalizeMarketResolution({
        marketId: optMarketId,
        adminUserId: adminId,
        force: false,
      });

      expect(finalRes.market.status).toBe('resolved');
      expect(finalRes.market.resolvedOutcomeId).toBe('star-yes');
      expect(finalRes.settlement.settledCount).toBeGreaterThanOrEqual(1);

      // 4. Bob must have received exactly $1.00 per share
      const bobFinal = await dbService.getUserById(bobId);
      const expectedPayout = Money.round(bobSharesHeld * 1.0);
      expect(bobFinal!.virtualBalance).toBe(Money.add(bobInitialBal, expectedPayout));

      // 5. Position status must be SETTLED_WIN
      const positions = await dbService.getPositions(bobId);
      const bobPos = positions.find((p) => p.marketId === optMarketId);
      expect(bobPos!.status).toBe('SETTLED_WIN');
    });

    it('calculates Risk Coverage Ratio metric in RiskEngine', async () => {
      const allMarkets = await dbService.getMarkets();
      const allTrades = await dbService.getTrades();
      const allPositions = await dbService.getPositions();

      const aggregates = (await import('../src/services/riskEngine')).RiskEngine.calculatePlatformAggregates(
        allMarkets,
        allTrades,
        allPositions
      );

      expect(aggregates).toBeDefined();
      expect(aggregates.riskCoverageRatio).toBeDefined();
      expect(typeof aggregates.riskCoverageRatio).toBe('number');
      expect(aggregates.netRemainingExposure).toBeGreaterThanOrEqual(0);
    });

    it('executes anonymous trade and protects user identity on public feeds', async () => {
      const anonMarket = await dbService.createMarket(
        {
          question: 'Will Mars exploration mission launch by 2030?',
          category: 'Technology',
          type: 'binary',
          closeTime: new Date(Date.now() + 86400000).toISOString(),
          resolutionTime: new Date(Date.now() + 172800000).toISOString(),
          liquidityParameter: 100,
          commissionRate: 0.01,
          spread: 0.015,
          outcomes: [
            { id: 'mars-yes', name: 'YES', initialProbability: 0.5 },
            { id: 'mars-no', name: 'NO', initialProbability: 0.5 },
          ],
        },
        adminId
      );

      // 1. Execute an anonymous buy trade with Alice
      const res = await dbService.executeTrade({
        userId: aliceId,
        marketId: anonMarket.id,
        outcomeId: 'mars-yes',
        type: 'BUY',
        amountOrShares: 25.0,
        isAnonymous: true,
      });

      expect(res.trade).toBeDefined();
      expect(res.trade.isAnonymous).toBe(true);

      // 2. In user private trade history, trade is recorded with isAnonymous = true
      const userTrades = await dbService.getTrades(aliceId);
      const foundTrade = userTrades.find((t) => t.id === res.trade.id);
      expect(foundTrade).toBeDefined();
      expect(foundTrade!.isAnonymous).toBe(true);
      expect(foundTrade!.userId).toBe(aliceId);

      // 3. In the public tape / public trades feed, identity is masked
      const publicTrades = await dbService.getPublicTrades(anonMarket.id);
      const publicEntry = publicTrades.find((t) => t.id === res.trade.id);
      expect(publicEntry).toBeDefined();
      expect(publicEntry!.isAnonymous).toBe(true);
      expect(publicEntry!.userName).toBe('Trader Anónimo');
      expect(publicEntry!.userId).toBe('anon');
    });
  });
});
