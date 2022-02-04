import { Vector } from "core/vector";
import { getBuildingDataFromCode } from "game/building_codes";
import { HUDBlueprintPlacer } from "game/hud/parts/blueprint_placer";
import { Mod } from "mods/mod";
import { SOUNDS } from "platform/sound";
import { SerializerInternal } from "savegame/serializer_internal";
import { BlueprintPacker } from "./BlueprintPacker";

import META from "./mod.json";

const SerializerInternalExtension = {
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
};

class BPStrings extends Mod {
    async handleCopy() {
        const data = new SerializerInternal().serializeEntityArray(this.currentBlueprint.get().entities);
        console.debug(data);
        try {
            const bpString = BlueprintPacker.serializeBlueprintString(data);
            await navigator.clipboard.writeText(bpString);
            this.root.soundProxy.playUi(SOUNDS.copy);
            console.debug("Copied blueprint to clipboard");
        } catch (ex) {
            console.error("Copy to clipboard failed:", ex.message);
        }
    }

    handlePaste(event) {
        if (this.root.app.inputMgr.getTopReciever().context !== "state-InGameState") return;
        let blueprint;
        try {
            let data = event.clipboardData.getData("text").trim();
            blueprint = BlueprintPacker.deserializeBlueprintString(this.root, data);
            console.debug("Received data from clipboard");
        } catch (ex) {
            console.error("Paste from clipboard failed:", ex.message);
        }

        this.lastBlueprintUsed = blueprint || this.lastBlueprintUsed;
        this.pasteBlueprint();
    }

    init() {
        this.modInterface.extendClass(SerializerInternal, SerializerInternalExtension);

        this.modInterface.runAfterMethod(HUDBlueprintPlacer, "initialize", function () {
            document.addEventListener("paste", ev => this.handlePaste.bind(this, ev));
        });

        this.modInterface.runAfterMethod(HUDBlueprintPlacer, "createBlueprintFromBuildings", this.handleCopy);
    }
}

// eslint-disable-next-line no-undef
registerMod(BPStrings, META);
