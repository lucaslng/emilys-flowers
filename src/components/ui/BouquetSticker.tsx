// BouquetSticker — the brand's hero visual: a photo of a handcrafted
// satin-ribbon bouquet presented as a cartoon die-cut sticker. The asset
// is a transparent cutout (alpha preserved); the sticker look comes from
// a drop-shadow FILTER stack that follows the bouquet's silhouette:
// an opaque white fill first (the sticker paper backing), then eight
// zero-blur white offsets (4 cardinal + 4 diagonal) that union into a
// hard, chunky cartoon outline, then two warm cocoa shadows for lift off
// the page. Static tilt (default 1°, configurable via the `tilt` prop) +
// baked-in gentle float (bob + sway) via the `.sticker-float` utility —
// collapsed by the global reduced-motion guard. Purely decorative
// (aria-hidden).
//
// The photo is a plain <img> with explicit dimensions: the project's
// next/image loader is for product images, and this asset is pre-cropped
// and served as-is from /stickers.

interface BouquetStickerProps {
  className?: string;
  size?: number;
  /** Static clockwise tilt in degrees (default 1 — the subtle hand-placed lean). */
  tilt?: number;
}

export default function BouquetSticker({ className = '', size = 260, tilt = 1 }: BouquetStickerProps) {
  return (
    <div
      aria-hidden="true"
      className={`sticker-float ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src="/stickers/bouquet-sticker.png"
        alt=""
        width={size}
        height={size}
        draggable={false}
        style={{ rotate: `${tilt}deg` }}
        className="h-full w-full [filter:drop-shadow(0_0_0_#fff)_drop-shadow(5px_0_0_#fff)_drop-shadow(-5px_0_0_#fff)_drop-shadow(0_5px_0_#fff)_drop-shadow(0_-5px_0_#fff)_drop-shadow(4px_4px_1px_#fff)_drop-shadow(-4px_4px_1px_#fff)_drop-shadow(4px_-4px_1px_#fff)_drop-shadow(-4px_-4px_1px_#fff)_drop-shadow(0_2px_4px_rgba(74,59,59,0.18))_drop-shadow(0_12px_20px_rgba(74,59,59,0.16))]"
      />
    </div>
  );
}