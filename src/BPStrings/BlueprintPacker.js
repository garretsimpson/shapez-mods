/**
 * Shapez blueprint packing
 * Author: SkimnerPhi and FatcatX
 *
 * Packed data syntax
 * - The input data is an array of entities from the game.
 *   Entity format:
 *   {
 *       components: {
 *           StaticMapEntity: {
 *               code: <code>,
 *               origin: { x: <posx>, y: <posy> },
 *               originalRotation: <original-rotation>,
 *               rotation: <rotation>,
 *           },
 *           <component-name>: <component-state>,  // Only needed if component has state (settings)
 *           ...
 *       },
 *   }
 * - The entities are grouped by location into chunks (16x16 tiles).
 * - The output data is a serialized text string: <symbol-table><chunk>...
 *   - version 1+: has a symbol table
 * - The <symbol-table> is a NUL separated list of strings.
 *   - The <symbol-table> contains building codes and component names.
 *   - syntax: <len>[<string>[NUL<string>]...]
 *   - where <len> is two bytes: len >>> 8, len & 0xff
 * - Each <chunk> is encoded as <chunk-header><building-data>...<state-tables>
 * - The <chunk-header> is 3 bytes:
 *   - 2 bytes <x><y> for the chunk offset.
 *   - 1 byte <n> for the number of buildings contained in the chunk.
 *     - version 2+: building count - 1 is stored to allow 256 buildings.
 * - The <building-data> is encoded as <offset><rotation><code><state-ref>
 *   - 1 byte building <offset> encoded as: y << 4 | x.  Example: (0, 12) is 192
 *   - 1 byte <rotation> encoded as (<rotation> / 90) << 4 | <original-rotation> / 90.
 *   - <code> is 1 byte when the building is native to the the game.
 *   - <code> 2 bytes for mod buildings: 0x0<symbol-table-index>
 * - The <state-ref> contains references to state tables: <num>[<symbol-table-index><state-table-index>]...
 * - The <state-tables> contains component state data:
 *   - Native components with state (ConstantSignal and Lever) have their own packing scheme and state tables.
 *   - Other components with state store state values in NUL sepearated list of strings.
 *   - <state-table>: <len><data>...
 *   - where <len> is two bytes: len >>> 8, len & 0xff
 * - ConstantSignal state values are packed using the scheme below.
 *
 * ConstantSignal state
 * 0000 000X : boolean
 * 0000 0010 : other - non-native color code
 * 0000 1RGB : color
 * AAAA 0000 : 1 layer shape header
 * AAAA BBBB CCCC DDDD : 2-4 layer shape header
 * RGBss : each quad
 *
 * Example
 * CpCp--Sy would be 1101 0000 10100 10100 11011
 */

import { compressX64, decompressX64 } from "core/lzstring";
import { SerializerInternal } from "savegame/serializer_internal";
import { gBuildingVariants } from "game/building_codes";

const BP_PREFIX = ">>>";
const BP_SUFFIX = "<<<";

const CONSTANT_SIGNAL = 31;
const COLORS = ["uncolored", "blue", "green", "cyan", "red", "purple", "yellow", "white"];
const SHAPES = ["C", "R", "W", "S"];

const MAX_WIDTH = 64;
const NUL = "\0";
const EOL = "\n";

// b64: base64 encoded
// state: has state data
// symbols: has a symbol table
// compress: compressed and base64 encoded
// bcb: building count bug - count is stored rather than count - 1
const CONFIGS = {
    "v0-b64": { id: "0", b64: true, bcb: true },
    "v0-compress": { id: "1", compress: true, bcb: true },
    "v1-b64": { id: "2", b64: true, symbols: true, bcb: true },
    "v1-compress": { id: "3", compress: true, symbols: true, bcb: true },
    "v2-b64": { id: "4", b64: true, symbols: true },
    "v2-compress": { id: "5", compress: true, symbols: true },
    "v3-b64": { id: "6", b64: true, symbols: true, state: true },
    "v3-compress": { id: "7", compress: true, symbols: true, state: true },
};

export class BlueprintPacker {
    constructor() {
        this.configTable = {};
        for (let config of Object.values(CONFIGS)) {
            this.configTable[config.id] = config;
        }
        this.symbolTable = [];
    }

    clearStateTables() {
        this.stateTable = [];
        this.constantSignalTable = [];
    }

    getTableData() {
        let result = "";
        let data;
        let len;

        // stateTable contains string data
        console.debug("State table entries:", this.stateTable.length);
        data = this.stateTable.join(NUL);
        len = data.length;
        result += String.fromCharCode(len >>> 8, len & 0xff);
        result += data;

        // constantSignalTable contains binary data
        console.debug("Signal table entries:", this.constantSignalTable.length);
        data = this.constantSignalTable.join("");
        len = data.length;
        result += String.fromCharCode(len >>> 8, len & 0xff);
        result += data;

        return result;
    }

    // Return index of entry
    // Adds entry to table if needed
    // TODO: Create a table class
    dedup(table, entry) {
        let result;
        const idx = table.indexOf(entry);
        if (idx < 0) {
            result = table.length;
            table.push(entry);
        } else {
            result = idx;
        }
        return result;
    }

    setSymbolTable(data, pos) {
        const hb = data.charCodeAt(pos++);
        const lb = data.charCodeAt(pos++);
        const len = (hb << 8) | lb;
        this.symbolTable = data.substring(pos, pos + len).split(NUL);
        console.debug("##### symbols:", this.symbolTable);
        return len + 2;
    }

    setStateTable(data, pos) {
        const hb = data.charCodeAt(pos++);
        const lb = data.charCodeAt(pos++);
        const len = (hb << 8) | lb;
        this.stateTable = data.substring(pos, pos + len).split(NUL);
        // console.debug("##### state:", this.stateTable);
        return len + 2;
    }

    setConstantSignalTable(data, pos) {
        const hb = data.charCodeAt(pos++);
        const lb = data.charCodeAt(pos++);
        const len = (hb << 8) | lb;
        const end = pos + len;
        let value;
        this.constantSignalTable = [];
        while (pos < end) {
            [value, pos] = this.unpackConstantSignal(data, pos);
            this.constantSignalTable.push(value);
        }
        // console.debug("##### signals:", this.constantSignalTable);
        return len + 2;
    }

    getCode(code) {
        if (typeof code === "number" && Number.isInteger(code) && code != 0) return [code];
        const idx = this.dedup(this.symbolTable, code);
        return [0, idx];
    }

    /**
     * Pack entities
     * @param {Array<Entity>} entities
     * @returns {String}
     */
    packEntities(entities) {
        this.check(entities);
        const chunks = this.chunkIt(entities);

        let result = "";
        chunks.forEach(chunk => {
            const chunkData = [];
            chunkData.push(chunk.idX, chunk.idY);
            chunkData.push(chunk.data.length - 1); // number of entities - 1
            this.clearStateTables();
            chunk.data.forEach(data => {
                const off = (data.x << 4) | data.y;
                const sme = data.entity.components.StaticMapEntity;
                // TODO: Check rotation is a multiple of 90
                const rot = ((sme.rotation / 90) << 4) | (sme.originalRotation / 90);
                const code = this.getCode(sme.code);
                chunkData.push(off, rot, ...code);

                const state = this.packState(data.entity);
                chunkData.push(...state);
            });
            result += String.fromCharCode(...chunkData);
            result += this.getTableData();
        });

        return this.format(result);
    }

    check(data) {
        const ex = new Error("Invalid blueprint data");
        if (typeof data != "object" || !Array.isArray(data)) throw ex;
        for (let item of data) {
            if (!item.components || !item.components.StaticMapEntity) throw ex;
            const sme = item.components.StaticMapEntity;
            if (!sme.code || !sme.origin) throw ex;
        }
    }

    chunkIt(entities) {
        const minPos = {
            x: entities.map(e => e.components.StaticMapEntity.origin.x).reduce((a, b) => Math.min(a, b)),
            y: entities.map(e => e.components.StaticMapEntity.origin.y).reduce((a, b) => Math.min(a, b)),
        };
        const chunks = [];
        entities.forEach(entity => {
            const origin = entity.components.StaticMapEntity.origin;
            const x = origin.x - minPos.x;
            const y = origin.y - minPos.y;
            const idX = (x / 16) | 0;
            const idY = (y / 16) | 0;

            let chunk = chunks.find(c => c.idX == idX && c.idY == idY);
            if (!chunk) {
                chunk = { idX, idY };
                chunk.data = [];
                chunks.push(chunk);
            }
            const data = {
                x: x % 16,
                y: y % 16,
                entity,
            };
            chunk.data.push(data);
        });
        return chunks;
    }

    packState(entity) {
        const result = [];
        const comps = entity.components;
        const entries = Object.entries(comps);
        // Look for components with state
        for (let [name, comp] of entries) {
            const obj = {};
            comp.copyAdditionalStateTo(obj);
            if (Object.keys(obj).length == 0) continue;
            const cidx = this.dedup(this.symbolTable, name);
            const state = comp.serialize();
            let sidx;
            switch (name) {
                case "ConstantSignal":
                    sidx = this.packConstantSignal(state);
                    break;
                case "Lever":
                    sidx = this.packLever(state);
                    break;
                default:
                    sidx = this.dedup(this.stateTable, JSON.stringify(state));
            }
            result.push([cidx, sidx]);
        }
        return [result.length, ...result.flat()];
    }

    format(dataStr) {
        let outputStr = "";

        // Insert the symbol table
        console.debug("##### symbols:", this.symbolTable);
        const symbols = this.symbolTable.join(NUL);
        const len = symbols.length;
        outputStr += String.fromCharCode(len >>> 8, len & 0xff);
        outputStr += symbols;
        outputStr += dataStr;

        // convert to both formats & output the shorter option
        let compressedOutput = compressX64(outputStr);
        let b64Output = btoa(outputStr);
        let result = BP_PREFIX;
        if (compressedOutput.length < b64Output.length) {
            result += CONFIGS["v3-compress"].id + compressedOutput;
        } else {
            result += CONFIGS["v3-b64"].id + b64Output;
        }
        result += BP_SUFFIX;

        // Format the output
        const RE = new RegExp(`.{1,${MAX_WIDTH}}`, "g");
        result = result.match(RE).join(EOL);

        return result;
    }

    /**
     * Unpack entities
     * @param {Object} root
     * @param {String} dataStr
     * @returns {Array<Entity>}
     */
    unpackEntities(root, dataStr) {
        if (!dataStr.startsWith(BP_PREFIX) || !dataStr.endsWith(BP_SUFFIX)) {
            throw "Not a blueprint string";
        }

        // parse format flag and data
        const format = dataStr.charAt(BP_PREFIX.length);
        let data = dataStr.substring(BP_PREFIX.length + 1, dataStr.length - BP_SUFFIX.length);
        const config = this.configTable[format];
        if (!config) {
            throw `Unknown blueprint string format: ${format}`;
        }
        // convert encoded string to raw string
        if (config.b64) data = atob(data);
        if (config.compress) data = decompressX64(data);

        let pos = 0;
        if (config.symbols) {
            pos += this.setSymbolTable(data, pos);
        }
        const maxPos = { x: 0, y: 0 };
        const buildings = [];
        while (pos < data.length) {
            // consume 3 bytes for chunk header
            const idX = data.charCodeAt(pos++);
            const idY = data.charCodeAt(pos++);
            let num = data.charCodeAt(pos++);
            if (!config.bcb) num++;

            const entities = [];
            for (let i = 0; i < num; i++) {
                let entity;
                [entity, pos] = this.unpackEntity(config, data, pos, idX, idY);
                maxPos.x = Math.max(maxPos.x, entity.components.StaticMapEntity.origin.x);
                maxPos.y = Math.max(maxPos.y, entity.components.StaticMapEntity.origin.y);
                entities.push(entity);
            }
            if (config.state) {
                pos += this.setStateTable(data, pos);
                pos += this.setConstantSignalTable(data, pos);
                this.unpackState(entities);
            }
            buildings.push(...entities);
        }

        const entities = buildings.map(e => {
            const origin = e.components.StaticMapEntity.origin;
            origin.x -= (maxPos.x / 2) | 0;
            origin.y -= (maxPos.y / 2) | 0;
            const result = new SerializerInternal().deserializeEntityNoPlace(root, e);
            if (typeof result === "string") throw new Error(result);
            return result;
        });
        return entities;
    }

    unpackEntity(config, data, pos, idX, idY) {
        // consume 3 or 4 bytes for each building
        const off = data.charCodeAt(pos++);
        const rot = data.charCodeAt(pos++);
        let code = data.charCodeAt(pos++);
        if (config.symbols && code == 0) {
            code = this.symbolTable[data.charCodeAt(pos++)];
        }
        if (!gBuildingVariants[code]) {
            console.log("Skip building:", code);
            return;
        }
        const entity = {
            uid: 0,
            components: {
                StaticMapEntity: {
                    origin: {
                        x: ((off >> 4) & 0xf) + 16 * idX,
                        y: (off & 0xf) + 16 * idY,
                    },
                    rotation: ((rot >> 4) & 0xf) * 90,
                    originalRotation: (rot & 0xf) * 90,
                    code: code,
                },
            },
        };

        if (!config.state && code == CONSTANT_SIGNAL) {
            [entity.components.ConstantSignal, pos] = this.unpackConstantSignal(data, pos);
        }
        if (config.state) {
            const num = data.charCodeAt(pos++);
            for (let i = 0; i < num; i++) {
                const cidx = data.charCodeAt(pos++);
                const sidx = data.charCodeAt(pos++);
                const cname = this.symbolTable[cidx];
                entity.components[cname] = { sidx };
            }
        }

        return [entity, pos];
    }

    unpackState(entities) {
        for (let entity of entities) {
            const entries = Object.entries(entity.components);
            for (let [cname, comp] of entries) {
                const sidx = comp.sidx;
                if (sidx == undefined) continue;
                let state;
                switch (cname) {
                    case "ConstantSignal":
                        state = this.constantSignalTable[sidx];
                        break;
                    case "Lever":
                        state = this.unpackLever(sidx);
                        break;
                    default:
                        state = JSON.parse(this.stateTable[sidx]);
                        break;
                }
                entity.components[cname] = state;
            }
        }
    }

    checkConstantSignal(state) {
        const value = state.signal;
        if (!value) return false;

        const TYPE_RE = /^(?:boolean_item|color|shape)$/;
        if (!TYPE_RE.test(value.$)) return false;

        const bools = "01";
        const colors = COLORS.join("|");
        const shapes = SHAPES.join("") + COLORS.map(c => c[0]).join("") + "\\-\\:";
        const DATA_RE = new RegExp(`^(?:[${bools}]|${colors}|[${shapes}]{8,35})$`); // FIXME
        if (!DATA_RE.test(value.data)) return false;

        return true;
    }

    packConstantSignal(state) {
        let result;
        let value;
        if (this.checkConstantSignal(state)) {
            // pack signal value in constantSignalTable, return index
            value = this.packSignalValue(state.signal);
        } else {
            // Store state in stateTable, store index in constantSignalTable
            const idx = this.dedup(this.stateTable, JSON.stringify(state));
            value = [0x2, idx];
        }
        value = String.fromCharCode(...value);
        result = this.dedup(this.constantSignalTable, value);
        return result;
    }

    packSignalValue(signal) {
        const type = signal.$;
        let value = signal.data;

        if (type === "boolean_item") {
            return [value & 1];
        }
        if (type === "color") {
            return [(COLORS.indexOf(value) & 0b0111) | 0b1000];
        }
        if (type === "shape") {
            // remove layer separators
            value = value.replaceAll(":", "");
            // pad to 2 or 4 layers, split into array of quads
            value = value.padEnd(value.length > 8 ? 32 : 16, "-").match(/(.{2})/g);

            let head = [];
            // generate bit field for enabled quads
            for (let i = 0; i < value.length; i++) {
                const idx = Math.floor(i / 8);
                head[idx] = (head[idx] << 1) | (value[i] !== "--");
            }

            // remove all empty quads
            value = value.filter(x => x !== "--");

            let data = [];
            let pos = 0;
            for (let i = 0; i < value.length; i++) {
                const shape = SHAPES.indexOf(value[i].charAt(0));
                const color = COLORS.findIndex(x => x.startsWith(value[i].charAt(1)));
                const pair = (color << 2) | shape; // RGBss

                // shift quad data into position and add to buffer
                const idx = Math.floor(pos / 8);
                const offset = (pos % 8) - 3; // 8-5 = 3
                data[idx] |= offset < 0 ? pair << -offset : pair >> offset;
                if (offset > 0) {
                    // if there is not enough space on the first byte, overflow remaining bits to the second byte
                    data[idx + 1] |= (pair << (8 - offset)) & 0xff;
                }
                pos += 5;
            }
            return [...head, ...data];
        }
    }

    unpackConstantSignal(dataIn, pos) {
        let head = dataIn.charCodeAt(pos++);
        let type;
        let value;

        if (head === 0b00000010) {
            const idx = dataIn.charCodeAt(pos++);
            value = this.stateTable[idx];
            const result = [JSON.parse(value), pos];
            return result;
        } else if ((head & 0b11111110) === 0b00000000) {
            // 0000 0xxx = boolean
            type = "boolean_item";
            value = head;
        } else if ((head & 0b11111000) === 0b00001000) {
            // 0000 1rgb = color
            type = "color";
            value = COLORS[head & 0b0111];
        } else {
            // aaaa bbbb = layers 0 and 1
            head <<= 8;
            if (head & 0b111100000000) {
                // cccc dddd = layers 2 and 3
                // only if layer 1 is non-empty
                head += dataIn.charCodeAt(pos++);
            }

            const quads = new Array(16);
            let buf = 0;
            let bits = 0;

            for (let i = 0; i < 16; i++) {
                const enabled = !!((head >> (15 - i)) & 1);
                if (enabled) {
                    if (bits < 5) {
                        // load another byte onto the end of the buffer if there aren't enough bits
                        buf |= dataIn.charCodeAt(pos++) << (4 - bits);
                        bits += 8;
                    }

                    // pull off 5 bits from the top of the buffer
                    let dat = (buf >> 7) & 0b11111;
                    buf <<= 5;
                    bits -= 5;

                    // rgbSS
                    const shape = SHAPES[dat & 0b11];
                    const color = COLORS[(dat >> 2) & 0b111].charAt(0);
                    quads[i] = shape + color;
                } else {
                    quads[i] = "--";
                }
            }

            const layerCodes = [];
            for (let layer = 0; layer < 16; layer += 4) {
                let layerCode = quads.slice(layer, layer + 4).join("");
                if (layerCode !== "--------") {
                    layerCodes.push(layerCode);
                }
            }
            type = "shape";
            value = layerCodes.join(":");
        }

        const result = [
            {
                signal: {
                    $: type,
                    data: value,
                },
            },
            pos,
        ];
        return result;
    }

    // TODO: Support modified Lever component.
    checkLever(state) {
        const value = state.toggled;
        return value != undefined && typeof value == "boolean";
    }

    packLever(state) {
        return state.toggled ? 1 : 0;
    }

    unpackLever(value) {
        return { toggled: value === 1 };
    }
}
