/**
 * Generate PWA icons from an inline SVG so the design lives in code, not in
 * binary assets. Re-run any time the wordmark changes:
 *
 *   node scripts/generate-icons.mjs
 *
 * Outputs: static/icon-192.png, icon-512.png, icon-maskable-512.png
 */

import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATIC = join(__dirname, '..', 'static');

// Brand tokens (mirror tailwind values used in the app)
const BG     = '#0a0a0a';
const ACCENT = '#ff8c1a';

/**
 * Render the Tifo mark inside a 512×512 viewBox at the given content scale.
 * scale=1.0 → fills the whole canvas (default 512 icon).
 * scale<1.0 → leaves padding around the content for Android maskable icons,
 *             which crop the corners with circular/squircle masks.
 */
function svg(scale = 1) {
	const pad = (1 - scale) * 256; // half the inset on each side
	const tx = pad;
	const ty = pad;

	return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
	<!-- Dark rounded-square background (full bleed even for maskable, so
	     anything Android crops to is still on-brand) -->
	<rect width="512" height="512" rx="${88 * (scale > 0.9 ? 1 : 0)}" fill="${BG}"/>

	<g transform="translate(${tx} ${ty}) scale(${scale})">
		<!-- TIFO wordmark — hand-crafted paths, no font dependency.
		     Letters are 120px tall, with a hex-shaped "O" tying to the flag motif. -->
		<g fill="${ACCENT}">
			<!-- T -->
			<rect x="68"  y="196" width="100" height="22" rx="3"/>
			<rect x="107" y="196" width="22"  height="120" rx="3"/>

			<!-- I -->
			<rect x="187" y="196" width="22" height="120" rx="3"/>

			<!-- F -->
			<rect x="228" y="196" width="22" height="120" rx="3"/>
			<rect x="228" y="196" width="84" height="22"  rx="3"/>
			<rect x="228" y="245" width="62" height="22"  rx="3"/>

			<!-- O as flat-top hexagon outline (matches our HexFlag clip-path) -->
			<polygon
				points="343,256 368,196 418,196 443,256 418,316 368,316"
				fill="none"
				stroke="${ACCENT}"
				stroke-width="22"
				stroke-linejoin="round"/>
		</g>

		<!-- Subtle WC2026 footer mark — drawn as small dots, no text font needed -->
		<g fill="${ACCENT}" opacity="0.55">
			<circle cx="240" cy="372" r="4"/>
			<circle cx="256" cy="372" r="4"/>
			<circle cx="272" cy="372" r="4"/>
		</g>
	</g>
</svg>`;
}

async function render(svgStr, outName, size) {
	const buf = await sharp(Buffer.from(svgStr)).resize(size, size).png().toBuffer();
	const out = join(STATIC, outName);
	writeFileSync(out, buf);
	console.log(`  wrote ${outName}  ${(buf.length / 1024).toFixed(1)} KB`);
}

(async () => {
	console.log('Generating Tifo PWA icons →');

	// Standard icons — full bleed (no padding)
	const standard = svg(1.0);
	await render(standard, 'icon-512.png', 512);
	await render(standard, 'icon-192.png', 192);

	// Maskable icon — shrunk content with safe-zone padding so Android's
	// adaptive icon masks (circle / squircle / squircle-rounded) never crop
	// any of the wordmark.
	const maskable = svg(0.72);
	await render(maskable, 'icon-maskable-512.png', 512);

	// Also overwrite favicon.svg so browsers that prefer SVG get the new mark
	writeFileSync(join(STATIC, 'favicon.svg'), svg(1.0));
	console.log('  wrote favicon.svg');

	console.log('Done.');
})();
