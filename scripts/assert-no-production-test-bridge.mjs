import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const port = 4174;
const preview = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(port)], {
  stdio: 'ignore',
});

try {
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}`);
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      // Preview server is still starting.
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error('Production preview did not start');

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}`);
    const exposed = await page.evaluate(() => '__df9' in window);
    if (exposed) throw new Error('Production build exposed window.__df9');
  } finally {
    await browser.close();
  }
} finally {
  preview.kill('SIGTERM');
}

console.log('Production build does not expose the __df9 test bridge.');
