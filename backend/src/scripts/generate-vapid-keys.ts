import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();
console.log("Ajoute ces variables à ton fichier .env :\n");
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:ton-email@example.com`);
