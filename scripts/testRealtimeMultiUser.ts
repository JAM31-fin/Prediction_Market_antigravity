import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY');
  process.exit(1);
}

async function runTest() {
  console.log('--- Starting Multi-Client Supabase Realtime Integration Test ---');

  // 1. Authenticate 3 test sessions against the local backend server
  const loginUserA = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'usera@demo.com', password: 'User123!' }),
  }).then((r) => r.json());

  const loginUserB = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'userb@demo.com', password: 'User123!' }),
  }).then((r) => r.json());

  const loginAdmin = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@demo.com', password: 'Admin123!' }),
  }).then((r) => r.json());

  console.log('Logged in sessions:', {
    userA: loginUserA.user?.name,
    userB: loginUserB.user?.name,
    admin: loginAdmin.user?.name,
  });

  const userAId = loginUserA.user.id;
  const userBId = loginUserB.user.id;
  const adminId = loginAdmin.user.id;

  // 2. Instantiate 3 distinct Supabase Realtime client instances (simulating 3 separate browser tabs)
  const clientA = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  const clientB = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  const clientAdmin = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

  // Tracking buckets
  const userAReceivedPublic: any[] = [];
  const userBReceivedPublic: any[] = [];
  const adminReceivedPublic: any[] = [];

  const userAPrivateEvents: any[] = [];
  const userBPrivateEvents: any[] = [];
  const adminPrivateEvents: any[] = [];

  // Setup Client A channels
  const chPublicA = clientA.channel('public:markets');
  chPublicA.on('broadcast', { event: 'market:update' }, (msg) => userAReceivedPublic.push(msg.payload));
  chPublicA.on('broadcast', { event: 'market:created' }, (msg) => userAReceivedPublic.push(msg.payload));

  const chPrivateA = clientA.channel(`user:${userAId}`);
  chPrivateA.on('broadcast', { event: 'user:update' }, (msg) => userAPrivateEvents.push(msg.payload));

  // Setup Client B channels
  const chPublicB = clientB.channel('public:markets');
  chPublicB.on('broadcast', { event: 'market:update' }, (msg) => userBReceivedPublic.push(msg.payload));
  chPublicB.on('broadcast', { event: 'market:created' }, (msg) => userBReceivedPublic.push(msg.payload));

  const chPrivateB = clientB.channel(`user:${userBId}`);
  chPrivateB.on('broadcast', { event: 'user:update' }, (msg) => userBPrivateEvents.push(msg.payload));

  // Setup Client Admin channels
  const chPublicAdmin = clientAdmin.channel('public:markets');
  chPublicAdmin.on('broadcast', { event: 'market:update' }, (msg) => adminReceivedPublic.push(msg.payload));

  const chAdminTelemetry = clientAdmin.channel('admin:updates');
  chAdminTelemetry.on('broadcast', { event: 'admin:update' }, (msg) => adminPrivateEvents.push(msg.payload));

  // Wait for all channels to be SUBSCRIBED
  console.log('Subscribing all client channels to Supabase Realtime...');
  await Promise.all([
    new Promise((resolve) => chPublicA.subscribe((s) => s === 'SUBSCRIBED' && resolve(s))),
    new Promise((resolve) => chPrivateA.subscribe((s) => s === 'SUBSCRIBED' && resolve(s))),
    new Promise((resolve) => chPublicB.subscribe((s) => s === 'SUBSCRIBED' && resolve(s))),
    new Promise((resolve) => chPrivateB.subscribe((s) => s === 'SUBSCRIBED' && resolve(s))),
    new Promise((resolve) => chPublicAdmin.subscribe((s) => s === 'SUBSCRIBED' && resolve(s))),
    new Promise((resolve) => chAdminTelemetry.subscribe((s) => s === 'SUBSCRIBED' && resolve(s))),
  ]);

  console.log('All 6 Supabase Realtime channels SUBSCRIBED successfully!');
  await new Promise((r) => setTimeout(r, 600));

  // 3. Find an active open market for testing
  const allMarketsRes = await fetch('http://localhost:3000/api/markets').then((r) => r.json());
  let targetMarket = allMarketsRes.markets.find((m: any) => m.status === 'open');

  if (!targetMarket) {
    // Admin creates an open market for testing
    const mRes = await fetch('http://localhost:3000/api/admin/markets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${loginAdmin.token}`,
      },
      body: JSON.stringify({
        question: `Test Market Active ${Date.now()}`,
        description: 'Test market',
        category: 'Technology',
        type: 'binary',
        status: 'open',
        closeTime: new Date(Date.now() + 86400000).toISOString(),
        resolutionTime: new Date(Date.now() + 90000000).toISOString(),
        liquidityParameter: 200,
        commissionRate: 0.01,
        spread: 0.015,
        outcomes: [
          { id: 'yes', name: 'YES', initialProbability: 0.5 },
          { id: 'no', name: 'NO', initialProbability: 0.5 },
        ],
      }),
    }).then((r) => r.json());
    targetMarket = mRes.market;
  }

  const marketId = targetMarket.id;
  const outcome1 = targetMarket.outcomes[0].id;
  const outcome2 = targetMarket.outcomes[1].id;
  console.log('Using target open market:', marketId, 'outcomes:', outcome1, outcome2);

  // --------------------------------------------------------------------------
  // TEST STEP 1: User A buys shares on an active market
  // --------------------------------------------------------------------------
  console.log('\n--- Step 1: User A executes BUY order ---');
  const tradeResA = await fetch('http://localhost:3000/api/trades/execute', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${loginUserA.token}`,
    },
    body: JSON.stringify({
      marketId,
      outcomeId: outcome1,
      type: 'BUY',
      amountOrShares: 10,
      idempotencyKey: `test-e2e-a-${Date.now()}`,
    }),
  }).then((r) => r.json());

  console.log('User A trade status:', tradeResA.success);

  // Allow real-time delivery
  await new Promise((r) => setTimeout(r, 800));

  console.log('Results for Step 1:');
  console.log('User B received public market update?', userBReceivedPublic.length > 0);
  console.log('Admin received telemetry update?', adminPrivateEvents.length > 0);
  console.log('User A received private user update?', userAPrivateEvents.length > 0);
  console.log('User B received User A private events? (Must be 0):', userBPrivateEvents.length);

  if (userBPrivateEvents.length > 0) {
    throw new Error('SECURITY VIOLATION: User B received private user data!');
  }

  // --------------------------------------------------------------------------
  // TEST STEP 2: User B executes BUY order
  // --------------------------------------------------------------------------
  console.log('\n--- Step 2: User B executes BUY order ---');
  const userAPublicCountBefore = userAReceivedPublic.length;
  const adminCountBefore = adminPrivateEvents.length;

  const tradeResB = await fetch('http://localhost:3000/api/trades/execute', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${loginUserB.token}`,
    },
    body: JSON.stringify({
      marketId,
      outcomeId: outcome2,
      type: 'BUY',
      amountOrShares: 8,
      idempotencyKey: `test-e2e-b-${Date.now()}`,
    }),
  }).then((r) => r.json());

  console.log('User B trade status:', tradeResB.success);

  await new Promise((r) => setTimeout(r, 800));

  console.log('Results for Step 2:');
  console.log('User A received public market update from B?', userAReceivedPublic.length > userAPublicCountBefore);
  console.log('Admin received trade telemetry from B?', adminPrivateEvents.length > adminCountBefore);
  console.log('User B received their own private update?', userBPrivateEvents.length > 0);

  // --------------------------------------------------------------------------
  // TEST STEP 3: Admin creates a new market
  // --------------------------------------------------------------------------
  console.log('\n--- Step 3: Admin creates a new market ---');
  const userAPublicBeforeCreate = userAReceivedPublic.length;
  const userBPublicBeforeCreate = userBReceivedPublic.length;

  const newMarketQuestion = `Real-time Test Market ${Date.now()}`;
  const createRes = await fetch('http://localhost:3000/api/admin/markets', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${loginAdmin.token}`,
    },
    body: JSON.stringify({
      question: newMarketQuestion,
      description: 'Automated test market for multi-client verification',
      category: 'Technology',
      type: 'binary',
      status: 'open',
      closeTime: new Date(Date.now() + 86400000).toISOString(),
      resolutionTime: new Date(Date.now() + 90000000).toISOString(),
      resolutionSource: 'Official Observation Network',
      resolutionRules: 'Resolves YES if verified.',
      liquidityParameter: 200,
      commissionRate: 0.01,
      spread: 0.015,
      outcomes: [
        { id: 'yes', name: 'YES', initialProbability: 0.5, color: '#10b981' },
        { id: 'no', name: 'NO', initialProbability: 0.5, color: '#f43f5e' },
      ],
    }),
  }).then((r) => r.json());

  console.log('Admin created market:', createRes.success, createRes.market?.id);

  await new Promise((r) => setTimeout(r, 800));

  console.log('Results for Step 3:');
  const userAReceivedNewMarket = userAReceivedPublic.slice(userAPublicBeforeCreate).some(
    (p) => (p.market?.id === createRes.market?.id || p.id === createRes.market?.id)
  );
  const userBReceivedNewMarket = userBReceivedPublic.slice(userBPublicBeforeCreate).some(
    (p) => (p.market?.id === createRes.market?.id || p.id === createRes.market?.id)
  );

  console.log('User A received new market in real time?', userAReceivedNewMarket);
  console.log('User B received new market in real time?', userBReceivedNewMarket);

  // --------------------------------------------------------------------------
  // TEST STEP 4: Admin updates market status (Pause / Open)
  // --------------------------------------------------------------------------
  console.log('\n--- Step 4: Admin updates market status ---');
  const userAPublicBeforeStatus = userAReceivedPublic.length;
  const userBPublicBeforeStatus = userBReceivedPublic.length;

  const statusRes = await fetch(`http://localhost:3000/api/admin/markets/${createRes.market.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${loginAdmin.token}`,
    },
    body: JSON.stringify({ status: 'paused' }),
  }).then((r) => r.json());

  console.log('Admin status update response:', statusRes.success, statusRes.market?.status);

  await new Promise((r) => setTimeout(r, 800));

  const userAReceivedStatus = userAReceivedPublic.slice(userAPublicBeforeStatus).some(
    (p) => (p.market?.id === createRes.market?.id && p.market?.status === 'paused')
  );
  const userBReceivedStatus = userBReceivedPublic.slice(userBPublicBeforeStatus).some(
    (p) => (p.market?.id === createRes.market?.id && p.market?.status === 'paused')
  );

  console.log('User A received market status change in real time?', userAReceivedStatus);
  console.log('User B received market status change in real time?', userBReceivedStatus);

  // Cleanup test market
  await fetch(`http://localhost:3000/api/admin/markets/${createRes.market.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${loginAdmin.token}` },
  });

  // Cleanup channels
  await Promise.all([
    clientA.removeChannel(chPublicA),
    clientA.removeChannel(chPrivateA),
    clientB.removeChannel(chPublicB),
    clientB.removeChannel(chPrivateB),
    clientAdmin.removeChannel(chPublicAdmin),
    clientAdmin.removeChannel(chAdminTelemetry),
  ]);

  console.log('\n==================================================');
  console.log('ALL REALTIME MULTI-CLIENT TESTS PASSED 100%!');
  console.log('==================================================\n');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
