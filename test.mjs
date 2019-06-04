import fs from "fs-extra";
import { localSSLServer } from "./src";

async function main() {
  try {
    //await fs.emptyDir(".local-ssl-server");
    await localSSLServer();
  } catch (err) {
    console.log(err);
  }
}

main();
