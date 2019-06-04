import process from "process";
import fs from "fs-extra";
import util from "util";
import path from "path";
import chalk from "chalk";
import pem from "pem";

const createCSR = util.promisify(pem.createCSR);
const createCertificate = util.promisify(pem.createCertificate);
const createPkcs12 = util.promisify(pem.createPkcs12);
const appendFile = util.promisify(fs.appendFile);

const defaultOptions = {
  LOCAL_SSL_SERVER_BASE_PATH: path.resolve(process.cwd(), ".local-ssl-server"),
  LOCAL_SSL_SERVER_P12_FILENAME: "local.p12",
  LOCAL_SSL_SERVER_P12_KEY_FILENAME: "local.key",
  LOCAL_SSL_SERVER_P12_PASSWORD: "localhost"
};

function warn(msg) {
  console.log(chalk.yellow(`[local-ssl-server] ${msg}`));
}

export const localSSLServer = async (opts = {}) => {
  const {
    LOCAL_SSL_SERVER_BASE_PATH,
    LOCAL_SSL_SERVER_P12_FILENAME,
    LOCAL_SSL_SERVER_P12_KEY_FILENAME,
    LOCAL_SSL_SERVER_P12_CERT_FILENAME,
    LOCAL_SSL_SERVER_P12_PASSWORD
  } = Object.assign({}, defaultOptions, opts);
  const P12_PATH = `${LOCAL_SSL_SERVER_BASE_PATH}/${LOCAL_SSL_SERVER_P12_FILENAME}`;
  const P12_KEY_PATH = `${LOCAL_SSL_SERVER_BASE_PATH}/${LOCAL_SSL_SERVER_P12_KEY_FILENAME}`;
  const P12_CERT_PATH = `${LOCAL_SSL_SERVER_BASE_PATH}/${LOCAL_SSL_SERVER_P12_CERT_FILENAME}`;
  const p12FileExists = await fs.pathExists(P12_PATH);
  if (!p12FileExists) {
    warn("No p12 file found. Creating one...");
    let rootCsr = await createCSR({
      country: "US",
      state: "New York",
      locality: "New York",
      organization: "CoinDesk",
      organizationUnit: "Root CA",
      commonName: "CoinDesk Root CA",
      emailAddress: "info@coindesk.com"
    });
    let rootCert = await createCertificate({
      days: 360,
      csr: rootCsr.csr,
      config: rootCsr.config
    });
    let { pkcs12 } = await createPkcs12(
      rootCert.serviceKey,
      rootCert.certificate,
      "coindesk"
    );
    await fs.outputFile(P12_PATH, pkcs12);
    warn(`Created p12: ${P12_PATH}`);
    const gitignorePath = path.resolve(process.cwd(), ".gitignore");
    const gitignoreExists = await fs.pathExists(gitignorePath);
    if (gitignoreExists) {
      warn("Gitignore exists");
      await appendFile(gitignorePath, "\n.local-ssl-server");
    }
  }
};

localSSLServer();
