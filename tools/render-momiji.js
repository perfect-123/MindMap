// Renders tools/momiji.html to extension/backgrounds/momiji-<scene>.webp at
// 2880×1800 (the 1920×1200 scene at 1.5× device scale, so leaves stay sharp).
// Not part of the extension. Needs Playwright (Chromium) and Python with Pillow:
//   node tools/render-momiji.js
// Chromium screenshots PNG only, so Pillow converts each to WebP (quality 92).
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// momiji.html state → scene name used by the new tab
const SCENES = { thriving: 'spring', healthy: 'autumn', sluggish: 'dry', rotting: 'faded' };
const STATES = Object.keys(SCENES);
const outDir = path.join(__dirname, '..', 'extension', 'backgrounds');

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'momiji-'));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1200 }, deviceScaleFactor: 1.5 });
  for (const state of STATES) {
    await page.goto('file://' + path.join(__dirname, 'momiji.html') + '?state=' + state);
    await page.waitForTimeout(300);
    await page.locator('#root').screenshot({ path: path.join(tmp, state + '.png') });
  }
  await browser.close();

  fs.mkdirSync(outDir, { recursive: true });
  for (const state of STATES) {
    const src = path.join(tmp, state + '.png');
    const dest = path.join(outDir, `momiji-${SCENES[state]}.webp`);
    execFileSync('python3', ['-c',
      'import sys; from PIL import Image; Image.open(sys.argv[1]).convert("RGB").save(sys.argv[2], "WEBP", quality=92, method=6)',
      src, dest]);
    console.log(dest, Math.round(fs.statSync(dest).size / 1024) + ' KB');
  }
  fs.rmSync(tmp, { recursive: true });
})();
