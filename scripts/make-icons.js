// M12 icon source. Produces build/icon.png (1024 placeholder) — electron-builder
// auto-generates the platform .ico (Win) and .icns (Mac) from it at package time.
// Swap build/icon.png for a real 1024x1024 logo and re-run `npm run icons`.

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const buildDir = path.join(__dirname, "..", "build");
const SIZE = 1024;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
  <rect width="${SIZE}" height="${SIZE}" rx="180" fill="#0f172a"/>
  <text x="50%" y="50%" dy="0.35em" text-anchor="middle"
        font-family="Arial, sans-serif" font-size="520" font-weight="700"
        fill="#f8fafc">PB</text>
</svg>`;

async function main() {
  fs.mkdirSync(buildDir, { recursive: true });
  await sharp(Buffer.from(svg))
    .resize(SIZE, SIZE)
    .ensureAlpha()
    .toColourspace("srgb")
    .png({ force: true })
    .toFile(path.join(buildDir, "icon.png"));
  console.log("[make-icons] wrote build/icon.png (1024) — electron-builder derives ico/icns");
}

main().catch((err) => {
  console.error("[make-icons]", err);
  process.exit(1);
});
