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

    pasteBlueprint(...args) {
        const blueprint = BPStrings.pasteFromClipboard(this.root);
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
        const entities = BlueprintPacker.unpackEntities(root, data);
        return new Blueprint(entities);
    }

    static async copyToClipboard(blueprint) {
        const data = BPStrings.serialize(blueprint.entities);
        console.debug("Copy to clipboard:", data);
        try {
            await navigator.clipboard.writeText(data);
            // this.root.soundProxy.playUi(SOUNDS.copy);
            console.debug("Copied blueprint to clipboard");
        } catch (ex) {
            console.error("Copy to clipboard failed:", ex.message);
        }
    }

    static pasteFromClipboard(root) {
        let blueprint;
        try {
            const data = BPStrings.getClipboard().trim();
            console.debug("Received data from clipboard:", data);
            blueprint = BPStrings.deserialize(root, data);
        } catch (e) {
            console.error("Paste from clipboard failed:", e);
        }
        return blueprint;
    }

    static getClipboard() {
        var pasteTarget = document.createElement("div");
        pasteTarget.contentEditable = true;
        var actElem = document.activeElement.appendChild(pasteTarget).parentNode;
        pasteTarget.focus();
        document.execCommand("Paste", null, null);
        var paste = pasteTarget.innerText;
        actElem.removeChild(pasteTarget);
        return paste;
    }

    init() {
        console.debug("##### Init mod:", META.id);

        this.modInterface.extendClass(SerializerInternal, SerializerInternalExt);
        this.modInterface.extendClass(HUDBlueprintPlacer, HUDBlueprintPlacerExt);
    }
}

// eslint-disable-next-line no-undef
registerMod(BPStrings, META);
