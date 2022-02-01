(()=>{"use strict";(()=>{const e=JSON.parse('{"id":"pause-and-step","name":"Pause and Step","author":"FatcatX","version":"0.4","description":"Press Pause/Break key to pause or resume the game.  Press or hold \'n\' to step one tick.","website":"https://github.com/garretsimpson/shapez-mods","minimumGameVersion":">=1.5.0","settings":{"gamePaused":false},"entry":"./index.js"}'),{STOP_PROPAGATION:s}=shapez,{GameCore:t}=shapez,{GameHUD:a}=shapez,{KEYMAPPINGS:i,keyToKeyCode:o}=shapez,{Mod:n}=shapez,d=({$super:s,$old:t})=>({shouldPauseGame(){return t.shouldPauseGame.call(this)||e.settings.gamePaused}}),r=({$super:t,$old:a})=>({initializeRoot(...e){a.initializeRoot.call(this,...e),this.root.keyMapper.getBinding(i.mods.step).add(this.stepTick,this)},stepTick(){const t=this.root;return e.settings.gamePaused=!1,t.time.updateRealtimeNow(),t.time.performTicks(this.root.dynamicTickrate.deltaMs,this.boundInternalTick),t.productionAnalytics.update(),t.achievementProxy.update(),e.settings.gamePaused=!0,s}});var m,p;m=class extends n{togglePause(){e.settings.gamePaused=!e.settings.gamePaused}init(){console.log("##### Init mod:",e.name),this.modInterface.registerIngameKeybinding({id:"pause",keyCode:19,translation:"Pause",modifiers:{},handler:this.togglePause}),this.modInterface.registerIngameKeybinding({id:"step",keyCode:o("N"),translation:"Step",modifiers:{},repeated:!0}),this.modInterface.extendClass(a,d),this.modInterface.extendClass(t,r)}},delete(p=e).entry,window.$shapez_registerMod(m,p)})()})();