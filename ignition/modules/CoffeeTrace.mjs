import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("CoffeeTraceModule", (m) => {
  const coffeeTrace = m.contract("CoffeeTrace");

  return { coffeeTrace };
});
