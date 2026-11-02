# Calculator curea

Calculator pentru transmisii cu curea între două roți: lungimea curelei, numărul de dinți, distanța reală dintre centre după ce alegi o curea din comerț și câți dinți intră în angrenare pe roata mică. Desenul roților și al curelei e animat și se actualizează pe loc.

![Captură de ecran](assets/screenshot.png)

## Ce face

- **Curea dințată** (GT2, HTD, MXL, XL sau alt pas): introduci dinții roților și distanța dorită, primești cureaua potrivită și distanța reală la care trebuie montate roțile.
- **Diametre**: pentru curele netede, rotunde sau trapezoidale, introduci direct diametrele.
- Alegi cureaua **mai scurtă**, **cea mai apropiată** sau **mai lungă**, sau scrii manual numărul de dinți.
- **Trage roata din dreapta** în desen ca să schimbi distanța.
- Avertizări pentru roți care se ating, prea puțini dinți în angrenare (sub 6) sau unghi de înfășurare mic (sub 120°).
- Secțiunea **Calculul pas cu pas** arată formulele cu valorile tale.
- Toate datele stau în link, deci **Copiază link** salvează exact configurația.
- Temă deschisă și închisă, funcționează și pe telefon.

## Formulele

Cu $C$ distanța dintre centre și $D_1$, $D_2$ diametrele de pitch:

$$
\varphi = \arcsin\frac{D_2 - D_1}{2C}
$$

$$
L = 2C\cos\varphi + \frac{\pi(D_1 + D_2)}{2} + \varphi\,(D_2 - D_1)
$$

Aproximarea uzuală:

$$
L \approx 2C + \frac{\pi(D_1 + D_2)}{2} + \frac{(D_2 - D_1)^2}{4C}
$$

Pentru roți dințate cu $z$ dinți și pasul $p$:

$$
D = \frac{z\,p}{\pi}, \qquad N = \frac{L}{p}
$$

Distanța pentru o curea de lungime $L_c = N p$ (din formula aproximativă):

$$
b = 2L_c - \pi(D_1 + D_2), \qquad C = \frac{b + \sqrt{b^2 - 8(D_2 - D_1)^2}}{8}
$$

Aplicația rezolvă distanța reală din formula exactă, numeric. Lungimea exactă crește strict cu $C$ ($dL/dC = 2\cos\varphi$), deci căutarea binară converge mereu.

## Structura

```
index.html          pagina
css/style.css       stilurile (temă deschisă și închisă)
js/belt.js          matematica, fără dependențe de browser
js/app.js           interfața, desenul SVG și animația
tests/belt.test.js  teste pentru formule
```

## Rulare locală

Pagina folosește module ES, deci trebuie servită printr-un server, nu deschisă direct ca fișier:

```bash
python -m http.server 8000
# apoi deschide http://localhost:8000
```

sau `npm start` dacă ai Node.

Testele pentru formule (Node 18 sau mai nou):

```bash
npm test
```

## Publicare pe GitHub Pages

1. Creează un repo pe GitHub și urcă fișierele:
   ```bash
   git remote add origin https://github.com/<utilizator>/calculator-curea.git
   git push -u origin main
   ```
2. În repo, mergi la **Settings → Pages** și la **Source** alege **GitHub Actions**.
3. La fiecare push pe `main`, workflow-ul rulează testele și publică pagina la `https://<utilizator>.github.io/calculator-curea/`.

## Note

- Diametrele exterioare sunt aproximative: se calculează din diametrul de pitch minus de două ori distanța dintre linia de pitch și dinte (PLD), care diferă ușor între producători.
- Formulele sunt pentru curea deschisă (roțile se rotesc în același sens), fără întinzător.

## Licență

MIT
