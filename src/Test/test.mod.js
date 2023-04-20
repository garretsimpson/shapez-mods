/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-undef */
const METADATA = {
    website: "",
    author: "FatcatX",
    name: "Test Mod",
    version: "0.1.1",
    id: "test1",
    description: "A test mod",
    minimumGameVersion: ">=1.5.0",
    doesNotAffectSavegame: true,
};

class Mod extends shapez.Mod {
    async init() {
        try {
            // const PRIVATE_FILE = "/Users/garre/Desktop/private.txt";
            const PRIVATE_FILE = "../private.txt";
            const BAD_DATA = "This is bad data";
            const storage = new shapez.StorageImplElectron(this.app);
            await storage.initialize();
            const data = await storage.writeFileAsync(PRIVATE_FILE, BAD_DATA);
            console.log("##### wrote data:", BAD_DATA);
            // const data = await storage.readFileAsync(PRIVATE_FILE);
            // console.log("##### private data:", data);
        } catch (e) {
            console.error(e);
        }
    }
}
