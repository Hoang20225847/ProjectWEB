const { VNPay, ignoreLogger } = require('vnpay');

/** Sandbox mặc định (demo) — override bằng biến môi trường khi deploy */
const SANDBOX_DEFAULTS = {
  tmnCode: 'E1JJOIAV',
  secureSecret: 'PRP3IVKG6OP5PFPKMSO6DSDFEHGR5KLW',
  vnpayHost: 'https://sandbox.vnpayment.vn',
};

function getVnpayCredentials() {
  return {
    tmnCode: (process.env.VNPAY_TMN_CODE || SANDBOX_DEFAULTS.tmnCode).trim(),
    secureSecret: (process.env.VNPAY_HASH_SECRET || SANDBOX_DEFAULTS.secureSecret).trim(),
    vnpayHost: (process.env.VNPAY_HOST || SANDBOX_DEFAULTS.vnpayHost).trim().replace(/\/$/, ''),
    testMode: process.env.VNPAY_TEST_MODE !== 'false',
  };
}

let client;

function getVNPayClient() {
  if (client) return client;
  const cred = getVnpayCredentials();
  client = new VNPay({
    tmnCode: cred.tmnCode,
    secureSecret: cred.secureSecret,
    vnpayHost: cred.vnpayHost,
    testMode: cred.testMode,
    hashAlgorithm: 'SHA512',
    enableLog: process.env.NODE_ENV !== 'production',
    loggerFn: ignoreLogger,
  });
  return client;
}

function resetVNPayClientForTests() {
  client = null;
}

module.exports = {
  getVNPayClient,
  getVnpayCredentials,
  resetVNPayClientForTests,
};
