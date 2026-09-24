const imageUrls = Object.freeze({
  ...import.meta.glob<string>("../assets/generated/swinir-2x/**/*.png", {
    eager: true,
    query: "?url&no-inline",
    import: "default",
  }),
  ...import.meta.glob<string>("../assets/generated/swinir-2x/**/*.jpg", {
    eager: true,
    query: "?url&no-inline",
    import: "default",
  }),
  ...import.meta.glob<string>("../assets/generated/swinir-2x/**/*.jpeg", {
    eager: true,
    query: "?url&no-inline",
    import: "default",
  }),
  ...import.meta.glob<string>("../assets/generated/swinir-2x/**/*.svg", {
    eager: true,
    query: "?url&no-inline",
    import: "default",
  }),
});

const manifestTexts = import.meta.glob<string>(
  "../assets/generated/swinir-2x/manifest.json",
  { eager: true, query: "?raw", import: "default" },
);

export const SWINIR_2X_ASSET_CATALOG = Object.freeze({
  imageUrls,
  manifestText: Object.values(manifestTexts)[0],
});
