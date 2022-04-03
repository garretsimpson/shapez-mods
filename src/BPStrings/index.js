import { Vector } from "core/vector";
import { Blueprint } from "game/blueprint";
import { getBuildingDataFromCode } from "game/building_codes";
import { HUDBlueprintPlacer } from "game/hud/parts/blueprint_placer";
import { enumNotificationType } from "game/hud/parts/notifications";
import { HUDSandboxController } from "game/hud/parts/sandbox_controller";
import { Mod } from "mods/mod";
import { SerializerInternal } from "savegame/serializer_internal";
import { BlueprintPacker } from "./BlueprintPacker";

import META from "./mod.json";

const MODES = { json: "json", pack: "pack" };

const HUDSandboxControllerExt = () => ({
    giveBlueprints() {
        const SHAPES = [
            "CbCbCbRb:CwCwCwCw",
            // "6CbCbCbCbCbRb:6CwCwCwCwCwCw", // hex
            // "Sb----Sb:CbCbCbCb:--CwCw--", // SI
            // "Sb----Sb:3b3b3b3b:--3w3w--", // SI
            // "SbSbSbSb:1b1b1b1b:--CwCw--", // SI
        ];
        SHAPES.forEach(shape => {
            const store = this.root.hubGoals.storedShapes;
            if (!store[shape]) store[shape] = 0;
            store[shape] += 1000;
        });
    },
});

const HUDBlueprintPlacerExt = ({ $old }) => ({
    createBlueprintFromBuildings(...args) {
        $old.createBlueprintFromBuildings.call(this, ...args);
        BPStrings.copyToClipboard(this.currentBlueprint.get(), this.root);
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
    static serializeAsJson(entities) {
        const result = [];
        // let data = new SerializerInternal().serializeEntityArray(entities);
        for (let entity of entities) {
            if (entity.queuedForDestroy || entity.destroyed) continue;
            const item = entity.serialize();
            delete item.uid;
            const comps = Object.entries(entity.components);
            for (let [name, comp] of comps) {
                const obj = {};
                comp.copyAdditionalStateTo(obj);
                if (name == "StaticMapEntity" || Object.keys(obj).length > 0) continue;
                delete item.components[name];
            }
            result.push(item);
        }
        return JSON.stringify(result, null, 2);
    }

    static deserializeJson(root, data) {
        const json = JSON.parse(data);
        if (typeof json != "object") return;
        if (!Array.isArray(json)) return;

        const serializer = new SerializerInternal();
        /** @type {Array<Entity>} */
        const entities = [];
        for (let i = 0; i < json.length; ++i) {
            /** @type {Entity?} */
            const value = json[i];
            if (!value.components || !value.components.StaticMapEntity) return;
            const staticData = value.components.StaticMapEntity;
            if (!staticData.code == undefined || !staticData.origin) return;
            const result = serializer.deserializeEntityNoPlace(root, value);
            if (typeof result === "string") throw new Error(result);
            entities.push(result);
        }
        return entities;
    }

    static serialize(entities) {
        // console.debug("##### data out:", entities);
        const mode = META.settings.mode;
        let data = "";
        switch (mode) {
            case MODES.json:
                data = BPStrings.serializeAsJson(entities);
                break;
            case MODES.pack:
                data = new BlueprintPacker().packEntities(entities);
                break;
            default:
                throw `Unknown blueprint string mode: ${mode}`;
        }
        return data;
    }

    static deserialize(root, data) {
        const EOL = "\n";
        let entities;
        try {
            entities = BPStrings.deserializeJson(root, data);
            if (!entities) throw "Unable to parse blueprint string as JSON";
        } catch (e) {
            data = data
                .split(EOL)
                .map(s => s.trim())
                .join("");
            entities = new BlueprintPacker().unpackEntities(root, data);
        }
        // console.debug("##### data in:", entities);
        return entities;
    }

    static async copyToClipboard(blueprint, root) {
        try {
            const data = BPStrings.serialize(blueprint.entities);
            console.debug("Copy to clipboard:", data);
            await navigator.clipboard.writeText(data);
            // this.root.soundProxy.playUi(SOUNDS.copy);
            // console.debug("Blueprint copied to clipboard");
            root.hud.signals.notification.dispatch(
                "Blueprint copied to clipboard",
                enumNotificationType.info
            );
        } catch (e) {
            console.error("Copy to clipboard failed:", e);
        }
    }

    static pasteFromClipboard(root) {
        let data;
        let blueprint;
        try {
            data = BPStrings.getClipboard().trim();
            // replace all &nbsp; with plain space
            // data = data.replace(/\xA0/g, " ");
            console.debug("Received data from clipboard:", data);
            const entities = BPStrings.deserialize(root, data);
            if (!entities) throw "Unable to parse blueprint string";
            blueprint = new Blueprint(entities);
        } catch (e) {
            console.error("Paste from clipboard failed:", e);
        }
        if (blueprint) {
            root.hud.signals.notification.dispatch(
                "Received blueprint from clipboard",
                enumNotificationType.info
            );
        }
        return blueprint;
    }

    static getClipboard() {
        const pasteTarget = document.createElement("textarea");
        pasteTarget.setAttribute("position", "absolute");
        pasteTarget.setAttribute("height", "0");
        pasteTarget.setAttribute("overflow", "hidden");

        pasteTarget.setAttribute("autocomplete", "off");
        pasteTarget.setAttribute("autocorrect", "off");
        pasteTarget.setAttribute("spellcheck", "false");

        const actElem = document.activeElement.appendChild(pasteTarget).parentNode;
        pasteTarget.focus();
        document.execCommand("Paste", null, null);
        const value = pasteTarget.value;
        actElem.removeChild(pasteTarget);
        return value;
    }

    // for debugging
    initSandbox() {
        this.modInterface.registerHudElement("sandboxController", HUDSandboxController);
        this.modInterface.extendClass(HUDSandboxController, HUDSandboxControllerExt);
    }

    init() {
        console.debug("##### Init mod:", META.id);
        // this.initSandbox();
        this.modInterface.extendClass(SerializerInternal, SerializerInternalExt);
        this.modInterface.extendClass(HUDBlueprintPlacer, HUDBlueprintPlacerExt);
    }
}

// eslint-disable-next-line no-undef
registerMod(BPStrings, META);
