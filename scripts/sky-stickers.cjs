/**
 * SKY Academy: turns branding/sky/stickers/*.svg into the embedded WebP stickers
 * in src/components/video-editor/sky/skyStickers.data.ts.
 *
 * Usage: node scripts/sky-stickers.cjs   (needs Playwright's Chromium and ffmpeg)
 * Set CHROMIUM_PATH if Playwright's bundled browser is not installed.
 */
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const svgDir = path.join(root, "branding/sky/stickers");
const outFile = path.join(root, "src/components/video-editor/sky/skyStickers.data.ts");

(async () => {
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sky-stickers-"));
	const browser = await chromium.launch(
		process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
	);
	const page = await browser.newPage();
	const entries = [];
	for (const file of fs.readdirSync(svgDir).filter((name) => name.endsWith(".svg")).sort()) {
		const svg = fs.readFileSync(path.join(svgDir, file), "utf8");
		const width = Number(svg.match(/width="(\d+)"/)[1]);
		const height = Number(svg.match(/height="(\d+)"/)[1]);
		await page.setViewportSize({ width, height });
		await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
		await page.waitForTimeout(80);
		const png = path.join(tmp, file.replace(".svg", ".png"));
		const webp = png.replace(".png", ".webp");
		await page.screenshot({ path: png, omitBackground: true, clip: { x: 0, y: 0, width, height } });
		execFileSync("ffmpeg", ["-v", "error", "-y", "-i", png, "-c:v", "libwebp", "-quality", "88", "-compression_level", "6", webp]);
		const src = `data:image/webp;base64,${fs.readFileSync(webp).toString("base64")}`;
		entries.push(`\t"${file.replace(".svg", "")}": { width: ${width}, height: ${height}, src: "${src}" },`);
	}
	await browser.close();
	fs.writeFileSync(
		outFile,
		[
			"/**",
			" * SKY Academy stickers (generated from branding/sky/stickers/*.svg by",
			" * scripts/sky-stickers.cjs). Drawn by SKY: free to use, no copyright.",
			" */",
			"",
			"export const SKY_STICKER_IMAGES: Record<string, { src: string; width: number; height: number }> = {",
			...entries,
			"};",
			"",
		].join("\n"),
	);
	console.log(`Wrote ${entries.length} stickers to ${path.relative(root, outFile)}`);
})();
