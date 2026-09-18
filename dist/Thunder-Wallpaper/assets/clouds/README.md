# Optional cloud textures

The wallpaper needs no image assets. To add your own transparent PNG or WebP overlays, put them here and add their relative paths to `Storm.cloudTextures` near the end of `js/config.js`, for example:

```js
Storm.cloudTextures = [
  "assets/clouds/cloud-01.webp",
  "assets/clouds/cloud-02.png",
];
```

Use soft, feathered edges, neutral blue-grey colour, and dimensions around 1024 × 512. Up to eight images are loaded once and drift over the procedural scene. Missing images are skipped. The overlays are decorative foreground clouds; procedural cloud lighting continues underneath. Only use images you have permission to use.
