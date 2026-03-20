/**
 * build/icon-source.svg → build/icon.png, public/favicon.png (1024×1024)
 * 실행: npm run render-icon  (sharp 필요)
 */
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const root = path.join(__dirname, '..');
const svgPath = path.join(root, 'build', 'icon-source.svg');
const outPng = path.join(root, 'build', 'icon.png');
const outFavicon = path.join(root, 'public', 'favicon.png');

async function main() {
  if (!fs.existsSync(svgPath)) {
    console.error('Missing', svgPath);
    process.exit(1);
  }
  await sharp(svgPath).resize(1024, 1024).png().toFile(outPng);
  fs.copyFileSync(outPng, outFavicon);
  console.log('Wrote', outPng, 'and', outFavicon);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
