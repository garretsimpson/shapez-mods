/**
 * Shapez blueprint packing
 * Author: SkimnerPhi and FatcatX
 *
 * Packed data syntax
 * - The input data is a list of entities from the game.
 * - The output data is a serialized text string.
 * - version 0 format: <chunk>...
 * - version 1 format: <symbols><chunk>...
 * - The <symbols> is a NUL separated list of strings: <len>[<string>[NUL<string>...]]
 *   - where <len> is two bytes: len >>> 8, len & 0xff
 * - These entities are grouped by location into chunks (16x16 tiles).
 * - Each <chunk> is encoded as <chunk-header><building-data>...
 * - The <chunk-header> is 3 bytes:
 *   - 2 bytes <x><y> for the chunk offset.
 *   - 1 byte <n> for the number of buildings contained in the chunk.
 * - The <building-data> is encoded as <offset><rotation><code>[<signal>]
 *   - 1 byte building <offset> encoded as: y << 4 | x.  Example: (0, 12) is 192
 *   - 1 byte <rotation> encoded as (<rotation> / 90) << 4 | <original-rotation> / 90.
 *   - <code> is 1 bytes when the building is native to the the game.
 *   - <code> 2 bytes for mod buildings: 0<symbol-table-index>
 * - Further bytes are only if the building is a constant signal, using the following:
 *
 * Signal compression
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

const COLORS = ["uncolored", "blue", "green", "cyan", "red", "purple", "yellow", "white"];
const SHAPES = ["C", "R", "W", "S"];

const MAX_WIDTH = 64;
const NUL = "\0";

const CONFIGS = {
    "v0-b64": { id: "0", b64: true },
    "v0-compress": { id: "1", compress: true },
    "v1-b64": { id: "2", b64: true, symbols: true },
    "v1-compress": { id: "3", compress: true, symbols: true },
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

    /**
     * Pack entities
     * @param {Array<Entity>} entities
     * @returns {String}
     */
    packEntities(entities) {
        this.symbolTable = [];
        let minPos = entities.reduce(
            (r, b) => [
                Math.min(r[0], b.components.StaticMapEntity.origin.x),
                Math.min(r[1], b.components.StaticMapEntity.origin.y),
            ],
            [Infinity, Infinity]
        );

        let chunks = [];
        entities.forEach(b => {
            let sme = b.components.StaticMapEntity;

            let x = sme.origin.x - minPos[0];
            let y = sme.origin.y - minPos[1];

            let chunkX = (x / 16) | 0;
            let chunkY = (y / 16) | 0;

            let chunk = chunks.find(c => c[0][0] === chunkX && c[0][1] === chunkY);
            if (!chunk) {
                // 3 bytes are used for the chunk headers
                // 2 bytes for position, 1 byte for building count
                // the building count in the header is added later
                chunk = [[chunkX, chunkY]];
                chunks.push(chunk);
            }

            // 3 or 4 bytes are used for all buildings
            // position, rotation, and ID
            const code = this.getCode(sme.code);
            let building = [
                (x % 16 << 4) | y % 16,
                ((sme.rotation / 90) << 4) | (sme.originalRotation / 90),
                ...code,
            ];
            let signal = [];
            if (sme.code === CONSTANT_SIGNAL) {
                // signal values use a format that adds 1-12 bytes
                signal = this.writeValue(
                    b.components.ConstantSignal.signal.data,
                    b.components.ConstantSignal.signal.$
                );
            }
            chunk.push([...building, ...signal]);
        });

        // finish by adding the building count to the chunk headers
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
            output += CONFIGS["v1-compress"].id + compressedOutput;
        } else {
            output += CONFIGS["v1-b64"].id + b64Output;
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
        let symbols = [];
        if (config.symbols) {
            // Get symbol table
            const hb = data.charCodeAt(idx++);
            const lb = data.charCodeAt(idx++);
            const len = (hb << 8) | lb;
            symbols = data.substring(idx, idx + len).split(NUL);
            console.debug("##### symbols:", symbols);
            idx += len;
        }

        let maxPos = [0, 0];
        let buildings = [];
        while (idx < data.length) {
            // consume 3 bytes for chunk header
            let chunkX = data.charCodeAt(idx++);
            let chunkY = data.charCodeAt(idx++);
            let chunkBuildings = data.charCodeAt(idx++);

            for (let bldg = 0; bldg < chunkBuildings; bldg++) {
                // consume 3 or 4 bytes for each building
                let pos = data.charCodeAt(idx++);
                let rot = data.charCodeAt(idx++);
                let code = data.charCodeAt(idx++);
                if (config.symbols && code == 0) code = symbols[data.charCodeAt(idx++)];
                if (!gBuildingVariants[code]) {
                    console.log("Skip building:", code);
                    continue;
                }
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
                if (code === CONSTANT_SIGNAL) {
                    [building.components.ConstantSignal, idx] = this.readValue(data, idx);
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
