import pem from "pem";
import tmp from "tmp";
import fs from "fs-extra";
import util from "util";

const createCSR = util.promisify(pem.createCSR);
const readPkcs12 = util.promisify(pem.readPkcs12);
const createCertificate = util.promisify(pem.createCertificate);
const readCertificateInfo = util.promisify(pem.readCertificateInfo);
const createTempFile = util.promisify(tmp.file);
const writeFile = util.promisify(fs.writeFile);

export const makeCSR = async function(key, domain, altNames) {
  if (!altNames) {
    altNames = [`www.${domain}`];
  }
  return await createCSR({
    clientKey: key,
    country: "US",
    state: "New York",
    locality: "New York",
    organization: "Foobar",
    commonName: domain,
    altNames: altNames,
    emailAddress: `info@${domain}`
  });
};

export const readPKCS12 = async function(p12Path, password) {
  return await readPkcs12(p12Path, {
    p12Password: password
  });
};

export const createCert = async function(key, cert, csr, config) {
  return await createCertificate({
    serviceKey: key,
    serviceCertificate: cert,
    days: 999,
    csr: csr,
    config: config
  });
};

export const makeTempFile = async function(data) {
  let path = await createTempFile();
  await writeFile(path, data);
  return path;
};

export const makeKeys = async function(domain, keyPath, password) {
  let { cert, key } = await readPKCS12(keyPath, password);
  let { csr } = await makeCSR(key, domain);
  let info = await readCertificateInfo(csr);
  console.log(info);
  let sslConfig = `[req]
		req_extensions = v3_req

		[ v3_req ]
		basicConstraints = CA:FALSE
		keyUsage = nonRepudiation, digitalSignature, keyEncipherment
		subjectAltName = @alt_names

		[alt_names]
    `;
  sslConfig += info.san.dns
    .map(function(dns, i) {
      return `DNS.${i} = ${dns}`;
    })
    .join("\n");
  let { certificate, serviceKey } = await createCert(key, cert, csr, sslConfig);
  return {
    key: serviceKey,
    cert: certificate
  };
};
