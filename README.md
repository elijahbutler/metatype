# Metatype

A local, dependency-free liquid-lettering editor. It uses an SVG blur and alpha threshold to merge nearby shapes in real time.

## Run it

```bash
cd ~/Documents/GitHub/metatype
bun run start
```

Then open [http://localhost:4173](http://localhost:4173).

You can also double-click `index.html`, but running the small local server is more reliable for SVG imports and exports.

## Use it

1. Choose a system font, size, weight, style, kerning, and word spacing.
2. Add a word or phrase. Every visible letter becomes a separate draggable object while spaces keep their measured width.
3. Adjust **Melt distance** to control when pieces join.
4. Adjust **Edge** to sharpen or soften the silhouette.
5. Import outlined SVG lettering from Illustrator for custom type.
6. Export the result as SVG or a 2× PNG.

The exported SVG keeps the liquid filter live. If you need plain paths for a printer or another design app, open the export in Illustrator and expand or rasterize the appearance there.
