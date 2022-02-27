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
 *           <component-name>: <component-state>,
 *       },
 *   }
 * - The entities are grouped by location into chunks (16x16 tiles).
 * - The output data is a serialized text string: <chunk>...
 * - Each <chunk> is encoded as <chunk-header>[<symbol-table>][<state-table>]<building-data>...
 *   - version 1+ has <symbol-table>
 *   - version 3+ has <state-table>
 * - The <chunk-header> is 3 bytes:
 *   - 2 bytes <x><y> for the chunk offset.
 *   - 1 byte <n> for the number of buildings contained in the chunk.
 *     - version 2+: building count - 1 is stored to allow 256 buildings.
 * - The <symbol-table> and <state-table> are NUL separated lists of strings.
 *   - Syntax: <len>[<string>[NUL<string>]...]
 *   - where <len> is two bytes: len >>> 8, len & 0xff
 *   - The <symbol-table> contains building codes and component names.
 *   - The <state-table> contains additional component state (settings).
 * - The <building-data> is encoded as <offset><rotation><code><state>
 *   - 1 byte building <offset> encoded as: y << 4 | x.  Example: (0, 12) is 192
 *   - 1 byte <rotation> encoded as (<rotation> / 90) << 4 | <original-rotation> / 90.
 *   - <code> is 1 byte when the building is native to the the game.
 *   - <code> 2 bytes for mod buildings: 0x0<symbol-table-index>
 * - The <state> contains component state data:
 *   - ConstantSignal state values are packed using the scheme below.
 *   - For other components: <len>[<symbol-table-index><state-table-index>]...
 *   - where <len> is 1 byte
 *
 * ConstantSignal state
 *   0000 000X : boolean
 *   0000 1RGB : color
 *   AAAA 0000 : 1 layer shape header
 *   AAAA BBBB CCCC DDDD : 2-4 layer shape header
 *   RGBss : each quad
 *
 * Example
 *   CpCp--Sy would be 1101 0000 10100 10100 11011
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

// b64: base64 encoded
// compress: compressed and base64 encoded
// symbols: contains a symbol table
// state: component state values are stored as strings in the state table
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

class StringTable {
    constructor(data = "") {
        this.table = [];
        if (data.length > 0) {
            // Parse data
        }
    }

    // TODO: index must be 1 byte (0..255)
    addValue(value) {
        if (typeof value !== "string") value = JSON.stringify(value);
        let idx = this.table.indexOf(value);
        if (idx < 0) {
            idx = this.table.length;
            this.table.push(value);
        }
        return idx;
    }

    getValue(idx) {
        let result = this.table[idx];
        try {
            result = JSON.parse(result);
        } catch (e) {
            // Do nothing
        }
        return result;
    }

    toString() {
        return "";
    }
}

export class BlueprintPacker {
    constructor() {
        this.configTable = {};
        for (let config of Object.values(CONFIGS)) {
            this.configTable[config.id] = config;
        }
    }

    getCode(code) {
        if (typeof code === "number" && Number.isInteger(code) && code != 0) return [code];
        return [0, this.addSymbol(code)];
    }

    getAdditionalState(entity) {
        const result = [];
        const comps = Object.entries(entity.components);
        for (let comp of comps) {
            const cname = comp[0];
            const obj = comp[1];
            const state = {};
            obj.copyAdditionalStateTo && obj.copyAdditionalStateTo(state);
            const values = Object.entries(state);
            for (let value of values) {
                const sname = value[0];
                let svalue = value[1];
                if (svalue.serialize !== undefined) svalue = svalue.serialize();
                console.debug(cname, sname);
                console.debug("  ", svalue);
                const state = {};
                state[sname] = svalue;
                result.push([cname, state]);
            }
        }
        return result;
    }

    /**
     * Pack entities
     * @param {Array<Entity>} entities
     * @returns {String}
     */
    packEntities(entities) {
        let minPos = entities.reduce(
            (r, b) => [
                Math.min(r[0], b.components.StaticMapEntity.origin.x),
                Math.min(r[1], b.components.StaticMapEntity.origin.y),
            ],
            [Infinity, Infinity]
        );

        let chunks = [];
        entities.forEach(entity => {
            const sme = entity.components.StaticMapEntity;
            const posx = sme.origin.x - minPos[0];
            const posy = sme.origin.y - minPos[1];
            const chunkX = (posx / 16) | 0;
            const chunkY = (posy / 16) | 0;

            let chunk = chunks.find(c => c[0][0] === chunkX && c[0][1] === chunkY);
            if (!chunk) {
                // 3 bytes are used for the chunk headers
                // 2 bytes for position, 1 byte for building count (added later)
                chunk = [[chunkX, chunkY]];
                chunks.push(chunk);
            }

            // 3 or 4 bytes are used for all buildings
            // position, rotation and code
            const pos = (posx % 16 << 4) | posy % 16;
            const rot = ((sme.rotation / 90) << 4) | (sme.originalRotation / 90);
            const code = this.getCode(sme.code);
            let building = [pos, rot, ...code];

            const addState = this.getAdditionalState(entity);
            const data = [addState.length]; // TODO: must be less than 256
            for (let state of addState) {
                const cname = state[0];
                const value = state[1];
                const cIdx = this.addSymbol(cname);
                const vIdx = this.addSymbol(value);
                data.push(cIdx, vIdx);
            }
            // Special handling of ConstantSignal components
            // let signal = [];
            // if (sme.code === CONSTANT_SIGNAL) {
            //     const value = b.components.ConstantSignal.serialize();
            //     // signal values use a format that adds 1-12 bytes
            //     signal = this.writeValue(value.signal.data, value.signal.$);
            // }
            chunk.push([...building, ...data]);
        });

        // finish by adding the building count (-1) to the chunk headers
        chunks.forEach(c => c[0].push(c.length - 2));

        // construct the output data
        let output = "";

        // Insert the symbol table
        console.debug("##### symbols:", this.symbolTable);
        const symbols = this.symbolTable.join(NUL);
        const len = symbols.length;
        output += String.fromCharCode(len >>> 8, len & 0xff);
        output += symbols;

        // flatten the chunk data
        output += String.fromCharCode(...chunks.flat(Infinity));
        // convert to both formats & output the shorter option
        let compressedOutput = compressX64(output);
        let b64Output = btoa(output);
        // ouput strings will always start with >>> and a flag indicating format and end with <<<
        output = BP_PREFIX;
        if (compressedOutput.length < b64Output.length) {
            output += CONFIGS["v3-compress"].id + compressedOutput;
        } else {
            output += CONFIGS["v3-b64"].id + b64Output;
        }
        output += BP_SUFFIX;

        // Format the output
        const EOL = "\n";
        let result = "";
        const numLines = Math.floor(output.length / MAX_WIDTH) + 1;
        for (let i = 0; i < numLines; i++) {
            const pos = MAX_WIDTH * i;
            result += output.substring(pos, pos + MAX_WIDTH) + EOL;
        }
        return result;
    }

    /**
     * Unpack entities
     * @param {Object} root
     * @param {String} dataStr
     * @returns {Array<Entity>}
     */
    unpackEntities(root, dataStr) {
        // strip newlines
        const EOL = /[\r\n]/;
        dataStr = dataStr.replaceAll(EOL, "");

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

        let idx = 0;
        if (config.symbols || config.allState) {
            // Get symbol table
            const hb = data.charCodeAt(idx++);
            const lb = data.charCodeAt(idx++);
            const len = (hb << 8) | lb;
            this.symbolTable = data.substring(idx, idx + len).split(NUL);
            console.debug("##### symbols:", this.symbolTable);
            idx += len;
        }

        let maxPos = [0, 0];
        let buildings = [];
        while (idx < data.length) {
            // consume 3 bytes for chunk header
            const chunkX = data.charCodeAt(idx++);
            const chunkY = data.charCodeAt(idx++);
            let chunkBuildings = data.charCodeAt(idx++);
            if (!config.bcb) chunkBuildings++;

            for (let bldg = 0; bldg < chunkBuildings; bldg++) {
                // consume 3 or 4 bytes for each building
                const pos = data.charCodeAt(idx++);
                const rot = data.charCodeAt(idx++);
                let code = data.charCodeAt(idx++);
                if ((config.symbols || config.allState) && code == 0) {
                    code = this.getSymbol(data.charCodeAt(idx++));
                }
                if (!gBuildingVariants[code]) {
                    console.log("Skip building:", code);
                    continue;
                }

                // return new StaticMapEntityComponent({
                //     origin: this.origin.copy(),
                //     rotation: this.rotation,
                //     originalRotation: this.originalRotation,
                //     code: this.code,
                // });
                let building = {
                    uid: 0,
                    components: {
                        StaticMapEntity: {
                            origin: {
                                x: ((pos >> 4) & 0xf) + 16 * chunkX,
                                y: (pos & 0xf) + 16 * chunkY,
                            },
                            rotation: ((rot >> 4) & 0xf) * 90,
                            originalRotation: (rot & 0xf) * 90,
                            code: code,
                        },
                    },
                };
                if (!config.allState && code === CONSTANT_SIGNAL) {
                    [building.components.ConstantSignal, idx] = this.readValue(data, idx);
                }
                if (config.allState) {
                    const stateLen = data.charCodeAt(idx++);
                    for (let i = 0; i < stateLen; ++i) {
                        const cIdx = data.charCodeAt(idx++);
                        const sIdx = data.charCodeAt(idx++);
                        const cname = this.getSymbol(cIdx);
                        const state = this.getSymbol(sIdx);
                        console.debug(cname, state);
                        // building.components[cname] = state;
                    }
                }

                maxPos = [
                    Math.max(maxPos[0], building.components.StaticMapEntity.origin.x),
                    Math.max(maxPos[1], building.components.StaticMapEntity.origin.y),
                ];
                buildings.push(building);
            }
        }

        const buildingEntities = buildings.map(b => {
            b.components.StaticMapEntity.origin.x -= (maxPos[0] / 2) | 0;
            b.components.StaticMapEntity.origin.y -= (maxPos[1] / 2) | 0;

            const result = new SerializerInternal().deserializeEntityNoPlace(root, b);
            if (typeof result === "string") {
                throw new Error(result);
            }
            return result;
        });
        return buildingEntities;
    }

    writeValue(value, type) {
        if (type === "boolean_item") {
            return [value & 1];
        }
        if (type === "color") {
            return [(COLORS.indexOf(value) & 0b0111) | 0b1000];
        }
        if (type === "shape") {
            // TODO: verify this is a plain vanilla shape that can be packed
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

    readValue(dataIn, pos) {
        let head = dataIn.charCodeAt(pos++);

        if ((head & 0b11111000) === 0b00000000) {
            // 0000 0xxx = boolean
            return [
                {
                    signal: {
                        $: "boolean_item",
                        data: head,
                    },
                },
                pos,
            ];
        }

        if ((head & 0b11111000) === 0b00001000) {
            // 0000 1rgb = color
            return [
                {
                    signal: {
                        $: "color",
                        data: COLORS[head & 0b0111],
                    },
                },
                pos,
            ];
        }

        // aaaa bbbb = layers 0 and 1
        head <<= 8;
        if (head & 0b111100000000) {
            // cccc dddd = layers 2 and 3
            // only if layer 1 is non-empty
            head += dataIn.charCodeAt(pos++);
        }

        const quads = new Array(16);
        let buf = 0,
            bits = 0;

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
        let shape = layerCodes.join(":");

        return [
            {
                signal: {
                    $: "shape",
                    data: shape,
                },
            },
            pos,
        ];
    }
}
