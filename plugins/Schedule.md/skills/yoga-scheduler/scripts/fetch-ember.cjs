#!/usr/bin/env node
/**
 * Fetch Ember Studios Schedule
 *
 * Usage:
 *   bun run fetch-yoga                       # From package.json script
 *   node scripts/fetch-ember.cjs             # Direct invocation
 *   node scripts/fetch-ember.cjs --next-week # Fetch next week
 *   node scripts/fetch-ember.cjs --days 15,16,19
 *
 * Outputs to XDG cache: ~/.cache/schedule-md/yoga/
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');

// XDG Base Directory paths
const XDG_CACHE = process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
const CACHE_DIR = path.join(XDG_CACHE, 'schedule-md', 'yoga');

const CONFIG = {
  url: 'https://www.example-yoga-studio.com/schedule',
  waitTime: 6000,
  navWaitTime: 3000,
  dayWaitTime: 2000,
  viewport: { width: 1400, height: 1200 }
};

// Ensure cache directory exists
function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
  return CACHE_DIR;
}

async function fetchSchedule(options = {}) {
  ensureCacheDir();

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const results = {
    success: true,
    timestamp: new Date().toISOString(),
    cacheDir: CACHE_DIR,
    days: {}
  };

  try {
    await page.setViewportSize(CONFIG.viewport);
    console.log('Navigating to Ember Studios...');
    await page.goto(CONFIG.url);
    await page.waitForTimeout(CONFIG.waitTime);

    // Get current week info
    const weekInfo = await page.evaluate(() => {
      const text = document.body.innerText;
      const weekMatch = text.match(/Week starting (\w+), (\w+ \d+)/);
      const dayMatch = text.match(/Availability for (\w+), (\w+ \d+)/);
      return {
        week: weekMatch ? weekMatch[0] : null,
        currentDay: dayMatch ? dayMatch[1] : null,
        currentDate: dayMatch ? dayMatch[2] : null
      };
    });
    console.log('Current week:', weekInfo.week);
    results.initialWeek = weekInfo;

    // Navigate to next week if requested
    if (options.nextWeek) {
      console.log('Navigating to next week...');
      await page.click('[data-hook="next-arrow"]');
      await page.waitForTimeout(CONFIG.navWaitTime);

      const newWeek = await page.evaluate(() => {
        const match = document.body.innerText.match(/Week starting (\w+), (\w+ \d+)/);
        return match ? match[0] : null;
      });
      console.log('Now on:', newWeek);
      results.navigatedToWeek = newWeek;
    }

    // Fetch specific days if requested
    if (options.days && options.days.length > 0) {
      for (const dayNum of options.days) {
        console.log(`Fetching day ${dayNum}...`);
        try {
          await page.click(`text="${dayNum}"`);
          await page.waitForTimeout(CONFIG.dayWaitTime);

          const dayText = await page.evaluate(() => document.body.innerText);
          const dayMatch = dayText.match(/Availability for (\w+), (\w+ \d+)/);

          if (dayMatch) {
            const dayName = dayMatch[1].toLowerCase();
            const textPath = path.join(CACHE_DIR, `ember-${dayName}-${dayNum}.txt`);
            const pngPath = path.join(CACHE_DIR, `ember-${dayName}-${dayNum}.png`);

            fs.writeFileSync(textPath, dayText);
            await page.screenshot({ path: pngPath, fullPage: true });

            const classes = parseClasses(dayText);
            results.days[dayNum] = { dayName, date: dayMatch[2], classes, textPath, pngPath };
            console.log(`  ${dayName}: ${classes.length} classes`);
          }
        } catch (e) {
          console.log(`  Day ${dayNum} failed:`, e.message.slice(0, 50));
          results.days[dayNum] = { error: e.message };
        }
      }
    } else {
      // Default: save current view
      const text = await page.evaluate(() => document.body.innerText);
      const textPath = path.join(CACHE_DIR, 'ember-schedule.txt');
      const pngPath = path.join(CACHE_DIR, 'ember-schedule.png');

      fs.writeFileSync(textPath, text);
      await page.screenshot({ path: pngPath, fullPage: true });

      results.defaultFetch = { textPath, pngPath };
      console.log('Saved current view');
    }

    // Save metadata
    fs.writeFileSync(
      path.join(CACHE_DIR, 'fetch-metadata.json'),
      JSON.stringify(results, null, 2)
    );

    return results;
  } catch (error) {
    console.error('Fetch failed:', error.message);
    return { success: false, error: error.message };
  } finally {
    await browser.close();
  }
}

function parseClasses(text) {
  const classes = [];
  const lines = text.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    const timeMatch = line.match(/^(\d{1,2}:\d{2})\s*(a\.m\.|p\.m\.)/i);

    if (timeMatch) {
      const hour = parseInt(timeMatch[1].split(':')[0]);
      const minute = timeMatch[1].split(':')[1];
      const isPM = timeMatch[2].toLowerCase().includes('p');
      const hour24 = isPM && hour !== 12 ? hour + 12 : (!isPM && hour === 12 ? 0 : hour);
      const time = `${hour24.toString().padStart(2, '0')}:${minute}`;

      // Get class name, instructor, duration from following lines
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) j++;
      const name = (lines[j]?.trim() || '').replace(/[🔥🌤️]/g, '').replace(/\|\s*\$\d+/g, '').trim();

      j++;
      while (j < lines.length && !lines[j].trim()) j++;
      const instructor = lines[j]?.trim() || '';

      if (name && !name.match(/^(Book|Registration)/)) {
        classes.push({ time, name, instructor });
      }
      i = j + 1;
    } else {
      i++;
    }
  }
  return classes;
}

// CLI
const args = process.argv.slice(2);
const options = {
  nextWeek: args.includes('--next-week'),
  days: []
};

const daysIdx = args.indexOf('--days');
if (daysIdx !== -1 && args[daysIdx + 1]) {
  options.days = args[daysIdx + 1].split(',').map(d => parseInt(d));
}

console.log('Ember Studios Schedule Fetcher');
console.log('Cache:', CACHE_DIR);

fetchSchedule(options).then(result => {
  if (result.success) {
    console.log('\n✓ Complete!');
  } else {
    console.error('\n✗ Failed:', result.error);
    process.exit(1);
  }
});
