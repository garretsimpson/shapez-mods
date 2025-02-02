import { createLogger } from "core/logging";
import { Signal } from "core/signal";
import { GameCore } from "game/core";
import { GameSystem } from "game/game_system";
import { Mod } from "mods/mod";
import { MOD_SIGNALS } from "mods/mod_signals";
import * as Tone from "tone";

import META from "./mod.json";

const logger = createLogger("synth");

class SynthSystem extends GameSystem {
    constructor(root) {
        super(root);

        this.entities = [];
        this.synths = {};

        MOD_SIGNALS.doneDrawing.add(this.play, this);
        this.root.signals.gameFrameStarted.add(function () {
            this.entities.length = 0;
        }, this);
        this.root.signals.aboutToDestruct.add(this.cleanup, this);
    }

    cleanup() {
        const synths = this.synths;
        for (let uid of Object.keys(synths)) {
            synths[uid].dispose();
            delete synths[uid];
        }
    }

    /**
     * Get UID and value from each display
     */
    getDisplayValues() {
        let result = {};
        const entities = this.entities;
        entities.sort((a, b) => a.uid - b.uid);

        for (let entity of entities) {
            let shape = "";
            const pinsComp = entity.components.WiredPins;
            const network = pinsComp.slots[0].linkedNetwork;
            if (network && network.hasValue()) {
                const value = network.currentValue;
                if (value.getItemType() === "shape") {
                    shape = value.getAsCopyableKey();
                }
            }
            result[entity.uid] = shape;
        }

        return result;
    }

    play() {
        const synths = this.synths;
        const displayInfo = this.getDisplayValues();

        // Create and delete synths as needed
        for (let uid of Object.keys(synths)) {
            if (displayInfo[uid] == undefined) {
                logger.log("Delete synth:", uid);
                synths[uid].dispose();
                delete synths[uid];
            }
        }
        for (let uid of Object.keys(displayInfo)) {
            if (synths[uid] == undefined) {
                logger.log("Create synth:", uid);
                synths[uid] = new ShapezSynth(uid);
            }
        }

        // Update synth values
        for (let uid of Object.keys(synths)) {
            window.assert(
                synths[uid] != undefined && displayInfo[uid] != undefined,
                "synths not in sync with displays"
            );
            synths[uid].update(displayInfo[uid]);
        }
    }

    drawChunk(parameters, chunk) {
        const contents = chunk.containedEntitiesByLayer.regular;
        for (let i = 0; i < contents.length; ++i) {
            const entity = contents[i];
            if (entity && entity.components.Display) {
                this.entities.push(entity);
            }
        }
    }
}

class ShapezSynth {
    constructor(uid) {
        this.uid = uid;
        const synth = new Tone.FMSynth();
        synth.oscillator.type = "sine";
        synth.modulation.type = "sine";
        synth.harmonicity.value = 5;
        synth.envelope.set({
            attack: 0.005,
            decay: 0.1,
            release: 2,
            sustain: 0.5,
            releaseCurve: "exponential",
        });
        synth.modulationEnvelope.set({
            attack: 0.005,
            decay: 0.1,
            release: 1,
            sustain: 0.3,
            //releaseCurve: "exponential",
        });
        // const reverb = new Tone.Reverb(0.3).toDestination();
        // this.synth = synth.connect(reverb);
        // const chorus = new Tone.Chorus(4, 2.5, 0.5).toDestination().start();
        // this.synth = synth.connect(chorus);
        this.synth = synth.toDestination();
        this.shape = "";
    }

    /**
     * Parse the shape and return note value.
     * Note mapping
     * - Currently uses first two quadrants of the first layer.
     * - Shape code: AbCd----
     * - where:
     *   A - octive 1-4: CRSW
     *   b - tone (rest/CDEFGAB): urygcbpw
     *   C - accidental (flat/natural/sharp): CRS
     *   d - unused
     * - Examples:
     *   RuRu: rest
     *   RwCu: Bb (octive 2)
     *   SrRu: C  (octive 3)
     * - WARNING: This is still a work in progress and this mapping may change.
     * @param {String} shape
     * @returns {String}
     */
    getNoteFromShape(shape) {
        const OCTIVE_STR = "CRSW";
        const TONE_STR = "urygcbpw";
        const ADJ_STR = "CRS";
        const TONES = "-CDEFGAB";
        const ACC = ["b", "", "#"];

        if (!shape) return;
        if (shape.length < 4) return;

        let note = "";
        const toneIndex = TONE_STR.indexOf(shape[1]);
        if (toneIndex == 0) return note; // rest

        const accIndex = ADJ_STR.indexOf(shape[2]);
        const octiveIndex = OCTIVE_STR.indexOf(shape[0]);
        if (octiveIndex == -1 || toneIndex == -1 || accIndex == -1) {
            console.log("Unknown sound shape:", shape);
            return null;
        }
        note = TONES[toneIndex] + ACC[accIndex] + (octiveIndex + 3);

        return note;
    }

    update(shape) {
        if (this.shape == shape) return;

        this.shape = shape;
        //this.synth.triggerRelease();
        const note = this.getNoteFromShape(this.shape);
        logger.log("Note:", note);
        if (!note) return; // release
        this.synth.triggerAttackRelease(note, "16n");
    }

    dispose() {
        this.synth.dispose();
    }
}

class SynthMod extends Mod {
    init() {
        console.debug("##### Init mod:", META.id);
        MOD_SIGNALS.doneDrawing = new Signal();
        this.modInterface.runAfterMethod(GameCore, "draw", function () {
            MOD_SIGNALS.doneDrawing.dispatch();
        });

        this.modInterface.registerGameSystem({
            id: "synth",
            systemClass: SynthSystem,
            before: "itemProcessorOverlays",
            drawHooks: ["staticAfter"],
        });
    }
}

// eslint-disable-next-line no-undef
registerMod(SynthMod, META);
