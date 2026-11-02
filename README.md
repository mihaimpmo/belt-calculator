# Belt Calculator

Belt length for two pulleys, from the center distance and the two pitch diameters. The pulleys and belt are drawn and animated, and update as you type.

![Screenshot](assets/screenshot.png)

## Use

Enter the two pitch diameters and the center distance, or drag the right pulley in the drawing. You get:

- the belt length (exact formula, with the approximate one next to it)
- the drive ratio
- the wrap angle on the small pulley
- the free span between tangent points

It warns you when the pulleys overlap or the wrap angle on the small pulley drops below 120°. The values are kept in the URL, so you can bookmark or share a setup.

## Formulas

$$
\varphi = \arcsin\frac{D_2 - D_1}{2C}
$$

$$
L = 2C\cos\varphi + \frac{\pi(D_1 + D_2)}{2} + \varphi\,(D_2 - D_1)
$$

$$
L \approx 2C + \frac{\pi(D_1 + D_2)}{2} + \frac{(D_2 - D_1)^2}{4C}
$$

For a timing pulley with $z$ teeth and pitch $p$, the pitch diameter is $D = z\,p/\pi$.

## Running

Open `index.html` in a browser. No build step or server needed.

Tests for the formulas (Node 18 or newer):

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

## Files

```
index.html          the page
css/style.css       styles (follows the system light/dark theme)
js/belt.js          the math
js/app.js           inputs, drawing and animation
tests/belt.test.js  tests for the formulas
```

## License

MIT
