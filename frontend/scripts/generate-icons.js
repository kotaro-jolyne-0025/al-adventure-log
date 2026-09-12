const sharp = require('sharp');
const pngToIco = require('png-to-ico').default || require('png-to-ico');
const path = require('path');
const fs = require('fs');

async function generateAllIcons() {
  const publicDir = path.resolve(__dirname, '../public');
  const logoPath = path.join(publicDir, 'logo.png');
  const iconsDir = path.join(publicDir, 'icons');

  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  // 1. Create a padded square base (1024x1024) with transparent background
  const baseSize = 1024;
  const padding = 120; // safe padding around the emblem
  const innerSize = baseSize - padding * 2;

  const resizedLogo = await sharp(logoPath)
    .resize(innerSize, innerSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  const masterSquare = await sharp({
    create: {
      width: baseSize,
      height: baseSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([{ input: resizedLogo, gravity: 'center' }])
    .png()
    .toBuffer();

  // Save master transparent square logo
  await sharp(masterSquare).toFile(path.join(publicDir, 'logo-square.png'));

  // 2. Generate PWA Icons
  const pwaSizes = [72, 96, 128, 144, 152, 192, 384, 512];
  for (const size of pwaSizes) {
    const outPath = path.join(iconsDir, `icon-${size}x${size}.png`);
    await sharp(masterSquare)
      .resize(size, size)
      .png()
      .toFile(outPath);
    console.log(`Generated: ${outPath}`);
  }

  // 3. Apple Touch Icon (180x180)
  const appleTouchPath = path.join(publicDir, 'apple-touch-icon.png');
  // Apple touch icon typically has a solid dark background for iOS homescreen
  const appleIconInner = await sharp(logoPath)
    .resize(130, 130, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: {
      width: 180,
      height: 180,
      channels: 4,
      background: { r: 15, g: 23, b: 42, alpha: 1 } // Slate 900
    }
  })
    .composite([{ input: appleIconInner, gravity: 'center' }])
    .png()
    .toFile(appleTouchPath);
  console.log(`Generated: ${appleTouchPath}`);

  // 4. Favicon (PNGs for ICO generation)
  const fav16 = await sharp(masterSquare).resize(16, 16).png().toBuffer();
  const fav32 = await sharp(masterSquare).resize(32, 32).png().toBuffer();
  const fav48 = await sharp(masterSquare).resize(48, 48).png().toBuffer();

  const icoBuffer = await pngToIco([fav16, fav32, fav48]);
  const icoPath = path.join(publicDir, 'favicon.ico');
  fs.writeFileSync(icoPath, icoBuffer);
  console.log(`Generated multi-resolution ICO: ${icoPath}`);

  // Also check if src/favicon.ico exists
  const srcFavicon = path.resolve(__dirname, '../src/favicon.ico');
  if (fs.existsSync(srcFavicon)) {
    fs.writeFileSync(srcFavicon, icoBuffer);
  }

  console.log('🎉 All icons successfully generated and updated!');
}

generateAllIcons().catch(console.error);
