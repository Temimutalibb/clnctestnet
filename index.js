import { SuiClient, getFullnodeUrl } from "@mysten/sui.js/client";
import { Ed25519Keypair } from "@mysten/sui.js/keypairs/ed25519";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";

// Load .env variables
dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const client = new SuiClient({ url: getFullnodeUrl("testnet") });

// Create Sui client and server keypair
const fullKey = Uint8Array.from(
  Buffer.from(process.env.SUI_PRIVATE_KEY, "base64")
);

const rawSecretKey = fullKey.slice(1);
const keypair = Ed25519Keypair.fromSecretKey(rawSecretKey);
const treasuryCoinId = process.env.TREASURY_COIN_OBJECT_ID;

app.get("/", (req, res) => {
  res.send("Hello World!  ");
});

app.post("/withdraw", async (req, res) => {
  try {
    const { amount, recipient } = req.body;

    if (!amount || !recipient) {
      return res
        .status(400)
        .json({ error: "Amount, recipient, and coinObjectId are required" });
    }

    const suiAmount = amount * 1000000; // 100_000_000
    console.log(suiAmount);

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
  }
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});
