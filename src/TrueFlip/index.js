import { formatItemsPerSecond } from "core/utils";
import { enumDirection, Vector } from "core/vector";
import { ItemAcceptorComponent } from "game/components/item_acceptor";
import { ItemEjectorComponent } from "game/components/item_ejector";
import { enumItemProcessorTypes, ItemProcessorComponent } from "game/components/item_processor";
import { MOD_ITEM_PROCESSOR_SPEEDS } from "game/hub_goals";
import { defaultBuildingVariant } from "game/meta_building";
import { BOTTOM_LEFT, BOTTOM_RIGHT, ShapeDefinition, TOP_LEFT, TOP_RIGHT } from "game/shape_definition";
import { MOD_ITEM_PROCESSOR_HANDLERS } from "game/systems/item_processor";
import { Mod, ModMetaBuilding } from "mods/mod";
import { T } from "translations";

import flipper from "./flipper.png";

import META from "./mod.json";

// Declare a new type of item processor
enumItemProcessorTypes.flipper = "flipper";

// For now, flipper always has the same speed
MOD_ITEM_PROCESSOR_SPEEDS.flipper = () => 10;

// Declare a handler for the processor so we define the "flip" operation
MOD_ITEM_PROCESSOR_HANDLERS.flipper = function (payload) {
    const shapeDefinition = payload.items.get(0).definition;

    // Flip bottom with top on a new, cloned item (NEVER modify the incoming item!)
    const newLayers = shapeDefinition.getClonedLayers();
    newLayers.reverse();
    newLayers.forEach(layer => {
        const tr = layer[TOP_RIGHT];
        const br = layer[BOTTOM_RIGHT];
        const bl = layer[BOTTOM_LEFT];
        const tl = layer[TOP_LEFT];

        layer[BOTTOM_LEFT] = tl;
        layer[BOTTOM_RIGHT] = tr;

        layer[TOP_LEFT] = bl;
        layer[TOP_RIGHT] = br;
    });

    const newDefinition = new ShapeDefinition({ layers: newLayers });
    payload.outItems.push({
        item: this.root.shapeDefinitionMgr.getShapeItemFromDefinition(newDefinition),
    });
};

// Create the building
class MetaModFlipperBuilding extends ModMetaBuilding {
    constructor() {
        super("modFlipperBuilding");
    }

    static getAllVariantCombinations() {
        return [
            {
                name: "Flipper",
                description: "Flipps/Mirrors shapez from top to bottom",
                variant: defaultBuildingVariant,

                regularImageBase64: `${flipper}`,
                blueprintImageBase64: `${flipper}`,
                tutorialImageBase64: `${flipper}`,
            },
        ];
    }

    getSilhouetteColor() {
        return "red";
    }

    getAdditionalStatistics(root) {
        const speed = root.hubGoals.getProcessorBaseSpeed(enumItemProcessorTypes.flipper);
        return [[T.ingame.buildingPlacement.infoTexts.speed, formatItemsPerSecond(speed)]];
    }

    getIsUnlocked(root) {
        return true;
    }

    setupEntityComponents(entity) {
        // Accept shapes from the bottom
        entity.addComponent(
            new ItemAcceptorComponent({
                slots: [
                    {
                        pos: new Vector(0, 0),
                        direction: enumDirection.bottom,
                        filter: "shape",
                    },
                ],
            })
        );

        // Process those shapes with tye processor type "flipper" (which we added above)
        entity.addComponent(
            new ItemProcessorComponent({
                inputsPerCharge: 1,
                processorType: enumItemProcessorTypes.flipper,
            })
        );

        // Eject the result to the top
        entity.addComponent(
            new ItemEjectorComponent({
                slots: [{ pos: new Vector(0, 0), direction: enumDirection.top }],
            })
        );
    }
}

class TrueFlipMod extends Mod {
    init() {
        // Register the new building
        this.modInterface.registerNewBuilding({
            metaClass: MetaModFlipperBuilding,
            buildingIconBase64: `${flipper}`,
        });

        // Add it to the regular toolbar
        this.modInterface.addNewBuildingToToolbar({
            toolbar: "regular",
            location: "primary",
            metaClass: MetaModFlipperBuilding,
        });
    }
}

registerMod(TrueFlipMod, META);
