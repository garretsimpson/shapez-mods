(()=>{"use strict";(()=>{const{compressX64:t,decompressX64:e}=shapez,{SerializerInternal:n}=shapez,{gBuildingVariants:o}=shapez,i=">>>",r="<<<",s=["uncolored","blue","green","cyan","red","purple","yellow","white"],a=["C","R","W","S"],l={"v0-b64":{id:"0",b64:!0,bcb:!0},"v0-compress":{id:"1",compress:!0,bcb:!0},"v1-b64":{id:"2",b64:!0,symbols:!0,bcb:!0},"v1-compress":{id:"3",compress:!0,symbols:!0,bcb:!0},"v2-b64":{id:"4",b64:!0,symbols:!0},"v2-compress":{id:"5",compress:!0,symbols:!0}};class c{constructor(){this.symbolTable=[],this.configTable={};for(let t of Object.values(l))this.configTable[t.id]=t}getCode(t){if("number"==typeof t&&Number.isInteger(t)&&0!=t)return[t];let e=[0];const n=this.symbolTable.indexOf(t);return n<0?(e.push(this.symbolTable.length),this.symbolTable.push(t)):e.push(n),e}packEntities(e){this.symbolTable=[];let n=e.reduce(((t,e)=>[Math.min(t[0],e.components.StaticMapEntity.origin.x),Math.min(t[1],e.components.StaticMapEntity.origin.y)]),[1/0,1/0]),o=[];e.forEach((t=>{let e=t.components.StaticMapEntity,i=e.origin.x-n[0],r=e.origin.y-n[1],s=i/16|0,a=r/16|0,l=o.find((t=>t[0][0]===s&&t[0][1]===a));l||(l=[[s,a]],o.push(l));const c=this.getCode(e.code);let d=[i%16<<4|r%16,e.rotation/90<<4|e.originalRotation/90,...c],p=[];if(31===e.code){const e=t.components.ConstantSignal.serialize().signal;p=this.writeValue(e.data,e.$)}l.push([...d,...p])})),o.forEach((t=>t[0].push(t.length-2)));let s="";console.debug("##### symbols:",this.symbolTable);const a=this.symbolTable.join("\0"),c=a.length;s+=String.fromCharCode(c>>>8,255&c),s+=a,s+=String.fromCharCode(...o.flat(1/0));let d=t(s),p=btoa(s);s=i,d.length<p.length?s+=l["v2-compress"].id+d:s+=l["v2-b64"].id+p,s+=r;let h="";const u=Math.floor(s.length/64)+1;for(let t=0;t<u;t++){const e=64*t;h+=s.substring(e,e+64)+"\n"}return h}unpackEntities(t,s){if(!s.startsWith(i)||!s.endsWith(r))throw"Not a blueprint string";const a=s.charAt(i.length);let l=s.substring(i.length+1,s.length-r.length);const c=this.configTable[a];if(!c)throw`Unknown blueprint string format: ${a}`;c.b64&&(l=atob(l)),c.compress&&(l=e(l));let d=0,p=[];if(c.symbols){const t=l.charCodeAt(d++)<<8|l.charCodeAt(d++);p=l.substring(d,d+t).split("\0"),console.debug("##### symbols:",p),d+=t}let h=[0,0],u=[];for(;d<l.length;){let t=l.charCodeAt(d++),e=l.charCodeAt(d++),n=l.charCodeAt(d++);c.bcb||n++;for(let i=0;i<n;i++){let n=l.charCodeAt(d++),i=l.charCodeAt(d++),r=l.charCodeAt(d++);if(c.symbols&&0==r&&(r=p[l.charCodeAt(d++)]),!o[r]){console.log("Skip building:",r);continue}let s={uid:0,components:{StaticMapEntity:{origin:{x:(n>>4&15)+16*t,y:(15&n)+16*e},rotation:90*(i>>4&15),originalRotation:90*(15&i),code:r}}};31===r&&([s.components.ConstantSignal,d]=this.readValue(l,d)),h=[Math.max(h[0],s.components.StaticMapEntity.origin.x),Math.max(h[1],s.components.StaticMapEntity.origin.y)],u.push(s)}}return u.map((e=>{e.components.StaticMapEntity.origin.x-=h[0]/2|0,e.components.StaticMapEntity.origin.y-=h[1]/2|0;const o=(new n).deserializeEntityNoPlace(t,e);if("string"==typeof o)throw new Error(o);return o}))}writeValue(t,e){if("boolean_item"===e)return[1&t];if("color"===e)return[7&s.indexOf(t)|8];if("shape"===e){t=(t=t.replaceAll(":","")).padEnd(t.length>8?32:16,"-").match(/(.{2})/g);let e=[];for(let n=0;n<t.length;n++){const o=Math.floor(n/8);e[o]=e[o]<<1|"--"!==t[n]}t=t.filter((t=>"--"!==t));let n=[],o=0;for(let e=0;e<t.length;e++){const i=a.indexOf(t[e].charAt(0)),r=s.findIndex((n=>n.startsWith(t[e].charAt(1))))<<2|i,l=Math.floor(o/8),c=o%8-3;n[l]|=c<0?r<<-c:r>>c,c>0&&(n[l+1]|=r<<8-c&255),o+=5}return[...e,...n]}}readValue(t,e){let n=t.charCodeAt(e++);if(0==(248&n))return[{signal:{$:"boolean_item",data:n}},e];if(8==(248&n))return[{signal:{$:"color",data:s[7&n]}},e];n<<=8,3840&n&&(n+=t.charCodeAt(e++));const o=new Array(16);let i=0,r=0;for(let l=0;l<16;l++)if(n>>15-l&1){r<5&&(i|=t.charCodeAt(e++)<<4-r,r+=8);let n=i>>7&31;i<<=5,r-=5;let c=a[3&n],d=s[n>>2&7].charAt(0);o[l]=c+d}else o[l]="--";let l=[];for(let t=0;t<16;t+=4){let e=o.slice(t,t+4).join("");"--------"!==e&&l.push(e)}return[{signal:{$:"shape",data:l.join(":")}},e]}}const d=JSON.parse('{"id":"bp-string","name":"Blueprint strings","author":"FatcatX and SkimnerPhi","version":"1.6.0","website":"https://github.com/garretsimpson/shapez-mods","description":"Generate a sharable string in the system clipboard when you copy and paste blueprints.","minimumGameVersion":">=1.5.0","settings":{"mode":"pack"},"doesNotAffectSavegame":true,"entry":"./index.js"}'),{Vector:p}=shapez,{getBuildingDataFromCode:h}=shapez,{HUDBlueprintPlacer:u}=shapez,{Mod:b}=shapez,{Blueprint:m}=shapez,{SerializerInternal:g}=shapez,f=({$old:t})=>({createBlueprintFromBuildings(...e){t.createBlueprintFromBuildings.call(this,...e),C.copyToClipboard(this.currentBlueprint.get())},pasteBlueprint(...e){const n=C.pasteFromClipboard(this.root);this.lastBlueprintUsed=n||this.lastBlueprintUsed,t.pasteBlueprint.call(this,...e)}}),y=()=>({deserializeEntityNoPlace(t,e){const n=e.components.StaticMapEntity;window.assert(n,"entity has no static data");const o=n.code,i=h(o),r=i.metaInstance.createEntity({root:t,origin:p.fromSerializedObject(n.origin),rotation:n.rotation,originalRotation:n.originalRotation,rotationVariant:i.rotationVariant,variant:i.variant});return r.uid=e.uid,this.deserializeComponents(t,r,e.components)||r}});class C extends b{static serializeAsJson(t){const e=[];for(let n of t){if(n.queuedForDestroy||n.destroyed)continue;const t=n.serialize();delete t.uid;const o=Object.entries(n.components);for(let[e,n]of o){const o={};n.copyAdditionalStateTo(o)||Object.keys(o).length>0||delete t.components[e]}e.push(t)}return JSON.stringify(e)}static deserializeJson(t,e){const n=JSON.parse(e);if("object"!=typeof n)return;if(!Array.isArray(n))return;const o=new g,i=[];for(let e=0;e<n.length;++e){const r=n[e];if(null==r.components||null==r.components.StaticMapEntity)return;const s=r.components.StaticMapEntity;if(null==s.code||null==s.origin)return;const a=o.deserializeEntityNoPlace(t,r);if("string"==typeof a)throw new Error(a);i.push(a)}return i}static serialize(t){const e=d.settings.mode;let n="";switch(e){case"json":n=C.serializeAsJson(t);break;case"pack":n=(new c).packEntities(t);break;default:throw`Unknown blueprint string mode: ${e}`}return n}static deserialize(t,e){let n;try{if(n=C.deserializeJson(t,e),!n)throw"Unable to parse blueprint string as JSON"}catch(o){n=(new c).unpackEntities(t,e)}return n}static async copyToClipboard(t){try{const e=C.serialize(t.entities);console.debug("Copy to clipboard:",e),await navigator.clipboard.writeText(e),console.debug("Copied blueprint to clipboard")}catch(t){console.error("Copy to clipboard failed:",t)}}static pasteFromClipboard(t){const e=/[\r\n\u00A0]/;let n,o;try{n=C.getClipboard().trim(),n=n.replaceAll(e,""),console.debug("Received data from clipboard:",n);const i=C.deserialize(t,n);if(!i)throw"Unable to parse blueprint string";o=new m(i)}catch(t){console.error("Paste from clipboard failed:",t)}return o}static getClipboard(){var t=document.createElement("div");t.contentEditable=!0;var e=document.activeElement.appendChild(t).parentNode;t.focus(),document.execCommand("Paste",null,null);var n=t.innerText;return e.removeChild(t),n}init(){console.debug("##### Init mod:",d.id),this.modInterface.extendClass(g,y),this.modInterface.extendClass(u,f)}}var w,z;w=C,delete(z=d).entry,window.$shapez_registerMod(w,z)})()})();