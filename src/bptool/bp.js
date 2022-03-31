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

export class BP {
    static ENTITY = {
        constant_signal: { code: 31, comps: ["ConstantSignal"] },
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
     * @param {string} data
     * @param {object} config
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
        for (cname of entityData.comps) {
            comps[cname] = this.makeComp(cname, config);
        }
        this.entities.push(entity);
    }

    /**
     * @param {object} entityData
     * @param {object} config
     */
    add(entityData, config) {
        this.addXY(this.x, this.y, entityData, config);
        this.x++;
    }

    toString() {
        const result = JSON.stringify(this.entities, "", 2);
        console.debug("Result:", result);
        return result;
    }
}
