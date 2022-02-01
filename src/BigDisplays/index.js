import { globalConfig } from "core/config";
import { Loader } from "core/loader";
import { enumDirection, Vector } from "core/vector";
import { enumColors } from "game/colors";
import { Component } from "game/component";
import { enumPinSlotType, WiredPinsComponent } from "game/components/wired_pins";
import { GameSystemWithFilter } from "game/game_system_with_filter";
import { BOOL_TRUE_SINGLETON, BOOL_FALSE_SINGLETON, isTrueItem, isTruthyItem } from "game/items/boolean_item";
import { COLOR_ITEM_SINGLETONS } from "game/items/color_item";
import { defaultBuildingVariant } from "game/meta_building";
import { types } from "savegame/serialization";
import { Mod, ModMetaBuilding } from "mods/mod";
import display16x1 from "./display16x1.png";
import displayIcon from "./displayIcon.png";

import meta from "./mod.json";

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

    constructor({ type = enumBigDisplayType.color, slots = [] }) {
        super();
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
        if (!value) {
            return null;
        }
        switch (value.getItemType()) {
            case "boolean": {
                return isTrueItem(value) ? COLOR_ITEM_SINGLETONS[enumColors.white] : null;
            }
            case "color": {
                const item = value;
                return item.color === enumColors.uncolored ? null : item;
            }
            case "shape": {
                return value;
            }
            default:
                window.assert(false, "Unknown item type: " + value.getItemType());
        }
    }

    update() {
        const entities = this.allEntities;
        for (let entity of entities) {
            const displayComp = entity.components.BigDisplay;
            if (!displayComp) continue;

            if (displayComp.type === enumBigDisplayType.color) {
                // clear display
                const slots = entity.components.BigDisplay.slots;
                for (let slot of slots) {
                    slot.value = null;
                }
            }

            const pinsComp = entity.components.WiredPins;
            if (displayComp.type === enumBigDisplayType.shape) {
                // Forward sync signal
                const inPin = pinsComp.slots[1];
                const outPin = pinsComp.slots[2];
                if (!inPin.linkedNetwork) continue;
                const newValue = isTruthyItem(inPin.linkedNetwork.currentValue)
                    ? BOOL_TRUE_SINGLETON
                    : BOOL_FALSE_SINGLETON;
                outPin.value = newValue;
            }

            const valueNetwork = pinsComp.slots[0].linkedNetwork;
            if (!valueNetwork || !valueNetwork.hasValue()) continue;
            const inputValue = this.getDisplayItem(valueNetwork.currentValue);
            if (inputValue.getItemType() !== "shape") continue;

            if (displayComp.type === enumBigDisplayType.color) {
                // map input value to display slots
                const slots = entity.components.BigDisplay.slots;
                for (let slot of slots) {
                    const idx = DISPLAY_SIZE.x * slot.pos.y + slot.pos.x;
                    const layer = inputValue.definition.layers[Math.floor(idx / 4)];
                    if (!layer) continue;
                    slot.value = layer[idx % 4];
                }
            }
        }
    }

    drawChunk(parameters, chunk) {
        const entities = chunk.containedEntitiesByLayer.regular;
        for (let entity of entities) {
            if (!entity || !entity.components.BigDisplay) continue;
            const displayComp = entity.components.BigDisplay;
            const slots = entity.components.BigDisplay.slots;
            for (let slot of slots) {
                const tile = entity.components.StaticMapEntity.localTileToWorld(slot.pos);
                if (!chunk.tileSpaceRectangle.containsPoint(tile.x, tile.y)) continue;
                const worldPos = tile.toWorldSpaceCenterOfTile();
                const value = slot.value;
                if (displayComp.type === enumBigDisplayType.color) {
                    if (!value || value.color === enumColors.uncolored) continue;
                    this.displaySprites[value.color].drawCachedCentered(
                        parameters,
                        worldPos.x,
                        worldPos.y,
                        globalConfig.tileSize
                    );
                }
                if (displayComp.type === enumBigDisplayType.shape) {
                    continue;
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
                entity.components.WiredPins.setSlots([
                    {
                        pos: new Vector(0, 0),
                        direction: enumDirection.left,
                        type: enumPinSlotType.logicalAcceptor,
                    },
                ]);
                break;
            case enumBigDisplayVariants.shapes:
                entity.components.BigDisplay.setType(enumBigDisplayType.shape);
                entity.components.WiredPins.setSlots([
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
                ]);
                break;
        }
    }
}

class BigDisplays extends Mod {
    init() {
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
        // const metaClass = MetaDisplayBuilding;
        // const combinations = MetaBigDisplays.getAllVariantCombinations();
        // combinations.forEach(combination => {
        //     const id = "display";
        //     const variant = combination.variant || defaultBuildingVariant;
        //     id += variant === defaultBuildingVariant ? "" : "-" + variant;
        //     registerBuildingVariant(id, metaClass, variant, combination.rotationVariant || 0);
        // });
        this.modInterface.registerGameSystem({
            id: "bigDisplay",
            systemClass: BigDisplaySystem,
            before: "constantSignal",
            drawHooks: ["staticAfter"],
        });
    }
}

// eslint-disable-next-line no-undef
registerMod(BigDisplays, meta);
