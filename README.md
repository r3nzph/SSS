# 🏪 Sari-Sari Store POS

A modern, browser-based Point of Sale (POS) system for sari-sari stores. Built with vanilla JavaScript (ES Modules) and pure CSS — no frameworks, no build tools, no Electron.

## Quick Start

Serve the project directory with any HTTP server:

```bash
# Using Python
python -m http.server 8080

# Using Node.js (npx)
npx serve .

# Using PHP
php -S localhost:8080
```

Then open `http://localhost:8080/login.html` in your browser.

**Default credentials:**
- Admin: `admin` / `admin123`
- Cashier: `cashier` / `cashier123`

## Project Structure

```
/
├── login.html          # Login page
├── admin.html           # Admin dashboard
├── cashier.html         # Cashier POS terminal
├── index.html           # Redirects to login.html
│
├── css/
│   ├── main.css         # Base styles & layout
│   ├── theme.css        # Theme variables (dark/light)
│   ├── admin.css        # Admin-specific styles
│   ├── cashier.css      # Cashier POS styles
│   ├── components.css   # Reusable component styles
│   └── animations.css   # @keyframes & transitions
│
├── js/
│   ├── app.js           # Login page entry point
│   ├── admin.js         # Admin page entry point
│   ├── cashier.js       # Cashier page entry point
│   ├── auth.js          # Authentication & RBAC
│   ├── session.js       # Session management
│   ├── storage.js       # Centralized CRUD data layer
│   ├── theme.js         # Dark/light theme manager
│   ├── utils.js         # Utility functions
│   ├── ui.js            # Toast, confirm, prompt, loading
│   ├── audit.js         # Activity logging
│   ├── login.js         # Login handler
│   ├── receipts.js      # Receipt viewer & printing
│   ├── dashboard.js     # Admin dashboard KPIs & charts
│   ├── inventory.js     # Product management
│   ├── suppliers.js     # Supplier management
│   ├── purchase-orders.js  # Purchase order management
│   ├── stock-receiving.js  # Stock receiving from POs
│   ├── stock-adjustments.js # Stock adjustments (stub)
│   ├── reports.js       # Sales & reports (charts, exports)
│   ├── users.js         # User management (stub)
│   ├── accounts.js      # Account CRUD operations
│   ├── settings.js      # Config center / settings
│   ├── pos.js           # Point of sale terminal
│   ├── transactions.js  # Checkout & transaction processing
│   ├── cashier-index.js # Cashier module controller
│   ├── admin-index.js   # Admin module controller
│   └── ...              # Additional module files
│
├── data/
│   ├── data.json        # Persistent data store
│   └── backup/          # Backup storage directory
│
└── assets/
    ├── images/          # Product images & logos
    ├── icons/           # App icons
    └── fonts/           # Custom fonts
```

## Key Features

- **Point of Sale** — Product grid, cart, barcode scanning, discount, multiple payment methods (Cash/GCash/Card)
- **Inventory Management** — Add/edit/delete/archive/restore products, bulk actions, image upload, CSV export
- **Supplier Management** — Supplier CRUD, filtering, archive/restore
- **Purchase Orders** — Create/edit/approve/cancel POs, item management, timeline tracking, print, CSV export
- **Stock Receiving** — Partial receive, damaged tracking, auto inventory update, PO status tracking
- **Sales & Reports** — 9-tab reporting with KPI cards, Canvas charts, transaction audit, monthly summaries, CSV/JSON exports, print
- **User Management** — RBAC with roles (superadmin/admin/cashier/inventory/readonly), permissions
- **Settings** — Store info, tax, receipt customization, security, backup
- **Dark/Light Theme** — Persisted theme selection

## Architecture

- **ES Modules** — All JavaScript uses native ES module imports (no bundler needed)
- **StorageService** — Centralized CRUD API (`save/load/update/delete`) over localStorage, swappable to Firebase
- **Session Manager** — browser sessionStorage with 30-min expiry
- **Canvas Charts** — All charts drawn with Canvas 2D API (no external chart libraries)
- **No Dependencies** — Zero npm packages, no build tools, no frameworks

## Browser Support

Works in all modern browsers (Chrome, Firefox, Edge, Safari). ES Modules require a web server — opening HTML files directly from the filesystem won't work.

## Migration History

This project was migrated from a legacy Electron-based POS to a pure browser-based web application. The key changes:
- Removed all Electron/Node.js dependencies
- Converted CommonJS (`require`/`module.exports`) to ES Modules
- Created a swappable StorageService abstraction
- Centralized session management with sessionStorage
- Flattened project structure for maintainability
