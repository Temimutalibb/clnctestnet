import { SuiClient, getFullnodeUrl } from "@mysten/sui.js/client";
import { Ed25519Keypair } from "@mysten/sui.js/keypairs/ed25519";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { decodeSuiPrivateKey } from "@mysten/sui.js/cryptography";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import admin from "firebase-admin";

// Load .env variables
dotenv.config();

// Initialize Firebase Admin SDK
if (!process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
  throw new Error(
    "FIREBASE_SERVICE_ACCOUNT_BASE64 is not set in the environment variables."
  );
}
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64.replace(/(\r\n|\n|\r)/gm, "");
const serviceAccount = JSON.parse(
  Buffer.from(serviceAccountJson, "base64").toString("ascii")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://clancircle-ecf0b-default-rtdb.firebaseio.com"
});

const app = express();
app.use(cors());
app.use(bodyParser.json());

const client = new SuiClient({ url: getFullnodeUrl("mainnet") });

// Create Sui client and server keypair
/*const fullKey = Uint8Array.from(
  Buffer.from(process.env.SUI_PRIVATE_KEY, "base64")
);
*/
const { secretKey } = decodeSuiPrivateKey(process.env.SUI_PRIVATE_KEY);
//const rawSecretKey = fullKey.slice(1);
//const keypair = Ed25519Keypair.fromSecretKey(rawSecretKey);
const keypair = Ed25519Keypair.fromSecretKey(secretKey);
const treasuryCoinId = process.env.TREASURY_COIN_OBJECT_ID;

app.get("/", (req, res) => {
  res.send("Hello World!  ");
});

// Authentication middleware
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  const idToken = authHeader.split("Bearer ")[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken; // Add user info to the request object
    next();
  } catch (error) {
    console.error("Error verifying auth token:", error);
    return res.status(403).json({ error: "Forbidden: Invalid token" });
  }
};

app.post("/withdraw", authenticate, async (req, res) => {
  try {
    // The user is now authenticated and req.user contains their details
    // You can add extra checks here, e.g., if req.user.uid is allowed to withdraw.
    console.log(`Withdrawal request from authorized user: ${req.user.uid}`);

    const { amount, recipient } = req.body;

    if (!amount || !recipient) {
      return res
        .status(400)
        .json({ error: "Amount, recipient, and coinObjectId are required" });
    }

    const suiAmount = amount * 1000000; // 100_000_000
    // Step 2: Create transaction
    const tx = new TransactionBlock();

    // Split from your custom coin object
    const [customCoin] = tx.splitCoins(tx.object(treasuryCoinId), [
      tx.pure(suiAmount),
    ]);

    // Transfer the split coin to recipient
    tx.transferObjects([customCoin], tx.pure(recipient));

    // Step 3: Sign and send
    const result = await client.signAndExecuteTransactionBlock({
      transactionBlock: tx,
      signer: keypair,
      options: { showEffects: true },
    });

    res.json({ success: true, txHash: result.digest });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Withdrawal failed" });
    console.log(error.message);
  }
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});
