/**
 * Blueprint string constructor
 *
 * - A Blueprint is an array of entities.
 *   Entity format:
 *   {
 *       components: {
 *           StaticMapEntity: {
 *               code: <code>,
 *               origin: { x: <posx>, y: <posy> },
 *               originalRotation: <original-rotation>,
 *               rotation: <rotation>,
 *           },
 *           <component-name>: <component-state>,  // optional
 *           ...
 *       },
 *   }
 *
 */

const EOL = "\n";

export class BP {
    static ENTITY = {
        "signal_transport-mirrored": { code: "signal_transport-mirrored" },
        "constant_signal": { code: 31, comps: ["ConstantSignal"] },
    };
    static COMP = {
        StaticMapEntity:
            '{"origin":{"x":__x__,"y":__y__},\
              "rotation":__rotation__,\
              "originalRotation":__originalRotation__,\
              "code":__code__}',
        ConstantSignal: '{"signal":{"$":__$__,"data":__data__}}',
    };

    constructor() {
        this.entities = [];
        this.x = 0;
        this.y = 0;
    }

    /**
     * @param {number} x
     * @param {number} y
     */
    setXY(x, y) {
        this.x = x;
        this.y = y;
    }

    /**
     * @returns {Array<number>}
     */
    getXY() {
        return [this.x, this.y];
    }

    /**
     * @param {string} data
     * @param {object} config
     * @returns {string}
     */
    doSub(data, config) {
        let result = data;
        const keys = Object.keys(config);
        let value;
        for (let key of keys) {
            value = config[key];
            key = `__${key}__`;
            result = result.replace(key, JSON.stringify(value));
        }
        console.debug("Sub:", result);
        return result;
    }

    /**
     *
     * @param {string} cname
     * @param {object} config
     * @returns {object}
     */
    makeComp(cname, config) {
        let result;
        let dataStr;
        try {
            dataStr = this.doSub(BP.COMP[cname], config);
            result = JSON.parse(dataStr);
        } catch (e) {
            console.error(e);
        }
        return result;
    }

    /**
     * @param {number} x
     * @param {number} y
     * @param {object} entityData
     * @param {object} config
     * @returns {object}
     */
    addXY(x, y, entityData, config) {
        const entity = { components: {} };
        const comps = entity.components;

        const rotation = config.rotation === undefined ? 0 : config.rotation;
        const originalRotation = config.originalRotation === undefined ? 0 : config.originalRotation;
        const code = entityData.code;
        const smeConfig = {
            x,
            y,
            rotation,
            originalRotation,
            code,
        };
        let cname = "StaticMapEntity";
        comps[cname] = this.makeComp(cname, smeConfig);
        if (entityData.comps)
            for (cname of entityData.comps) {
                comps[cname] = this.makeComp(cname, config);
            }
        this.entities.push(entity);
        return this;
    }

    /**
     * @param {object} entityData
     * @param {object} config
     * @returns {object}
     */
    add(entityData, config) {
        this.addXY(this.x, this.y, entityData, config);
        this.x++;
        return this;
    }

    /**
     * @returns {string}
     */
    toString() {
        let result = JSON.stringify(this.entities, "", 2);
        result += EOL;
        console.debug("Result:", result);
        return result;
    }
}
