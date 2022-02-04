# Shapez-mods

## Description

This project contains modifications for Shapez.io (https://github.com/tobspr/shapez.io).

## Notes

Create the types.d.ts file
In the game root directory:

`# yarn tsc src/js/application.js --declaration --allowJs --emitDeclarationOnly --skipLibCheck --out types.js`

Zip all the mod packages

`# foreach ($f in ls build/\*.js) { node .\src\tools\zipit.js $f }`
