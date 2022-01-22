const METADATA = {
    website: "https://github.com/garretsimpson/shapez-mods",
    author: "FatcatX",
    name: "Shapez pause mod",
    version: "0.1",
    id: "pause-mod",
    description: "Press Pause to pause / resume the game.",
};

const GameHUDExtention = ({ $super, $old }) => ({
    shouldPauseGame() {
        return $old.shouldPauseGame.call(this) || GameHUDExtention.gamePaused;
    },
});

class Mod extends shapez.Mod {
    togglePause() {
        GameHUDExtention.gamePaused = !GameHUDExtention.gamePaused;
        console.debug("Game paused:", GameHUDExtention.gamePaused);
    }

    init() {
        console.log("##### Init mod:", METADATA.name);

        GameHUDExtention.gamePaused = false;
        this.modInterface.registerIngameKeybinding({
            id: "pause",
            keyCode: 19, // Pause
            translation: "Pause",
            modifiers: {},
            handler: this.togglePause.bind(this),
        });
        this.modInterface.extendClass(shapez.GameHUD, GameHUDExtention);
    }
}
