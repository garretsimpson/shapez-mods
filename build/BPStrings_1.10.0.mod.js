(()=>{"use strict";(()=>{const{compressX64:t,decompressX64:e}=shapez,{gBuildingVariants:n}=shapez,{SerializerInternal:o}=shapez,s=["uncolored","blue","green","cyan","red","purple","yellow","white"],a=["C","R","W","S"],i="\0",r={"v0-b64":{id:"0",b64:!0,bcb:!0},"v0-compress":{id:"1",compress:!0,bcb:!0},"v1-b64":{id:"2",b64:!0,symbols:!0,bcb:!0},"v1-compress":{id:"3",compress:!0,symbols:!0,bcb:!0},"v2-b64":{id:"4",b64:!0,symbols:!0},"v2-compress":{id:"5",compress:!0,symbols:!0},"v3-b64":{id:"6",b64:!0,symbols:!0,state:!0},"v3-compress":{id:"7",compress:!0,symbols:!0,state:!0}};class l{constructor(){this.configTable={};for(let t of Object.values(r))this.configTable[t.id]=t;this.symbolTable=[]}clearStateTables(){this.stateTable=[],this.constantSignalTable=[]}getSymbolTableData(){console.debug("##### symbols:",this.symbolTable);let t="";const e=this.symbolTable.join(i),n=e.length;return t+=String.fromCharCode(n>>>8,255&n),t+=e,t}getStateTableData(){console.debug("State table entries:",this.stateTable.length);let t="";const e=this.stateTable.join(i),n=e.length;return t+=String.fromCharCode(n>>>8,255&n),t+=e,t}getConstantSignalTableData(){console.debug("Signal table entries:",this.constantSignalTable.length);let t="";const e=this.constantSignalTable.join(""),n=e.length;return t+=String.fromCharCode(n>>>8,255&n),t+=e,t}dedup(t,e){let n;const o=t.indexOf(e);return o<0?(n=t.length,t.push(e)):n=o,n}setSymbolTable(t,e){const n=t.charCodeAt(e++)<<8|t.charCodeAt(e++);return this.symbolTable=t.substring(e,e+n).split(i),console.debug("##### symbols:",this.symbolTable),e+n}setStateTable(t,e){const n=t.charCodeAt(e++)<<8|t.charCodeAt(e++);return this.stateTable=t.substring(e,e+n).split(i),e+n}setConstantSignalTable(t,e){const n=t.charCodeAt(e++),o=t.charCodeAt(e++),s=e+(n<<8|o);let a;for(this.constantSignalTable=[];e<s;)[a,e]=this.unpackConstantSignal(t,e),this.constantSignalTable.push(a);return s}getCode(t){return"number"==typeof t&&Number.isInteger(t)&&0!=t?[t]:[0,this.dedup(this.symbolTable,t)]}packEntities(t){this.check(t);const e=this.chunkIt(t);let n="";return e.forEach((t=>{const e=[];e.push(t.idX,t.idY),e.push(t.data.length-1),this.clearStateTables(),t.data.forEach((t=>{const n=t.x<<4|t.y,o=t.entity.components.StaticMapEntity,s=o.rotation/90<<4|o.originalRotation/90,a=this.getCode(o.code);e.push(n,s,...a);const i=this.packState(t.entity);e.push(...i)})),n+=String.fromCharCode(...e),n+=this.getStateTableData(),n+=this.getConstantSignalTableData()})),this.format(n)}check(t){const e=new Error("Invalid blueprint data");if("object"!=typeof t||!Array.isArray(t))throw e;for(let n of t){if(!n.components||!n.components.StaticMapEntity)throw e;const t=n.components.StaticMapEntity;if(!t.code||!t.origin)throw e}}chunkIt(t){const e=t.map((t=>t.components.StaticMapEntity.origin.x)).reduce(((t,e)=>Math.min(t,e))),n=t.map((t=>t.components.StaticMapEntity.origin.y)).reduce(((t,e)=>Math.min(t,e))),o=[];return t.forEach((t=>{const s=t.components.StaticMapEntity.origin,a=s.x-e,i=s.y-n,r=a/16|0,l=i/16|0;let c=o.find((t=>t.idX==r&&t.idY==l));c||(c={idX:r,idY:l},c.data=[],o.push(c));const h={x:a%16,y:i%16,entity:t};c.data.push(h)})),o}packState(t){const e=[],n=t.components,o=Object.entries(n);for(let[t,n]of o){const o={};if(n.copyAdditionalStateTo(o),0==Object.keys(o).length)continue;const s=this.dedup(this.symbolTable,t),a=n.serialize();let i;switch(t){case"ConstantSignal":i=this.packConstantSignal(a);break;case"Lever":i=this.packLever(a);break;default:i=this.dedup(this.stateTable,JSON.stringify(a))}e.push([s,i])}return[e.length,...e.flat()]}format(e){let n="";n+=this.getSymbolTableData(),n+=e;let o=t(n),s=btoa(n),a=">>>";o.length<s.length?a+=r["v3-compress"].id+o:a+=r["v3-b64"].id+s,a+="<<<";const i=new RegExp(".{1,64}","g");return a=a.match(i).join("\n"),a}unpackEntities(t,n){if(!n.startsWith(">>>")||!n.endsWith("<<<"))throw"Not a blueprint string";const s=n.charAt(3);let a=n.substring(4,n.length-3);const i=this.configTable[s];if(!i)throw`Unknown blueprint string format: ${s}`;i.b64&&(a=atob(a)),i.compress&&(a=e(a));let r=0;i.symbols&&(r=this.setSymbolTable(a,r));const l={x:0,y:0},c=[];for(;r<a.length;){const t=a.charCodeAt(r++),e=a.charCodeAt(r++);let n=a.charCodeAt(r++);i.bcb||n++;const o=[];for(let s=0;s<n;s++){let n;[n,r]=this.unpackEntity(i,a,r,t,e),null!=n&&(l.x=Math.max(l.x,n.components.StaticMapEntity.origin.x),l.y=Math.max(l.y,n.components.StaticMapEntity.origin.y),o.push(n))}i.state&&(r=this.setStateTable(a,r),r=this.setConstantSignalTable(a,r),this.unpackState(o)),c.push(...o)}return c.map((e=>{const n=e.components.StaticMapEntity.origin;n.x-=l.x/2|0,n.y-=l.y/2|0;const s=(new o).deserializeEntityNoPlace(t,e);if("string"==typeof s)throw new Error(s);return s}))}unpackEntity(t,e,o,s,a){const i=e.charCodeAt(o++),r=e.charCodeAt(o++);let l=e.charCodeAt(o++);t.symbols&&0==l&&(l=this.symbolTable[e.charCodeAt(o++)]);const c={uid:0,components:{StaticMapEntity:{origin:{x:(i>>4&15)+16*s,y:(15&i)+16*a},rotation:90*(r>>4&15),originalRotation:90*(15&r),code:l}}};if(t.state||31!=l||([c.components.ConstantSignal,o]=this.unpackConstantSignal(e,o)),t.state){const t=e.charCodeAt(o++);for(let n=0;n<t;n++){const t=e.charCodeAt(o++),n=e.charCodeAt(o++),s=this.symbolTable[t];c.components[s]={sidx:n}}}return n[l]?[c,o]:(console.log("Skip building:",l),[null,o])}unpackState(t){for(let e of t){const t=Object.entries(e.components);for(let[n,o]of t){const t=o.sidx;if(null==t)continue;let s;switch(n){case"ConstantSignal":s=this.constantSignalTable[t];break;case"Lever":s=this.unpackLever(t);break;default:s=JSON.parse(this.stateTable[t])}e.components[n]=s}}}checkConstantSignal(t){const e=t.signal;if(!e)return!1;if(!/^(?:boolean_item|color|shape)$/.test(e.$))return!1;const n=s.join("|"),o=a.join("")+s.map((t=>t[0])).join("")+"\\-\\:";return!!new RegExp(`^(?:[01]|${n}|[${o}]{8,35})$`).test(e.data)}packConstantSignal(t){let e,n;return n=this.checkConstantSignal(t)?this.packSignalValue(t.signal):[2,this.dedup(this.stateTable,JSON.stringify(t))],n=String.fromCharCode(...n),e=this.dedup(this.constantSignalTable,n),e}packSignalValue(t){const e=t.$;let n=t.data;if("boolean_item"===e)return[1&n];if("color"===e)return[7&s.indexOf(n)|8];if("shape"===e){n=n.replaceAll(":",""),n=n.padEnd(n.length>8?32:16,"-").match(/(.{2})/g);let t=[];for(let e=0;e<n.length;e++){const o=Math.floor(e/8);t[o]=t[o]<<1|"--"!==n[e]}n=n.filter((t=>"--"!==t));let e=[],o=0;for(let t=0;t<n.length;t++){const i=a.indexOf(n[t].charAt(0)),r=s.findIndex((e=>e.startsWith(n[t].charAt(1))))<<2|i,l=Math.floor(o/8),c=o%8-3;e[l]|=c<0?r<<-c:r>>c,c>0&&(e[l+1]|=r<<8-c&255),o+=5}return[...t,...e]}}unpackConstantSignal(t,e){let n,o,i=t.charCodeAt(e++);if(2===i){const n=t.charCodeAt(e++);return o=this.stateTable[n],[JSON.parse(o),e]}if(0==(254&i))n="boolean_item",o=i;else if(8==(248&i))n="color",o=s[7&i];else{i<<=8,3840&i&&(i+=t.charCodeAt(e++));const r=new Array(16);let l=0,c=0;for(let n=0;n<16;n++)if(i>>15-n&1){c<5&&(l|=t.charCodeAt(e++)<<4-c,c+=8);let o=l>>7&31;l<<=5,c-=5;const i=a[3&o],h=s[o>>2&7].charAt(0);r[n]=i+h}else r[n]="--";const h=[];for(let t=0;t<16;t+=4){let e=r.slice(t,t+4).join("");"--------"!==e&&h.push(e)}n="shape",o=h.join(":")}return[{signal:{$:n,data:o}},e]}checkLever(t){const e=t.toggled;return null!=e&&"boolean"==typeof e}packLever(t){return t.toggled?1:0}unpackLever(t){return{toggled:1===t}}}const c=JSON.parse('{"id":"bp-string","name":"Blueprint Strings","author":"FatcatX and SkimnerPhi","version":"1.10.0","website":"https://github.com/garretsimpson/shapez-mods","description":"Generate a sharable string in the system clipboard when you copy and paste blueprints.","minimumGameVersion":">=1.5.0","settings":{"mode":"pack"},"doesNotAffectSavegame":true,"modId":"1779764","entry":"./index.js"}'),{Vector:h}=shapez,{Blueprint:d}=shapez,{getBuildingDataFromCode:p}=shapez,{HUDBlueprintPlacer:b}=shapez,{enumNotificationType:u}=shapez,{HUDSandboxController:g}=shapez,{Mod:m}=shapez,{SerializerInternal:f}=shapez,y=()=>({giveBlueprints(){["CbCbCbRb:CwCwCwCw"].forEach((t=>{const e=this.root.hubGoals.storedShapes;e[t]||(e[t]=0),e[t]+=1e3}))}}),S=({$old:t})=>({createBlueprintFromBuildings(...e){t.createBlueprintFromBuildings.call(this,...e),T.copyToClipboard(this.currentBlueprint.get(),this.root)},pasteBlueprint(...e){const n=T.pasteFromClipboard(this.root);this.lastBlueprintUsed=n||this.lastBlueprintUsed,t.pasteBlueprint.call(this,...e)}}),C=()=>({deserializeEntityNoPlace(t,e){const n=e.components.StaticMapEntity;window.assert(n,"entity has no static data");const o=n.code,s=p(o),a=s.metaInstance.createEntity({root:t,origin:h.fromSerializedObject(n.origin),rotation:n.rotation,originalRotation:n.originalRotation,rotationVariant:s.rotationVariant,variant:s.variant});return a.uid=e.uid,this.deserializeComponents(t,a,e.components)||a}});class T extends m{static serializeAsJson(t){const e=[];for(let n of t){if(n.queuedForDestroy||n.destroyed)continue;const t=n.serialize();delete t.uid;const o=Object.entries(n.components);for(let[e,n]of o){const o={};n.copyAdditionalStateTo(o),"StaticMapEntity"==e||Object.keys(o).length>0||delete t.components[e]}e.push(t)}return JSON.stringify(e,null,2)}static deserializeJson(t,e){const n=JSON.parse(e);if("object"!=typeof n)return;if(!Array.isArray(n))return;const o=new f,s=[];for(let e=0;e<n.length;++e){const a=n[e];if(!a.components||!a.components.StaticMapEntity)return;const i=a.components.StaticMapEntity;if(null==!i.code||!i.origin)return;const r=o.deserializeEntityNoPlace(t,a);if("string"==typeof r)throw new Error(r);s.push(r)}return s}static serialize(t){const e=c.settings.mode;let n="";switch(e){case"json":n=T.serializeAsJson(t);break;case"pack":n=(new l).packEntities(t);break;default:throw`Unknown blueprint string mode: ${e}`}return n}static deserialize(t,e){let n;try{if(n=T.deserializeJson(t,e),!n)throw"Unable to parse blueprint string as JSON"}catch(o){e=e.split("\n").map((t=>t.trim())).join(""),n=(new l).unpackEntities(t,e)}return n}static async copyToClipboard(t,e){try{const n=T.serialize(t.entities);console.debug("Copy to clipboard:",n),await navigator.clipboard.writeText(n),e.hud.signals.notification.dispatch("Blueprint copied to clipboard",u.info)}catch(t){console.error("Copy to clipboard failed:",t)}}static pasteFromClipboard(t){let e,n;try{e=T.getClipboard().trim(),console.debug("Received data from clipboard:",e);const o=T.deserialize(t,e);if(!o)throw"Unable to parse blueprint string";n=new d(o)}catch(t){console.error("Paste from clipboard failed:",t)}return n&&t.hud.signals.notification.dispatch("Received blueprint from clipboard",u.info),n}static getClipboard(){const t=document.createElement("textarea");t.setAttribute("position","absolute"),t.setAttribute("height","0"),t.setAttribute("overflow","hidden"),t.setAttribute("autocomplete","off"),t.setAttribute("autocorrect","off"),t.setAttribute("spellcheck","false");const e=document.activeElement.appendChild(t).parentNode;t.focus(),document.execCommand("Paste",null,null);const n=t.value;return e.removeChild(t),n}initSandbox(){this.modInterface.registerHudElement("sandboxController",g),this.modInterface.extendClass(g,y)}init(){console.debug("##### Init mod:",this.metadata.id),c.settings=this.settings,this.modInterface.extendClass(f,C),this.modInterface.extendClass(b,S)}}var k,w;k=T,delete(w=c).entry,window.$shapez_registerMod(k,w)})()})();