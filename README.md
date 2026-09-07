# Consulta urbanística POUPE — Comú d'Encamp

Web pública de consulta del Pla d'Ordenació i Urbanisme de la Parròquia d'Encamp.
Fitxers estàtics: no hi ha servidor ni base de dades.

## Com funciona

```
Full de càlcul  →  npm run dades  →  public/data/*.json  →  git push  →  Vercel
   (Urbanisme)      (al teu PC)        (al repositori)                  (publicat)
```

Les dades publicades viuen al repositori. Cada actualització queda registrada amb data
i autor, i es pot revertir.

## Posada en marxa

1. **Comparteix el full de càlcul.** Obre *POUPE — Base de dades web* al Drive,
   Comparteix → Qualsevol amb l'enllaç → Lector. Sense això l'script no el pot llegir.

2. **Crea el repositori a GitHub** i puja-hi aquesta carpeta.

3. **Genera les dades** (necessites Node.js instal·lat):
   ```
   npm run dades
   ```
   Escriu `public/data/`. Comprova que digui el nombre d'unitats generades.

4. **Prova-ho al teu ordinador:**
   ```
   npm run servir
   ```
   i obre l'adreça que et mostri.

5. **Publica:** a vercel.com, Add New → Project → importa el repositori.
   No cal configurar res: framework *Other*, directori de sortida `public`.
   Cada `git push` publica automàticament.

## Actualitzar les dades

Quan Urbanisme modifiqui el full:

```
npm run dades
git add public/data
git commit -m "Actualització de dades"
git push
```

Vercel publica en un minut.

## Els PDF de les fitxes

Els enllaços apunten als fitxers del Drive. Perquè el ciutadà els pugui obrir, la carpeta
que els conté ha d'estar compartida com a lectura pública. **Recomanació:** crea una carpeta
nova només amb les fitxes vigents i comparteix aquesta, en lloc d'obrir la carpeta de treball.

## Cerca per referència cadastral

Quan tingueu la taula de referències, afegiu `public/data/cadastre.json` amb aquest format:

```json
{ "REFERENCIA-1": "ID_UA", "REFERENCIA-2": ["ID_UA_A", "ID_UA_B"] }
```

La web el carrega sola si existeix. Si una referència toca dues unitats, mostra totes dues.

## Què calcula i què no

**Calcula:** sostre màxim estimat (coeficient de zona sobre parcel·la neta, articles 62 a 66)
i impost sobre la construcció (48,18 €/m² ponderat per l'índex 1,37, article 59 de l'ordinació
tributària), amb la bonificació del 90%.

**No calcula la cessió urbanística.** En sòl urbà consolidat es paga l'equivalent econòmic
segons l'article 14.12, que depèn d'una taula de valors de repercussió que el Comú no té
aprovada. Sense aquesta taula no es poden donar imports.

Totes les xifres es presenten com a estimatives, sense valor de llicència ni de liquidació.

## Manteniment anual

- **Cada desembre:** actualitzar la pestanya `Tributs` del full amb la nova ordinació
  tributària i el tipus de l'impost sobre la construcció, i regenerar les dades.
- **Quan s'aprovi una modificació del POUPE:** processar les fitxes noves, actualitzar el
  full i regenerar.

## Fitxers

```
scripts/build-data.mjs   baixa el full i genera els JSON
public/index.html        estructura de la pàgina
public/style.css         estils
public/app.js            cerca, fitxa i calculadores
public/data/             generat: no s'edita a mà
```
