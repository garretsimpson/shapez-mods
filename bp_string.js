const METADATA = {
    website: "https://github.com/SkimnerPhi/shapez-mods",
    author: "FatcatX and SkimnerPhi",
    name: "Blueprint strings",
    version: "1.1.0",
    id: "bp-string",
    description:
        "Generate a sharable string for when you copy & paste designs. Strings are exported to clipboard automatically on blueprint copy, use Ctrl-V to import.",
    minimumGameVersion: ">=1.5.0",
};

const BP_PREFIX = ">>>";
const BP_SUFFIX = "<<<";

const BP_FLAG_B64 = "0";
const BP_FLAG_COMPRESSED = "1";

const CONSTANT_SIGNAL = 31;

const COLORS = ["uncolored", "blue", "green", "cyan", "red", "purple", "yellow", "white"];
const SHAPES = ["C", "R", "W", "S"];

shapez.SerializerInternal.prototype["deserializeEntityNoPlace"] = function (root, payload) {
    const staticData = payload.components.StaticMapEntity;
    assert(staticData, "entity has no static data");

    const code = staticData.code;
    const data = shapez.getBuildingDataFromCode(code);

    const metaBuilding = data.metaInstance;

    const entity = metaBuilding.createEntity({
        root,
        origin: shapez.Vector.fromSerializedObject(staticData.origin),
        rotation: staticData.rotation,
        originalRotation: staticData.originalRotation,
        rotationVariant: data.rotationVariant,
        variant: data.variant,
    });

    entity.uid = payload.uid;

    let errorStatus = this.deserializeComponents(root, entity, payload.components);
    return errorStatus || entity;
};

function serializeBlueprintString(entities) {
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

        // 3 bytes are used for all buildings
        // position, rotation, and ID
        let building = [
            (x % 16 << 4) | y % 16,
            ((sme.rotation / 90) << 4) | (sme.originalRotation / 90),
            sme.code,
        ];
        let signal = [];
        if (sme.code === CONSTANT_SIGNAL) {
            // signal values use a format that adds 1-12 bytes
            signal = writeValue(
                b.components.ConstantSignal.signal.data,
                b.components.ConstantSignal.signal.$
            );
        }
        chunk.push([...building, ...signal]);
    });

    // finish by adding the building count to the chunk headers
    chunks.forEach(c => c[0].push(c.length - 1));

    // convert to both formats & output the shorter option
    // strings will always start with >>> and a flag indicating format
    //   and end with <<<
    let output = String.fromCharCode(...chunks.flat(Infinity));
    let compressedOutput = shapez.compressX64(output);
    let b64Output = btoa(output);
    if (compressedOutput.length < b64Output.length) {
        return BP_PREFIX + BP_FLAG_COMPRESSED + compressedOutput + BP_SUFFIX;
    } else {
        return BP_PREFIX + BP_FLAG_B64 + b64Output + BP_SUFFIX;
    }
}
function deserializeBlueprintString(root, blueprint) {
    try {
        if (!blueprint.startsWith(BP_PREFIX) || !blueprint.endsWith(BP_SUFFIX)) {
            throw "Not a blueprint string";
        }

        // remove >>>, format flag, and <<<
        let data = blueprint.substring(BP_PREFIX.length + 1, blueprint.length - BP_SUFFIX.length);
        // convert encoded string to raw string
        switch (blueprint.charAt(BP_PREFIX.length)) {
            case BP_FLAG_B64:
                data = atob(data);
                break;
            case BP_FLAG_COMPRESSED:
                data = shapez.decompressX64(data);
                break;
            default:
                throw "Unknown blueprint format";
        }

        let maxPos = [0, 0];
        let buildings = [];
        for (let idx = 0; idx < data.length; ) {
            // consume 3 bytes for chunk header
            let chunkX = data.charCodeAt(idx++);
            let chunkY = data.charCodeAt(idx++);
            let chunkBuildings = data.charCodeAt(idx++);

            for (let bldg = 0; bldg < chunkBuildings; bldg++) {
                // consume 3 bytes for each building
                let pos = data.charCodeAt(idx++);
                let rot = data.charCodeAt(idx++);
                let code = data.charCodeAt(idx++);

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
                    [building.components.ConstantSignal, idx] = readValue(data, idx);
                }

                maxPos = [
                    Math.max(maxPos[0], building.components.StaticMapEntity.origin.x),
                    Math.max(maxPos[1], building.components.StaticMapEntity.origin.y),
                ];
                buildings.push(building);
            }
        }

        const serializer = new shapez.SerializerInternal();

        const buildingEntities = buildings.map(b => {
            b.components.StaticMapEntity.origin.x -= (maxPos[0] / 2) | 0;
            b.components.StaticMapEntity.origin.y -= (maxPos[1] / 2) | 0;

            const result = serializer.deserializeEntityNoPlace(root, b);

            if (typeof result === "string") {
                throw new Error(result);
            }

            return result;
        });

        return new shapez.Blueprint(buildingEntities);
    } catch (ex) {
        console.error("Invalid blueprint data:", ex.message);
    }
}

function readValue(dataIn, pos) {
    let head = dataIn.charCodeAt(pos++);
    if ((head & 0b11111000) === 0b00000000) {
        // 0000 0xxx = boolean
        return [
            {
                $: "boolean_item",
                data: head,
            },
            pos,
        ];
    } else if ((head & 0b11111000) === 0b00001000) {
        // 0000 1rgb = color
        return [
            {
                $: "color",
                data: COLORS[head & 0b0111],
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

    quads = new Array(16);
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

function writeValue(value, type) {
    if (type === "boolean_item") {
        return [value & 1];
    } else if (type === "color") {
        return [(COLORS.indexOf(value) & 0b0111) | 0b1000];
    } else if (type === "shape") {
        // remove layer separators
        value = value.replaceAll(":", "");
        // pad to 2 or 4 layers, split into array of quads
        value = value.padEnd(value.length > 16 ? 32 : 16, "-").match(/(.{2})/g);

        let head = [];
        // generate bit field for enabled quads
        for (let i = 0; i < value.length; i++) {
            head[Math.floor(i / 8)] = (head[Math.floor(i / 8)] << 1) | (value[i] !== "--");
        }

        // remove all empty quads
        value = value.filter(x => x !== "--");

        let data = [];
        let pos = 0;
        for (let i = 0; i < value.length; i++) {
            const shape = SHAPES.indexOf(value[i].charAt(0));
            const color = COLORS.findIndex(x => x.startsWith(value[i].charAt(1)));
            const pair = (color << 2) | shape;

            // shift quad data into position and add to buffer
            const offset = (pos % 8) - 3;
            data[Math.floor(pos / 8)] |= offset < 0 ? pair << -offset : pair >> offset;
            if (offset > 0) {
                // if there is not enough space on the first byte, overflow remaining bits to the second byte
                data[Math.floor(pos / 8) + 1] |= (pair << (8 - offset)) & 0xff;
            }
            pos += 5;
        }

        return [...head, ...data];
    }
}
class Mod extends shapez.Mod {
    init() {
        this.modInterface.runAfterMethod(shapez.HUDBlueprintPlacer, "initialize", function () {
            document.addEventListener("paste", ev => {
                if (this.root.app.inputMgr.getTopReciever().context === "state-InGameState") {
                    let blueprint;
                    try {
                        let data = ev.clipboardData.getData("text");
                        blueprint = deserializeBlueprintString(this.root, data);

                        console.debug("Received data from clipboard");
                    } catch (ex) {
                        console.error("Paste from clipboard failed:", ex.message);
                    }

                    this.lastBlueprintUsed = blueprint || this.lastBlueprintUsed;

                    this.pasteBlueprint();
                }
            });
        });

        this.modInterface.runAfterMethod(
            shapez.HUDBlueprintPlacer,
            "createBlueprintFromBuildings",
            async function () {
                const data = new shapez.SerializerInternal().serializeEntityArray(
                    this.currentBlueprint.get().entities
                );

                console.log(data);

                try {
                    const bpString = serializeBlueprintString(data);
                    await navigator.clipboard.writeText(bpString);
                    this.root.soundProxy.playUi(shapez.SOUNDS.copy);
                    console.debug("Copied blueprint to clipboard");
                } catch (ex) {
                    console.error("Copy to clipboard failed:", ex.message);
                }
            }
        );
    }
}
