export class Shape {
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
}
