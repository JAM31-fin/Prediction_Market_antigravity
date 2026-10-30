# CentraMarkets - Centralized Prediction Market (Private Beta)

CentraMarkets is a high-performance centralized prediction market platform engineered with an LMSR (Logarithmic Market Scoring Rule) automated market maker, atomic state engine, server-authoritative double-entry ledger, and role-based access controls.

---

## Private Beta Readiness Overview

- **Atomic Persistent State**: In-memory data store with atomic file writes (`fs.renameSync`) to `.server_state.json` ensuring zero corruption across server restarts and restarts.
- **Server-Authoritative LMSR Engine**: Pricing, cost calculation, shares valuation, spread margins (0.5%), and platform commission (1.0%) calculated on the backend.
- **Strict Role Enforcement**: Administrative endpoints (`/api/admin/*`) require server-verified sessions with `role: "admin"`.
- **Financial Audit Ledger**: Comprehensive ledger recording every credit movement: `BUY`, `SELL`, `COMMISSION`, `SETTLEMENT`, and `REFUND`.
- **Structured Logging & Security**: Redacted logs with PII masking, cryptographic SHA-256 password salting, sanitized error responses, and no leaked stack traces in production.
- **Real-time Event Streaming**: Server-Sent Events (SSE) broadcasting live order fills, price changes, and settlements.

---

## Getting Started

### Prerequisites
- Node.js 18+ or 20+
- npm or bun

### Environment Configuration
Copy `.env.example` to `.env` and configure your settings:

```bash
cp .env.example .env
```

| Variable | Description | Default |
|---|---|---|
| `PORT` | Container and HTTP port | `3000` |
| `NODE_ENV` | Environment mode (`development` or `production`) | `production` |
| `SESSION_SECRET` | Cryptographic secret for session token hashing | *Change in production* |
| `STATE_STORAGE_PATH` | File path for persistent JSON database | `.server_state.json` |
| `ENABLE_DEV_SHORTCUTS` | Set to `false` for private beta; isolates balance resets | `false` |
| `VITE_APP_NAME` | Client-facing brand name | `CentraMarkets` |
| `VITE_API_URL` | Base API URL for client-server communication | `/api` |

### Installation & Build

```bash
# Install dependencies
npm install

# Run type check and lint
npm run lint

# Build production bundle (client + bundled server)
npm run build

# Start production server
npm run start
```

---

## Canonical Seed Accounts

For private beta testing, canonical accounts are created on initial initialization only if they do not already exist. They are never overwritten on restart:

| Account | Email | Role | Initial Virtual Balance |
|---|---|---|---|
| **Administrator** | `admin@demo.com` | `admin` | $25,000.00 |
| **Demo Trader** | `user@demo.com` | `user` | $1,000.00 |

*Passwords can be changed or new beta users can register via the sign-up modal.*

---

## System Architecture

```
centramarkets/
├── src/
│   ├── components/         # React presentation components & trading terminal
│   │   ├── admin/          # Market creator, resolver, risk & revenue analytics
│   │   ├── auth/           # Authentication & registration modals
│   │   ├── common/         # Layout headers, navigation, badges
│   │   ├── home/           # Market discovery, category filters, featured carousel
│   │   ├── market-detail/  # Real-time order book, depth chart, LMSR trading panel
│   │   └── portfolio/      # Open positions, trade history, PnL analytics
│   ├── context/            # MarketContext & AuthContext
│   ├── server/             # Authoritative backend services
│   │   ├── apiRouter.ts    # HTTP routing, RBAC, input validation, sanitized errors
│   │   ├── logger.ts       # Structured logging with PII redaction
│   │   ├── realtimeService.ts # Server-Sent Events (SSE) broadcast engine
│   │   └── serverState.ts  # LMSR math, persistent storage, ledger, mutex lock
│   ├── services/           # Client HTTP and SSE connectors
│   └── types.ts            # TypeScript contracts and market models
├── server.ts               # Express entrypoint mounting API and Vite middleware
└── package.json
```

---

## Health Check & Monitoring

The API provides a dedicated health check endpoint:

```bash
GET /api/health
```

Response:
```json
{
  "status": "ok",
  "service": "centra-prediction-markets",
  "database": "connected",
  "timestamp": "2026-09-21T02:15:02.933Z",
  "connections": 1
}
```
