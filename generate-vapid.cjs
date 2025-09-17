// generate-vapid.cjs
const webpush = require("web-push");

const vapidKeys = webpush.generateVAPIDKeys();

console.log("=======================================");
console.log("Public Key:", JSON.stringify(vapidKeys.publicKey));
console.log("Lunghezza Public Key:", vapidKeys.publicKey.length);
console.log();
console.log("Private Key:", JSON.stringify(vapidKeys.privateKey));
console.log("Lunghezza Private Key:", vapidKeys.privateKey.length);
console.log("=======================================");
