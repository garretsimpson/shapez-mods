/* eslint-disable */
const { resolve } = require("path");

const importResolver = {
    test: /\.js$/,
    loader: "string-replace-loader",
    options: {
        search: /import {([\s\S]*?)} from "[^.](.*?)";/gms,
        replace: (_, imports) => `const {${imports}} = shapez;`,
    },
    exclude: /node_modules/,
};

const cssProcessor = {
    test: /\.css$/,
    use: ["to-string-loader", "css-loader"],
};

const resourceInliner = {
    test: /\.png$/,
    type: "asset/inline",
};

module.exports = {
    entry: "./src/index.js",
    mode: "development",
    module: {
        rules: [importResolver, cssProcessor, resourceInliner],
    },
    output: {
        path: resolve(__dirname, "build"),
        filename: "mod.js",
    },
};
