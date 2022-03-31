/**
 * Blueprint tool
 */

import { writeFileSync } from "fs";
import { BP } from "./bp.js";

const APP_NAME = "BP";
const BP_FILE_NAME = "bp.txt";

/**
 * @param {string} filename
 * @param {*} data
 */
function writeFile(filename, data) {
    try {
        writeFileSync(filename, data);
    } catch (err) {
        console.error(err);
    }
}

function main() {
    console.log(APP_NAME);
    console.log(Date());
    console.log("");

    const bp = new BP();
    bp.add(BP.ENTITY.constant_signal, { $: "shape", data: "CuCuCuCu:CuCuCuRw" });
    writeFile(BP_FILE_NAME, bp.toString());
    console.log("Wrote file:", BP_FILE_NAME);
}

main();
