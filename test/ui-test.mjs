// UI tests (Playwright) for: reports edit/delete (student + admin permission difference),
// and files-list password protection (create w/ password, edit preserves password, correct/wrong password download).

import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8788';
let passCount = 0, failCount = 0;
const failures = [];

function check(label, cond, extra) {
  if (cond) { passCount++; console.log('PASS:', label); }
  else { failCount++; failures.push(label); console.log('FAIL:', label, extra || ''); }
}

async function login(page, email, password) {
  // clear any existing session cookie first so the login form actually shows
  // (the app auto-restores a logged-in session on load otherwise).
  await page.context().clearCookies();
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#loginEmail', { timeout: 15000 });
  await page.fill('#loginEmail', email);
  await page.fill('#loginPassword', password);
  await page.click('#loginBtn');
  await page.waitForSelector('.nav-item', { timeout: 15000 });
}

async function main() {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox'],
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('dialog', d => {
    // default: accept confirm() dialogs (delete confirmations) and plain alerts.
    // prompt() dialogs (the password prompt) are handled exclusively by page.once()
    // overrides installed right before triggering them — do NOT also handle 'prompt'
    // here, or both listeners race to accept the same dialog and one throws.
    if (d.type() === 'prompt') return;
    d.accept();
  });

  // ===================== REPORTS: student edit/delete =====================
  await login(page, 'yamada@example.com', 'student-2026');
  await page.evaluate(() => appNav('report'));
  await page.waitForSelector('#reportTitle', { timeout: 10000 });
  await page.fill('#reportTitle', 'UIテスト日報');
  await page.fill('#reportBody', 'UIテスト内容です');
  await page.click('button:has-text("日報を提出する")');
  await page.waitForSelector('.report-item:has-text("UIテスト日報")', { timeout: 10000 });

  const newCard = page.locator('.report-item:has-text("UIテスト日報")').first();
  check('new report shows 編集 button (own report)', await newCard.locator('button:has-text("編集")').count() === 1);
  check('new report shows 削除 button (own report)', await newCard.locator('button:has-text("削除")').count() === 1);

  await newCard.locator('button:has-text("編集")').click();
  await page.waitForSelector('#editReportTitle', { timeout: 10000 });
  await page.fill('#editReportTitle', 'UIテスト日報_編集済み');
  await page.click('#submitEditReportBtn');
  await page.waitForSelector('.report-item:has-text("UIテスト日報_編集済み")', { timeout: 10000 });
  check('report title updated after edit', true);

  // ===================== REPORTS: admin sees delete-only (no edit) =====================
  await login(page, 'mai@example.com', 'mailab-admin-2026');
  await page.evaluate(() => appNav('report'));
  await page.waitForSelector('.card table', { timeout: 10000 });
  const yamadaRow = page.locator('tr:has-text("山田")').first();
  await yamadaRow.locator('span:has-text("日報を見る")').click();
  await page.waitForSelector('.report-item', { timeout: 10000 }).catch(() => {});

  const adminCard = page.locator('.report-item:has-text("UIテスト日報_編集済み")').first();
  const adminCardCount = await adminCard.count();
  if (adminCardCount > 0) {
    check('admin view: no 編集 button on student report', await adminCard.locator('button:has-text("編集")').count() === 0);
    check('admin view: has 削除 button on student report', await adminCard.locator('button:has-text("削除")').count() === 1);
    await adminCard.locator('button:has-text("削除")').click();
    await page.waitForTimeout(800);
    check('admin deleted the report', await page.locator('.report-item:has-text("UIテスト日報_編集済み")').count() === 0);
  } else {
    check('admin view shows the target student report', false, 'card not found under admin view');
  }

  // ===================== FILES-LIST: password protection =====================
  await login(page, 'mai@example.com', 'mailab-admin-2026');
  await page.evaluate(() => appNav('files'));
  await page.waitForSelector('button:has-text("資料を追加")', { timeout: 10000 });
  await page.click('button:has-text("資料を追加")');
  await page.waitForSelector('#newFileName', { timeout: 10000 });
  await page.fill('#newFileName', 'UIテスト資料.txt');

  const tmpFile = path.join(os.tmpdir(), 'ui-test-material.txt');
  fs.writeFileSync(tmpFile, 'dummy material content for ui test');
  await page.setInputFiles('#newFileInput', tmpFile);
  await page.check('#fileUsePassword');
  await page.fill('#newFilePassword', 'uitestpw123');
  await page.click('#submitFileBtn');
  await page.waitForSelector('.file-row:has-text("UIテスト資料.txt")', { timeout: 15000 });

  const fileRow = page.locator('.file-row:has-text("UIテスト資料.txt")').first();
  check('new password-protected file shows パスワード付き tag', await fileRow.locator('text=パスワード付き').count() === 1);

  // correct password download -> should trigger an actual download (not navigate away, no error)
  const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
  page.once('dialog', d => d.accept('uitestpw123'));
  await fileRow.locator('button:has-text("ダウンロード")').click();
  const dl = await downloadPromise;
  check('correct password triggers a file download', !!dl, dl);

  // edit: change name, leave password blank -> should keep existing password
  const fileRow2 = page.locator('.file-row:has-text("UIテスト資料.txt")').first();
  await fileRow2.locator('button').nth(1).click(); // order is [download, edit, delete]; edit is index 1
  await page.waitForSelector('#newFileName', { timeout: 10000 });
  check('edit modal placeholder hints "keep current password"', (await page.locator('#newFilePassword').getAttribute('placeholder') || '').includes('未入力なら現在のまま'));
  await page.fill('#newFileName', 'UIテスト資料_編集済み.txt');
  await page.click('#submitFileBtn');
  await page.waitForSelector('.file-row:has-text("UIテスト資料_編集済み.txt")', { timeout: 15000 });
  const fileRow3 = page.locator('.file-row:has-text("UIテスト資料_編集済み.txt")').first();
  check('renamed file still shows パスワード付き tag (password preserved on edit)', await fileRow3.locator('text=パスワード付き').count() === 1);

  // wrong password download -> server returns 403 plain-text response (page will navigate away)
  const respPromise = page.waitForResponse(r => r.url().includes('/download') && r.request().method() === 'GET', { timeout: 10000 }).catch(() => null);
  page.once('dialog', d => d.accept('wrongpassword'));
  await fileRow3.locator('button:has-text("ダウンロード")').click();
  const resp = await respPromise;
  check('wrong password download responds 403', resp && resp.status() === 403, resp && resp.status());

  // ===================== FILES-LIST: student cannot see edit/delete buttons =====================
  await login(page, 'yamada@example.com', 'student-2026');
  await page.evaluate(() => appNav('files'));
  await page.waitForSelector('.file-row', { timeout: 10000 });
  check('student does not see 資料を追加 button', await page.locator('button:has-text("資料を追加")').count() === 0);
  const anyFileRow = page.locator('.file-row').first();
  check('student file row has no edit/delete admin buttons', await anyFileRow.locator('button.secondary.sm').count() <= 1); // only download-ish; edit/delete pen&trash icons absent

  // cleanup: admin deletes the test file
  await login(page, 'mai@example.com', 'mailab-admin-2026');
  await page.evaluate(() => appNav('files'));
  await page.waitForSelector('.file-row', { timeout: 10000 });
  const cleanupRow = page.locator('.file-row:has-text("UIテスト資料_編集済み.txt")').first();
  if (await cleanupRow.count() > 0) {
    await cleanupRow.locator('button').nth(2).click(); // order is [download, edit, delete]; delete is index 2
    await page.waitForTimeout(800);
    check('cleanup: test file deleted', await page.locator('.file-row:has-text("UIテスト資料_編集済み.txt")').count() === 0);
  }

  // ERR_TUNNEL_CONNECTION_FAILED is the sandbox's outbound-network proxy blocking unrelated
  // external requests (fonts/CDN), not an app bug. The single 403 is our own intentional
  // wrong-password download test, expected to fail to load as a resource.
  const unexpectedErrors = consoleErrors.filter(e =>
    !e.includes('ERR_TUNNEL_CONNECTION_FAILED') && !e.includes('status of 403')
  );
  check('no unexpected console errors', unexpectedErrors.length === 0, unexpectedErrors);

  await browser.close();

  console.log(`\nui-test.mjs: ${passCount} passed, ${failCount} failed`);
  if (failCount > 0) {
    console.log('Failures:', failures);
    process.exit(1);
  }
  process.exit(0);
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
