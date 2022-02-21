import { enumDirection, Vector } from "core/vector";
import { Component } from "game/component";
import { enumPinSlotType, WiredPinsComponent } from "game/components/wired_pins";
import { GameSystemWithFilter } from "game/game_system_with_filter";
import { BOOL_FALSE_SINGLETON, BOOL_TRUE_SINGLETON } from "game/items/boolean_item";
import { KEYCODES, KEYMAPPINGS, keyToKeyCode } from "game/key_action_mapper";
import { defaultBuildingVariant } from "game/meta_building";
import { Mod, ModMetaBuilding } from "mods/mod";
import gamepad from "./gamepad.png";
import gamepadIcon from "./gamepadIcon.png";

import META from "./mod.json";

/**
 * Game Pad
 *
 * Has wired outputs that emit '1' while a key is pressed.
 */

const PAD_SIZE = { x: 9, y: 4 };

const KEYS = [
    { id: "gamepad-up", keyCode: KEYCODES.ArrowUp, translation: "Gamepad Up" },
    { id: "gamepad-down", keyCode: KEYCODES.ArrowDown, translation: "Gamepad Down" },
    { id: "gamepad-left", keyCode: KEYCODES.ArrowLeft, translation: "Gamepad Left" },
    { id: "gamepad-right", keyCode: KEYCODES.ArrowRight, translation: "Gamepad Right" },
    { id: "gamepad-start", keyCode: KEYCODES.Enter, translation: "Gamepad Start" },
    { id: "gamepad-A", keyCode: keyToKeyCode("H"), translation: "Gamepad A" },
    { id: "gamepad-B", keyCode: keyToKeyCode("J"), translation: "Gamepad B" },
    { id: "gamepad-X", keyCode: keyToKeyCode("K"), translation: "Gamepad X" },
    { id: "gamepad-Y", keyCode: keyToKeyCode("L"), translation: "Gamepad Y" },
];

class GamePadComponent extends Component {
    static getId() {
        return "GamePad";
    }

    constructor() {
        super();
    }
}

class GamePadSystem extends GameSystemWithFilter {
    constructor(root) {
        super(root, [GamePadComponent]);
    }

    update() {
        if (!this.root.gameInitialized) return;
        const keyMapper = this.root.keyMapper;

        for (let entity of this.allEntities) {
            const pinsComp = entity.components.WiredPins;
            for (let idx = 0; idx < KEYS.length; ++idx) {
                const key = KEYMAPPINGS.mods[KEYS[idx].id];
                const value = keyMapper.getBinding(key).pressed;
                pinsComp.slots[idx].value = value ? BOOL_TRUE_SINGLETON : BOOL_FALSE_SINGLETON;
            }
        }
    }
}

class GamePadMeta extends ModMetaBuilding {
    constructor() {
        super("game_pad");
    }

    static getAllVariantCombinations() {
        return [
            {
                variant: defaultBuildingVariant,
                name: "Game Pad",
                description: "Has 9 wire outputs.  The outputs emit '1' while the key is pressed.",
                regularImageBase64: `${gamepad}`,
                blueprintImageBase64: `${gamepad}`,
                tutorialImageBase64: `${gamepad}`,
            },
        ];
    }

    getAvailableVariants() {
        return [defaultBuildingVariant];
    }

    getSilhouetteColor() {
        return "#ddddaa";
    }

    getDimensions() {
        return new Vector(PAD_SIZE.x, PAD_SIZE.y);
    }

    getRenderPins() {
        return false;
    }

    setupEntityComponents(entity) {
        const pins = [];
        const keys = Object.keys(KEYS);
        let x = 0;
        for (let key of keys) {
            const pin = {
                pos: new Vector(x++, 0),
                direction: enumDirection.top,
                type: enumPinSlotType.logicalEjector,
            };
            pins.push(pin);
        }
        entity.addComponent(
            new WiredPinsComponent({
                slots: pins,
            })
        );
        entity.addComponent(new GamePadComponent());
    }
}

class GamePadMod extends Mod {
    init() {
        console.debug("##### Init mod:", META.id);

        this.modInterface.registerComponent(GamePadComponent);
        this.modInterface.registerNewBuilding({
            metaClass: GamePadMeta,
            buildingIconBase64: `${gamepadIcon}`,
        });
        this.modInterface.addNewBuildingToToolbar({
            toolbar: "normal",
            location: "secondary",
            metaClass: GamePadMeta,
        });
        this.modInterface.addNewBuildingToToolbar({
            toolbar: "wires",
            location: "secondary",
            metaClass: GamePadMeta,
        });
        this.modInterface.registerGameSystem({
            id: "gamePad",
            systemClass: GamePadSystem,
            before: "constantSignal",
        });

        for (let key of KEYS) {
            this.modInterface.registerIngameKeybinding(key);
        }
    }
}

// eslint-disable-next-line no-undef
registerMod(GamePadMod, META);
