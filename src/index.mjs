import process from "process";
import fs from "fs-extra";
import util from "util";
import path from "path";
import chalk from "chalk";
import pem from "pem";
import { makeKeys } from "./ssl";
import https from "https";

const createCSR = util.promisify(pem.createCSR);
const createCertificate = util.promisify(pem.createCertificate);
const createPkcs12 = util.promisify(pem.createPkcs12);
const appendFile = util.promisify(fs.appendFile);

const defaultOptions = {
  domain: "example.com",
  basePath: path.resolve(process.cwd(), ".local-ssl-server"),
  p12Filename: "local.p12",
  p12KeyFilename: "local.pem",
  p12Password: "localhost",
  logSlug: "[local-ssl-server]",
  silent: false,
  port: 3000
};

export const localSSLServer = async (opts = {}) => {
  const {
    domain,
    basePath,
    p12Filename,
    p12KeyFilename,
    LOCAL_SSL_SERVER_P12_CERT_FILENAME,
    p12Password,
    logSlug,
    silent,
    port
  } = Object.assign({}, defaultOptions, opts);
  function log(msg) {
    if (!silent) {
      console.log(chalk.green(`${logSlug} ${msg}`).trim());
    }
  }
  function warn(msg) {
    if (!silent) {
      console.log(chalk.yellow(`${logSlug} ${msg}`).trim());
    }
  }
  function error(msg) {
    if (!silent) {
      console.log(chalk.yellow(`${logSlug} ${msg}`).trim());
    }
  }
  const P12_PATH = `${basePath}/${p12Filename}`;
  const P12_KEY_PATH = `${basePath}/${p12KeyFilename}`;
  const P12_CERT_PATH = `${basePath}/${LOCAL_SSL_SERVER_P12_CERT_FILENAME}`;
  const p12FileExists = await fs.pathExists(P12_PATH);
  if (!p12FileExists) {
    warn("No p12 file found. Creating one...");
    let rootCsr = await createCSR({
      country: "US",
      state: "New York",
      locality: "New York",
      organization: "Your Computer",
      organizationUnit: "Root CA",
      commonName: "Localhost Root CA",
      emailAddress: "you@localhost.com"
    });
    let rootCert = await createCertificate({
      days: 999,
      csr: rootCsr.csr,
      config: rootCsr.config
    });
    let { pkcs12 } = await createPkcs12(
      rootCert.serviceKey,
      rootCert.certificate,
      p12Password
    );
    await fs.outputFile(P12_PATH, pkcs12);
    await fs.outputFile(P12_KEY_PATH, rootCert.serviceKey);
    warn(`Created p12: ${P12_PATH}`);
    const gitignorePath = path.resolve(process.cwd(), ".gitignore");
    const gitignoreExists = await fs.pathExists(gitignorePath);
    if (gitignoreExists && basePath.startsWith(process.cwd())) {
      let ignoreBase = basePath.replace(`${process.cwd()}/`, "");
      let ignoreBaseArr = ignoreBase.split("/");
      let ignoreEntry = ignoreBaseArr[0];
      let ignoreContent = await fs.readFile(gitignorePath, {
        encoding: "utf-8"
      });
      if (ignoreContent.split("\n").every(line => line !== ignoreEntry)) {
        await appendFile(gitignorePath, `\n${ignoreEntry}`);
        warn(`Updated .gitignore to prevent commit of files in ${ignoreEntry}`);
      }
    }
  }
  let credentials = await makeKeys(domain, P12_PATH, p12Password);
  const server = https.createServer(credentials, function(req, res) {
    res.end("Hi");
  });
  server.listen(port, () => {
    log("Listening on https://localhost:3000");
  });
};
