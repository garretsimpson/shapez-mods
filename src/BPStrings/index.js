import { Vector } from "core/vector";
import { getBuildingDataFromCode } from "game/building_codes";
import { HUDBlueprintPlacer } from "game/hud/parts/blueprint_placer";
import { Mod } from "mods/mod";
import { Blueprint } from "game/blueprint";
import { SerializerInternal } from "savegame/serializer_internal";
import { BlueprintPacker } from "./BlueprintPacker";

import META from "./mod.json";

const HUDBlueprintPlacerExt = ({ $old }) => ({
    createBlueprintFromBuildings(...args) {
        $old.createBlueprintFromBuildings.call(this, ...args);
        BPStrings.copyToClipboard(this.currentBlueprint.get());
    },

    async pasteBlueprint(...args) {
        const blueprint = await BPStrings.pasteFromClipboard(this.root);
        this.lastBlueprintUsed = blueprint || this.lastBlueprintUsed;
        $old.pasteBlueprint.call(this, ...args);
    },
});

const SerializerInternalExt = () => ({
    deserializeEntityNoPlace(root, payload) {
        const staticData = payload.components.StaticMapEntity;
        window.assert(staticData, "entity has no static data");

        const code = staticData.code;
        const data = getBuildingDataFromCode(code);
        const metaBuilding = data.metaInstance;
        const entity = metaBuilding.createEntity({
            root,
            origin: Vector.fromSerializedObject(staticData.origin),
            rotation: staticData.rotation,
            originalRotation: staticData.originalRotation,
            rotationVariant: data.rotationVariant,
            variant: data.variant,
        });
        entity.uid = payload.uid;

        let errorStatus = this.deserializeComponents(root, entity, payload.components);
        return errorStatus || entity;
    },
});

class BPStrings extends Mod {
    static serializeOld(entities) {
        let data = new SerializerInternal().serializeEntityArray(entities);
        for (let entry of data) {
            delete entry.uid;
            delete entry.components.WiredPins;
            delete entry.components.ItemEjector;
            delete entry.components.ItemProcessor;
            delete entry.components.UndergroundBelt;
        }
        return data;
    }

    static serialize(entities) {
        const data = new SerializerInternal().serializeEntityArray(entities);
        const bpString = BlueprintPacker.packEntities(data);
        return bpString;
    }

    static deserialize(root, data) {
        const result = BlueprintPacker.unpackEntities(root, data);
        return new Blueprint(result);
    }

    static async copyToClipboard(blueprint) {
        const data = BPStrings.serialize(blueprint.entities);
        console.debug(data);
        try {
            await navigator.clipboard.writeText(data);
            // this.root.soundProxy.playUi(SOUNDS.copy);
            console.debug("Copied blueprint to clipboard");
        } catch (ex) {
            console.error("Copy to clipboard failed:", ex.message);
        }
    }

    static pasteFromClipboard(event, root) {
        if (this.root.app.inputMgr.getTopReciever().context !== "state-InGameState") return;
        let blueprint;
        try {
            let data = event.clipboardData.getData("text").trim();
            blueprint = BPStrings.deserialize(root, data);
            console.debug("Received data from clipboard");
        } catch (ex) {
            console.error("Paste from clipboard failed:", ex.message);
        }
        return blueprint;
    }

    init() {
        console.debug("##### Init mod:", META.id);

        this.modInterface.extendClass(SerializerInternal, SerializerInternalExt);
        this.modInterface.extendClass(HUDBlueprintPlacer, HUDBlueprintPlacerExt);

        // this.modInterface.runAfterMethod(HUDBlueprintPlacer, "initialize", function () {  // FIXME
        //     document.addEventListener("paste", ev => this.handlePaste.bind(this, ev));
        // });

        // this.modInterface.runAfterMethod(HUDBlueprintPlacer, "createBlueprintFromBuildings", this.handleCopy);
    }
}

// eslint-disable-next-line no-undef
registerMod(BPStrings, META);
