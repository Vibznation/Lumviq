You are the lead product architect, senior full-stack engineer, accounting-systems specialist, UX designer, security engineer and QA lead for a new software platform called Lumviq.

Your assignment is to design and build Lumviq as a production-quality, AI-native, all-in-one accounting and business financial-management platform.

WORKING BRAND

Name: Lumviq
Pronunciation: LUM-vik
Tagline: “Clarity behind every number.”

Lumviq is a working name and must be stored in centralized brand configuration so it can be changed later without editing the entire codebase.

CORE VISION

Lumviq will combine the strongest capabilities associated with:

- QuickBooks Online
- Xero
- Zoho Books
- Sage Intacct
- FreshBooks
- Oracle NetSuite
- Microsoft Dynamics 365 Business Central
- Odoo Accounting
- Wave
- Sage Accounting/Sage 50

Do not copy proprietary code, layouts, wording, branding or protected assets from these products. Study only their broad functional strengths and common customer complaints.

Lumviq must become an original platform that delivers:

- QuickBooks’ U.S. accounting ecosystem and tax readiness
- Xero’s collaboration and reconciliation experience
- Zoho Books’ automation
- Sage Intacct’s fund, grant and dimensional accounting
- FreshBooks’ invoicing and service-business usability
- NetSuite’s multi-entity scalability
- Business Central’s operational integration
- Odoo’s modularity
- Wave’s accessibility
- Sage’s accounting controls, inventory and job costing

Correct their common weaknesses through:

- Clear, predictable navigation
- Progressive feature disclosure
- Transparent pricing architecture
- Fast self-service onboarding
- Complete data portability
- Strong performance
- Responsive design
- Explainable AI
- Human approval for material financial actions
- Modular functionality
- Reliable integrations
- Simple workflows without sacrificing accounting accuracy

Do not claim that any software has literally no weaknesses. Build Lumviq to eliminate or substantially reduce the common weaknesses found in existing platforms.

PRIMARY USERS

Lumviq must eventually support:

- Freelancers
- Independent contractors
- Startups
- Small businesses
- Midsize businesses
- Nonprofits and foundations
- Professional service firms
- Construction and project-based businesses
- Retail and e-commerce companies
- Inventory-based businesses
- Multi-location organizations
- Multi-entity enterprises
- Accountants and bookkeeping firms

PRODUCT PRINCIPLE

“Powerful underneath. Simple on the surface.”

Users must not be forced to understand debits and credits to complete normal tasks. Lumviq must maintain a professional double-entry accounting ledger behind every operational workflow.

The application should reveal features based on the organization’s industry, size, activated modules and user role. Do not show every feature to every user.

EXECUTION RULES

1. First inspect the existing repository completely.
2. Preserve existing working code, user changes and configuration.
3. Identify the current framework, package manager, database and design system.
4. If a working application already exists, extend it instead of rebuilding unnecessarily.
5. Do not create a second application inside the repository.
6. Do not replace working functionality with static mockups.
7. Do not use fake buttons, dead navigation or decorative controls without functionality.
8. Do not expose secrets in source code.
9. Use environment variables and create or update `.env.example` with placeholder names only.
10. Use strict TypeScript.
11. Use database migrations, not manual database assumptions.
12. Preserve monetary precision using database decimal/numeric values or integer minor units. Never use floating-point arithmetic for money.
13. Make all financial posting operations transactional and idempotent.
14. Never silently alter posted accounting records.
15. Build automated tests for the ledger and every material financial workflow.
16. After each implementation phase, run linting, type checks, unit tests, integration tests and the production build.
17. Fix errors before proceeding.
18. Document architectural decisions and unfinished integration requirements.
19. Do not ask unnecessary questions. Make professional, documented assumptions when information is missing.
20. Do not falsely claim an external integration works unless it has been tested with valid credentials or a documented sandbox.

RECOMMENDED TECHNOLOGY

If the repository does not already establish an appropriate stack, use:

- Next.js with App Router
- React
- TypeScript in strict mode
- PostgreSQL
- Supabase for managed PostgreSQL, authentication, storage and row-level security
- Tailwind CSS
- A consistent accessible component library
- React Hook Form
- Zod validation
- TanStack Table for professional data tables
- Recharts or another accessible charting library
- Vitest for unit tests
- Playwright for end-to-end tests
- Background jobs for imports, recurring transactions, notifications and financial processing
- A provider-neutral AI service layer
- A provider-neutral integration adapter layer

Do not change an established repository stack merely to follow this recommendation.

ARCHITECTURE

Build Lumviq as a modular monolith initially, with clear domain boundaries that can later be separated into services.

Required domains:

- Identity and access
- Organizations and tenants
- Subscriptions and entitlements
- Accounting ledger
- Banking and reconciliation
- Sales and receivables
- Purchasing and payables
- Expenses and receipts
- Payments
- Payroll
- Inventory
- Projects and time
- Budgeting and forecasting
- Tax readiness
- Nonprofit funds and grants
- Multi-entity management
- Reporting and analytics
- Documents
- Notifications
- Audit and compliance
- AI intelligence
- Integrations

Create clean internal APIs and domain services. UI components must not directly perform accounting logic.

MULTITENANCY

The platform must support:

- One user belonging to multiple organizations
- Multiple users in one organization
- Separate books for each legal entity
- Multiple locations, departments, programs, projects and funds
- Consolidated reporting without combining legally separate ledgers
- Strong tenant isolation
- Row-level security where supported
- Organization-scoped queries
- Explicit organization switching
- Invitations and membership management
- Fine-grained permissions

Never rely only on a client-provided organization ID for authorization. Enforce tenant access on the server and database layers.

USER MODES

Create three presentation modes over the same trusted financial data:

1. Business Owner ModePlain language
2. Essential financial information
3. Guided workflows
4. Actions and warnings
5. Accountant ModeGeneral ledger
6. Journal entries
7. Trial balance
8. Reconciliation
9. Adjusting entries
10. Close management
11. Professional reports
12. Executive ModeKPIs
13. Trends
14. Budgets
15. Forecasts
16. Risks
17. Performance summaries
18. Strategic scenarios

Permissions and user modes are different concepts. A mode changes presentation; permissions control access.

PRIMARY NAVIGATION

Use a clear desktop sidebar and responsive mobile navigation:

- Overview
- Sales
- Expenses
- Banking
- Accounting
- Payroll
- Inventory
- Projects
- Planning
- Reports
- Intelligence
- Settings

Show Payroll, Inventory, Projects, Grants and other specialized modules only when activated.

GLOBAL COMMAND BAR

Add a universal command bar:

“Ask Lumviq, search records or create something…”

It should support:

- Searching customers, vendors, transactions, invoices, bills and accounts
- Navigating to modules
- Starting supported actions
- Asking natural-language financial questions
- Opening contextual help

Do not allow the command bar to execute high-risk financial actions without preview and approval.

DESIGN DIRECTION

Lumviq must feel trustworthy, modern, calm and professional.

Suggested palette:

- Deep midnight blue for trust
- Electric teal for intelligence
- Warm gold for important financial progress
- White and soft gray for workspaces
- Accessible red, amber and green for status

Requirements:

- Light and dark modes
- Responsive desktop, tablet and mobile layouts
- WCAG 2.2 AA accessibility
- Keyboard navigation
- Visible focus states
- Sufficient color contrast
- Clear empty, loading, success and error states
- Skeleton loading where appropriate
- Tables that remain usable on smaller screens
- No excessive gradients
- No cluttered dashboards
- No tiny text
- No oversized marketing-style cards inside operational screens

OVERVIEW COMMAND CENTER

The main dashboard should answer:

- How much cash is available?
- How much revenue has been earned?
- What must be collected?
- What must be paid?
- Is the organization profitable?
- What needs attention?
- What is expected to happen next?

Include:

- Cash position
- Revenue
- Expenses
- Net income
- Outstanding invoices
- Upcoming bills
- Estimated tax obligations
- Payroll obligations when activated
- Budget versus actual
- Cash-flow forecast
- Accounts requiring reconciliation
- Close readiness
- Approval queue
- Financial alerts
- Recent activity
- Customizable date range
- Drill-down from every material number to its supporting records

CORE ACCOUNTING ENGINE

This is the most important part of Lumviq.

Implement a proper double-entry ledger containing:

- Chart of accounts
- Account types and subtypes
- Journal entries
- Journal lines
- Debit and credit validation
- Fiscal years and periods
- Posting dates
- Document dates
- Source modules
- References
- Dimensions
- Attachments
- Currencies
- Exchange rates
- Reversals
- Recurring entries
- Adjusting entries
- Opening balances
- Closing periods
- Audit history

Ledger requirements:

- Every posted journal entry must balance
- Posted records must be immutable
- Corrections use reversals and replacement entries
- Draft entries may be edited
- Posting must occur in a database transaction
- Duplicate posting must be prevented with idempotency keys
- Closed periods must reject unauthorized postings
- Authorization must be checked server-side
- Journal numbers must be unique by organization
- Source documents must retain links to generated journal entries
- Every report must derive from the ledger or a traceable financial subledger
- Use append-only audit events for material financial changes
- Provide drill-down from reports to journal lines and source documents
- Support cash and accrual reporting where correctly applicable

Create a documented posting matrix showing how invoices, payments, bills, expenses, inventory, payroll and other workflows affect the ledger.

SALES AND RECEIVABLES

Implement:

- Customers
- Contacts
- Estimates
- Proposals
- Sales orders as a later-ready domain
- Invoices
- Credit notes
- Deposits
- Retainers
- Recurring invoices
- Progress billing
- Payment terms
- Taxes and discounts
- Multi-currency preparation
- Online payment status
- Customer statements
- Aging reports
- Automatic reminders
- Customer portal architecture
- PDF generation
- Email delivery through an adapter
- Invoice activity timeline

Invoice lifecycle:

Draft → Sent → Viewed → Partially Paid → Paid → Overdue → Voided

Voiding or correcting an invoice must follow sound accounting controls.

PURCHASING, BILLS AND EXPENSES

Implement:

- Vendors
- Bills
- Vendor credits
- Purchase orders
- Expense transactions
- Employee reimbursements
- Recurring bills
- Payment scheduling
- Approval workflows
- Cost allocation
- Receipt and document attachment
- Duplicate detection
- Three-way matching architecture for purchase order, receipt and invoice
- Vendor activity history
- Accounts-payable aging

Create an upload workflow for receipts and bills. Design an OCR provider interface, but do not pretend OCR is active without a configured provider.

BANKING AND RECONCILIATION

Implement:

- Bank and credit-card accounts
- Imported bank transactions
- CSV import with mapping, preview and validation
- Bank-feed adapter interfaces
- Transaction matching
- Categorization rules
- Transfer detection
- Duplicate detection
- Reconciliation sessions
- Statement opening and closing balances
- Cleared and reconciled statuses
- Reconciliation discrepancy display
- Undo controls with permissions and audit history
- Suggested matches with confidence levels

Bank imports must not create duplicate transactions when files are uploaded again.

Prepare adapters for services such as Plaid or other bank-data providers, but do not hard-code the platform to one provider.

PAYMENTS

Create a provider-neutral payments layer supporting future integrations with payment processors.

Include:

- Payment intents
- Customer payments
- Vendor payments
- Refunds
- Processing fees
- Partial payments
- Failed-payment handling
- Webhook verification
- Idempotent webhook processing
- Payout reconciliation
- Processor clearing accounts
- Transaction audit records

Do not store raw card information.

PAYROLL

Build the internal payroll domain and provider adapter architecture.

Support future functionality for:

- Employees
- Contractors
- Pay schedules
- Earnings
- Deductions
- Benefits
- Taxes
- Time entries
- Payroll runs
- Direct-deposit status
- Payroll liabilities
- W-2 and 1099 readiness
- Payroll journal posting
- Department and project allocation

Do not represent payroll tax filing or direct deposit as operational without a licensed and configured provider.

INVENTORY

Implement or prepare the domain for:

- Products and services
- SKUs
- Categories
- Units of measure
- Inventory locations
- Stock movements
- Purchase receipts
- Sales fulfillment
- Adjustments
- Transfers
- Reorder points
- Cost of goods sold
- Inventory valuation
- Average cost initially
- Extensible valuation methods
- Lot and serial tracking
- Inventory audit trail
- Low-stock alerts

Inventory movement and financial posting must remain synchronized through tested domain services.

PROJECTS AND TIME

Implement:

- Projects
- Customers
- Project status
- Project budgets
- Tasks and milestones
- Time entries
- Billable and nonbillable time
- Project expenses
- Staff assignments
- Invoicing from approved time and expenses
- Estimated versus actual
- Project profitability
- Job costing
- Project-level reporting

PLANNING AND FORECASTING

Implement:

- Annual and monthly budgets
- Department, project, location, program and fund budgets
- Budget versions
- Approval workflow
- Budget versus actual reporting
- Rolling forecasts
- Cash-flow forecasting
- Assumption management
- Best-case, expected and worst-case scenarios
- Scenario comparison

Forecasts must be visually identified as projections, never recorded as actual accounting transactions.

NONPROFIT AND GRANT ACCOUNTING

Create a first-class nonprofit edition, not an afterthought.

Support:

- Funds
- Restricted and unrestricted resources
- Grants
- Programs
- Donors
- Donations
- Pledges
- In-kind contributions
- Scholarship awards
- Grant budgets
- Allowable expense categories
- Grant periods
- Reporting deadlines
- Functional expense allocation
- Board-designated funds
- Statement of activities
- Statement of financial position
- Statement of functional expenses
- Grant budget versus actual
- Restricted balance reporting
- Complete audit trail

Prevent restricted funds from being presented as freely available cash.

MULTI-ENTITY MANAGEMENT

Architect for:

- Multiple legal entities
- Entity-specific ledgers
- Parent-child relationships
- Intercompany transactions
- Due-to and due-from accounts
- Eliminations
- Consolidated reporting
- Multiple currencies
- Exchange-rate adjustments
- Entity-level permissions
- Consolidated dashboards

Do not combine separate legal entities into one set of books.

REPORTING

Required reports:

- Profit and loss
- Balance sheet
- Cash-flow statement
- Trial balance
- General ledger
- Journal report
- Accounts-receivable aging
- Accounts-payable aging
- Sales by customer
- Expenses by vendor
- Budget versus actual
- Project profitability
- Inventory valuation
- Tax summary
- Fund activity
- Grant activity
- Functional expenses
- Consolidated financial statements when supported

Every report should provide:

- Date and dimension filters
- Cash or accrual basis when valid
- Comparison periods
- Export to CSV
- Print-friendly/PDF-ready output
- Drill-down to source transactions
- Saved report configurations
- Plain-language summary
- Professional accounting view
- Executive visualization where useful

AI INTELLIGENCE

Create a provider-neutral AI layer called Lumviq Intelligence.

Capabilities:

- Explain financial performance
- Answer natural-language questions
- Suggest transaction categories
- Explain variances
- Identify unusual transactions
- Predict possible cash shortages
- Summarize overdue receivables
- Recommend follow-up actions
- Produce management summaries
- Generate draft board reports
- Assist with budgets and forecasts
- Identify missing documents
- Explain accounting terms
- Guide users through workflows

AI safety requirements:

- AI cannot directly post journal entries without approval
- AI cannot move money
- AI cannot run payroll
- AI cannot file taxes
- AI cannot close periods
- AI cannot modify permissions
- AI suggestions must include supporting data
- Show confidence where appropriate
- Clearly distinguish facts, forecasts and recommendations
- Log AI-generated financial suggestions and approvals
- Prevent cross-tenant information leakage
- Do not send unnecessary personal or financial data to model providers
- Support redaction and provider configuration
- Validate structured AI output with Zod or equivalent schemas

FINANCIAL HEALTH AND ANOMALIES

Create transparent financial-health indicators based on:

- Liquidity
- Profitability
- Cash reserves
- Receivable aging
- Payable pressure
- Expense growth
- Revenue concentration
- Budget performance
- Debt obligations
- Reconciliation status
- Tax readiness

Never produce a mysterious score. Show the factors, source data and calculation.

Add anomaly detection architecture for:

- Duplicate bills
- Unusual journal entries
- Changed vendor banking information
- Unexpected payroll changes
- Missing deposits
- Subscription increases
- Grant overspending
- Negative inventory
- Repeated failed payments

Phrase alerts neutrally. Do not accuse users, employees or vendors of fraud without evidence.

ROLES AND PERMISSIONS

Include configurable roles such as:

- Owner
- Administrator
- Accountant
- Bookkeeper
- Executive
- Manager
- Accounts Receivable
- Accounts Payable
- Payroll Administrator
- Inventory Manager
- Project Manager
- Employee
- Auditor
- Read Only

Support permissions by action, module, entity and dimension where appropriate.

Add approval rules for:

- Bills
- Expenses
- Payments
- Purchase orders
- Journal entries
- Payroll runs
- Budgets
- Vendor banking changes

AUDIT AND SECURITY

Implement:

- Secure authentication
- MFA-ready architecture
- Passkey-ready architecture
- Session controls
- Role-based authorization
- Row-level security where applicable
- Encryption in transit
- Secure secret management
- Rate limiting
- CSRF protection where applicable
- Content Security Policy
- Secure headers
- Input validation
- Output encoding
- File-type and file-size validation
- Signed file access
- Webhook verification
- Audit logs
- Login history
- Sensitive-action confirmations
- Separation of duties
- Data export
- Data-retention controls
- Backup and recovery documentation

Audit logs must capture:

- Actor
- Organization
- Action
- Resource
- Previous and new state when appropriate
- Timestamp
- Request or correlation ID
- IP and device context when legally and technically appropriate

Do not log passwords, full access tokens, raw card information or unnecessary personal data.

ONBOARDING

Create an onboarding process that can be completed quickly:

1. Create an account
2. Create or join an organization
3. Select business or nonprofit
4. Select industry
5. Enter legal and fiscal details
6. Choose cash or accrual defaults with explanation
7. Activate relevant modules
8. Import existing data or start fresh
9. Connect or manually create bank accounts
10. Invite an accountant or team
11. Review the generated chart of accounts
12. Enter opening balances
13. Complete a readiness checklist

Generate an appropriate starting chart of accounts by organization type while allowing accountant review.

DATA IMPORT AND EXPORT

Create import tools for:

- Customers
- Vendors
- Chart of accounts
- Products
- Invoices
- Bills
- Bank transactions
- Journal entries
- Opening balances

Include:

- Downloadable templates
- Column mapping
- Validation
- Error reporting
- Preview
- Duplicate handling
- Dry-run mode
- Rollback strategy
- Import history

Support full organization data export in standard formats. Never trap customer data.

INTEGRATION ARCHITECTURE

Prepare documented adapters for:

- Banking providers
- Payment processors
- Payroll providers
- Tax providers
- E-commerce platforms
- Point-of-sale platforms
- CRM platforms
- Email providers
- Document OCR
- Cloud storage
- AI providers
- Microsoft 365 and Google Workspace
- Zapier-style automation
- Public developer API and webhooks

Each integration must have:

- Interface contract
- Credential configuration
- Sandbox mode where available
- Connection status
- Error handling
- Retry strategy
- Rate-limit handling
- Idempotency
- Webhook validation
- Health monitoring
- Disconnect and data-retention behavior

DATABASE MODEL

Design a normalized database schema with clear IDs, organization scope, timestamps and audit fields.

Core entities should include, at minimum:

- users
- organizations
- organization_memberships
- roles
- permissions
- entities
- locations
- departments
- programs
- funds
- grants
- fiscal_years
- accounting_periods
- currencies
- exchange_rates
- accounts
- journal_entries
- journal_lines
- dimensions
- dimension_values
- contacts
- customers
- vendors
- products
- invoices
- invoice_lines
- customer_payments
- bills
- bill_lines
- vendor_payments
- bank_accounts
- bank_transactions
- reconciliation_sessions
- reconciliation_items
- expenses
- receipts
- projects
- time_entries
- inventory_locations
- inventory_movements
- budgets
- budget_lines
- forecasts
- employees
- contractors
- payroll_runs
- documents
- approvals
- notifications
- integrations
- webhooks
- audit_events
- ai_interactions
- import_jobs
- export_jobs
- subscriptions
- feature_entitlements

Use UUIDs or another appropriate non-sequential identifier strategy. Add appropriate indexes, unique constraints, foreign keys and check constraints.

TESTING REQUIREMENTS

Create tests for:

- Balanced journal enforcement
- Unbalanced journal rejection
- Posted-entry immutability
- Reversal behavior
- Closed-period restrictions
- Tenant isolation
- Permission enforcement
- Invoice posting
- Customer payment application
- Bill posting
- Vendor payment application
- Partial payments
- Credit notes
- Bank-import idempotency
- Reconciliation
- Inventory valuation and COGS
- Payroll journal generation
- Fund restrictions
- Grant budget reporting
- Multi-currency calculations
- Multi-entity separation
- Report accuracy
- AI approval boundaries
- Webhook idempotency
- Import validation
- Data export
- Responsive critical workflows
- Accessibility of essential screens

Use fixed, deterministic accounting fixtures. Add end-to-end tests for the most important user journeys.

MVP IMPLEMENTATION ORDER

Do not attempt to build every enterprise feature superficially in one pass.

Phase 1: Foundation

- Repository audit
- Architecture documentation
- Design system
- Authentication
- Organizations and memberships
- Multitenancy and permissions
- Organization onboarding
- Chart of accounts
- Double-entry ledger
- Fiscal periods
- Audit events

Phase 2: Essential accounting

- Customers and vendors
- Invoices
- Bills
- Expenses
- Payments
- Bank accounts
- CSV transaction imports
- Reconciliation
- Core reports
- Overview dashboard

Phase 3: Intelligence and collaboration

- Global command bar
- Lumviq Intelligence service layer
- Approval center
- Accountant mode
- Executive mode
- Notifications
- Document management
- Import/export center

Phase 4: Business operations

- Projects and time
- Inventory
- Purchase orders
- Budgeting
- Cash-flow forecasting
- Payroll provider architecture
- Tax-readiness center

Phase 5: Advanced editions

- Nonprofit funds and grants
- Multi-entity management
- Consolidation
- Intercompany accounting
- Advanced dimensions
- Advanced reporting
- Integration marketplace

For features outside the active phase, create clean domain boundaries and roadmap documentation. Do not fill the interface with fake unfinished modules.

MVP ACCEPTANCE CRITERIA

The initial usable release is complete only when a new organization can:

- Register securely
- Complete onboarding
- Invite another user
- Configure a chart of accounts
- Add customers and vendors
- Create and send an invoice
- Record a customer payment
- Enter a bill
- Record a vendor payment
- Upload an expense receipt
- Import bank transactions
- Reconcile a bank account
- View accurate profit-and-loss and balance-sheet reports
- Drill from a report to source transactions
- Review the audit trail
- Export its data
- Use responsive desktop and mobile interfaces
- Pass automated ledger, security and workflow tests

DEMO DATA

Create a clearly labeled demo organization with realistic but fictional data demonstrating:

- Customers
- Vendors
- Invoices
- Bills
- Payments
- Expenses
- Bank transactions
- Projects
- Reports
- A small number of actionable alerts

Demo data must never mix with production organizations.

DELIVERABLES

Produce:

1. Working application code
2. Database schema and migrations
3. Seeded demo environment
4. Reusable design system
5. Responsive interface
6. Core accounting engine
7. Automated test suite
8. `.env.example`
9. Setup instructions
10. Architecture documentation
11. Ledger posting matrix
12. Permissions matrix
13. Integration adapter documentation
14. Security notes
15. Known limitations
16. Product roadmap
17. Deployment instructions
18. Verification report showing actual commands run and results

FINAL QUALITY STANDARD

Lumviq must not be presented as a visual prototype if it is only a prototype. Clearly distinguish production-ready functionality, sandbox integrations, demonstrations and roadmap items.

Prioritize in this order:

1. Accounting correctness
2. Security and tenant isolation
3. Data integrity and auditability
4. User simplicity
5. Accessibility
6. Reliability and testing
7. Performance
8. Visual polish
9. Advanced features

Begin by auditing the repository and reporting:

- Existing stack
- Existing functionality
- Reusable components
- Problems or risks
- Proposed architecture
- Database strategy
- Immediate implementation plan

Then begin implementation with Phase 1. Continue autonomously through safe, testable milestones. After every milestone, verify the work and summarize what is functional, what remains simulated and what comes next.

Do not merely describe Lumviq. Build it.