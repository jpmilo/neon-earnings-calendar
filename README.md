# Neon Earnings Calendar

A highly customized, ultra-aesthetic web application for tracking stock earnings, estimating future releases, and calculating post-earnings price movements (Day 1 Move). 

## Features
- **Intelligent Calendar Grid**: Automatically plots hundreds of stocks on their earnings release dates.
- **Categorization & Sidebar**: Fetches Yahoo Finance Asset Profiles to organize your portfolio by Market and real Industry mappings (e.g. Semi-Conductors, Auto Manufacturers).
- **Day 1 Move Tracking**: For companies that have recently reported, calculates the exact market reaction percentage from the first trading day.
- **Batch Manage Stocks**: Upload `.txt` files or paste comma-separated stock tickers. The application rewrites itself to maintain an offline source of truth in `index.html`.
- **Cyberpunk UI**: A state-of-the-art neon design language to make tracking earnings a premium experience.

## Getting Started
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the backend server:
   ```bash
   npm start
   ```
4. Open your browser to `http://localhost:3333`.

## Tools Used
- Node.js, Express.js
- `yahoo-finance2`
- Vanilla HTML/CSS/JS with zero external frontend libraries.
