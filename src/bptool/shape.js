export class Shape {
    static SHAPES = ["C", "R", "S", "W"];
    static COLORS = ["u", "r", "y", "g", "c", "b", "p", "w"];

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

    static encodeNum(num) {
        if (num < 0 || num > 0xff) {
            console.error("Number to encode must be 0..255:", num);
            return;
        }
        const color = Shape.COLORS[0];
        const base4 = num.toString(4);
        const shape = base4
            .padStart(4, "0")
            .split("")
            .map(c => Shape.SHAPES[c] + color)
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
