# Top agents atlas assets

Created for TripLink on 2026-10-11. Artwork is decorative: routes and endpoints do not describe agent locations, coverage, or tracking.

- Composition reference: [Aceternity UI World Map](https://ui.aceternity.com/components/world-map). The TripLink React component, route animation, and contour artwork are local implementations adapted to the approved design; no Aceternity runtime package or external image service is used.
- `world.svg`: generated with [NTag/dotted-map](https://github.com/NTag/dotted-map), version **3.1.0**, in a disposable Yarn workspace. Full MIT license is in `DOTTED-MAP-LICENSE.txt`. Generator settings: height 72, diagonal grid, equirectangular projection, latitude -60 to 85, longitude -180 to 180. SVG settings: dot radius 0.23, color #2747dd, transparent background. Coordinates are rounded to three decimal places. The SVG viewBox is `0 0 179 72`; route coordinates use this same projection. The generator is not an application dependency. Raw SVG size: 248,209 bytes; gzip estimate: 11,366 bytes.
- `contours.svg`: original decorative vector artwork, drawn for this section.
- [Literata](https://github.com/google/fonts/tree/main/ofl/literata): official Google Fonts variable TTF converted with FontTools to a static WOFF2 at weight 600 and optical size 48 (89,220 bytes).
- [Manrope](https://github.com/google/fonts/tree/main/ofl/manrope): official Google Fonts variable TTF converted with FontTools to WOFF2, retaining weights 200–800 (53,744 bytes).
- Both fonts retain Latin and Cyrillic glyphs, are self-hosted in `/fonts/agents-atlas/`, and use `font-display: swap`. The full SIL Open Font License files are alongside them. Korean uses system serif/sans fallbacks; other homepage sections retain their existing font families.

## Map regeneration

In a temporary directory outside the application, create a private `package.json` and run `yarn add dotted-map@3.1.0 --exact --ignore-scripts --non-interactive`. Then use:

```js
const DottedMap = require('dotted-map').default;
const map = new DottedMap({
  height: 72,
  grid: 'diagonal',
  projection: { name: 'equirectangular' },
  region: { lat: { min: -60, max: 85 }, lng: { min: -180, max: 180 } },
});
const svg = map.getSVG({ radius: 0.23, color: '#2747dd', backgroundColor: 'transparent' })
  .replace(/\s+/g, ' ')
  .replace(/(?<=\d)\.\d{4,}/g, value => Number(value).toFixed(3).slice(1));
```

Write `svg` to `world.svg`, and retain the package's MIT license. Do not install the generator in the TripLink application.
