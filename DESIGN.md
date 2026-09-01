# Metatype design system

Metatype is a dark room with one lit surface. The chrome recedes to near-black so the
artwork on the canvas is the only thing with color in it. Every panel, label, and button
is built to stay out of the way of the letterforms you are pushing around.

Three rules hold the whole thing together:

1. The canvas is the brightest thing on screen. Nothing in the UI competes with it.
2. Elevation is a color step, never a shadow.
3. Three type voices, each with one job. Serif for headings, sans for UI, mono for data.

Tokens live in `:root` in `styles.css`. Read that file as the source of truth. This
document explains why the values are what they are.

## Color

### Surfaces

| Token | Value | Where it goes |
|---|---|---|
| `--void` | `#000000` | Input wells, hex fields, text fields |
| `--abyss` | `#090a0b` | The wall the canvas hangs on |
| `--obsidian` | `#0f1011` | Side panels and the top bar |
| `--graphite` | `#2e2e2e` | Raised cards: shape tiles, the groups hint, the empty-canvas prompt |
| `--steel` | `#3f4041` | Hover and pressed states, slider tracks, the transparency grid |
| `--silver` | `#cacaca` | The plate behind a color swatch |

Six surfaces, five steps apart. A card is visible because it is lighter than what is under
it, not because it floats. There are no drop shadows anywhere in the app.

### Ink

| Token | Value | Where it goes |
|---|---|---|
| `--pure` | `#ffffff` | Primary button fill, slider thumbs, icons |
| `--cloud` | `#f5f5f7` | Headings and input text |
| `--ash` | `#9f9fa0` | Descriptions and secondary buttons |
| `--fog` | `#6a6b6b` | Mono labels, panel numbers, disabled text |

Body text never runs at pure white. Pure white belongs to the primary action and to the
slider thumbs, so those stay the brightest pixels in the chrome.

### Chromatic

| Token | Value | Where it goes |
|---|---|---|
| `--iris` | `#847dff` | Selection outlines, marquee, focus rings, the brand mark, the transparency toggle |
| `--iris-deep` | `#4b49aa` | The "how it works" panel |
| `--iris-pale` | `#d1c9ff` | The eyebrow label inside that panel |
| `--cyan` | `#00b3dd` | The "local only" status dot |

Color is rationed. It marks two things: what you have selected, and what the app is doing
on its own. Iris is defined twice, in `styles.css` and as `SELECTION_COLOR` in `app.js`,
because SVG attributes cannot read CSS custom properties. Change both together.

Never tint body copy or small labels. On this background, saturated color at 10px vibrates.

## Type

Three families, no overlap in what they do.

**Instrument Serif** carries the headings: the wordmark, the two panel titles, and the
empty-canvas line. It runs at 32px to 38px with `line-height: .9` and slight negative
tracking. Tight leading at that size is the signature. The italic appears exactly twice,
in "Meta*type*" and in "The canvas is *empty*", which is enough. Falls back to Didot,
then Bodoni 72, then Georgia.

**Inter** handles everything you click or read as an instruction: buttons, inputs, hint
copy, toggle labels. 13px to 14px, weight 400.

**Roboto Mono** handles anything the app measures or names. Field labels, panel numbers,
slider readouts, canvas dimensions, the piece count, keyboard chips. Always uppercase,
always 9px to 11px, tracked out to `.18em`. Mono uppercase reads as instrumentation, which
is what these values are.

| Role | Family | Size | Tracking |
|---|---|---|---|
| Panel title | Instrument Serif | 38px / .9 | -.015em |
| Wordmark | Instrument Serif | 22px | -.01em |
| Empty prompt | Instrument Serif | 32px / .95 | normal |
| Button, input | Inter | 13-14px | normal |
| Hint body | Inter | 12px / 1.55 | normal |
| Field label | Roboto Mono | 9-10px | .16-.18em |
| Data readout | Roboto Mono | 10-12px | .02-.04em |

The fonts load from Google Fonts. Offline, the fallback stacks hold the shape of the
system: a high-contrast serif, a neo-grotesque, a monospace.

## Space and shape

The base unit is 4px. Panels use 22px of horizontal padding and 28px at the top. Cards
take 20px to 24px of padding. Related controls sit 10px apart, groups 22px to 28px apart.

| Radius | Value | Applies to |
|---|---|---|
| `--r-control` | 8px | Buttons, inputs, selects, swatches, toast |
| `--r-card` | 16px | The canvas frame, the import target |
| `--r-tile` | 20px | Shape tiles, the empty prompt, the iris panel |
| `--r-pill` | 9999px | The status chip, the toggle, slider tracks |

Radius rises with the size of the surface. An 8px control inside a 20px tile inside a
16px frame reads as nested rather than repetitive.

## Components

**Primary button.** White fill, black text, a right arrow. Only Export PNG gets it. One
primary action per screen.

**Ghost button.** Transparent with a `--line-strong` border. Export SVG and the four
selection actions. Hover fills with white at 10%.

**Quiet button.** No border, `--ash` text. Undo, Redo, Reset. These are frequent and
should not shout.

**Status chip.** A pill with a cyan dot. It says the app has not sent your work anywhere.

**Shape tile.** A graphite tile with a white icon over a mono caption. The icon is the
label; the word underneath is a caption, not the point.

**Iris panel.** The single chromatic block in the app, explaining what the melt filter
does. It is the one place a full-bleed color is allowed, and it stays at the bottom of the
Melt panel where it reads as a footnote rather than a control.

**Color swatch.** The swatch sits on a 3px silver plate. Without it, a `#171717` shape
color would be invisible against `--obsidian`. The plate makes every value legible,
including black.

**Canvas frame.** A container query sizes the frame to the 1200x760 artwork ratio, so the
1px border traces the artwork exactly and there is no letterboxing inside it. On narrow
screens the frame switches to `container-type: inline-size` and sizes from width alone.

**Transparency grid.** Steel with a 7% white check at 20px. Mid-tone on purpose. A light
grid would swallow white lettering and a dark one swallows the default near-black.

## Rules

Do:

- Step surface colors to show elevation.
- Set every label and numeric readout in uppercase mono.
- Keep the serif at weight 400 and let size do the work.
- Give focus a 2px iris ring at 2px offset. Every control gets one.
- Set descriptions in `--ash` and headings in `--cloud`.

Do not:

- Add a drop shadow. There are none in the app and there is no token for one.
- Tint text under 18px with a chromatic color.
- Use iris for anything other than selection, focus, and app state.
- Set body copy at `#ffffff`.
- Add a gradient to a UI surface.
- Bold the serif.

## Artwork defaults

The stage ships at `#171717` on `#f1eee6`, warm paper rather than white. Those are the
user's colors and the system does not touch them. They are saved with the design in local
storage and restored on reload.
