const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:3333');
  
  // Wait for initial load
  await page.waitForTimeout(2000);
  
  // Add stock
  await page.fill('#newStockInput', 'PLTR');
  await page.click('#addStockBtn');
  
  // Wait for optimistic UI update (sidebar should show PENDING)
  await page.waitForTimeout(500);
  const sidebarText = await page.textContent('.sidebar-list');
  console.log("Sidebar contains PLTR:", sidebarText.includes('PLTR'));
  console.log("Sidebar contains PENDING:", sidebarText.includes('PENDING'));
  
  // Wait for backend poll to finish (real data should arrive)
  await page.waitForTimeout(6000);
  const newSidebarText = await page.textContent('.sidebar-list');
  console.log("Sidebar contains PLTR after sync:", newSidebarText.includes('PLTR'));
  console.log("Sidebar contains PENDING after sync (should be false):", newSidebarText.includes('PENDING'));
  
  await browser.close();
})();
