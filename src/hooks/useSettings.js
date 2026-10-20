import { useCallback, useEffect, useMemo, useState } from "react";
import { ascart } from "../ascart";

export const DEFAULT_SETTINGS = {
  removeBackground: false,
  width: 120,
  ratio: "--",
  keepOriginal: false,
  charset: "detailed",
  customChars: "@%#*+=-:. ",
  colorScheme: "original",
  invert: false,
  dither: false,
  brightness: 0,
  contrast: 100,
  livePreview: true,
};

// Only the keys we know about are restored, so old or odd files can't inject junk
export const pickSettings = (saved) =>
  Object.fromEntries(
    Object.keys(DEFAULT_SETTINGS)
      .filter((key) => saved && saved[key] !== undefined && saved[key] !== null)
      .map((key) => [key, saved[key]]),
  );

/**
 * All user settings in one object, saved to disk whenever they change (once
 * the saved ones have been loaded, so defaults never overwrite them).
 */
export function useSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    ascart.loadSettings().then((saved) => {
      if (cancelled) return;
      if (saved) {
        setSettings((prev) => ({ ...prev, ...pickSettings(saved) }));
      }
      // Loaded even if nothing was saved, so we know we tried
      setLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loaded) ascart.saveSettings(settings);
  }, [settings, loaded]);

  const setSetting = useCallback(
    (key, value) => setSettings((prev) => ({ ...prev, [key]: value })),
    [],
  );

  const resetAdjustments = useCallback(() => {
    const { brightness, contrast, invert, dither } = DEFAULT_SETTINGS;
    setSettings((prev) => ({ ...prev, brightness, contrast, invert, dither }));
  }, []);

  // History stores the options of a conversion. Live preview is not one of
  // them, and a ratio of "--" is stored as null (which pickSettings skips).
  const restoreOptions = useCallback((options) => {
    setSettings((prev) => ({
      ...DEFAULT_SETTINGS,
      ...pickSettings(options),
      livePreview: prev.livePreview,
    }));
  }, []);

  // What the backend needs to know, in its own vocabulary
  const conversionOptions = useMemo(
    () => ({
      width: settings.width,
      charset: settings.charset,
      // Only sent for the custom set, so editing it doesn't re-convert
      // pictures that use another one
      ...(settings.charset === "custom" && {
        customChars: settings.customChars,
      }),
      colorScheme: settings.colorScheme,
      removeBackground: settings.removeBackground,
      brightness: settings.brightness,
      contrast: settings.contrast,
      invert: settings.invert,
      dither: settings.dither,
      ratio: settings.ratio !== "--" ? settings.ratio : null,
      keepOriginal: settings.keepOriginal,
    }),
    [
      settings.width,
      settings.charset,
      settings.customChars,
      settings.colorScheme,
      settings.removeBackground,
      settings.brightness,
      settings.contrast,
      settings.invert,
      settings.dither,
      settings.ratio,
      settings.keepOriginal,
    ],
  );

  return {
    settings,
    loaded,
    setSetting,
    resetAdjustments,
    restoreOptions,
    conversionOptions,
  };
}
