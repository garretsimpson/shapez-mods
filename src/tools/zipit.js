/* eslint-disable */
var zipper = require("zip-local");

const VERSION = "ZipIt 0.1";
const USAGE = "ZipIt <filename>";

function main(args) {
    const rawFile = args[2];
    if (!rawFile) {
        console.log("Usage:", USAGE);
        return;
    }

    const zipFile = rawFile + ".zip";
    try {
        zipper.sync.zip(rawFile).compress().save(zipFile);
    } catch (e) {
        console.log("Problem zipping file:", rawFile);
    }
    console.log("Created file:", zipFile);
}

console.log(VERSION);
main(process.argv);
