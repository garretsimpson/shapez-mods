import { STOP_PROPAGATION } from "core/signal";
import { GameCore } from "game/core";
import { GameHUD } from "game/hud/hud";
import { KEYMAPPINGS, keyToKeyCode } from "game/key_action_mapper";
import { Mod } from "mods/mod";

import META from "./mod.json";

const GameHUDExt = ({ $old }) => ({
    shouldPauseGame() {
        return $old.shouldPauseGame.call(this) || META.settings.gamePaused;
    },
});

const GameCoreExt = ({ $old }) => ({
    initializeRoot(...args) {
        $old.initializeRoot.call(this, ...args);
        this.root.keyMapper.getBinding(KEYMAPPINGS.mods["step"]).add(this.stepTick, this);
    },

    stepTick() {
        const root = this.root;
        META.settings.gamePaused = false;
        root.time.updateRealtimeNow();
        root.time.performTicks(this.root.dynamicTickrate.deltaMs, this.boundInternalTick);
        root.productionAnalytics.update();
        root.achievementProxy.update();
        META.settings.gamePaused = true;
        return STOP_PROPAGATION;
    },
});

class PauseAndStep extends Mod {
    togglePause() {
        META.settings.gamePaused = !META.settings.gamePaused;
    }

    init() {
        this.modInterface.registerIngameKeybinding({
            id: "pause",
            keyCode: 19, // Pause
            translation: "Pause",
            modifiers: {},
            handler: this.togglePause,
        });
        this.modInterface.registerIngameKeybinding({
            id: "step",
            keyCode: keyToKeyCode("N"),
            translation: "Step",
            modifiers: {},
            repeated: true,
        });

        this.modInterface.extendClass(GameHUD, GameHUDExt);
        this.modInterface.extendClass(GameCore, GameCoreExt);
    }
}

// eslint-disable-next-line no-undef
registerMod(PauseAndStep, META);
