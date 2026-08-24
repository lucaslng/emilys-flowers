// The sticker look is a drop-shadow FILTER stack following the bouquet's
// silhouette: opaque white fill + eight zero-blur white offsets (the cartoon
// outline) + two warm cocoa shadows. Plain <img> with explicit dimensions —
// the next/image loader is for product images; this asset is pre-cropped
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