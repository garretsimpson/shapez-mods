# Shapez-mods

## Description

This project contains modifications for Shapez.io (https://github.com/tobspr/shapez.io).

## Notes

### Install development environemt

-   Install node.js (https://nodejs.org/)
-   Install yarn (https://yarnpkg.com/)

### Create the types.d.ts file


Note: This step is needed only if the game source has changed.

-   Clone the game repo (https://github.com/tobspr/shapez.io)
-   In the game root directory:

    `# yarn`

    `# yarn tsc src/js/application.js --declaration --allowJs --emitDeclarationOnly --skipLibCheck --out types.js`

### Build the mods

`# yarn`

`# yarn build`

### Create zip files for all the mods

`# foreach ($f in ls build/\*.js) { node .\src\tools\zipit.js $f }`
