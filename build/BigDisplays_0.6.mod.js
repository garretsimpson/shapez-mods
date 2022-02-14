(()=>{"use strict";var e={594:(e,t,s)=>{var o=s(938),a=s(45);const i=JSON.parse('{"id":"big-displays","name":"Big Displays","author":"FatcatX and saile515","version":"0.6","description":"Adds big displays","website":"https://github.com/garretsimpson/shapez-mods","minimumGameVersion":">=1.5.0","entry":"./index.js"}'),{globalConfig:n}=shapez,{Loader:r}=shapez,{enumDirection:l,Vector:A}=shapez,{enumColors:p}=shapez,{Component:c}=shapez,{enumPinSlotType:d,WiredPinsComponent:u}=shapez,{GameSystemWithFilter:g}=shapez,{isTrueItem:f,isTruthyItem:h}=shapez,{COLOR_ITEM_SINGLETONS:m}=shapez,{typeItemSingleton:y}=shapez,{defaultBuildingVariant:I}=shapez,{Mod:B,ModMetaBuilding:x}=shapez,{types:C}=shapez,w={x:16,y:1},D="shapes",Q="hidef",T={color:"color",shape:"shape",hd:"hd"},M={red:"#f8143a",yellow:"#fcff19",green:"#69ff2e",cyan:"#17f1f4",blue:"#30a0ff",purple:"#d02dff",white:"#ffffff",uncolored:"#71737c"};class V extends c{static getId(){return"BigDisplay"}static getSchema(){return{index:C.uint,type:C.enum(T),slots:C.fixedSizeArray(C.structured({data:C.nullable(y),value:C.nullable(y)}))}}constructor({index:e=0,type:t=T.color,slots:s=[]}){super(),this.index=e,this.setType(t),this.setSlots(s)}setType(e){this.type=e}setSlots(e){this.slots=e.map((e=>({pos:e.pos,value:e.value,data:e.data})))}}class S extends g{constructor(e){super(e,[V]),this.displaySprites={};for(const e in p)e!==p.uncolored&&(this.displaySprites[e]=r.getSprite("sprites/wires/display/"+e+".png"))}getDisplayItem(e){if(!e)return null;const t=m[p.uncolored],s=m[p.white];switch(e.getItemType()){case"boolean":return f(e)?s:t;case"color":case"shape":return e;default:window.assert(!1,"Unknown item type: "+e.getItemType())}}getShapeColors(e){const t=[];if("shape"!==e.getItemType())return t;for(let s=0;s<16;s++){let o=m[p.uncolored];const a=e.definition.layers[Math.floor(s/4)];if(!a)break;const i=a[s%4];i&&(o=m[i.color]),t.push(o)}return t}update(){for(let e of this.allEntities){const t=e.components.BigDisplay;if(!t)continue;const s=e.components.WiredPins,o=s.slots[0];let a=null;o.linkedNetwork&&o.linkedNetwork.hasValue()&&(a=this.getDisplayItem(o.linkedNetwork.currentValue));const i=m[p.uncolored];if(t.type===T.color){if(a&&"color"===a.getItemType())for(let e of t.slots)e.data=a;if(a&&"shape"===a.getItemType()){const e=this.getShapeColors(a);for(let s of t.slots){const t=e[w.x*s.pos.y+s.pos.x]||i;s.data=t}}}if(t.type===T.shape||t.type===T.hd){const e=t.index;t.index=(e+1)%(w.x*w.y),a&&(t.slots[e].data=a)}const n=e.uid;let r=s.slots[1],l=!0;for(;l&&r.linkedNetwork&&r.linkedNetwork.providers;){const e=r.linkedNetwork.providers[0].entity;if(!e.components.BigDisplay)break;if(r=e.components.WiredPins.slots[1],e.uid==n)break}let A=!1;if(r.linkedNetwork&&(s.slots[2].value=r.linkedNetwork.currentValue,A=h(r.linkedNetwork.currentValue)),A){t.index=0;for(let e of t.slots)e.value=e.data}}}drawChunk(e,t){const s=t.containedEntitiesByLayer.regular;for(let o of s){const s=o.components.BigDisplay;if(!o||!s)continue;const a=s.type,i=s.slots;for(let s of i){const i=o.components.StaticMapEntity.localTileToWorld(s.pos);if(!t.tileSpaceRectangle.containsPoint(i.x,i.y))continue;const r=i.toWorldSpaceCenterOfTile(),l=s.value;if(l){if("color"===l.getItemType()){if(l.color===p.uncolored)continue;this.displaySprites[l.color].drawCachedCentered(e,r.x,r.y,n.tileSize)}if("shape"===l.getItemType()&&a===T.shape&&l.drawItemCenteredClipped(r.x,r.y,e,30),"shape"===l.getItemType()&&a===T.hd){const t=this.getShapeColors(l);if(0==t.length)continue;const s=n.tileSize/4,o=s;for(let a=0;a<16;a++){const i=t[a];if(!i||i.color===p.uncolored)continue;const n=a%4-2,l=1-Math.floor(a/4);let A=r.x+n*s,c=r.y+l*s;A+=(s-o)/2,c+=(s-o)/2,e.context.fillStyle=M[i.color],e.context.fillRect(A,c,o,o)}}}}}}}class E extends x{constructor(){super("bigDisplays")}static getAllVariantCombinations(){return[{variant:I,name:"Color Display",description:"Displays 16 colors, one for each corner of the connected shape signal.Use a truthy signal on the sync input to display and latch the values.",regularImageBase64:`${o}`,blueprintImageBase64:`${o}`,tutorialImageBase64:`${o}`},{variant:D,name:"Shape Display",description:"Displays 16 colors or shapes. Connect a stream of values to the data input. Use a truthy signal on the sync input to display and latch the values.",regularImageBase64:`${o}`,blueprintImageBase64:`${o}`,tutorialImageBase64:`${o}`},{variant:Q,name:"Hi-def Display",description:"Displays 256 colors.  Connect a stream of shapes. Each shape is displayed as a 4x4 array of colors. Use a truthy signal on the sync input to display and latch the values.",regularImageBase64:`${o}`,blueprintImageBase64:`${o}`,tutorialImageBase64:`${o}`}]}getAvailableVariants(){return[I,D,Q]}getSilhouetteColor(){return"#aaaaaa"}getDimensions(){return new A(w.x,w.y)}setupEntityComponents(e){e.addComponent(new u({slots:[{pos:new A(0,0),direction:l.left,type:d.logicalAcceptor},{pos:new A(0,0),direction:l.bottom,type:d.logicalAcceptor},{pos:new A(0,0),direction:l.top,type:d.logicalEjector}]}));const t=w,s=[];for(let e=0;e<t.y;e++)for(let o=0;o<t.x;o++)s.push({pos:new A(o,e)});e.addComponent(new V({slots:s}))}updateVariants(e,t,s){switch(s){case I:e.components.BigDisplay.setType(T.color);break;case D:e.components.BigDisplay.setType(T.shape);break;case Q:e.components.BigDisplay.setType(T.hd)}}}var F,b;F=class extends B{init(){console.debug("##### Init mod:",i.id),this.modInterface.registerComponent(V),this.modInterface.registerNewBuilding({metaClass:E,buildingIconBase64:`${a}`}),this.modInterface.addNewBuildingToToolbar({toolbar:"regular",location:"secondary",metaClass:E}),this.modInterface.addNewBuildingToToolbar({toolbar:"wires",location:"secondary",metaClass:E}),this.modInterface.registerGameSystem({id:"bigDisplay",systemClass:S,before:"constantSignal",drawHooks:["staticAfter"]})}},delete(b=i).entry,window.$shapez_registerMod(F,b)},938:e=>{e.exports="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAAQCAYAAAD506FJAAABcmlDQ1BpY2MAACiRdZE9S8NQFIbftmpFK0V0kOKQoYpDi0VBHKWCXapDW8GqS3KbtEKShpsUKa6Ci0PBQXTxa/Af6Cq4KgiCIog4+QP8WqTEc5tCi9QTbs7De897uPdcwJ/WmWF3JQDDdHgmlZRW8qtS8A0+RNCDSQzKzLYWsws5/BvfD1RNcR8Xvf6v6xj9BdVmgK+XeIZZ3CGeI05vOpbgXeJhVpILxMfEMU4HJL4RuuLxq+Cix5+CeS4zD/hFT6nYxkobsxI3iCeIo4ZeYc3ziJuEVHM5SzlCaxQ2MkghCQkKKtiADgdxyibNrLMv0fAtoUweRn8LVXByFFEib4zUCnVVKWukq/TpqIq5/52nrU1Ped1DSaD7xXU/xoDgHlCvue7PievWT4HAM3BltvxlmtPsF+m1lhY9AsLbwMV1S1P2gcsdYOTJkrnckAK0/JoGvJ8DA3lg6A7oW/Nm1dzH2SOQ26InugUODoFxqg+v/wL7P2gIwmXK0wAAAAlwSFlzAAALEgAACxIB0t1+/AAAAKlJREFUeAHt1MEJw0AUQ8E4Lbn/ErampIZn8EWMz9aC5oOuz4Pvvu/fg5gIAQIvCpxzrvr8twb8T4DAjoAB2LmlJgSygAHIZAIEdgQMwM4tNSGQBQxAJhMgsCNgAHZuqQmBLGAAMpkAgR0BA7BzS00IZAEDkMkECOwIGICdW2pCIAsYgEwmQGBHwADs3FITAlnAAGQyAQI7AgZg55aaEMgCBiCTCRDYEfgDEAUEIKzcCDMAAAAASUVORK5CYII="},45:e=>{e.exports="data:image/png;base64,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"}},t={};!function s(o){var a=t[o];if(void 0!==a)return a.exports;var i=t[o]={exports:{}};return e[o](i,i.exports,s),i.exports}(594)})();