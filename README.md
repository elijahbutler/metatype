# Metatype

A local, dependency-free liquid-lettering editor. It uses an SVG blur and alpha threshold to merge nearby shapes in real time.

## Run it

```bash
cd ~/Documents/GitHub/metatype
bun run start
```

Then open [http://localhost:4173](http://localhost:4173).

You can also double-click `index.html`, but running the small local server is more reliable for SVG imports and exports.

Metatype saves the current design in your browser after each edit. Refreshing or reopening the page restores the objects, canvas dimensions, melt settings, colors, transparency, and imported Google Fonts. Resetting the canvas replaces the saved design with the starter design.

## Use it

1. Choose a font, size, weight, style, kerning, and word spacing.
2. Add a word or phrase. Every visible letter becomes a separate draggable object while spaces keep their measured width.
3. Drag across the canvas to select several pieces, then group them. Shift-click adds or removes pieces from the selection.
4. Drag the square selection handle to resize. Drag the round handle to rotate, or hold Shift to snap rotation to 15-degree increments.
5. Choose a canvas preset, or enter a custom width and height between 240 and 4096 pixels and select **Apply size** or press Enter. Canvas size, color, and transparency carry through to exports.
6. Adjust **Melt distance** to control when pieces join, then use **Edge** to sharpen or soften the silhouette.
7. Import outlined SVG lettering from Illustrator for custom type, or export the result as SVG or a 2× PNG.

Chrome and Edge can load every installed font after you allow local font access. You can also import a Google Font by entering its family name or pasting a URL from Google Fonts.

## Shortcuts

- `Command/Ctrl+A`: select every piece
- `Command/Ctrl+Z`: undo
- `Shift+Command/Ctrl+Z` or `Ctrl+Y`: redo
- `Command/Ctrl+G`: group the selection
- `Shift+Command/Ctrl+G`: ungroup the selection
- `Command/Ctrl+D`: duplicate the selection
- `Delete` or `Backspace`: delete the selection
- Arrow keys: nudge the selection by 1 px, or 10 px while holding Shift

The exported SVG keeps the liquid filter live. If you need plain paths for a printer or another design app, open the export in Illustrator and expand or rasterize the appearance there.
