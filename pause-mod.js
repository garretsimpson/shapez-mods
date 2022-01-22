const METADATA = {
    website: "https://github.com/garretsimpson/shapez-mods",
    author: "FatcatX",
    name: "Shapez pause mod",
    version: "0.2",
    id: "pause-mod",
    description: "Press Pause to pause / resume the game.  Press Space to step one tick.",
    minimumGameVersion: ">=1.5.0",
};

const GameHUDExtention = ({ $super, $old }) => ({
    shouldPauseGame() {
        return $old.shouldPauseGame.call(this) || GameHUDExtention.gamePaused;
    },
});

const GameCoreExtention = ({ $super, $old }) => ({
    initializeRoot(...args) {
        $old.initializeRoot.call(this, ...args);
        const root = this.root;
        this.root.gameState.inputReciever.keydown.addToTop(key => {
            if (key.keyCode === 32 /* Space */) {
                GameHUDExtention.gamePaused = false;
                this.root.time.updateRealtimeNow();
                this.root.time.performTicks(this.root.dynamicTickrate.deltaMs, this.boundInternalTick);
                root.productionAnalytics.update();
                root.achievementProxy.update();
                GameHUDExtention.gamePaused = true;
                return shapez.STOP_PROPAGATION;
            }
        });
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
        this.modInterface.extendClass(shapez.GameCore, GameCoreExtention);
        this.modInterface.extendClass(shapez.GameHUD, GameHUDExtention);
    }
}
