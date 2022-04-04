/**
 * Blueprint tool
 */

import { writeFileSync } from "fs";
import { BP } from "./bp.js";
import { Shape } from "./shape.js";

const APP_NAME = "Blueprint tool";
const BP_FILE_NAME = "bp.txt";

const bp = new BP();

export class BPTool {
    /**
     * @param {string} filename
     * @param {*} data
     */
    static writeFile(filename, data) {
        try {
            writeFileSync(filename, data);
        } catch (err) {
            console.error(err);
        }
    }

    static makePattern(pattern, config) {
        let [posx, posy] = [config.posX, config.posY];
        let [x, y] = [posx, posy];
        let ename, configData;
        for (let row of pattern) {
            x = posx;
            for (let entry of row) {
                if (entry) {
                    [ename, configData] = entry;
                    console.debug(x, y, ename);
                    bp.addXY(x, y, BP.ENTITY[ename], configData);
                }
                x++;
            }
            y++;
        }
    }

    static constantSignal(shape) {
        bp.add("constant_signal", { $: "shape", data: shape });
    }

    static displayLogic(config) {
        const rotA = [90, 180, 0, 270];
        const top = ["CuCuCuRw", "RwCuCuCu", "CuCuRwCu", "CuRwCuCu"];
        const shapes = top.map(v => config.shape + ":" + v);
        const configA = {
            $: "shape",
            data: shapes,
            rotation: rotA,
            originalRotation: rotA.slice(),
        };
        const rotB = [180, 90, 270, 0];
        const configB = { rotation: rotB, originalRotation: rotB.slice() };
        const A = ["constant_signal", configA];
        const B = ["signal_transport-mirrored", configB];
        const N = null;
        const pattern = [
            [A, B, A],
            [B, N, B],
            [A, B, A],
        ];
        BPTool.makePattern(pattern, config);
    }

    static displayLogicArray(dimX, dimY) {
        const sizeX = 3;
        const sizeY = 3;
        let num, shape;
        let posX, posY;
        let config;
        for (let y = 0; y < dimY; y++) {
            for (let x = 0; x < dimX; x++) {
                posX = sizeX * x;
                posY = sizeY * y;
                num = (x << 4) + y;
                shape = Shape.encodeNum(num);
                config = { posX, posY, shape };
                BPTool.displayLogic(config);
            }
        }
    }

    static inputLogic(config) {
        const configB = { rotation: 90, originalRotation: 90 };
        const configC = {
            rotation: [90, 0, 0],
            originalRotation: [90, 0, 0],
            wirelessCode: ["pixel", "grid", config.input],
        };
        const configH = {
            rotation: [0, 270],
            originalRotation: [0, 270],
            $: "shape",
            data: [config.shape, "CuCuCuCu:CuCuCuCu:CuCuCuCu:CuCuCuCu"],
        };
        const A = ["wire_tunnel-turn", {}];
        const B = ["transistor-mirrored", configB];
        const C = ["signal_transport-static", configC];
        const D = ["diode", {}];
        const E = ["wire", {}];
        const F = ["transistor", {}];
        const G = ["not", {}];
        const H = ["constant_signal", configH];
        const I = ["comparator", {}];
        const N = null;
        const pattern = [
            [A, B, C],
            [D, E, C],
            [D, E, F],
            [E, G, H],
            [E, I, H],
            [C, N, N],
        ];
        BPTool.makePattern(pattern, config);
    }

    static inputLogicArray(dimX, dimY) {
        const sizeX = 3;
        const sizeY = 6;
        let num, input, shape;
        let posX, posY;
        let config;
        for (let y = 0; y < dimY; y++) {
            for (let x = 0; x < dimX; x++) {
                posX = sizeX * x;
                posY = sizeY * y;
                input = "m" + (x.toString(16) + y.toString(16)).toUpperCase();
                num = (x << 4) + y;
                shape = Shape.encodeNum(num);
                config = { posX, posY, input, shape };
                BPTool.inputLogic(config);
            }
        }
    }

    static ram(config) {
        const rotA = [0, 0, 180, 180];
        const configA = { rotation: rotA, originalRotation: rotA.slice() };
        const top = ["CuCuCuRw", "RwCuCuCu", "CuCuRwCu", "CuRwCuCu"];
        const shapes = top.map(v => config.shape + ":" + v);
        const rotB = [270, 270, 90, 90];
        const configB = {
            rotation: rotB,
            originalRotation: rotB.slice(),
            $: "shape",
            data: shapes,
        };
        const rotC = [270, 270, 90, 90];
        const configC = { rotation: rotC, originalRotation: rotC.slice() };
        const rotD = [180, 180, 0, 0];
        const configD = { rotation: rotD, originalRotation: rotD.slice(), $: "shape", data: shapes.slice() };
        const rotE = [0, 180, 0, 180];
        const configE = {
            rotation: rotE,
            originalRotation: rotE.slice(),
            wirelessCode: "next_value",
        };
        const A = ["signal_transport-mirrored", configA];
        const B = ["constant_signal", configB];
        const C = ["memory-write_enable", configC];
        const D = ["constant_signal", configD];
        const E = ["signal_transport-static", configE];
        const N = null;
        const pattern = [
            [A, B, A, B],
            [N, D, N, D],
            [C, A, C, A],
            [E, E, E, E],
            [A, C, A, C],
            [D, N, D, N],
            [B, A, B, A],
        ];
        BPTool.makePattern(pattern, config);
    }

    static main() {
        console.log(APP_NAME);
        console.log(Date());
        console.log("");

        // BPTool.displayLogicArray(16, 12);
        // BPTool.inputLogicArray(16, 12);
        // BPTool.inputLogic({ posX: 0, posY: 0, input: "m00", shape: "CuCuCuCu" });
        BPTool.ram({ posX: 0, posY: 0, shape: "CuCuCuCu" });
        BPTool.writeFile(BP_FILE_NAME, bp.toString());
        console.log("Wrote file:", BP_FILE_NAME);
    }
}
