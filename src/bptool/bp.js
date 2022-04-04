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
        "comparator": { code: 46 },
        "constant_signal": { code: 31, comps: ["ConstantSignal"] },
        "diode": { code: "diode" },
        "memory-write_enable": { code: "memory-write_enable" },
        "not": { code: 34 },
        "signal_transport-mirrored": { code: "signal_transport-mirrored" },
        "signal_transport-static": { code: "signal_transport-static", comps: ["WirelessCode"] },
        "transistor": { code: 38 },
        "transistor-mirrored": { code: 60 },
        "wire": { code: 27 },
        "wire_tunnel-turn": { code: "wire_tunnel-turn" },
        "wireless_display_managers-quad_sender": {
            code: "wireless_display_managers-quad_sender",
            comps: ["WirelessCode"],
        },
    };
    static COMP = {
        StaticMapEntity:
            '{"origin":{"x":__x__,"y":__y__},\
              "rotation":__rotation__,\
              "originalRotation":__originalRotation__,\
              "code":__code__}',
        ConstantSignal: '{"signal":{"$":__$__,"data":__data__}}',
        WirelessCode: '{"wirelessCode":__wirelessCode__}',
    };
    static CONFIG_DEFAULT = {
        rotation: 0,
        originalRotation: 0,
    };

    constructor() {
        this.clear();
    }

    clear() {
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
     * @param {object} configData
     * @returns {object}
     */
    getConfig(configData) {
        const result = {};
        const entries = Object.entries(configData);
        for (let [key, value] of entries) {
            if (typeof value === "object" && Array.isArray(value)) {
                // console.debug("shift", value);
                value = value.shift();
            }
            result[key] = value;
        }
        return result;
    }

    /**
     * @param {object} config
     * @param {string} key
     * @returns {*}
     */
    getValue(config, key) {
        let value = config[key];
        if (value === undefined) value = BP.CONFIG_DEFAULT[key];
        return value;
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
            value = this.getValue(config, key);
            // console.debug("sub", key, value);
            key = `__${key}__`;
            result = result.replace(key, JSON.stringify(value));
        }
        // console.debug("Sub:", result);
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
            // console.debug("JSON:", dataStr);
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
    addXY(x, y, entityData, configData) {
        const entity = { components: {} };
        const comps = entity.components;

        const config = this.getConfig(configData);
        const rotation = this.getValue(config, "rotation");
        const originalRotation = this.getValue(config, "originalRotation");
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
        // console.debug("Result:", result);
        return result;
    }
}
