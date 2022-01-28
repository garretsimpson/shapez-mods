// @ts-nocheck
const METADATA = {
    website: "https://github.com/garretsimpson/shapez-mods",
    author: "saile515 and FatcatX",
    name: "Add big displays",
    version: "0.1",
    id: "big-displays",
    description: "Adds big displays.  Including: 16x1x32 color display.",
    minimumGameVersion: ">=1.5.0",
};

const DISPLAYS = { color16: { size: { x: 16, y: 1 } } };

class BigDisplayComponent extends shapez.Component {
    static getId() {
        return "BigDisplay";
    }

    constructor({ slots = [] }) {
        super();
        this.setSlots(slots);
    }

    setSlots(slots) {
        this.slots = [];

        for (let i = 0; i < slots.length; ++i) {
            const slotData = slots[i];
            this.slots.push({
                pos: slotData.pos,
                value: null,
            });
        }
    }
}

class BigDisplaySystem extends shapez.GameSystem {
    constructor(root) {
        super(root);
        this.displaySprites = {};

        for (const colorId in shapez.enumColors) {
            if (colorId === shapez.enumColors.uncolored) {
                continue;
            }
            this.displaySprites[colorId] = shapez.Loader.getSprite(
                "sprites/wires/display/" + colorId + ".png"
            );
        }
    }

    getDisplayItem(value) {
        if (!value) {
            return null;
        }
        switch (value.getItemType()) {
            case "boolean": {
                return shapez.isTrueItem(value)
                    ? shapez.COLOR_ITEM_SINGLETONS[shapez.enumColors.white]
                    : null;
            }
            case "color": {
                const item = value;
                return item.color === shapez.enumColors.uncolored ? null : item;
            }
            case "shape": {
                return value;
            }
            default:
                shapez.assertAlways(false, "Unknown item type: " + value.getItemType());
        }
    }

    drawChunk(parameters, chunk) {
        const contents = chunk.containedEntitiesByLayer.regular;
        for (let i = 0; i < contents.length; ++i) {
            const entity = contents[i];
            if (entity && entity.components.BigDisplay) {
                const pinsComp = entity.components.WiredPins;
                const valueNetwork = pinsComp.slots[0].linkedNetwork;
                if (!valueNetwork || !valueNetwork.hasValue()) {
                    continue;
                }
                const value = this.getDisplayItem(valueNetwork.currentValue);
                if (!value || value.getItemType() !== "shape") continue;
                // console.debug("##### value:", value);
                // const shape = value.getAsCopyableKey();
                // console.debug("##### shape:", shape);
                const slots = entity.components.BigDisplay.slots;
                for (let slot of slots) {
                    const tile = entity.components.StaticMapEntity.localTileToWorld(slot.pos);
                    if (!chunk.tileSpaceRectangle.containsPoint(tile.x, tile.y)) continue;
                    // TODO: map position per display type
                    const idx = slot.pos.x;
                    const layer = value.definition.layers[Math.floor(idx / 4)];
                    if (!layer) continue;
                    const item = layer[idx % 4];
                    if (!item || item.color === shapez.enumColors.uncolored) continue;
                    const worldPos = tile.toWorldSpaceCenterOfTile();
                    this.displaySprites[item.color].drawCachedCentered(
                        parameters,
                        worldPos.x,
                        worldPos.y,
                        shapez.globalConfig.tileSize
                    );
                }
            }
        }
    }
}

class MetaBigDisplays extends shapez.ModMetaBuilding {
    constructor() {
        super("bigDisplays");
    }

    static getAllVariantCombinations() {
        return [
            {
                variant: shapez.defaultBuildingVariant,
                name: "Big Display",
                description: "A big display",

                regularImageBase64: RESOURCES["color16.png"],
                blueprintImageBase64: RESOURCES["color16.png"],
                tutorialImageBase64: RESOURCES["color16.png"],
            },
        ];
    }

    getSilhouetteColor() {
        return "#aaaaaa";
    }

    getDimensions(variant) {
        const size = DISPLAYS.color16.size;
        return new shapez.Vector(size.x, size.y);
    }

    setupEntityComponents(entity) {
        entity.addComponent(
            new shapez.WiredPinsComponent({
                slots: [
                    {
                        pos: new shapez.Vector(0, 0),
                        direction: shapez.enumDirection.left,
                        type: shapez.enumPinSlotType.logicalAcceptor,
                    },
                ],
            })
        );

        const size = DISPLAYS.color16.size;
        const slots = [];
        for (let x = 0; x < size.x; x++) {
            for (let y = 0; y < size.y; y++) {
                slots.push({
                    pos: new shapez.Vector(x, y),
                });
            }
        }
        entity.addComponent(
            new BigDisplayComponent({
                slots,
            })
        );
    }
}

class Mod extends shapez.Mod {
    init() {
        this.modInterface.registerComponent(BigDisplayComponent);
        this.modInterface.registerNewBuilding({
            metaClass: MetaBigDisplays,
            buildingIconBase64: RESOURCES["displayIcon.png"],
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
        // const metaClass = shapez.MetaDisplayBuilding;
        // const combinations = MetaBigDisplays.getAllVariantCombinations();
        // combinations.forEach(combination => {
        //     const id = "display";
        //     const variant = combination.variant || shapez.defaultBuildingVariant;
        //     id += variant === shapez.defaultBuildingVariant ? "" : "-" + variant;
        //     shapez.registerBuildingVariant(id, metaClass, variant, combination.rotationVariant || 0);
        // });
        this.modInterface.registerGameSystem({
            id: "bigDisplay",
            systemClass: BigDisplaySystem,
            before: "constantSignal",
            drawHooks: ["staticAfter"],
        });
    }
}

////////////////////////////////////////////////////////////////////////

const RESOURCES = {
    "color16.png":
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAAQCAYAAAD506FJAAABcmlDQ1BpY2MAACiRdZE9S8NQFIbftmpFK0V0kOKQoYpDi0VBHKWCXapDW8GqS3KbtEKShpsUKa6Ci0PBQXTxa/Af6Cq4KgiCIog4+QP8WqTEc5tCi9QTbs7De897uPdcwJ/WmWF3JQDDdHgmlZRW8qtS8A0+RNCDSQzKzLYWsws5/BvfD1RNcR8Xvf6v6xj9BdVmgK+XeIZZ3CGeI05vOpbgXeJhVpILxMfEMU4HJL4RuuLxq+Cix5+CeS4zD/hFT6nYxkobsxI3iCeIo4ZeYc3ziJuEVHM5SzlCaxQ2MkghCQkKKtiADgdxyibNrLMv0fAtoUweRn8LVXByFFEib4zUCnVVKWukq/TpqIq5/52nrU1Ped1DSaD7xXU/xoDgHlCvue7PievWT4HAM3BltvxlmtPsF+m1lhY9AsLbwMV1S1P2gcsdYOTJkrnckAK0/JoGvJ8DA3lg6A7oW/Nm1dzH2SOQ26InugUODoFxqg+v/wL7P2gIwmXK0wAAAAlwSFlzAAALEgAACxIB0t1+/AAAAKlJREFUeAHt1MEJw0AUQ8E4Lbn/ErampIZn8EWMz9aC5oOuz4Pvvu/fg5gIAQIvCpxzrvr8twb8T4DAjoAB2LmlJgSygAHIZAIEdgQMwM4tNSGQBQxAJhMgsCNgAHZuqQmBLGAAMpkAgR0BA7BzS00IZAEDkMkECOwIGICdW2pCIAsYgEwmQGBHwADs3FITAlnAAGQyAQI7AgZg55aaEMgCBiCTCRDYEfgDEAUEIKzcCDMAAAAASUVORK5CYII=",
    "displayIcon.png":
        "data:image/png;base64,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",
};
