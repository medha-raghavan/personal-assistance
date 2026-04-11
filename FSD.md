# Personal Finance Application - Functional Specification Document

## Table of Contents
1. [Overview](#overview)
2. [Technology Stack](#technology-stack)
   - [Backend](#backend)
   - [Frontend (Web)](#frontend-web)
   - [Mobile App](#mobile-app)
   - [Deployment](#deployment)
3. [Core Features](#core-features)
   - [User Authentication](#user-authentication)
   - [Dashboard](#dashboard)
   - [Sections Management](#sections-management)
   - [Transactions Management](#transactions-management)
   - [Bank Statement Upload](#bank-statement-upload)
   - [Category Management](#category-management)
   - [Trips & Expense Splitting](#trips--expense-splitting)
   - [Tax Calculator](#tax-calculator)
4. [Data Models](#data-models)
5. [API Endpoints](#api-endpoints)
6. [UI/UX Features](#uiux-features)
   - [Design System](#design-system)
   - [Mobile Responsiveness](#mobile-responsiveness)
   - [Accessibility](#accessibility)
7. [Mobile Application](#mobile-application)
   - [Tech Stack](#tech-stack)
   - [App Screens](#app-screens)
   - [Screen Details](#screen-details)
   - [Configuration](#configuration)
   - [Building the APK](#building-the-apk)
   - [Mobile-Specific Features](#mobile-specific-features)
8. [Deployment](#deployment-1)
9. [Future Enhancements](#future-enhancements)

---

## Overview

This is a **self-hosted personal finance application** designed to help users:
- Track finances across multiple bank accounts and payment methods
- Upload and parse bank statements automatically (HDFC CSV, HDFC XLS, ICICI PDF)
- Manage expense categories with automatic transaction tagging
- Split expenses with friends/family (Splitwise-like functionality)
- Calculate and compare income tax under Old vs New regimes (India-specific)
- Visualize spending patterns through dashboards and charts
- Access finances via Web UI and Native Android App

The application follows the **Indian Financial Year** convention (April 1 - March 31) and automatically detects FY from transaction/salary dates.

---

## Technology Stack

### Backend
| Component | Technology | Version |
|-----------|------------|---------|
| Runtime | Node.js with TypeScript | 20.x |
| Framework | Express.js | 4.x |
| Database | MongoDB with Mongoose ORM | 6.x |
| Authentication | JWT (JSON Web Tokens) + bcryptjs | - |
| File Parsing | csv-parse, pdf-parse, xlsx | - |
| File Upload | Multer (disk storage with temp files) | - |

### Frontend (Web)
| Component | Technology | Version |
|-----------|------------|---------|
| Framework | React with TypeScript | 18.3.x |
| Build Tool | Vite | 5.x |
| Styling | Tailwind CSS (Dark Mode) | 3.x |
| State Management | Zustand | 4.x |
| Data Fetching | TanStack React Query | 5.x |
| Charts | Recharts | 2.x |
| Icons | Lucide React | - |
| HTTP Client | Axios | 1.x |
| Routing | React Router DOM | 6.x |

### Mobile App
| Component | Technology | Version |
|-----------|------------|---------|
| Framework | React Native with Expo | SDK 52 |
| Styling | NativeWind (TailwindCSS for RN) | 2.0.11 |
| Build Service | EAS Build (Cloud) | - |
| Navigation | Expo Router (file-based) | 4.x |
| Secure Storage | expo-secure-store | 14.x |
| State Management | Zustand | 4.x |
| Data Fetching | TanStack React Query | 5.x |

### Deployment
| Component | Technology |
|-----------|------------|
| Containerization | Docker + Docker Compose |
| Reverse Proxy | Nginx |
| Target Platform | Raspberry Pi / Self-hosted servers |
| Mobile Distribution | EAS Build (APK/AAB) |

---

## Core Features

### User Authentication

**Registration & Login:**
- Email/password-based authentication
- Password hashing with bcryptjs (10 salt rounds)
- JWT token-based session management
- Token stored in localStorage (web) / SecureStore (mobile) with Zustand persistence
- **Cache clearing on logout** - React Query cache is cleared when user logs out

**Security Features:**
- Show/hide password toggle on all password fields
- Protected routes requiring authentication
- Automatic redirect to login for unauthenticated users

---

### Dashboard

The dashboard provides a comprehensive overview of the user's financial status:

**Summary Cards:**
- Total Balance (sum across all sections)
- Monthly Income (current month credits)
- Monthly Expenses (current month debits)
- Savings Rate percentage

**Visualizations:**
- **Section Balances**: Card-based display of each account/wallet balance with type-specific icons
- **Spending Trends**: Line chart showing income vs expenses over time (6 months)
- **Category Breakdown**: Pie/donut chart showing expense distribution by category
- **Recent Transactions**: Quick list of latest transactions

**Quick Actions:**
- Add Transaction button linking to Transactions page

---

### Sections Management

Sections represent different bank accounts, wallets, or cash holdings.

**Section Types:**
| Type | Icon | Description |
|------|------|-------------|
| Cash | Wallet | Physical cash |
| Checking | Building2 | Checking/current accounts |
| Savings | PiggyBank | Savings accounts |
| Credit | CreditCard | Credit cards |
| Investment | Landmark | Investment accounts |
| Digital Wallet | Smartphone | UPI, Paytm, GPay, etc. |

**Features:**
- Create sections with name, label, type, and optional initial balance
- Each section has a calculated balance based on transactions
- Upload-enabled flag for sections supporting bank statement import
- Visual differentiation with type-specific colors and icons
- Parser configuration with auto-detection support

---

### Transactions Management

**Transaction Fields:**
- Date (transaction date with year display, editable)
- Description (with text wrapping for mobile/desktop)
- Amount
- Type (Credit/Debit)
- Section (linked bank account)
- Category (single category per transaction)
- Tags (multiple tags, comma-separated)
- Trip Link (optional, for expense splitting with member splits)
- Currency & Exchange Rate

**Transaction Operations:**
- **Create**: Manual entry with all fields
- **Edit**: Modify all fields including date, description, category, tags, trip link
- **Delete**: Remove individual transactions
- **Multi-Select**: Checkbox selection for bulk operations

**Transaction Totals Display:**
- **Total Income**: Sum of all credit transactions (filtered)
- **Total Expense**: Sum of all debit transactions (filtered)
- **Net Total**: Income minus Expenses
- Totals update dynamically based on active filters
- Includes all filtered transactions, not just current page

**Bulk Operations (Multi-Select):**
| Operation | Description |
|-----------|-------------|
| Bulk Edit Date | Set a new date for all selected transactions |
| Bulk Edit Category | Change or clear category for all selected |
| Bulk Edit Tags | Add, remove, or replace tags for all selected |
| Bulk Delete | Delete multiple transactions at once |

The bulk edit modal provides three tabs:
- **Date Tab**: Set a single date for all selected transactions
- **Category Tab**: Assign a category or clear category from all
- **Tags Tab**: Add tags (append), remove specific tags, or replace all tags

**Comprehensive Filtering:**
| Filter | Description |
|--------|-------------|
| Search | Keyword search in description |
| Section | Filter by bank account |
| Category | Filter by expense category |
| Type | Credit or Debit |
| Date Range | From date to To date |
| Amount Range | Minimum and Maximum amount |
| Tags | Filter by specific tags |
| Trip | Filter by linked trip |

All filters can be combined for complex queries.

**Sorting:**
Clickable column headers for sorting by:
- Date (ascending/descending)
- Section
- Category
- Amount

**Pagination:**
- 100 transactions per page (configurable)
- Page navigation with total count display

**Deduplication:**
Composite key = `Date + Amount + Description + Section`
- Prevents duplicate entries during bank statement upload
- Shows warning for potential duplicates

---

### Bank Statement Upload

**Integrated Upload Flow:**
The upload functionality is integrated into the Transactions page via a modal (no separate Upload page).

**Supported Formats:**

| Format | Extension | Parser | Description |
|--------|-----------|--------|-------------|
| HDFC CSV | .csv | hdfc_csv | Standard HDFC bank statement CSV |
| HDFC Excel | .xls, .xlsx | hdfc_xls | HDFC credit card and bank statements |
| ICICI PDF | .pdf | icici_pdf | ICICI bank statement PDF |

**Auto-Detection:**
The system automatically detects the file format based on extension:
- `.csv` → HDFC CSV Parser
- `.xls`, `.xlsx` → HDFC XLS Parser (handles credit card sparse format)
- `.pdf` → ICICI PDF Parser

Parser selection ignores section configuration and always uses extension-based detection.

**Parser Details:**

1. **HDFC CSV Format**
   - Auto-detects column structure
   - Parses Date, Narration, Value Date, Debit/Credit amounts
   - Handles Indian date formats (DD/MM/YYYY)

2. **HDFC XLS/XLSX Format**
   - Parses binary Excel files (.xls) and modern Excel (.xlsx)
   - **Auto-detects header row** (searches for DATE, Description columns)
   - Handles Excel serial date numbers and various date formats
   - **Supports credit card statements** with sparse column layouts
   - Dynamic column mapping for flexible file structures

3. **ICICI PDF Format**
   - Extracts transaction table from PDF statements
   - Parses transaction rows with regex patterns
   - Supports multi-line descriptions

**Upload Flow:**
1. Click "Upload Statement" button on Transactions page
2. Select target section (bank account)
3. Upload file (drag & drop or browse)
4. Click "Preview and Upload"
5. **Preview parsed transactions** in full-screen modal with:
   - Stats: Total found, Selected, Duplicates
   - Checkbox to select/deselect individual transactions
   - Duplicate indicator (yellow) for existing transactions
   - **Category dropdown** to change auto-detected category per row
   - Mobile-friendly card view on small screens
6. Click "Import X Transactions" to confirm

**Database Optimization:**
- Parsed transactions are stored in temporary JSON files (not in MongoDB)
- `uploadSessionId` field links imported transactions to their upload session
- Temporary files are cleaned up after confirmation or cancellation

**Auto-Categorization:**
- Matches transaction descriptions against category keywords
- Automatically assigns matching category
- **Adds matched keyword as a tag** (not category name)
- Allows manual override during preview

---

### Category Management

**Category Structure:**
- Name (unique per user)
- Color (hex code for visual identification)
- Icon (optional)
- Keywords (array of strings for auto-matching)
- isDefault flag (for system categories)

**Default Categories:**
- Food & Dining
- Shopping
- Transportation
- Bills & Utilities
- Entertainment
- Healthcare
- Travel
- Groceries
- Education
- Investments
- Salary/Income
- Transfers
- Uncategorized

**Keyword-Based Auto-Tagging:**
- Each category has associated keywords (e.g., "swiggy", "zomato", "uber")
- During bank statement upload, descriptions are scanned for keyword matches
- Matched category is auto-assigned
- **Matched keyword is automatically added as a transaction tag** (e.g., "uber" not "Transport")

**Category Operations:**
- Create custom categories with color
- Edit category name, color, keywords
- Add/remove keywords dynamically
- Delete categories (transactions become uncategorized)

---

### Trips & Expense Splitting

A **Splitwise-like** feature for managing shared expenses.

**Trip Structure:**
- Name & Description
- Default Currency (INR, USD, EUR, etc.)
- Exchange Rate to INR
- Start/End Dates
- Members (not app users, just names/emails)
- Status (active, completed, cancelled)

**Trip Members:**
- Add members by name and optional email
- **Current user detection**: If logged-in user's name/email matches a member, they're marked as "Me"
- "Me" is excluded from "Paid by" dropdown for linked transactions
- Member display with initials avatar

**Expense Management:**

1. **Direct Expenses** (within trip):
   - Description, Amount, Currency
   - Paid by (select member)
   - Date & Category
   - **Split Type**:
     - **Equal**: Amount divided equally among selected members
     - **Custom**: Specify exact amount per member
   - **Partial Splits**: Can select subset of members (not mandatory to include all)
   - **Custom Split Validation**: Total must equal expense amount to save

2. **Linked Transactions**:
   - Link existing bank transactions to a trip
   - Specify which members to split with
   - **Auto-select current user as "Paid by"**
   - Adds trip-related tag
   - Shows in trip expenses with "Linked" indicator
   - **Unlinking properly clears** tripId, tripSplits, paidByMemberId fields

**Trip Details Page (Full Page View):**
Four tabs for comprehensive trip management:

1. **Expenses Tab**:
   - Combined list of direct expenses and linked transactions
   - Sorted by date (newest first)
   - Expandable splits view
   - Delete button for direct expenses
   - Mobile card view for small screens

2. **Breakdown Tab (Spreadsheet View)**:
   | Date | Description | Category | Cost | Currency | Member1 | Member2 | ... |
   |------|-------------|----------|------|----------|---------|---------|-----|
   | 05 Apr 2026 | Dinner | Food | 2000 | INR | +1500 | -500 | ... |

   - Columns for each trip member
   - **Positive values (green)**: Amount owed TO this person
   - **Negative values (red)**: Amount owed BY this person
   - Footer row with totals per member

3. **Members Tab**:
   - List of all members with avatars
   - Add new member form
   - Remove member button

4. **Balances Tab**:
   - Per-member: Paid, Owes, Balance
   - **Correct "Owes" calculation**: Payers don't owe themselves
   - Settlement suggestions (who pays whom)

**Export to Excel:**
- Downloads CSV with full breakdown
- Includes all expenses with member columns
- Includes member balances and settlements
- Format matches the Breakdown tab layout

---

### Tax Calculator

Comprehensive income tax management for Indian taxpayers.

**Financial Year Handling:**
- Auto-detects FY from dates (Apr 1 - Mar 31)
- Supports FY 2023-24, 2024-25, 2025-26
- Configurable tax slabs per FY

**Salary Slip Management:**

1. **Manual Entry**:
   - Month selection (April - March)
   - **Earnings**: Basic, HRA, LTA, Special Allowance, Other Allowances
   - **Deductions**: PF, Professional Tax, Income Tax (TDS), Other Deductions
   - Auto-calculates Gross, Total Deductions, Net Salary

2. **PDF Upload & Parsing**:
   - Upload salary slip PDF
   - **Auto-extracts** using regex patterns:
     - Basic Salary
     - House Rent Allowance (HRA)
     - LTA (Leave Travel Allowance)
     - Special Allowance
     - Other Allowances (Books, Internet, Petrol, Food, Research, etc.)
     - Professional Tax
     - Income Tax (TDS)
     - Provident Fund
     - Other Deductions (Labour Welfare, ESI, Food Ded)
   - Shows detected fields for verification
   - Auto-fills form with parsed values
   - Manual adjustment before saving

**Investment/Declaration Tracking:**

| Section | Limit | Examples |
|---------|-------|----------|
| 80C | ₹1,50,000 | PPF, ELSS, LIC, Tax-saver FD, Tuition Fees, Home Loan Principal |
| 80D | ₹75,000 | Health Insurance (self + parents), Preventive Checkup |
| 80CCD(1B) | ₹50,000 | Additional NPS contribution |
| HRA | Calculated | Rent paid exemption |
| LTA | Actual | Travel fare exemption |

**Tax Regime Comparison:**

**New Regime (FY 2025-26):**
| Slab | Rate |
|------|------|
| 0 - 4 Lakh | 0% |
| 4 - 8 Lakh | 5% |
| 8 - 12 Lakh | 10% |
| 12 - 16 Lakh | 15% |
| 16 - 20 Lakh | 20% |
| 20 - 24 Lakh | 25% |
| Above 24 Lakh | 30% |
| Standard Deduction | ₹75,000 |

**Old Regime (FY 2025-26):**
| Slab | Rate |
|------|------|
| 0 - 2.5 Lakh | 0% |
| 2.5 - 5 Lakh | 5% |
| 5 - 10 Lakh | 20% |
| Above 10 Lakh | 30% |
| Standard Deduction | ₹50,000 |
| + 80C, 80D, HRA exemptions | |

**Tax Output:**
- Side-by-side comparison of both regimes
- Taxable income calculation with breakdown
- Tax breakdown by slab
- **Recommended regime** with potential savings amount
- Health & Education Cess (4%)
- Rebate u/s 87A where applicable

**Personalized Tax Tips:**
Organized by priority:

**High Priority:**
- Maximize 80C investments (with remaining amount)
- NPS additional benefit (80CCD 1B)
- Health Insurance (80D)
- HRA Exemption (if applicable)
- Regime recommendation with reasoning

**Medium Priority:**
- Home loan interest benefits
- LTA exemption

**Good to Know:**
- Professional tax deduction info
- Standard deduction details
- Document checklist for filing

**Important Dates:**
- Investment Declaration: January
- Investment Proofs Submission: February
- ITR Filing Deadline: July 31

---

## Data Models

### User
```typescript
{
  _id: ObjectId,
  email: string (unique),
  password: string (hashed),
  name: string,
  createdAt: Date
}
```

### Section
```typescript
{
  _id: ObjectId,
  userId: ObjectId,
  name: string,
  label: string,
  type: 'cash' | 'checking' | 'credit' | 'savings' | 'investment' | 'digital_wallet',
  balance: number,
  uploadEnabled: boolean,
  parserConfig: {
    type: 'auto' | 'hdfc_csv' | 'hdfc_xls' | 'icici_pdf' | 'generic_xls' | 'manual',
    columnMapping?: Record<string, string>
  },
  createdAt: Date
}
```

### Transaction
```typescript
{
  _id: ObjectId,
  userId: ObjectId,
  sectionId: ObjectId,
  uploadSessionId: ObjectId,  // Links to upload session for tracking
  transactionDate: Date,
  valueDate: Date,
  amount: number,
  type: 'credit' | 'debit',
  description: string,
  reference: string,
  tags: string[],
  categoryId: ObjectId,
  tripId: ObjectId,
  tripSplits: [{
    memberId: ObjectId,
    memberName: string,
    amount: number
  }],
  paidByMemberId: ObjectId,
  paidByMemberName: string,
  currency: string,
  exchangeRate: number,
  compositeKey: string,  // Date+Amount+Desc+Section for deduplication
  createdAt: Date
}
```

### Category
```typescript
{
  _id: ObjectId,
  userId: ObjectId,
  name: string,
  color: string,
  icon: string,
  keywords: string[],
  isDefault: boolean,
  createdAt: Date
}
```

### Trip
```typescript
{
  _id: ObjectId,
  userId: ObjectId,
  name: string,
  description: string,
  defaultCurrency: string,
  inrRate: number,
  startDate: Date,
  endDate: Date,
  members: [{
    _id: ObjectId,
    name: string,
    email: string,
    isRegisteredUser: boolean
  }],
  status: 'active' | 'completed' | 'cancelled',
  createdAt: Date
}
```

### TripExpense
```typescript
{
  _id: ObjectId,
  tripId: ObjectId,
  description: string,
  amount: number,
  currency: string,
  amountInINR: number,
  exchangeRate: number,
  paidByMemberId: ObjectId,
  paidByMemberName: string,
  splitType: 'equal' | 'exact',
  splits: [{
    memberId: ObjectId,
    memberName: string,
    amount: number,
    isPaid: boolean
  }],
  date: Date,
  category: string,
  createdAt: Date
}
```

### UploadSession
```typescript
{
  _id: ObjectId,
  userId: ObjectId,
  sectionId: ObjectId,
  fileName: string,
  filePath: string,
  parsedDataPath: string,  // Path to temp JSON file with parsed transactions
  status: 'pending' | 'previewing' | 'confirmed' | 'failed' | 'expired',
  totalCount: number,
  duplicateCount: number,
  newCount: number,
  errorMessage: string,
  expiresAt: Date,  // TTL for auto-cleanup
  createdAt: Date
}
```

### SalarySlip
```typescript
{
  _id: ObjectId,
  userId: ObjectId,
  financialYear: string,
  month: string,
  grossIncome: number,
  basicSalary: number,
  hra: number,
  lta: number,
  specialAllowance: number,
  otherAllowances: number,
  deductions: {
    pf: number,
    professionalTax: number,
    incomeTax: number,
    other: number
  },
  netSalary: number,
  uploadDate: Date,
  createdAt: Date
}
```

### Investment
```typescript
{
  _id: ObjectId,
  userId: ObjectId,
  financialYear: string,
  category: '80C' | '80D' | '80CCD' | 'NPS' | '80G' | 'HRA' | 'LTA' | 'OTHER',
  subCategory: string,
  name: string,
  amount: number,
  description: string,
  status: 'active' | 'completed',
  createdAt: Date
}
```

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | Login and get JWT |
| GET | /api/auth/me | Get current user |

### Sections
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/sections | List all sections |
| POST | /api/sections | Create section |
| PUT | /api/sections/:id | Update section |
| DELETE | /api/sections/:id | Delete section |

### Transactions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/transactions | List with filters, sorting, pagination, totals |
| POST | /api/transactions | Create transaction |
| PUT | /api/transactions/:id | Update transaction |
| DELETE | /api/transactions/:id | Delete transaction |
| PUT | /api/transactions/bulk/update | Bulk update (date, category, tags) |

### Categories
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/categories | List categories |
| POST | /api/categories | Create category |
| PUT | /api/categories/:id | Update category |
| DELETE | /api/categories/:id | Delete category |
| POST | /api/categories/:id/keywords | Add keyword |
| DELETE | /api/categories/:id/keywords/:keyword | Remove keyword |

### Upload
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/upload/statement | Upload & parse bank statement |
| GET | /api/upload/preview/:sessionId | Get parsed transactions |
| POST | /api/upload/confirm/:sessionId | Confirm import |
| DELETE | /api/upload/:sessionId | Cancel upload |

### Trips
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/trips | List all trips |
| GET | /api/trips/:id | Get single trip |
| POST | /api/trips | Create trip |
| PUT | /api/trips/:id | Update trip |
| DELETE | /api/trips/:id | Delete trip |
| POST | /api/trips/:id/members | Add member |
| DELETE | /api/trips/:id/members/:memberId | Remove member |
| GET | /api/trips/:id/expenses | List expenses |
| POST | /api/trips/:id/expenses | Add expense |
| DELETE | /api/trips/:id/expenses/:expenseId | Delete expense |
| GET | /api/trips/:id/balances | Get balances & settlements |
| GET | /api/trips/:id/linked-transactions | Get linked transactions |

### Tax
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/tax/calculate/:fy | Calculate tax for FY |
| GET | /api/tax/salary-slips | List salary slips |
| POST | /api/tax/salary-slip | Add salary slip |
| POST | /api/tax/parse-salary-slip | Parse PDF salary slip |
| GET | /api/tax/slabs/:fy | Get tax slabs |

### Investments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/investments | List investments |
| POST | /api/investments | Create investment |
| PUT | /api/investments/:id | Update investment |
| DELETE | /api/investments/:id | Delete investment |
| GET | /api/investments/summary/:fy | Get summary with limits |

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/dashboard/overview | Get dashboard stats |
| GET | /api/dashboard/trends | Get spending trends |
| GET | /api/dashboard/category-breakdown | Get category breakdown |

---

## UI/UX Features

### Design System
- **Dark Mode**: Full dark theme with gray-800/900 backgrounds
- **Primary Color**: Sky blue (sky-500/600) for interactive elements
- **Typography**: Clean sans-serif with proper hierarchy
- **Cards**: Rounded corners (rounded-lg/xl), subtle borders, hover states
- **Forms**: Consistent input styling with labels and validation
- **Buttons**: Multiple variants (primary, secondary, danger, ghost)

### Mobile Responsiveness

All pages are optimized for mobile devices:

**Responsive Breakpoints:**
- `sm`: 640px (small tablets, large phones)
- `md`: 768px (tablets)
- `lg`: 1024px (laptops)
- `xl`: 1280px (desktops)

**Mobile-First Features:**
- Collapsible sidebar with hamburger menu
- Touch-friendly tap targets (min 44px)
- Responsive font sizes (`text-sm sm:text-base`)
- Compact padding on mobile (`p-2 sm:p-4`)
- Horizontal scrollable tabs
- Card-based views replace tables on mobile
- Full-screen modals on mobile (`max-w-[95vw]`)

**Component Adaptations:**
| Component | Desktop | Mobile |
|-----------|---------|--------|
| Transaction Table | Full table with columns | Card-based list |
| Upload Preview | Table view | Card list with inline editing |
| Trip Expenses | Table | Card list |
| Filters | Inline | Collapsible panel |
| Modals | Centered overlay | Full-screen |
| Navigation | Fixed sidebar | Slide-out drawer |

### Accessibility
- Password visibility toggle on all password fields
- Form validation with inline error messages
- Loading states with spinners
- Empty states with helpful messages and actions
- Proper color contrast in dark mode
- Focus indicators on interactive elements

### Navigation
- Sidebar with icon + label navigation
- Active state indication (highlighted background)
- Mobile: Hamburger menu with slide-out drawer
- Quick access to all major features

### Data Tables
- Sortable columns with indicators
- Horizontal scroll for many columns
- Expandable rows for details (tags, splits)
- Sticky headers
- Multi-select with checkbox column

### Modals
- Multiple sizes: sm, md, lg, xl, 2xl, 3xl, 4xl, full
- `full` size: 95vw on mobile, 4xl on desktop
- Backdrop click to close
- Form validation before submit
- Scrollable content with fixed header

### Feedback
- Loading indicators during API calls
- Inline validation errors
- Success states after operations
- Confirmation dialogs for destructive actions

---

## Mobile Application

### Overview
Full-featured native Android application built with React Native and Expo SDK 52, providing complete feature parity with the web application.

### Tech Stack
| Component | Technology | Version |
|-----------|------------|---------|
| Framework | React Native + Expo | SDK 52 |
| Navigation | Expo Router (file-based) | 4.x |
| Styling | NativeWind + TailwindCSS | v2.0.11 |
| State Management | Zustand | 4.x |
| Data Fetching | TanStack React Query | 5.x |
| HTTP Client | Axios | 1.x |
| Secure Storage | expo-secure-store | 14.x |
| Date Picker | @react-native-community/datetimepicker | 8.x |
| Picker | @react-native-picker/picker | 2.9.x |
| Icons | @expo/vector-icons (Ionicons) | 14.x |

### App Screens

#### Authentication
| Screen | Features |
|--------|----------|
| Login | Email/password login, secure token storage, error handling |
| Register | New user registration, validation, auto-login on success |

#### Main Tabs (Bottom Navigation)
| Tab | Icon | Features |
|-----|------|----------|
| Dashboard | home | Balance overview, income/expense stats, savings rate, recent transactions, quick actions |
| Transactions | swap-horizontal | Full transaction list with totals, search, filters (section, category, type), edit/delete, pagination |
| Add | add-circle | Create transaction with date picker, account selection, type toggle, category, tags |
| Accounts | wallet | Full sections CRUD (create, edit, delete), account type selection, balance display |
| Categories | pricetags | Category CRUD, keyword management (add/remove), color picker |
| Trips | airplane | Trip list with status badges, create trip modal, navigation to details |
| Settings | settings | User profile, logout with cache clearing |

#### Detail Screens
| Screen | Features |
|--------|----------|
| Trip Details | Three tabs (Expenses, Members, Balances), add expense modal, add member, settlement suggestions |

### Screen Details

#### Dashboard Screen
- **Balance Card**: Total balance across all accounts with primary color
- **Stats Row**: This month's income (green) and expenses (red)
- **Savings Rate**: Percentage display with net saved amount
- **Accounts List**: Top 5 accounts with type-specific icons and balances
- **Recent Transactions**: Last 5 transactions with category badges
- **Quick Actions**: Add transaction, Trips, Categories shortcuts

#### Transactions Screen
- **Totals Bar**: Income, Expense, Net totals for filtered results
- **Search**: Real-time search in transaction descriptions
- **Filter Modal**: Section, Category, Type (All/Income/Expense)
- **Transaction Cards**: Date, description, category badge, tags, amount with color
- **Edit Modal**: Full transaction editing (date, description, type, amount, section, category, tags)
- **Delete**: Long-press to delete with confirmation
- **Pagination**: Page navigation for large datasets

#### Add Transaction Screen
- **Date Picker**: Native date picker with formatted display
- **Account Selection**: Dropdown with all user accounts
- **Type Toggle**: Visual expense/income toggle with icons
- **Amount Input**: Large currency input with ₹ prefix
- **Description**: Multi-line text input
- **Category**: Dropdown with all user categories
- **Tags**: Comma-separated tags input
- **Submit**: Loading state, form validation, auto-clear on success

#### Sections (Accounts) Screen
- **Account Cards**: Type icon, name, label, balance with color coding
- **Type Selection**: Visual type picker (Bank, Savings, Credit, Cash, Investment, Digital)
- **Add/Edit Modal**: Name, label, type, initial/current balance
- **Delete**: Confirmation dialog with warning

#### Categories Screen
- **Category Cards**: Color indicator, name, keyword count
- **Keywords Display**: Pill badges with remove button
- **Add Keyword**: Inline input with add/cancel buttons
- **Add/Edit Modal**: Name input, color picker grid
- **Delete**: Non-default categories only

#### Trips Screen
- **Trip Cards**: Name, description, status badge, member count, date range
- **Status Colors**: Active (green), Completed (blue), Cancelled (gray)
- **Create Trip Modal**: Name, description, currency, exchange rate
- **Navigation**: Tap card to view trip details

#### Trip Details Screen
- **Header**: Trip name, total expenses, member count
- **Tabs**: Expenses | Members | Balances
- **Expenses Tab**:
  - Expense cards with description, payer, date, category
  - Split breakdown display
  - Delete button per expense
  - FAB to add new expense
- **Members Tab**:
  - Member list with avatars and "(Me)" indicator
  - Remove member button
  - Add member card/modal
- **Balances Tab**:
  - Per-member: Paid, Owes, Balance (color coded)
  - Settlement suggestions (who pays whom)

#### Add Expense Modal
- Description, amount, paid by (dropdown), split members (multi-select)
- Select all members shortcut
- Category input
- Equal split calculation

### Configuration

**API Base URL:**
Configure in `mobile/services/api.ts` or via environment variable:

```typescript
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001/api';
```

Set via `.env` file:
```
EXPO_PUBLIC_API_URL=http://YOUR_SERVER_IP:3001/api
```

### Building the APK

See `mobile/BUILD.md` for detailed instructions.

**Quick Build:**
```bash
cd mobile
eas build -p android --profile preview
```

### EAS Build Service
- Cloud-based builds (no local Android Studio required)
- Free tier: 30 builds/month, queue wait times
- Paid tier: Unlimited builds, priority queue

### Mobile-Specific Features
- **Pull-to-Refresh**: All list screens support pull-to-refresh
- **Native Pickers**: Platform-native date and dropdown pickers
- **Bottom Sheet Modals**: Slide-up modals for forms
- **Touch Feedback**: Visual feedback on all interactive elements
- **Secure Storage**: JWT tokens stored in device secure storage
- **Cache Management**: React Query caching with 5-minute stale time
- **Error Handling**: Alert dialogs for API errors

### Payment Auto-Detection (Android)

Automatic detection and recording of payments from bank/UPI SMS messages.

**How it works:**
1. App listens for incoming SMS messages from banks and payment apps
2. Parser extracts payment details (amount, merchant, type)
3. Quick Add overlay appears for instant transaction recording
4. User selects account, category, and saves with one tap

**Supported SMS Formats:**
| Bank/Service | Example Message |
|--------------|-----------------|
| HDFC | Rs.500 debited from A/c XX1234 to Amazon |
| ICICI | Your A/c XXXX debited for Rs.500 to Swiggy |
| SBI | Rs.1000 withdrawn from A/c XX5678 |
| UPI (Generic) | Paid Rs.250 to merchant@upi |
| GPay/PhonePe | Rs.100 paid to Store Name |

**Settings (in Settings tab):**
- Enable/disable SMS detection
- View pending (unrecorded) payments
- Test parser with sample SMS
- Setup instructions for first-time users

**Requirements:**
- Android only (iOS does not allow SMS access)
- Requires `react-native-android-sms-listener` library
- Needs RECEIVE_SMS and READ_SMS permissions
- Must rebuild app with EAS after installing library

**Quick Add Overlay:**
- Shows detected amount with debit/credit indicator
- Pre-filled merchant name from SMS
- Account dropdown (defaults to Digital Wallet)
- Quick category selection buttons
- Save or Skip options

---

## Deployment

### Docker Compose Setup
```yaml
services:
  mongodb:
    image: mongo:6
    volumes:
      - mongo_data:/data/db
    
  backend:
    build: ./backend
    environment:
      - MONGODB_URI=mongodb://mongodb:27017/finance
      - JWT_SECRET=your-secret
    depends_on:
      - mongodb
    
  frontend:
    build: ./frontend
    depends_on:
      - backend
    
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    depends_on:
      - frontend
      - backend
```

### Raspberry Pi Optimization
- ARM64 compatible Docker images
- Memory-efficient MongoDB settings
- Nginx caching for static assets
- Optional: External SSD for database

### Environment Variables

**Backend (.env):**
```env
PORT=3001
MONGODB_URI=mongodb://localhost:27017/finance
JWT_SECRET=your-super-secret-key
NODE_ENV=development
```

**Frontend (.env):**
```env
VITE_API_URL=http://localhost:3001/api
```

**Mobile (.env):**
```env
EXPO_PUBLIC_API_URL=http://YOUR_SERVER_IP:3001/api
```

---

## Future Enhancements

### High Priority
1. **iOS App**: Build and deploy iOS version via EAS (same codebase)
2. **Bank Statement Upload (Mobile)**: File picker and upload from device
3. **Tax Calculator (Mobile)**: Salary slips, investments, regime comparison
4. **Push Notifications**: Mobile alerts for transactions and budget warnings

### Medium Priority
5. **Recurring Transactions**: Auto-add monthly bills/subscriptions
6. **Budget Alerts**: Notifications for overspending categories
7. **Multi-Currency Dashboard**: Real-time forex rates
8. **Biometric Authentication**: Fingerprint/Face unlock on mobile
9. **Offline Mode**: Full offline support with sync on reconnect
10. **Notification Listener (Android)**: Direct payment app notification reading for GPay/PhonePe

### Nice to Have
11. **OCR for Images**: Salary slip image parsing (currently PDF only)
12. **Data Export/Import**: Full backup/restore functionality
13. **Two-Factor Authentication**: Enhanced security with TOTP
14. **Shared Sections**: Family account access with permissions
15. **ML Predictions**: Spending forecasts and anomaly detection
16. **Receipt Scanning**: OCR for expense receipts
17. **Widgets**: Home screen widgets for balance and quick add
18. **iOS Share Extension**: Record payments via share sheet on iOS

---

*Last Updated: April 2026*
*Version: 2.2.0*
