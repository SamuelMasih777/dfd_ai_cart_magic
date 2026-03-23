import type { CSSProperties } from "react";
import { useFetchers, useNavigation } from "@remix-run/react";
import "./global-loader.css";

const LOGO_SRC = "/cart-magic-logo.png";

export type GlobalLoaderProps = {
  /** Override gold gradient (hex or any CSS color) */
  accentFrom?: string;
  accentMid?: string;
  accentTo?: string;
  /** Outer ring diameter in px */
  sizePx?: number;
  /** When true, blocks interaction with the page behind */
  blockInteraction?: boolean;
};

export function GlobalLoader({
  accentFrom = "#facc15",
  accentMid = "#ca8a04",
  accentTo = "#854d0e",
  sizePx = 104,
  blockInteraction = true,
}: GlobalLoaderProps) {
  const navigation = useNavigation();
  const fetchers = useFetchers();

  const busy =
    navigation.state !== "idle" ||
    fetchers.some((f) => f.state !== "idle");

  if (!busy) return null;

  const style: CSSProperties = {
    "--gloader-from": accentFrom,
    "--gloader-mid": accentMid,
    "--gloader-to": accentTo,
    "--gloader-size": `${sizePx}px`,
  };

  return (
    <div
      className={
        blockInteraction
          ? "gloader-overlay gloader-overlay--blocking"
          : "gloader-overlay"
      }
      style={style}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="gloader-inner">
        <div className="gloader-ring" aria-hidden />
        <img
          className="gloader-logo"
          src={LOGO_SRC}
          alt=""
          decoding="async"
        />
      </div>
      <span className="gloader-sr-only">Loading</span>
    </div>
  );
}
