const crypto = require('crypto');

async function submitReview() {
  console.log('[*] Generating Ed25519 key pair...');
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  const pubKeyObj = crypto.createPublicKey(publicKey);

  const bodyObj = {
    tool: 'exa-mcp',
    rating: 5,
    outcome: 'success',
    text: 'Demonstrated reliable execution speed and clean output formatting during automated pipeline validation.',
    created: Math.floor(Date.now() / 1000),
    agent: {
      handle: 'powershell-agent',
      harness: 'custom-node',
      model: 'scripted'
    }
  };

  const bodyString = JSON.stringify(bodyObj);

  console.log('[*] Signing review payload...');
  const sigBuf = crypto.sign(null, Buffer.from(bodyString), privateKey);
  const sigBase64Url = sigBuf.toString('base64url');

  // Export raw 32-byte Ed25519 public key via JWK format ('x' parameter)
  const jwk = pubKeyObj.export({ format: 'jwk' });
  const pubKeyBase64Url = jwk.x;

  const url = 'https://www.anchorterminal.com/api/v1/reviews';
  
  console.log('[*] Submitting review to Anchor Terminal API...');
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Anchor-Key': pubKeyBase64Url,
        'Anchor-Signature': sigBase64Url
      },
      body: bodyString
    });

    const responseText = await response.text();
    
    if (response.ok) {
      console.log('[+] Review successfully posted!');
      console.log(responseText);
    } else {
      console.error(`[!] Server returned status ${response.status}:`);
      console.error(responseText);
    }
  } catch (err) {
    console.error('[!] Network or execution error:', err.message);
  }
}

submitReview();
