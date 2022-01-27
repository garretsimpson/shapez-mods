// @ts-nocheck
const METADATA = {
    website: "https://github.com/garretsimpson/shapez-mods",
    author: "FatcatX",
    name: "Add big displays",
    version: "0.1",
    id: "big-displays",
    description: "Adds big displays.  Including: 16x1x32 color display.",
    minimumGameVersion: ">=1.5.0",
};

const DISPLAYS = { big16: { size: { x: 16, y: 1 } } };

class BigDisplayComponent extends shapez.Component {
    static getId() {
        return "BigDisplay";
    }

    constructor({ slots = [] }) {
        super();
        this.setSlots(slots);
    }

    setSlots(slots) {
        this.slots = [];

        for (let i = 0; i < slots.length; ++i) {
            const slotData = slots[i];
            this.slots.push({
                pos: slotData.pos,
                value: null,
            });
        }
    }
}

class BigDisplaySystem extends shapez.GameSystem {
    constructor(root) {
        super(root);
        this.displaySprites = {};

        for (const colorId in shapez.enumColors) {
            if (colorId === shapez.enumColors.uncolored) {
                continue;
            }
            this.displaySprites[colorId] = shapez.Loader.getSprite(
                "sprites/wires/display/" + colorId + ".png"
            );
        }
    }

    getDisplayItem(value) {
        if (!value) {
            return null;
        }
        switch (value.getItemType()) {
            case "boolean": {
                return shapez.isTrueItem(value)
                    ? shapez.COLOR_ITEM_SINGLETONS[shapez.enumColors.white]
                    : null;
            }
            case "color": {
                const item = value;
                return item.color === shapez.enumColors.uncolored ? null : item;
            }
            case "shape": {
                return value;
            }
            default:
                shapez.assertAlways(false, "Unknown item type: " + value.getItemType());
        }
    }

    drawChunk(parameters, chunk) {
        const contents = chunk.containedEntitiesByLayer.regular;
        for (let i = 0; i < contents.length; ++i) {
            const entity = contents[i];
            if (entity && entity.components.BigDisplay) {
                const pinsComp = entity.components.WiredPins;
                const valueNetwork = pinsComp.slots[0].linkedNetwork;
                if (!valueNetwork || !valueNetwork.hasValue()) {
                    continue;
                }
                const value = this.getDisplayItem(valueNetwork.currentValue);
                if (!value || value.getItemType() !== "shape") continue;
                // console.debug("##### value:", value);
                // const shape = value.getAsCopyableKey();
                // console.debug("##### shape:", shape);
                const slots = entity.components.BigDisplay.slots;
                for (let slot of slots) {
                    const tile = entity.components.StaticMapEntity.localTileToWorld(slot.pos);
                    if (!chunk.tileSpaceRectangle.containsPoint(tile.x, tile.y)) continue;
                    // TODO: map position per display type
                    const idx = slot.pos.x;
                    const layer = value.definition.layers[Math.floor(idx / 4)];
                    if (!layer) continue;
                    const item = layer[idx % 4];
                    if (!item || item.color === shapez.enumColors.uncolored) continue;
                    const worldPos = tile.toWorldSpaceCenterOfTile();
                    this.displaySprites[item.color].drawCachedCentered(
                        parameters,
                        worldPos.x,
                        worldPos.y,
                        shapez.globalConfig.tileSize
                    );
                }
            }
        }
    }
}

class MetaBigDisplays extends shapez.ModMetaBuilding {
    constructor() {
        super("bigDisplays");
    }

    static getAllVariantCombinations() {
        return [
            {
                variant: shapez.defaultBuildingVariant,
                name: "Big Display",
                description: "A big display",

                regularImageBase64: RESOURCES["display1x16.png"],
                blueprintImageBase64: RESOURCES["display1x16.png"],
                tutorialImageBase64: RESOURCES["display1x16.png"],
            },
        ];
    }

    getSilhouetteColor() {
        return "#aaaaaa";
    }

    getDimensions() {
        const size = DISPLAYS.big16.size;
        return new shapez.Vector(size.x, size.y);
    }

    setupEntityComponents(entity) {
        entity.addComponent(
            new shapez.WiredPinsComponent({
                slots: [
                    {
                        pos: new shapez.Vector(0, 0),
                        direction: shapez.enumDirection.left,
                        type: shapez.enumPinSlotType.logicalAcceptor,
                    },
                ],
            })
        );

        const size = DISPLAYS.big16.size;
        const slots = [];
        for (let x = 0; x < size.x; x++) {
            for (let y = 0; y < size.y; y++) {
                slots.push({
                    pos: new shapez.Vector(x, y),
                });
            }
        }
        entity.addComponent(
            new BigDisplayComponent({
                slots,
            })
        );
    }
}

class Mod extends shapez.Mod {
    init() {
        this.modInterface.registerComponent(BigDisplayComponent);
        this.modInterface.registerNewBuilding({
            metaClass: MetaBigDisplays,
            buildingIconBase64: RESOURCES["displayIcon.png"],
        });
        this.modInterface.addNewBuildingToToolbar({
            toolbar: "regular",
            location: "secondary",
            metaClass: MetaBigDisplays,
        });
        this.modInterface.registerGameSystem({
            id: "bigDisplay",
            systemClass: BigDisplaySystem,
            before: "constantSignal",
            drawHooks: ["staticAfter"],
        });
    }
}

////////////////////////////////////////////////////////////////////////

const RESOURCES = {
    "display1x16.png":
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAAQCAYAAAD506FJAAABcmlDQ1BpY2MAACiRdZE9S8NQFIbftmpFK0V0kOKQoYpDi0VBHKWCXapDW8GqS3KbtEKShpsUKa6Ci0PBQXTxa/Af6Cq4KgiCIog4+QP8WqTEc5tCi9QTbs7De897uPdcwJ/WmWF3JQDDdHgmlZRW8qtS8A0+RNCDSQzKzLYWsws5/BvfD1RNcR8Xvf6v6xj9BdVmgK+XeIZZ3CGeI05vOpbgXeJhVpILxMfEMU4HJL4RuuLxq+Cix5+CeS4zD/hFT6nYxkobsxI3iCeIo4ZeYc3ziJuEVHM5SzlCaxQ2MkghCQkKKtiADgdxyibNrLMv0fAtoUweRn8LVXByFFEib4zUCnVVKWukq/TpqIq5/52nrU1Ped1DSaD7xXU/xoDgHlCvue7PievWT4HAM3BltvxlmtPsF+m1lhY9AsLbwMV1S1P2gcsdYOTJkrnckAK0/JoGvJ8DA3lg6A7oW/Nm1dzH2SOQ26InugUODoFxqg+v/wL7P2gIwmXK0wAAAAlwSFlzAAALEgAACxIB0t1+/AAAAKlJREFUeAHt1MEJw0AUQ8E4Lbn/ErampIZn8EWMz9aC5oOuz4Pvvu/fg5gIAQIvCpxzrvr8twb8T4DAjoAB2LmlJgSygAHIZAIEdgQMwM4tNSGQBQxAJhMgsCNgAHZuqQmBLGAAMpkAgR0BA7BzS00IZAEDkMkECOwIGICdW2pCIAsYgEwmQGBHwADs3FITAlnAAGQyAQI7AgZg55aaEMgCBiCTCRDYEfgDEAUEIKzcCDMAAAAASUVORK5CYII=",
    "displayIcon.png":
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAACXBIWXMAAAsTAAALEwEAmpwYAAALUGlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNS42LWMxNDUgNzkuMTYzNDk5LCAyMDE4LzA4LzEzLTE2OjQwOjIyICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0RXZ0PSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VFdmVudCMiIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczpwaG90b3Nob3A9Imh0dHA6Ly9ucy5hZG9iZS5jb20vcGhvdG9zaG9wLzEuMC8iIHhtbG5zOnRpZmY9Imh0dHA6Ly9ucy5hZG9iZS5jb20vdGlmZi8xLjAvIiB4bWxuczpleGlmPSJodHRwOi8vbnMuYWRvYmUuY29tL2V4aWYvMS4wLyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ0MgMjAxOSAoV2luZG93cykiIHhtcDpDcmVhdGVEYXRlPSIyMDIwLTA1LTE4VDIwOjIwOjEyKzAyOjAwIiB4bXA6TWV0YWRhdGFEYXRlPSIyMDIwLTA5LTI0VDEwOjUxOjE1KzAyOjAwIiB4bXA6TW9kaWZ5RGF0ZT0iMjAyMC0wOS0yNFQxMDo1MToxNSswMjowMCIgZGM6Zm9ybWF0PSJpbWFnZS9wbmciIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6MTlhY2JiZGYtMjdlNy1mNDQyLTg2NGYtZTRiODkyMDdiZjExIiB4bXBNTTpEb2N1bWVudElEPSJhZG9iZTpkb2NpZDpwaG90b3Nob3A6MGQ1NGJhMDktNmZmNS1hNzQ1LTkxNmItMzdjNDIzMDZiZTU2IiB4bXBNTTpPcmlnaW5hbERvY3VtZW50SUQ9InhtcC5kaWQ6NThhMWU5MWYtMGY2YS1kMjQ0LWE1MzAtNDZlZGExMzgzODRiIiBwaG90b3Nob3A6Q29sb3JNb2RlPSIzIiB0aWZmOk9yaWVudGF0aW9uPSIxIiB0aWZmOlhSZXNvbHV0aW9uPSI3MjAwMDAvMTAwMDAiIHRpZmY6WVJlc29sdXRpb249IjcyMDAwMC8xMDAwMCIgdGlmZjpSZXNvbHV0aW9uVW5pdD0iMiIgZXhpZjpDb2xvclNwYWNlPSI2NTUzNSIgZXhpZjpQaXhlbFhEaW1lbnNpb249IjEyOCIgZXhpZjpQaXhlbFlEaW1lbnNpb249IjEyOCI+IDx4bXBNTTpIaXN0b3J5PiA8cmRmOlNlcT4gPHJkZjpsaSBzdEV2dDphY3Rpb249ImNyZWF0ZWQiIHN0RXZ0Omluc3RhbmNlSUQ9InhtcC5paWQ6NThhMWU5MWYtMGY2YS1kMjQ0LWE1MzAtNDZlZGExMzgzODRiIiBzdEV2dDp3aGVuPSIyMDIwLTA1LTE4VDIwOjIwOjEyKzAyOjAwIiBzdEV2dDpzb2Z0d2FyZUFnZW50PSJBZG9iZSBQaG90b3Nob3AgQ0MgMjAxOSAoV2luZG93cykiLz4gPHJkZjpsaSBzdEV2dDphY3Rpb249InNhdmVkIiBzdEV2dDppbnN0YW5jZUlEPSJ4bXAuaWlkOjJmODk5Yzk2LTkxY2ItOWI0Yi04OGY3LWIyMGQ3MDUzMzBlNiIgc3RFdnQ6d2hlbj0iMjAyMC0wNS0xOFQyMDoyMjoxNCswMjowMCIgc3RFdnQ6c29mdHdhcmVBZ2VudD0iQWRvYmUgUGhvdG9zaG9wIENDIDIwMTkgKFdpbmRvd3MpIiBzdEV2dDpjaGFuZ2VkPSIvIi8+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJzYXZlZCIgc3RFdnQ6aW5zdGFuY2VJRD0ieG1wLmlpZDo0NTMyODVlZi0wY2MzLTg5NGUtOThlOC1mZjQ0YTMzZDE0YmIiIHN0RXZ0OndoZW49IjIwMjAtMDktMjRUMTA6NTE6MTUrMDI6MDAiIHN0RXZ0OnNvZnR3YXJlQWdlbnQ9IkFkb2JlIFBob3Rvc2hvcCBDQyAyMDE5IChXaW5kb3dzKSIgc3RFdnQ6Y2hhbmdlZD0iLyIvPiA8cmRmOmxpIHN0RXZ0OmFjdGlvbj0iY29udmVydGVkIiBzdEV2dDpwYXJhbWV0ZXJzPSJmcm9tIGFwcGxpY2F0aW9uL3ZuZC5hZG9iZS5waG90b3Nob3AgdG8gaW1hZ2UvcG5nIi8+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJkZXJpdmVkIiBzdEV2dDpwYXJhbWV0ZXJzPSJjb252ZXJ0ZWQgZnJvbSBhcHBsaWNhdGlvbi92bmQuYWRvYmUucGhvdG9zaG9wIHRvIGltYWdlL3BuZyIvPiA8cmRmOmxpIHN0RXZ0OmFjdGlvbj0ic2F2ZWQiIHN0RXZ0Omluc3RhbmNlSUQ9InhtcC5paWQ6MTlhY2JiZGYtMjdlNy1mNDQyLTg2NGYtZTRiODkyMDdiZjExIiBzdEV2dDp3aGVuPSIyMDIwLTA5LTI0VDEwOjUxOjE1KzAyOjAwIiBzdEV2dDpzb2Z0d2FyZUFnZW50PSJBZG9iZSBQaG90b3Nob3AgQ0MgMjAxOSAoV2luZG93cykiIHN0RXZ0OmNoYW5nZWQ9Ii8iLz4gPC9yZGY6U2VxPiA8L3htcE1NOkhpc3Rvcnk+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOjQ1MzI4NWVmLTBjYzMtODk0ZS05OGU4LWZmNDRhMzNkMTRiYiIgc3RSZWY6ZG9jdW1lbnRJRD0iYWRvYmU6ZG9jaWQ6cGhvdG9zaG9wOmRhNjYyYjUwLThkMDktODE0OS1hNTRmLTg1MmZjNjE2ZGY2MCIgc3RSZWY6b3JpZ2luYWxEb2N1bWVudElEPSJ4bXAuZGlkOjU4YTFlOTFmLTBmNmEtZDI0NC1hNTMwLTQ2ZWRhMTM4Mzg0YiIvPiA8cGhvdG9zaG9w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",
};
