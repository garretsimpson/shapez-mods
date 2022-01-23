const METADATA = {
    website: "https://github.com/garretsimpson/shapez-mods",
    author: "FatcatX",
    name: "Shapez pause mod",
    version: "0.3",
    id: "pause-mod",
    description: "Press Pause to pause / resume the game.  Press Space to step one tick.",
    minimumGameVersion: ">=1.5.0",
    setttings: { gamePaused: false },
};

const GameHUDExtention = ({ $super, $old }) => ({
    shouldPauseGame() {
        return $old.shouldPauseGame.call(this) || METADATA.setttings.gamePaused;
    },
});

const GameCoreExtention = ({ $super, $old }) => ({
    initializeRoot(...args) {
        $old.initializeRoot.call(this, ...args);
        this.root.keyMapper.getBinding(shapez.KEYMAPPINGS.mods["step"]).add(this.stepTick, this);
    },

    stepTick() {
        const root = this.root;
        METADATA.setttings.gamePaused = false;
        root.time.updateRealtimeNow();
        root.time.performTicks(this.root.dynamicTickrate.deltaMs, this.boundInternalTick);
        root.productionAnalytics.update();
        root.achievementProxy.update();
        METADATA.setttings.gamePaused = true;
        return shapez.STOP_PROPAGATION;
    },
});

class Mod extends shapez.Mod {
    togglePause() {
        METADATA.setttings.gamePaused = !METADATA.setttings.gamePaused;
    }

    init() {
        console.log("##### Init mod:", METADATA.name);

        this.modInterface.registerIngameKeybinding({
            id: "pause",
            keyCode: 19, // Pause
            translation: "Pause",
            modifiers: {},
            handler: this.togglePause,
        });
        this.modInterface.registerIngameKeybinding({
            id: "step",
            keyCode: 32, // Space
            translation: "Step",
            modifiers: {},
            repeated: true,
        });

        this.modInterface.extendClass(shapez.GameHUD, GameHUDExtention);
        this.modInterface.extendClass(shapez.GameCore, GameCoreExtention);
    }
}
