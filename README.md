# Personal Finance Tracker

A self-hosted personal finance application for tracking finances across multiple accounts, managing trips with expense splitting, and computing India-specific taxes.

## Features

- **Multi-Section Finance Tracking**: Track multiple bank accounts, credit cards, and cash
- **Bank Statement Import**: Upload CSV/PDF statements from HDFC and ICICI banks with auto-categorization
- **Trip/Project Management**: Create trips, add members, track expenses, and split costs
- **Tax Calculator**: Compare Old vs New tax regimes for Indian FY with investment tracking
- **Interactive Dashboard**: View balances, spending trends, and category breakdowns
- **Mobile App**: React Native app for Android (iOS coming soon)

## Tech Stack

- **Backend**: Node.js, Express, TypeScript, MongoDB
- **Frontend**: React, TypeScript, Vite, Tailwind CSS, Recharts
- **Mobile**: React Native, Expo
- **Deployment**: Docker, Docker Compose

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB (local or Docker)
- npm or yarn

### Development Setup

1. **Clone and install dependencies**:
   ```bash
   # Backend
   cd backend
   npm install
   cp .env.example .env
   
   # Frontend
   cd ../frontend
   npm install
   ```

2. **Start MongoDB** (using Docker):
   ```bash
   docker-compose -f docker-compose.dev.yml up -d
   ```

3. **Start the backend**:
   ```bash
   cd backend
   npm run dev
   ```

4. **Start the frontend**:
   ```bash
   cd frontend
   npm run dev
   ```

5. Open http://localhost:3000 in your browser

### Production Deployment (Docker)

```bash
# Build and run all services
docker-compose up -d

# View logs
docker-compose logs -f
```

The application will be available at:
- Frontend: http://localhost:3000
- API: http://localhost:3001

## Project Structure

```
personal-finance/
├── backend/
│   ├── src/
│   │   ├── config/         # Configuration
│   │   ├── controllers/    # Route handlers
│   │   ├── middleware/     # Express middleware
│   │   ├── models/         # MongoDB schemas
│   │   ├── routes/         # API routes
│   │   ├── services/
│   │   │   └── parsers/    # Bank statement parsers
│   │   └── utils/          # Helper functions
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── services/       # API client
│   │   ├── store/          # Zustand stores
│   │   └── types/          # TypeScript types
│   └── Dockerfile
├── mobile/                 # React Native app
├── docker-compose.yml
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh token
- `GET /api/auth/me` - Get current user

### Sections
- `GET /api/sections` - List sections
- `POST /api/sections` - Create section
- `PUT /api/sections/:id` - Update section
- `DELETE /api/sections/:id` - Delete section

### Transactions
- `GET /api/transactions` - List with filters
- `POST /api/transactions` - Create transaction
- `PUT /api/transactions/:id` - Update transaction
- `DELETE /api/transactions/:id` - Delete transaction
- `PUT /api/transactions/bulk/tags` - Bulk update tags
- `GET /api/transactions/calendar/:year/:month` - Calendar data

### Upload
- `POST /api/upload/statement` - Upload bank statement
- `GET /api/upload/preview/:id` - Preview parsed transactions
- `POST /api/upload/confirm/:id` - Confirm import

### Trips
- `GET /api/trips` - List trips
- `POST /api/trips` - Create trip
- `GET /api/trips/:id/summary` - Get trip summary with splits

### Tax
- `GET /api/tax/calculate/:fy` - Calculate tax for FY
- `POST /api/tax/salary-slip` - Add salary slip
- `GET /api/investments/summary/:fy` - Investment summary

### Dashboard
- `GET /api/dashboard/overview` - Dashboard data
- `GET /api/dashboard/trends` - Spending trends
- `GET /api/dashboard/category-breakdown` - Category breakdown

## Bank Statement Formats

### HDFC CSV
Expected columns: Date, Description, Reference, Value Date, Withdrawal, Deposit, Balance

### ICICI PDF
The parser extracts transactions from standard ICICI bank statement PDFs.

## Environment Variables

```env
# Server
PORT=3001
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/personal-finance

# JWT
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
```

## Tax Slabs (FY 2025-26)

### New Regime
| Income Range | Tax Rate |
|-------------|----------|
| 0 - 4L | 0% |
| 4L - 8L | 5% |
| 8L - 12L | 10% |
| 12L - 16L | 15% |
| 16L - 20L | 20% |
| 20L - 24L | 25% |
| Above 24L | 30% |

### Old Regime
| Income Range | Tax Rate |
|-------------|----------|
| 0 - 2.5L | 0% |
| 2.5L - 5L | 5% |
| 5L - 10L | 20% |
| Above 10L | 30% |

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT
