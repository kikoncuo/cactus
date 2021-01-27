const tap = require('tap')
const truffleAssert = require("truffle-assertions");
const HashTimeLock = artifacts.require("HashTimeLock");
const { SECONDS_IN_ONE_MINUTE } = require("./constants.js");
const { id, secret, invalidSecret, mockNewContract } = require("./mockData.js");
const { getTimestamp, timeout } = require("./helpers");
const statuses = require("./statuses");
const { ACTIVE, REFUNDED, WITHDRAWN } = require("./constants.js");

// Unit tests wrapper
contract("HashTimeLock", () => {
  let contractInstance;
  let txHash;

  beforeEach(async () => {
    contractInstance = await HashTimeLock.new();
  });

  // Deploy contract
  tap.test("should deploy contract", async () => {
    tap.notEqual(
      contractInstance.address, "",
      `Expected valid hash for address, got ${contractInstance.address} instead`
    );
    tap.end()
  });

  // Contract exists
  tap.test("should return error, because contract doesn't exist yet", async () => {
    const contractExists = await contractInstance.contractExists(id);
    tap.notOk(contractExists, `Expected false, got ${contractExists} instead`);
    tap.end()
  });

  // New contract
  tap.test("should create new contract", async () => {
    const newContract = await contractInstance.newContract(
      ...Object.values(mockNewContract),
      { value: 1 }
    );

    txHash = newContract.logs[0].transactionHash;

    const contractId = newContract.logs[0].args.id;
    const contractExists = await contractInstance.contractExists(contractId);
    tap.ok(contractExists, `Expected true, got ${contractExists} instead`);
    tap.end()
  });

  // Get one status
  tap.test("should get one status", async () => {
    const newContract = await contractInstance.newContract(
      ...Object.values(mockNewContract),
      { value: 1 }
    );

    const contractId = newContract.logs[0].args.id;
    const getOneStatus = await contractInstance.getSingleStatus(contractId);

    tap.equal(
      statuses[parseInt(getOneStatus)], ACTIVE,
      `Expected ACTIVE, got ${statuses[parseInt(getOneStatus)]} instead`
    );
    tap.end()
  });

  // Successful withdraw
  tap.test("should withdraw", async () => {
    const timestamp = await getTimestamp(txHash);
    const {
      outputAmount,
      hashLock,
      receiverAddress,
      outputNetwork,
      outputAddress
    } = mockNewContract;

    const newContract = await contractInstance.newContract(
      outputAmount,
      (timestamp + SECONDS_IN_ONE_MINUTE).toString(),
      hashLock,
      receiverAddress,
      outputNetwork,
      outputAddress,
      { value: 1 }
    );

    const contractId = newContract.logs[0].args.id;
    await contractInstance.withdraw(contractId, secret);

    const getOneStatus = await contractInstance.getSingleStatus(contractId);


    tap.equal(
      statuses[parseInt(getOneStatus)], WITHDRAWN,
      `Expected WITHDRAWN, got ${statuses[parseInt(getOneStatus)]} instead`
    );
    tap.end()
  });

  // Unsuccessful withdraw (invalid secret)
  tap.test("should revert withdraw, because secret is invalid", async () => {
    const timestamp = await getTimestamp(txHash);
    const {
      outputAmount,
      hashLock,
      receiverAddress,
      outputNetwork,
      outputAddress
    } = mockNewContract;

    const newContract = await contractInstance.newContract(
      outputAmount,
      (timestamp + SECONDS_IN_ONE_MINUTE).toString(),
      hashLock,
      receiverAddress,
      outputNetwork,
      outputAddress,
      { value: 1 }
    );

    const contractId = newContract.logs[0].args.id;

    await truffleAssert.reverts(
      contractInstance.withdraw(contractId, invalidSecret)
    );
    tap.end()
  });

  // Unsuccessful withdraw (expiration time passed)
  tap.test("should revert withdraw, because expiration time has passed", async () => {
    const timestamp = await getTimestamp(txHash);
    const {
      outputAmount,
      hashLock,
      receiverAddress,
      outputNetwork,
      outputAddress
    } = mockNewContract;

    const time = timestamp + 5


    const newContract = await contractInstance.newContract(
      outputAmount,
      time,
      hashLock,
      receiverAddress,
      outputNetwork,
      outputAddress,
      { value: 1 }
    );

    const contractId = newContract.logs[0].args.id;
    await timeout(5000);

    await truffleAssert.reverts(contractInstance.withdraw(contractId, secret));
    tap.end()
  });

  // Successful refund
  tap.test("should refund", async () => {
    const timestamp = await getTimestamp(txHash);
    const {
      outputAmount,
      hashLock,
      receiverAddress,
      outputNetwork,
      outputAddress
    } = mockNewContract;

    const time = timestamp + 10

    const newContract = await contractInstance.newContract(
      outputAmount,
      time,
      hashLock,
      receiverAddress,
      outputNetwork,
      outputAddress,
      { value: 1 }
    );

    const contractId = newContract.logs[0].args.id;
    await timeout(5000);
    await contractInstance.refund(contractId);

    const getOneStatus = await contractInstance.getSingleStatus(contractId);

    tap.equal(
      statuses[parseInt(getOneStatus)], REFUNDED,
      `Expected REFUNDED, got ${statuses[parseInt(getOneStatus)]} instead`
    );
    tap.end()
  });

  // Unsuccessful refund (expiration time hasn't passed)
  tap.test("should revert refund, because expiration time hasn't passed yet", async () => {
    const timestamp = await getTimestamp(txHash);
    const {
      outputAmount,
      hashLock,
      receiverAddress,
      outputNetwork,
      outputAddress
    } = mockNewContract;
    const newContract = await contractInstance.newContract(
      outputAmount,
      (timestamp + 1000).toString(),
      hashLock,
      receiverAddress,
      outputNetwork,
      outputAddress,
      { value: 1 }
    );

    const contractId = newContract.logs[0].args.id;
    await truffleAssert.reverts(contractInstance.refund(contractId));
    tap.end()
  });
});
