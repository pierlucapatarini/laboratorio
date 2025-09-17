/**
 * Questo script verifica la validità di una chiave VAPID pubblica in base alla sua lunghezza.
 * Eseguilo con Node.js per una verifica rapida.
 * * Come si usa:
 * 1. Incolla la tua chiave VAPID pubblica qui sotto.
 * 2. Apri il terminale nella stessa cartella del file.
 * 3. Esegui il comando: node checkVapid.js
 */

const VAPID_PUBLIC_KEY = 'BDdJ3dQK2AXmc7fDA-oCZKaydrxC6BK2x5mEfuDCCS0ul5175Tea9VObDfrZ1-rYohfxudE-8Ye6bqBolwiuxEU';

console.log('--- Verifica Chiave VAPID ---');
console.log('Chiave inserita:', VAPID_PUBLIC_KEY);
console.log('Lunghezza della stringa:', VAPID_PUBLIC_KEY.length);

if (VAPID_PUBLIC_KEY.length !== 88) {
  console.error('❌ ERRORE: La chiave VAPID pubblica ha una lunghezza di ' + VAPID_PUBLIC_KEY.length + ' caratteri. Dovrebbe essere 88.');
  console.error('Motivo probabile: la chiave non è stata copiata interamente.');
  console.log('--- Azione consigliata ---');
  console.log('1. Torna alla console di Firebase e clicca sul pulsante "Copia" accanto alla chiave.');
  console.log('2. Assicurati che non ci siano spazi vuoti prima o dopo la chiave in questo file.');
} else {
  console.log('✅ Successo! La chiave ha la lunghezza corretta di 88 caratteri.');
  console.log('Ora puoi copiare questa chiave e incollarla nel tuo file .env in modo sicuro.');
}