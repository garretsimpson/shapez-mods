export class Shape {
    static SHAPES = {
        CIRC: "C",
        RECT: "R",
        STAR: "S",
        WIND: "W",
    };
    static COLORS = {
        uncolored: "uncolored",
        red: "red",
        yellow: "yellow",
        greed: "green",
        cyan: "cyan",
        blue: "blue",
        purple: "purple",
        white: "white",
    };

    /**
     * @param {number} x
     * @param {number} y
     * @returns {number} 0..3
     */
    static gridToQuad(x, y) {
        const quads = [
            [3, 0],
            [2, 1],
        ];
        x = x < 0 ? 0 : 1;
        y = y < 0 ? 0 : 1;
        return quads[y][x];
    }

    /**
     * @param {number} num
     * @param {string} color
     * @returns
     */
    static encodeNum(num, color = Shape.COLORS.uncolored) {
        if (num < 0 || num > 0xff) {
            console.error("Number to encode must be 0..255:", num);
            return;
        }
        const base4 = num.toString(4);
        const shape = base4
            .padStart(4, "0")
            .split("")
            .map(c => Object.values(Shape.SHAPES)[c] + color[0])
            .join("");
        return shape;
    }

    static test() {
        const nums = [0, 1, 0xa, 0x5a, 0xff];
        let shape;
        for (let num of nums) {
            shape = Shape.encodeNum(num);
            console.log(num.toString(16).padStart(2, "0"), shape);
        }
    }
}
