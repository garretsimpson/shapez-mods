(()=>{"use strict";(()=>{const e=JSON.parse('{"id":"save-games","name":"SaveGames","author":"FatcatX","version":"0.1.1","description":"Create savegames.txt file.","website":"https://github.com/garretsimpson/shapez-mods","minimumGameVersion":">=1.5.0","doesNotAffectSavegame":true,"entry":"./index.js"}'),{SavegameManager:s}=shapez,{Mod:t}=shapez,a=({$old:e})=>({initialize(){return this.readAsync().then((()=>{const e=JSON.stringify(this.currentData.savegames);return this.app.storage.writeFileAsync("savegames.txt",e),console.log("savegames:",e),this.updateAfterSavegamesChanged()}))}});var i,n;i=class extends t{init(){console.log("##### Init mod:",e.id),this.modInterface.extendClass(s,a)}},delete(n=e).entry,window.$shapez_registerMod(i,n)})()})();