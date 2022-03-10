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
 *       },
 *   }
 * - The entities are grouped by location into chunks (16x16 tiles).
 * - The output data is a serialized text string: <symbol-table><chunk>...
 *   - version 1+ has <symbol-table>
 * - The <symbol-table> is a NUL separated list of strings.
 *   - syntax: <len>[<string>[NUL<string>]...]
 *   - where <len> is two bytes: len >>> 8, len & 0xff
 *   - The <symbol-table> contains building codes and component names.
 * - Each <chunk> is encoded as <chunk-header><building-data>...
 * - The <chunk-header> is 3 bytes:
 *   - 2 bytes <x><y> for the chunk offset.
 *   - 1 byte <n> for the number of buildings contained in the chunk.
 *     - version 2+: building count - 1 is stored to allow 256 buildings.
 * - The <building-data> is encoded as <offset><rotation><code><state>
 *   - 1 byte building <offset> encoded as: y << 4 | x.  Example: (0, 12) is 192
 *   - 1 byte <rotation> encoded as (<rotation> / 90) << 4 | <original-rotation> / 90.
 *   - <code> is 1 byte when the building is native to the the game.
 *   - <code> 2 bytes for mod buildings: 0x0<symbol-table-index>
 * - The <state> contains component state data:
 *   - ConstantSignal state values are packed using the scheme below.
 *
 * ConstantSignal state
 * 0000 000X : boolean
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
const IDS = {
    31: "ConstantSignal",
    33: "Lever",
};

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
        this.symbolTable = [];
        this.configTable = {};
        for (let config of Object.values(CONFIGS)) {
            this.configTable[config.id] = config;
        }
    }

    getCode(code) {
        if (typeof code === "number" && Number.isInteger(code) && code != 0) return [code];

        let result = [0];
        const idx = this.symbolTable.indexOf(code);
        if (idx < 0) {
            result.push(this.symbolTable.length);
            this.symbolTable.push(code);
        } else {
            result.push(idx);
        }
        return result;
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

    formatOutput(output) {
        let outputStr = "";

        // Insert the symbol table
        console.debug("##### symbols:", this.symbolTable);
        const symbols = this.symbolTable.join(NUL);
        const len = symbols.length;
        outputStr += String.fromCharCode(len >>> 8, len & 0xff);
        outputStr += symbols;

        outputStr += String.fromCharCode(...output);

        // convert to both formats & output the shorter option
        let compressedOutput = compressX64(outputStr);
        let b64Output = btoa(outputStr);
        // ouput strings will always start with >>> and a flag indicating format and end with <<<
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
     * Pack entities
     * @param {Array<Entity>} entities
     * @returns {String}
     */
    packEntities(entities) {
        this.symbolTable = [];

        this.check(entities);
        const chunks = this.chunkIt(entities);

        const output = [];
        chunks.forEach(chunk => {
            output.push(chunk.idX, chunk.idY);
            output.push(chunk.data.length - 1);
            chunk.data.forEach(data => {
                const comps = data.entity.components;
                const off = (data.x << 4) | data.y;
                const sme = comps.StaticMapEntity;
                const rot = ((sme.rotation / 90) << 4) | (sme.originalRotation / 90);
                const code = this.getCode(sme.code);
                output.push(off, rot, ...code);

                const entries = Object.entries(comps);
                for (let [name, comp] of entries) {
                    const obj = {};
                    comp.copyAdditionalStateTo(obj);
                    if (Object.keys(obj).length == 0) continue;
                    const packFunc = this["pack" + name];
                    if (!packFunc) {
                        console.debug("Unknown component with state:", name);
                        continue;
                    }
                    const state = packFunc(comp.serialize());
                    output.push(...state);
                }
            });
        });

        const result = this.formatOutput(output);
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
        let symbols = [];
        if (config.symbols) {
            // Get symbol table
            const hb = data.charCodeAt(pos++);
            const lb = data.charCodeAt(pos++);
            const len = (hb << 8) | lb;
            symbols = data.substring(pos, pos + len).split(NUL);
            console.debug("##### symbols:", symbols);
            pos += len;
        }

        let maxPos = { x: 0, y: 0 };
        let buildings = [];
        while (pos < data.length) {
            // consume 3 bytes for chunk header
            let idX = data.charCodeAt(pos++);
            let idY = data.charCodeAt(pos++);
            let chunkBuildings = data.charCodeAt(pos++);
            if (!config.bcb) chunkBuildings++;

            for (let bldg = 0; bldg < chunkBuildings; bldg++) {
                // consume 3 or 4 bytes for each building
                let off = data.charCodeAt(pos++);
                let rot = data.charCodeAt(pos++);
                let code = data.charCodeAt(pos++);
                if (config.symbols && code == 0) code = symbols[data.charCodeAt(pos++)];
                if (!gBuildingVariants[code]) {
                    console.log("Skip building:", code);
                    continue;
                }
                let building = {
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

                let name = "";
                if (!config.state) {
                    if (code == CONSTANT_SIGNAL) name = "ConstantSignal";
                } else {
                    name = IDS[code];
                }
                if (name) {
                    const unpackFunc = this["unpack" + name];
                    [building.components[name], pos] = unpackFunc(data, pos);
                }
                maxPos.x = Math.max(maxPos.x, building.components.StaticMapEntity.origin.x);
                maxPos.y = Math.max(maxPos.y, building.components.StaticMapEntity.origin.y);

                buildings.push(building);
            }
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

    packConstantSignal(comp) {
        const type = comp.signal.$;
        let value = comp.signal.data;

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
            const result = [...head, ...data];
            return result;
        }
    }

    unpackConstantSignal(dataIn, pos) {
        let head = dataIn.charCodeAt(pos++);
        let type;
        let value;

        if ((head & 0b11111000) === 0b00000000) {
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
                let enabled = !!((head >> (15 - i)) & 1);
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
                    let shape = SHAPES[dat & 0b11];
                    let color = COLORS[(dat >> 2) & 0b111].charAt(0);
                    quads[i] = shape + color;
                } else {
                    quads[i] = "--";
                }
            }

            let layerCodes = [];
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

    packLever(comp) {
        const value = comp.toggled;
        return value ? [1] : [0];
    }

    unpackLever(dataIn, pos) {
        const value = dataIn.charCodeAt(pos++);
        return [{ toggled: value == 1 }, pos];
    }
}
