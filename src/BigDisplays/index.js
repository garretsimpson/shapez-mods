import { globalConfig } from "core/config";
import { Loader } from "core/loader";
import { enumDirection, Vector } from "core/vector";
import { enumColors } from "game/colors";
import { Component } from "game/component";
import { enumPinSlotType, WiredPinsComponent } from "game/components/wired_pins";
import { GameSystemWithFilter } from "game/game_system_with_filter";
import { isTrueItem, isTruthyItem } from "game/items/boolean_item";
import { COLOR_ITEM_SINGLETONS } from "game/items/color_item";
import { typeItemSingleton } from "game/item_resolver";
import { defaultBuildingVariant } from "game/meta_building";
import { Mod, ModMetaBuilding } from "mods/mod";
import { types } from "savegame/serialization";
import display16x1 from "./display16x1.png";
import displayIcon from "./displayIcon.png";

import META from "./mod.json";

/**
 * Big Displays
 *
 * Description
 * - 16 tiles wide, 1 tile high
 * - 1 data input (side)
 * - 1 sync input (bottom)
 * - 1 sync output (top)
 *
 * Connect a stream of values (shapes or colors) to the data pin.
 * Send a pulse to the sync pin to display and latch the values.
 * The sync pin is a "pass-thru" connector.
 * All displays connected to the same sync signal update at the same time.
 *
 * Display types
 * - "default" - input a shape, displays 16 colors, 1 tick refresh.
 * - "shapes" - input a stream of values, displays 16 colors or shapes, 16 tick refresh.
 * - "hidef" - input a stream of shapes, displays 256 (64x4) colors, 16 tick refresh.
 *
 * TODO
 * - Extend in-game Display building?
 */

const DISPLAY_SIZE = { x: 16, y: 1 };

const enumBigDisplayVariants = {
    shapes: "shapes",
    hidef: "hidef",
};

const enumBigDisplayType = {
    color: "color",
    shape: "shape",
    hd: "hd",
};

const COLOR_TABLE = {
    red: "#f8143a", // rgb(248,20,58) hsv(350°, 92%, 97%)
    yellow: "#fcff19", // rgb(252,255,25) hsv(61°, 90%, 100%)
    green: "#69ff2e", // rgb(105,255,46) hsv(103°, 82%, 100%)
    cyan: "#17f1f4", // rgb(23,241,244) hsv(181°, 91%, 96%)
    blue: "#30a0ff", // rgb(48,160,255) hsv(208°, 81%, 100%)
    purple: "#d02dff", // rgb(208,45,255) hsv(287°, 82%, 100%)
    white: "#ffffff", // rgb(255,255,255) hsv(0°, 0%, 100%)
    uncolored: "#71737c", // rgb(113,115,124) hsv(229°, 9%, 49%)
};

class BigDisplayComponent extends Component {
    static getId() {
        return "BigDisplay";
    }

    // Is getSchema needed?
    static getSchema() {
        return {
            index: types.uint,
            type: types.enum(enumBigDisplayType),
            slots: types.fixedSizeArray(
                types.structured({
                    data: types.nullable(typeItemSingleton),
                    value: types.nullable(typeItemSingleton),
                })
            ),
        };
    }

    constructor({ index = 0, type = enumBigDisplayType.color, slots = [] }) {
        super();
        this.index = index;
        this.setType(type);
        this.setSlots(slots);
    }

    setType(type) {
        this.type = type;
    }

    /**
     * @param {Array} slots
     */
    setSlots(slots) {
        this.slots = slots.map(slotData => {
            return { pos: slotData.pos, value: slotData.value, data: slotData.data };
        });
    }
}

class BigDisplaySystem extends GameSystemWithFilter {
    constructor(root) {
        super(root, [BigDisplayComponent]);

        this.displaySprites = {};
        for (const colorId in enumColors) {
            if (colorId === enumColors.uncolored) continue;
            this.displaySprites[colorId] = Loader.getSprite("sprites/wires/display/" + colorId + ".png");
        }
    }

    getDisplayItem(value) {
        const uncoloredItem = COLOR_ITEM_SINGLETONS[enumColors.uncolored];
        const whiteItem = COLOR_ITEM_SINGLETONS[enumColors.white];

        if (!value) return uncoloredItem;
        switch (value.getItemType()) {
            case "boolean":
                return isTrueItem(value) ? whiteItem : uncoloredItem;
            case "color":
            case "shape":
                return value;
            default:
                window.assert(false, "Unknown item type: " + value.getItemType());
        }
    }

    getShapeColors(item) {
        const result = [];
        if (item.getItemType() !== "shape") return result;

        for (let i = 0; i < 16; i++) {
            let colorItem = COLOR_ITEM_SINGLETONS[enumColors.uncolored];
            const layer = item.definition.layers[Math.floor(i / 4)];
            if (!layer) break;
            const quad = layer[i % 4];
            if (quad) colorItem = COLOR_ITEM_SINGLETONS[quad.color];
            result.push(colorItem);
        }
        return result;
    }

    update() {
        for (let entity of this.allEntities) {
            const displayComp = entity.components.BigDisplay;
            if (!displayComp) continue;
            const pinsComp = entity.components.WiredPins;

            const valuePin = pinsComp.slots[0];
            let inputValue = COLOR_ITEM_SINGLETONS[enumColors.uncolored];
            if (valuePin.linkedNetwork && valuePin.linkedNetwork.hasValue()) {
                inputValue = this.getDisplayItem(valuePin.linkedNetwork.currentValue);
            }

            if (displayComp.type === enumBigDisplayType.color) {
                if (inputValue.getItemType() === "color") {
                    for (let slot of displayComp.slots) {
                        slot.data = inputValue;
                    }
                }
                if (inputValue.getItemType() === "shape") {
                    const colors = this.getShapeColors(inputValue);
                    for (let slot of displayComp.slots) {
                        slot.data = null;
                        const idx = DISPLAY_SIZE.x * slot.pos.y + slot.pos.x;
                        const color = colors[idx];
                        if (!color || color.color === enumColors.uncolored) continue;
                        slot.data = color;
                    }
                }
            }

            if (displayComp.type === enumBigDisplayType.shape || displayComp.type === enumBigDisplayType.hd) {
                const index = displayComp.index;
                displayComp.index = (index + 1) % (DISPLAY_SIZE.x * DISPLAY_SIZE.y);
                displayComp.slots[index].data = inputValue;
            }

            // If there are multiple BigDisplays connected, find the first inPin.
            const myUid = entity.uid;
            let inPin = pinsComp.slots[1];
            let looking = true;
            while (looking) {
                if (!inPin.linkedNetwork || !inPin.linkedNetwork.providers) break;
                const nextEntity = inPin.linkedNetwork.providers[0].entity;
                if (!nextEntity.components.BigDisplay) break;
                inPin = nextEntity.components.WiredPins.slots[1];
                if (nextEntity.uid == myUid) break; // loop detection
            }

            // Forward sync signal
            let sync = false;
            if (inPin.linkedNetwork) {
                const outPin = pinsComp.slots[2];
                outPin.value = inPin.linkedNetwork.currentValue;
                sync = isTruthyItem(inPin.linkedNetwork.currentValue);
            }

            if (sync) {
                // sync display
                displayComp.index = 0;
                for (let slot of displayComp.slots) {
                    slot.value = slot.data;
                    slot.data = null;
                }
            }
        }
    }

    // toColor(r, g, b) {
    //     const red = r.toString(16).padStart(2, "0");
    //     const grn = g.toString(16).padStart(2, "0");
    //     const blu = b.toString(16).padStart(2, "0");
    //     return `#${red.toString(16)}${grn.toString(16)}${blu.toString(16)}`;
    // }

    drawChunk(parameters, chunk) {
        const entities = chunk.containedEntitiesByLayer.regular;
        for (let entity of entities) {
            const displayComp = entity.components.BigDisplay;
            if (!entity || !displayComp) continue;
            const displayType = displayComp.type;
            const slots = displayComp.slots;
            for (let slot of slots) {
                const tile = entity.components.StaticMapEntity.localTileToWorld(slot.pos);
                if (!chunk.tileSpaceRectangle.containsPoint(tile.x, tile.y)) continue;
                const worldPos = tile.toWorldSpaceCenterOfTile();
                const value = slot.value;
                if (!value) continue;
                if (value.getItemType() === "color") {
                    if (value.color === enumColors.uncolored) continue;
                    this.displaySprites[value.color].drawCachedCentered(
                        parameters,
                        worldPos.x,
                        worldPos.y,
                        globalConfig.tileSize
                    );
                }
                if (value.getItemType() === "shape" && displayType === enumBigDisplayType.shape) {
                    value.drawItemCenteredClipped(worldPos.x, worldPos.y, parameters, 30);
                }
                if (value.getItemType() === "shape" && displayType === enumBigDisplayType.hd) {
                    const colors = this.getShapeColors(value);
                    if (colors.length == 0) continue;
                    // Display 4x4 array of colors
                    const tileSize = globalConfig.tileSize / 4;
                    const elemSize = tileSize; // scale?
                    for (let i = 0; i < 16; i++) {
                        const color = colors[i];
                        if (!color || color.color === enumColors.uncolored) continue;
                        const x = (i % 4) - 2; // x range: -2..1
                        const y = 1 - Math.floor(i / 4); // y range: -2..1
                        let posX = worldPos.x + x * tileSize;
                        let posY = worldPos.y + y * tileSize;
                        posX += (tileSize - elemSize) / 2;
                        posY += (tileSize - elemSize) / 2;
                        parameters.context.fillStyle = COLOR_TABLE[color.color];
                        parameters.context.fillRect(posX, posY, elemSize, elemSize);
                    }
                }
            }
        }
    }
}

class MetaBigDisplays extends ModMetaBuilding {
    constructor() {
        super("bigDisplays");
    }

    static getAllVariantCombinations() {
        return [
            {
                variant: defaultBuildingVariant,
                name: "Color Display",
                description:
                    "Displays 16 colors, one for each corner of the connected shape signal." +
                    "Use a truthy signal on the sync input to display and latch the values.",
                regularImageBase64: `${display16x1}`,
                blueprintImageBase64: `${display16x1}`,
                tutorialImageBase64: `${display16x1}`,
            },
            {
                variant: enumBigDisplayVariants.shapes,
                name: "Shape Display",
                description:
                    "Displays 16 colors or shapes. Connect a stream of values to the data input. " +
                    "Use a truthy signal on the sync input to display and latch the values.",
                regularImageBase64: `${display16x1}`,
                blueprintImageBase64: `${display16x1}`,
                tutorialImageBase64: `${display16x1}`,
            },
            {
                variant: enumBigDisplayVariants.hidef,
                name: "Hi-def Display",
                description:
                    "Displays 256 colors.  Connect a stream of shapes. " +
                    "Each shape is displayed as a 4x4 array of colors. " +
                    "Use a truthy signal on the sync input to display and latch the values.",
                regularImageBase64: `${display16x1}`,
                blueprintImageBase64: `${display16x1}`,
                tutorialImageBase64: `${display16x1}`,
            },
        ];
    }

    getAvailableVariants() {
        return [defaultBuildingVariant, enumBigDisplayVariants.shapes, enumBigDisplayVariants.hidef];
    }

    getSilhouetteColor() {
        return "#aaaaaa";
    }

    getDimensions() {
        return new Vector(DISPLAY_SIZE.x, DISPLAY_SIZE.y);
    }

    setupEntityComponents(entity) {
        entity.addComponent(
            new WiredPinsComponent({
                slots: [
                    {
                        pos: new Vector(0, 0),
                        direction: enumDirection.left,
                        type: enumPinSlotType.logicalAcceptor,
                    },
                    {
                        pos: new Vector(0, 0),
                        direction: enumDirection.bottom,
                        type: enumPinSlotType.logicalAcceptor,
                    },
                    {
                        pos: new Vector(0, 0),
                        direction: enumDirection.top,
                        type: enumPinSlotType.logicalEjector,
                    },
                ],
            })
        );

        const size = DISPLAY_SIZE;
        const slots = [];
        for (let y = 0; y < size.y; y++) {
            for (let x = 0; x < size.x; x++) {
                slots.push({
                    pos: new Vector(x, y),
                });
            }
        }
        entity.addComponent(
            new BigDisplayComponent({
                slots,
            })
        );
    }

    updateVariants(entity, rotationVariant, variant) {
        switch (variant) {
            case defaultBuildingVariant:
                entity.components.BigDisplay.setType(enumBigDisplayType.color);
                break;
            case enumBigDisplayVariants.shapes:
                entity.components.BigDisplay.setType(enumBigDisplayType.shape);
                break;
            case enumBigDisplayVariants.hidef:
                entity.components.BigDisplay.setType(enumBigDisplayType.hd);
                break;
        }
    }
}

class BigDisplays extends Mod {
    init() {
        console.debug("##### Init mod:", META.id);
        this.modInterface.registerComponent(BigDisplayComponent);
        this.modInterface.registerNewBuilding({
            metaClass: MetaBigDisplays,
            buildingIconBase64: `${displayIcon}`,
        });
        this.modInterface.addNewBuildingToToolbar({
            toolbar: "regular",
            location: "secondary",
            metaClass: MetaBigDisplays,
        });
        this.modInterface.addNewBuildingToToolbar({
            toolbar: "wires",
            location: "secondary",
            metaClass: MetaBigDisplays,
        });
        this.modInterface.registerGameSystem({
            id: "bigDisplay",
            systemClass: BigDisplaySystem,
            before: "constantSignal",
            drawHooks: ["staticAfter"],
        });
    }
}

// eslint-disable-next-line no-undef
registerMod(BigDisplays, META);
