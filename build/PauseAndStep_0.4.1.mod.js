(()=>{"use strict";(()=>{const e=JSON.parse('{"id":"pause-and-step","name":"Pause and Step","author":"FatcatX","version":"0.4.1","description":"Press Pause/Break key to pause or resume the game.  Press or hold \'n\' to step one tick.","website":"https://github.com/garretsimpson/shapez-mods","minimumGameVersion":">=1.5.0","settings":{"gamePaused":false},"doesNotAffectSavegame":true,"entry":"./index.js"}'),{STOP_PROPAGATION:t}=shapez,{GameCore:s}=shapez,{GameHUD:a}=shapez,{KEYMAPPINGS:i,keyToKeyCode:o}=shapez,{Mod:n}=shapez,d=({$old:t})=>({shouldPauseGame(){return t.shouldPauseGame.call(this)||e.settings.gamePaused}}),r=({$old:s})=>({initializeRoot(...e){s.initializeRoot.call(this,...e),this.root.keyMapper.getBinding(i.mods.step).add(this.stepTick,this)},stepTick(){const s=this.root;return e.settings.gamePaused=!1,s.time.updateRealtimeNow(),s.time.performTicks(this.root.dynamicTickrate.deltaMs,this.boundInternalTick),s.productionAnalytics.update(),s.achievementProxy.update(),e.settings.gamePaused=!0,t}});var m,u;m=class extends n{togglePause(){e.settings.gamePaused=!e.settings.gamePaused}init(){this.modInterface.registerIngameKeybinding({id:"pause",keyCode:19,translation:"Pause",modifiers:{},handler:this.togglePause}),this.modInterface.registerIngameKeybinding({id:"step",keyCode:o("N"),translation:"Step",modifiers:{},repeated:!0}),this.modInterface.extendClass(a,d),this.modInterface.extendClass(s,r)}},delete(u=e).entry,window.$shapez_registerMod(m,u)})()})();