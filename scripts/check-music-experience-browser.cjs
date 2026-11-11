// Use an isolated browser profile and mocked public catalog responses. No real
// account credentials or platform writes are involved.
const { chromium } = require(process.env.MELORANK_PLAYWRIGHT_MODULE || 'playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const output = path.join(process.env.TEMP, 'melorank-experience-qa'); fs.mkdirSync(output, { recursive: true });
const image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZp8AAAAASUVORK5CYII=';
const songs = Array.from({ length: 5 }, (_, i) => ({ songmid: `fixture${i}`, songname: ['Midnight City', 'Intro', 'Wait', 'Reunion', 'Outro'][i], singer: [{ name: 'M83', mid: 'artist1' }], albummid: 'album1', albumname: 'Hurry Up, We’re Dreaming', interval: 240 }));
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.MELORANK_BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
    const page = await context.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route(/https:\/\/(y\.qq\.com|p1\.music\.126\.net)\//, route => route.fulfill({ contentType: 'image/png', body: Buffer.from(image, 'base64') }));
    await page.route('http://localhost:3200/**', route => {
      const url = new URL(route.request().url()); let data = {};
      if (url.pathname === '/getSearchByKey') {
        const kind = url.searchParams.get('catZhida');
        data = kind === '3' ? { album: { list: [{ albummid: 'album1', albumname: 'Hurry Up, We’re Dreaming', singername: 'M83', publicTime: '2011-10-18' }], totalnum: 1 } } : kind === '2' ? { singer: { list: [{ singermid: 'artist1', singername: 'M83' }], totalnum: 1 } } : { song: { list: songs, totalnum: 5 } };
      }
      if (url.pathname === '/getAlbumInfo') data = { name: 'Hurry Up, We’re Dreaming', aDate: '2011-10-18', desc: 'A dreamlike double album.', total_song_num: 5, list: songs };
      if (url.pathname === '/getSingerHotsong') data = { singer: { data: { singer_info: { desc: 'French electronic music project.' }, total: 5, songlist: songs } } };
      if (url.pathname === '/getLyric') return route.fulfill({ json: { response: { lyric: '[00:00]Waiting in the car\n[00:10]Waiting for a ride in the dark' } } });
      if (url.pathname === '/getMusicPlay') data = { playUrl: { fixture0: { url: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=' } } };
      return route.fulfill({ json: { response: { data } } });
    });
    await page.goto('http://localhost:5188/');
    await page.getByRole('button', { name: '播放器', exact: true }).click();
    const disabled = page.getByRole('button', { name: '下载当前歌曲', exact: true });
    await disabled.hover({ force: true }); await page.getByRole('tooltip').waitFor();
    assert.match(await page.getByRole('tooltip').innerText(), /请先选择歌曲/);
    assert.equal(await disabled.evaluate(node => getComputedStyle(node).cursor), 'not-allowed');
    await page.getByRole('button', { name: '搜索', exact: true }).first().click();
    await page.getByRole('textbox', { name: '搜索音乐' }).fill('M83');
    await page.locator('.search-tabs').getByRole('button', { name: '专辑', exact: true }).click();
    await page.locator('.catalog-search-result').first().click();
    await page.getByRole('heading', { name: 'Hurry Up, We’re Dreaming', exact: true }).waitFor();
    await page.locator('.catalog-track-row').nth(1).waitFor();
    assert.equal(await page.locator('button.catalog-track-row').count(), 5);
    await page.screenshot({ path: path.join(output, 'album-desktop.png'), fullPage: true, animations: 'disabled' });
    await page.getByRole('button', { name: '评分 / 导出乐评卡' }).click();
    await page.getByRole('spinbutton', { name: '总体评分', exact: true }).fill('8.7');
    await page.getByRole('spinbutton', { name: 'Midnight City 评分', exact: true }).fill('9.2');
    await page.locator('.review-text-label textarea').fill('每一首歌都是一场新的梦。');
    await page.getByRole('button', { name: '保存评分', exact: true }).click();
    const rankingBefore = await page.evaluate(() => localStorage.getItem('yearlyRankings'));
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '导出 PNG 图片', exact: true }).click();
    const download = await downloadPromise; await download.saveAs(path.join(output, 'album-review.png'));
    assert.equal(await page.evaluate(() => localStorage.getItem('yearlyRankings')), rankingBefore);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '评分 / 导出乐评卡' }).click();
    assert.equal(await page.getByRole('spinbutton', { name: '总体评分', exact: true }).inputValue(), '8.7');
    assert.equal(await page.getByRole('spinbutton', { name: 'Midnight City 评分', exact: true }).inputValue(), '9.2');
    await page.keyboard.press('Escape');
    await page.locator('button.catalog-track-row').first().click();
    await page.locator('.player-view-tabs').getByRole('button', { name: '歌曲', exact: true }).click();
    await page.getByRole('heading', { name: 'Midnight City', exact: true }).waitFor();
    const dimensions = await page.evaluate(() => ({ scroll: document.documentElement.scrollHeight, viewport: innerHeight, left: document.querySelector('.player-left').getBoundingClientRect().toJSON() }));
    console.log('desktop player dimensions', dimensions);
    assert.ok(dimensions.scroll <= dimensions.viewport + 2, 'desktop player fits in one viewport');
    await page.screenshot({ path: path.join(output, 'player-desktop.png'), fullPage: true, animations: 'disabled' });
    for (const viewport of [{ width: 1366, height: 768 }, { width: 1024, height: 768 }]) {
      await page.setViewportSize(viewport);
      assert.ok(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 2), 'player fits common desktop viewport');
      console.log('viewport detail', viewport, await page.locator('.player-left').evaluate(n => ({client:n.clientHeight,scroll:n.scrollHeight})));
      await page.screenshot({ path: path.join(output, `player-${viewport.width}.png`), fullPage: true, animations: 'disabled' });
      assert.ok(await page.evaluate(() => { const node = document.querySelector('.player-left'); return node.scrollHeight <= node.clientHeight + 2; }), 'all playback controls fit without internal scrolling');
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole('button', { name: '评分 / 导出乐评卡' }).click();
    await page.getByRole('spinbutton', { name: '总体评分', exact: true }).fill('7.5');
    await page.getByRole('button', { name: '保存评分', exact: true }).click();
    const songDownloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '导出 PNG 图片', exact: true }).click();
    await (await songDownloadPromise).saveAs(path.join(output, 'song-review.png'));
    await page.keyboard.press('Escape');

    await page.locator('.player-view-tabs').getByRole('button', { name: '歌手', exact: true }).click();
    await page.locator('button.catalog-track-row').first().waitFor();
    await page.screenshot({ path: path.join(output, 'artist-desktop.png'), fullPage: true, animations: 'disabled' });
    await page.getByRole('button', { name: '年度榜单', exact: true }).click();
    await page.getByRole('button', { name: '导出', exact: true }).click();
    assert.equal(await page.locator('.export-format-grid button').count(), 4);
    await page.screenshot({ path: path.join(output, 'export-dialog.png'), fullPage: true, animations: 'disabled' });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '搜索', exact: true }).first().click();
    await page.locator('.search-tabs').getByRole('button', { name: '歌手', exact: true }).click();
    await page.locator('.catalog-search-result').first().click();
    await page.locator('button.catalog-track-row').first().waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(output, 'artist-mobile.png'), fullPage: true, animations: 'disabled' });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal overflow on mobile');
    await page.locator('.player-view-tabs').getByRole('button', { name: '歌曲', exact: true }).click();
    await page.screenshot({ path: path.join(output, 'player-mobile.png'), fullPage: true, animations: 'disabled' });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    console.log('page errors', errors); assert.deepEqual(errors, []);
    console.log('PASS disabled reason, typed search, album/artist navigation, independent saved score, PNG download, export chooser, responsive layout');
    console.log('Artifacts:', output);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
