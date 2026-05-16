const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  const CoffeeTrace = await hre.ethers.getContractFactory("CoffeeTrace");
  const coffeeTrace = await CoffeeTrace.deploy();

  await coffeeTrace.waitForDeployment();

  console.log("CoffeeTrace deployed to:", await coffeeTrace.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
