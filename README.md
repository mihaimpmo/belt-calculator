# Belt Calculator

A calculator for two-pulley belt drives: belt length, tooth count, the actual center distance once you pick a belt you can buy, and how many teeth are in mesh on the small pulley. The pulleys and belt are drawn and animated, and update as you type.

![Screenshot](assets/screenshot.png)

## Features

- **Timing belts** (GT2, HTD, MXL, XL or a custom pitch): enter the pulley tooth counts and the center distance you want, get the matching belt and the actual distance to mount the pulleys at.
- **Diameters**: for flat, round or V-belts, enter the pitch diameters directly.
- Pick the **shorter**, **nearest** or **longer** belt, or type a tooth count.
- **Drag the right pulley** in the drawing to change the distance.
- Warnings for pulleys that touch, too few teeth in mesh (below 6) or a small wrap angle (below 120°).
- The **step-by-step calculation** shows every formula with your numbers.
- The whole configuration lives in the URL, so **Copy link** saves exactly what you see.
- Light and dark theme, works on phones.

## Formulas

With $C$ the center distance and $D_1$, $D_2$ the pitch diameters:

$$
\varphi = \arcsin\frac{D_2 - D_1}{2C}
$$

$$
L = 2C\cos\varphi + \frac{\pi(D_1 + D_2)}{2} + \varphi\,(D_2 - D_1)
$$

The usual approximation:

$$
L \approx 2C + \frac{\pi(D_1 + D_2)}{2} + \frac{(D_2 - D_1)^2}{4C}
$$

For toothed pulleys with $z$ teeth and pitch $p$:

$$
D = \frac{z\,p}{\pi}, \qquad N = \frac{L}{p}
$$

Center distance for a belt of length $L_c = N p$ (from the approximate formula):

$$
b = 2L_c - \pi(D_1 + D_2), \qquad C = \frac{b + \sqrt{b^2 - 8(D_2 - D_1)^2}}{8}
$$

The app solves the actual center distance from the exact formula numerically. The exact length is strictly increasing in $C$ ($dL/dC = 2\cos\varphi$), so bisection always converges.

## Project layout

```
index.html          the page
css/style.css       styles (light and dark theme)
js/belt.js          the math, no browser dependencies
js/app.js           UI, SVG drawing and animation
tests/belt.test.js  tests for the formulas
```

## Running locally

The page uses ES modules, so it has to be served over HTTP rather than opened as a file:

```bash
python -m http.server 8000
# then open http://localhost:8000
```

or `npm start` if you have Node.

Formula tests (Node 18 or newer):

```bash
npm test
```

## Publishing on GitHub Pages

1. Create a repository on GitHub and push:
   ```bash
   git remote add origin https://github.com/<user>/belt-calculator.git
   git push -u origin main
   ```
2. In the repository, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Every push to `main` runs the tests and publishes the page at `https://<user>.github.io/belt-calculator/`.

## Notes

- Outside diameters are approximate: they are the pitch diameter minus twice the pitch line differential (PLD), which varies slightly between manufacturers.
- The formulas are for an open belt (both pulleys turn the same way) without an idler.

## License

MIT
