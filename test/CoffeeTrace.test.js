import { expect } from 'chai'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { ethers } = require('hardhat')

describe('CoffeeTrace', function () {
  let coffee

  beforeEach(async function () {
    const CoffeeTrace = await ethers.getContractFactory('CoffeeTrace')
    coffee = await CoffeeTrace.deploy()
  })

  it('registers and returns a batch', async function () {
    await coffee.registerBatch('Farmer One', 'Coop A', 'Origin', '2026-05-07', '1000', 250n, 250000n)

    const batchId = await coffee.batchIds(0)
    const batch = await coffee.getBatch(batchId)
    expect(batch.batchId).to.equal('CT-1001')
    expect(batch.farmer).to.equal('Farmer One')
    expect(batch.isRegistered).to.equal(true)
    expect(batch.boughtPricePerKgRWF).to.equal(250n)
    expect(batch.boughtTotalRWF).to.equal(250000n)
  })

  it('records processing details', async function () {
    await coffee.registerBatch('Farmer Three', 'Coop C', 'Origin', '2026-05-07', '750', 300n, 225000n)
    const batchId = await coffee.batchIds(0)
    await coffee.logProcessing(batchId, 'Station C', 'Fully washed', '10.8', 'AA', '86')

    const batch = await coffee.getBatch(batchId)
    expect(batch.station).to.equal('Station C')
    expect(batch.washMethod).to.equal('Fully washed')
    expect(batch.grade).to.equal('AA')
  })

  it('records export details', async function () {
    await coffee.registerBatch('Farmer Four', 'Coop D', 'Origin', '2026-05-07', '300', 200n, 60000n)
    const batchId = await coffee.batchIds(0)
    await coffee.logExportWithPrice(batchId, 'Buyer X', 'Rotterdam', '2026-06-01', 'CONT-123', 320n, 96000n)

    const batch = await coffee.getBatch(batchId)
    expect(batch.buyer).to.equal('Buyer X')
    expect(batch.destination).to.equal('Rotterdam')
    expect(batch.container).to.equal('CONT-123')
    expect(batch.soldPricePerKgRWF).to.equal(320n)
    expect(batch.soldTotalRWF).to.equal(96000n)
  })
})
