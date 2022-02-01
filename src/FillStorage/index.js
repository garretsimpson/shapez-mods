import { StorageComponent } from "game/components/storage";
import { HUDMassSelector } from "game/hud/parts/mass_selector";
import { KEYMAPPINGS, keyToKeyCode } from "game/key_action_mapper";
import { Mod } from "mods/mod";

import META from "./mod.json";

const KEYID = {
    fillStorages: "fill_storages",
};

const MassSelectorExtention = ({ $super, $old }) => ({
    initialize() {
        $old.initialize.call(this);
        this.root.keyMapper.getBinding(KEYMAPPINGS.mods[KEYID.fillStorages]).add(this.fillStorages, this);
    },

    clearBelts() {
        for (const uid of this.selectedUids) {
            const entity = this.root.entityMgr.findByUid(uid);
            for (const component of Object.values(entity.components)) {
                component.clear();
                if (component instanceof StorageComponent && component.storedItem) {
                    component.storedCount = 0;
                    component.storedItem = null;
                }
            }
        }
        this.selectedUids = new Set();
    },

    fillStorages() {
        for (const uid of this.selectedUids) {
            const entity = this.root.entityMgr.findByUid(uid);
            for (const component of Object.values(entity.components)) {
                if (component instanceof StorageComponent && component.storedItem) {
                    component.storedCount = 5000;
                }
            }
        }
        this.selectedUids = new Set();
    },
});

class FillStorage extends Mod {
    init() {
        this.modInterface.registerIngameKeybinding({
            id: KEYID.fillStorages,
            keyCode: keyToKeyCode("n"),
            translation: "Fill Storages",
            modifiers: {},
        });

        this.modInterface.extendClass(HUDMassSelector, MassSelectorExtention);
    }
}

registerMod(FillStorage, META);