import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const { ethers } = hre;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("----------------------------------------------------");
  console.log("Deploying contracts with the account:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");
  console.log("----------------------------------------------------");

  const CoffeeTrace = await ethers.getContractFactory("CoffeeTrace");
  const coffeeTrace = await CoffeeTrace.deploy();

  await coffeeTrace.waitForDeployment();

  const address = await coffeeTrace.getAddress();
  console.log("CoffeeTrace deployed to:", address);

  // Update contractInfo.json for the frontend
  const artifactPath = path.join(__dirname, "../artifacts/contracts/CoffeeTrace.sol/CoffeeTrace.json");
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  const info = {
    address: address,
    abi: artifact.abi
  };

  const infoPath = path.join(__dirname, "../src/contracts/contractInfo.json");
  
  // Ensure directory exists
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
