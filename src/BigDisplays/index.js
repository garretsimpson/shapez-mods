import { globalConfig } from "core/config";
import { Loader } from "core/loader";
import { enumDirection, Vector } from "core/vector";
import { enumColors } from "game/colors";
import { Component } from "game/component";
import { enumPinSlotType, WiredPinsComponent } from "game/components/wired_pins";
import { GameSystemWithFilter } from "game/game_system_with_filter";
import { isTrueItem, isTruthyItem } from "game/items/boolean_item";
import { COLOR_ITEM_SINGLETONS } from "game/items/color_item";
import { defaultBuildingVariant } from "game/meta_building";
import { types } from "savegame/serialization";
import { Mod, ModMetaBuilding } from "mods/mod";
import display16x1 from "./display16x1.png";
import displayIcon from "./displayIcon.png";

import META from "./mod.json";

const DISPLAY_SIZE = { x: 16, y: 1 };

const enumBigDisplayVariants = {
    shapes: "shapes",
};

const enumBigDisplayType = {
    color: "color",
    shape: "shape",
};

class BigDisplayComponent extends Component {
    static getId() {
        return "BigDisplay";
    }

    // Is getSchema needed?
    static getSchema() {
        return {
            type: types.string,
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
            return { pos: slotData.pos, value: null, data: null };
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

    update() {
        for (let entity of this.allEntities) {
            const displayComp = entity.components.BigDisplay;
            if (!displayComp) continue;
            const pinsComp = entity.components.WiredPins;

            const valuePin = pinsComp.slots[0];
            let inputValue;
            if (valuePin.linkedNetwork && valuePin.linkedNetwork.hasValue()) {
                inputValue = this.getDisplayItem(valuePin.linkedNetwork.currentValue);
            } else {
                inputValue = COLOR_ITEM_SINGLETONS[enumColors.uncolored];
            }

            if (displayComp.type === enumBigDisplayType.color) {
                if (inputValue.getItemType() === "color") {
                    for (let slot of displayComp.slots) {
                        slot.data = inputValue;
                    }
                }
                if (inputValue.getItemType() === "shape") {
                    // map input value to display slots
                    for (let slot of displayComp.slots) {
                        slot.data = null;
                        const idx = DISPLAY_SIZE.x * slot.pos.y + slot.pos.x;
                        const layer = inputValue.definition.layers[Math.floor(idx / 4)];
                        if (!layer) continue;
                        const quad = layer[idx % 4];
                        if (!quad) continue;
                        slot.data = COLOR_ITEM_SINGLETONS[quad.color];
                    }
                }
            }

            if (displayComp.type === enumBigDisplayType.shape) {
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

    drawChunk(parameters, chunk) {
        const entities = chunk.containedEntitiesByLayer.regular;
        for (let entity of entities) {
            if (!entity || !entity.components.BigDisplay) continue;
            const slots = entity.components.BigDisplay.slots;
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
                if (value.getItemType() === "shape") {
                    value.drawItemCenteredClipped(worldPos.x, worldPos.y, parameters, 30);
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
                name: "Color Display (16 x 1)",
                description: "Displays 16 colors, one for each corner of the connected shape signal.",

                regularImageBase64: `${display16x1}`,
                blueprintImageBase64: `${display16x1}`,
                tutorialImageBase64: `${display16x1}`,
            },
            {
                variant: enumBigDisplayVariants.shapes,
                name: "Shape Display (16 x 1)",
                description:
                    "Displays 16 shapes. Connect a stream of shapes to the data input. " +
                    "Then use a truthy signal on the sync input to display the shapes.",

                regularImageBase64: `${display16x1}`,
                blueprintImageBase64: `${display16x1}`,
                tutorialImageBase64: `${display16x1}`,
            },
        ];
    }

    getAvailableVariants() {
        return [defaultBuildingVariant, enumBigDisplayVariants.shapes];
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
