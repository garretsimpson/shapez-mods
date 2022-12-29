import { SavegameManager } from "savegame/savegame_manager";
import { Mod } from "mods/mod";

import META from "./mod.json";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const SavegameManagerExt = ({ $old }) => ({
    initialize() {
        return this.readAsync().then(() => {
            const gameData = JSON.stringify(this.currentData.savegames);
            this.app.storage.writeFileAsync("savegames.txt", gameData);
            console.log("savegames:", gameData);

            return this.updateAfterSavegamesChanged();
        });
    },
});

class SaveGamesMod extends Mod {
    init() {
        console.log("##### Init mod:", META.id);
        this.modInterface.extendClass(SavegameManager, SavegameManagerExt);
    }
}

// eslint-disable-next-line no-undef
registerMod(SaveGamesMod, META);
