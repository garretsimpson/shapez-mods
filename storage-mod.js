const METADATA = {
    website: "https://github.com/garretsimpson/shapez-mods",
    author: "FatcatX and SkimnerPhi",
    name: "Shapez storage mod",
    version: "0.4",
    id: "storage-mod",
    description: "Select storages, then press 'b' to clear, or press 'n' to fill.",
};

const MassSelectorExtention = ({ $super, $old }) => ({
    initialize() {
        $old.initialize.call(this);
        this.root.keyMapper.getBinding(shapez.KEYMAPPINGS.mods["fill_storages"]).add(this.fillStorages, this);
    },

    clearBelts() {
        for (const uid of this.selectedUids) {
            const entity = this.root.entityMgr.findByUid(uid);
            for (const component of Object.values(entity.components)) {
                component.clear();
                if (component instanceof shapez.StorageComponent && component.storedItem) {
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
                if (component instanceof shapez.StorageComponent && component.storedItem) {
                    component.storedCount = 5000;
                }
            }
        }
        this.selectedUids = new Set();
    },
});

class Mod extends shapez.Mod {
    init() {
        this.modInterface.registerIngameKeybinding({
            id: "fill_storages",
            keyCode: shapez.keyToKeyCode("n"),
            translation: "Fill Storages",
            modifiers: {},
        });

        this.modInterface.extendClass(shapez.HUDMassSelector, MassSelectorExtention);
    }
}
