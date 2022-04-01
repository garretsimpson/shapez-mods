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
        let ename, func;
        for (let row of pattern) {
            x = posx;
            for (let entry of row) {
                if (entry) {
                    ename = entry[0];
                    func = entry[1];
                    bp.addXY(x, y, BP.ENTITY[ename], func({ x, y, ename }));
                }
                x++;
            }
            y++;
        }
    }

    static test() {
        bp.add(BP.ENTITY["constant_signal"], { $: "shape", data: "CuCuCuCu:CuCuCuRw" });
    }

    static displayLogic() {
        const ROTS = [180, 270, 0, 90];
        const CONFIG = { $: "shape", data: "CuCuCuCu:CuCuCuRw" };
        const f = info => {
            const x = info.x - 1;
            const y = info.y - 1;
            const quad = Shape.gridToQuad(x, y);
            return { $: CONFIG.$, data: CONFIG.data, rotation: ROTS[quad], originalRotation: ROTS[quad] };
        };
        const A = ["constant_signal", f];
        const B = ["signal_transport-mirrored", f];
        const N = null;
        const PATTERN = [
            [A, B, A],
            [B, N, B],
            [A, B, A],
        ];
        BPTool.makePattern(PATTERN);
    }

    static main() {
        console.log(APP_NAME);
        console.log(Date());
        console.log("");

        BPTool.displayLogic();
        BPTool.writeFile(BP_FILE_NAME, bp.toString());
        console.log("Wrote file:", BP_FILE_NAME);
    }
}
