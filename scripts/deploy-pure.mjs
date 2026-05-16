import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  const rpcUrl = process.env.RPC_URL;

  if (!privateKey || !rpcUrl) {
    console.error("Missing PRIVATE_KEY or RPC_URL in .env");
    process.exit(1);
  }

  console.log("----------------------------------------------------");
  console.log("Connecting to Sepolia via RPC...");
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log("Deploying contracts with the account:", wallet.address);
  const balance = await provider.getBalance(wallet.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");
  console.log("----------------------------------------------------");

  // Load contract artifact
  const artifactPath = path.join(__dirname, "../artifacts/contracts/CoffeeTrace.sol/CoffeeTrace.json");
  if (!fs.existsSync(artifactPath)) {
    console.error("Artifact not found. Please run 'npx hardhat compile' first.");
    process.exit(1);
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  console.log("Deploying CoffeeTrace...");
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy();

  console.log("Waiting for deployment...");
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("CoffeeTrace deployed to:", address);

  // Update contractInfo.json for the frontend
  const info = {
    address: address,
    abi: artifact.abi
  };

  const infoPath = path.join(__dirname, "../src/contracts/contractInfo.json");
  const dir = path.dirname(infoPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(infoPath, JSON.stringify(info, null, 2));
  
  console.log("----------------------------------------------------");
  console.log("SUCCESS: Contract address and ABI saved to contractInfo.json");
  console.log("----------------------------------------------------");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
