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

    static makePattern(pattern) {
        let [posx, posy] = bp.getXY();
        let [x, y] = [posx, posy];
        let ename, config;
        for (let row of pattern) {
            x = posx;
            for (let entry of row) {
                if (entry) {
                    ename = entry[0];
                    config = entry[1];
                    console.debug(x, y, ename);
                    bp.addXY(x, y, BP.ENTITY[ename], config);
                }
                x++;
            }
            y++;
        }
    }

    static test() {
        bp.add(BP.ENTITY["constant_signal"], { $: "shape", data: "CuCuCuCu:CuCuCuRw" });
    }

    static displayLogic(shape) {
        const rotA = [90, 180, 0, 270];
        const top = ["CuCuCuRw", "RwCuCuCu", "CuCuRwCu", "CuRwCuCu"];
        const shapes = top.map(v => shape + ":" + v);
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
        BPTool.makePattern(pattern);
    }

    static main() {
        console.log(APP_NAME);
        console.log(Date());
        console.log("");

        BPTool.displayLogic("CuCuCuCu");
        BPTool.writeFile(BP_FILE_NAME, bp.toString());
        console.log("Wrote file:", BP_FILE_NAME);
    }
}
