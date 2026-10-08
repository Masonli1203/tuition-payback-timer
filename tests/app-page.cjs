const fs = require('node:fs/promises');
const path = require('node:path');

exports.routeApp = async (page, origin) => {
  const { appAssets } = await import('../scripts/app-assets.mjs');
  await page.route(`${origin}/**`, async route => {
    const file = new URL(route.request().url()).pathname.slice(1) || 'index.html';
    const contentType = appAssets.get(file);
    if (!contentType) return route.fulfill({ status: 404 });
    await route.fulfill({ body: await fs.readFile(path.resolve(__dirname, '..', file)), contentType });
  });
};
