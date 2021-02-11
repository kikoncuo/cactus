import test, { Test } from "tape";
import { v4 as uuidv4 } from "uuid";
import { createServer } from "http";
import { ApiServer, ConfigService } from "@hyperledger/cactus-cmd-api-server";
import { LogLevelDesc } from "@hyperledger/cactus-common";
import { AddressInfo } from "net";
import { BesuTestLedger } from "@hyperledger/cactus-test-tooling";
import Web3 from "web3";
import {
  Configuration,
  DefaultApi,
  IPluginHtlcEthBesuOptions,
  PluginFactoryHtlcEthBesu,
  NewContractObj,
  RefundReq,
} from "@hyperledger/cactus-plugin-htlc-eth-besu";
import {
  Web3SigningCredentialType,
  PluginLedgerConnectorBesu,
  PluginFactoryLedgerConnector,
  EthContractInvocationType,
} from "@hyperledger/cactus-plugin-ledger-connector-besu";
import DemoHelpers from "../../../solidity/hash-time-lock-contract/DemoHelpers.json";

import { PluginRegistry } from "@hyperledger/cactus-core";
import { PluginImportType } from "@hyperledger/cactus-core-api";
import { PluginKeychainMemory } from "@hyperledger/cactus-plugin-keychain-memory";
import { dataTest } from "../dataTest";

const accountRef = "account";
const privateKeyRef = "privateKey";
const connectorId = uuidv4();

test("Test refund endpoint", async (t: Test) => {
  const logLevel: LogLevelDesc = "TRACE";
  const timeout = (ms: number) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
  };
  const besuTestLedger = new BesuTestLedger();
  await besuTestLedger.start();

  const keychainId = uuidv4();
  const firstHighNetWorthAccount = "627306090abaB3A6e1400e9345bC60c78a8BEf57";
  const besuKeyPair = {
    privateKey:
      "c87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3",
  };
  const keychain = new PluginKeychainMemory({
    backend: new Map([
      [accountRef, firstHighNetWorthAccount],
      [privateKeyRef, besuKeyPair.privateKey],
    ]),
    keychainId,
    logLevel,
    instanceId: uuidv4(),
  });

  test.onFinish(async () => {
    await besuTestLedger.stop();
    await besuTestLedger.destroy();
  });
  const rpcApiHttpHost = await besuTestLedger.getRpcApiHttpHost();
  const web3 = new Web3(rpcApiHttpHost);

  const factory = new PluginFactoryLedgerConnector({
    pluginImportType: PluginImportType.LOCAL,
  });
  const connector: PluginLedgerConnectorBesu = await factory.create({
    rpcApiHttpHost,
    instanceId: connectorId,
    pluginRegistry: new PluginRegistry(),
  });
  const httpServer = createServer();
  await new Promise((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.once("listening", resolve);
    httpServer.listen(0, "127.0.0.1");
  });

  const addressInfo = httpServer.address() as AddressInfo;
  t.comment(`HttpServer AddressInfo: ${JSON.stringify(addressInfo)}`);
  const node1Host = `http://${addressInfo.address}:${addressInfo.port}`;
  t.comment(`Cactus Node Host: ${node1Host}`);
  const pluginRegistry = new PluginRegistry({});
  pluginRegistry.add(keychain);
  pluginRegistry.add(connector);
  const configService = new ConfigService();
  const apiServerOptions = configService.newExampleConfig();
  const pluginOptions: IPluginHtlcEthBesuOptions = {
    logLevel,
    instanceId: uuidv4(),
    pluginRegistry,
  };

  const factoryHTLC = new PluginFactoryHtlcEthBesu({
    pluginImportType: PluginImportType.LOCAL,
  });

  const pluginHtlc = await factoryHTLC.create(pluginOptions);
  pluginRegistry.add(pluginHtlc);
  apiServerOptions.configFile = "";
  apiServerOptions.apiCorsDomainCsv = "*";
  apiServerOptions.apiPort = addressInfo.port;
  apiServerOptions.cockpitPort = 0;
  apiServerOptions.apiTlsEnabled = false;
  const config = configService.newExampleConfigConvict(apiServerOptions);
  const apiServer = new ApiServer({
    httpServerApi: httpServer,
    config: config.getProperties(),
    pluginRegistry,
  });
  await apiServer.start();
  t.comment("Start server");
  test.onFinish(() => apiServer.shutdown());
  const configuration = new Configuration({
    basePath: node1Host,
  });
  t.comment("Setting configuration");

  const api = new DefaultApi(configuration);
  t.comment("Api generated");

  //Deploy contract
  const deployOut = await pluginHtlc.initialize(
    keychainId,
    accountRef,
    privateKeyRef,
    dataTest.estimated_gas,
    Web3SigningCredentialType.PRIVATEKEYHEX,
    connectorId,
  );
  t.comment(deployOut.transactionReceipt.contractAddress!);
  t.ok(deployOut, "deployContract is truthy OK");

  const hashTimeLockAddress = deployOut.transactionReceipt
    .contractAddress as string;

  //deploy DemoHelpers
  const deployDemoHelper = await connector.deployContract({
    web3SigningCredential: {
      ethAccount: firstHighNetWorthAccount,
      secret: besuKeyPair.privateKey,
      type: Web3SigningCredentialType.PRIVATEKEYHEX,
    },
    bytecode: DemoHelpers.bytecode,
    gas: dataTest.estimated_gas,
  });
  t.comment(deployDemoHelper.transactionReceipt.contractAddress!);
  t.ok(deployDemoHelper, "deployContract DemoHelpers is OK");

  let timestamp: number;
  const { callOutput } = await connector.invokeContract({
    contractAbi: DemoHelpers.abi,
    contractAddress: deployDemoHelper.transactionReceipt
      .contractAddress as string,
    invocationType: EthContractInvocationType.CALL,
    methodName: "getTimestamp",
    params: [],
    web3SigningCredential: {
      ethAccount: firstHighNetWorthAccount,
      type: Web3SigningCredentialType.PRIVATEKEYHEX,
      secret: besuKeyPair.privateKey,
    },
    gas: dataTest.estimated_gas,
  });
  t.ok(callOutput, "getTimestamp is truthy OK");
  timestamp = callOutput as number;
  timestamp = +timestamp + +10;

  const balance1 = await web3.eth.getBalance(firstHighNetWorthAccount);
  t.comment(balance1);

  //newContract
  const bodyObj: NewContractObj = {
    contractAddress: hashTimeLockAddress,
    inputAmount: 10,
    outputAmount: 1,
    expiration: timestamp,
    hashLock: dataTest.hashLock,
    receiver: dataTest.receiver,
    outputNetwork: "BTC",
    outputAddress: "1AcVYm7M3kkJQH28FXAvyBFQzFRL6xPKu8",
    keychainId: keychainId,
    connectorId: connectorId,
    accountRef: accountRef,
    privateKeyRef: privateKeyRef,
    credentialType: Web3SigningCredentialType.PRIVATEKEYHEX,
    gas: dataTest.estimated_gas,
  };
  const resp = await api.newContract(bodyObj);
  t.ok(resp, "new contract");

  const resp2 = await connector.invokeContract({
    contractAbi: DemoHelpers.abi,
    contractAddress: deployDemoHelper.transactionReceipt
      .contractAddress as string,
    invocationType: EthContractInvocationType.CALL,
    methodName: "getTxId",
    params: [
      firstHighNetWorthAccount,
      dataTest.receiver,
      10,
      dataTest.hashLock,
      timestamp,
    ],
    web3SigningCredential: {
      ethAccount: firstHighNetWorthAccount,
      type: Web3SigningCredentialType.PRIVATEKEYHEX,
      secret: besuKeyPair.privateKey,
    },
    gas: dataTest.estimated_gas,
  });
  t.ok(resp2.callOutput, "result invoke is truthy OK");
  const id = resp2.callOutput as string;
  t.comment(id);
  const balance = await web3.eth.getBalance(firstHighNetWorthAccount);
  t.comment(balance);
  t.equal(
    parseInt(balance),
    parseInt(balance1) - 10,
    "The balance of accout is OK",
  );

  // Test for 200 valid response test case
  await timeout(20000);
  const refundRequest: RefundReq = {
    contractAddress: hashTimeLockAddress,
    credentialType: Web3SigningCredentialType.PRIVATEKEYHEX,
    keychainId,
    connectorId,
    accountRef,
    privateKeyRef,
  };
  const res = await api.refund(id, refundRequest);
  t.comment("Getting result");
  t.equal(res.status, 200);
  const balance2 = await web3.eth.getBalance(firstHighNetWorthAccount);
  t.comment(balance2);
  t.equal(balance1, balance2, "Retrieved balance of test account OK");

  const resStatus = await api.getSingleStatus(
    id,
    keychainId,
    hashTimeLockAddress,
    Web3SigningCredentialType.PRIVATEKEYHEX,
    connectorId,
    accountRef,
    privateKeyRef,
  );
  t.equal(resStatus.status, 200, "response status is 200 OK");
  t.equal(resStatus.data, 2, "the contract status is Refunded");
});

test("Test error refund endpoint", async (t: Test) => {
  const logLevel: LogLevelDesc = "TRACE";
  const besuTestLedger = new BesuTestLedger();
  await besuTestLedger.start();

  const keychainId = uuidv4();
  const firstHighNetWorthAccount = "627306090abaB3A6e1400e9345bC60c78a8BEf57";
  const besuKeyPair = {
    privateKey:
      "c87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3",
  };
  const keychain = new PluginKeychainMemory({
    backend: new Map([
      [accountRef, firstHighNetWorthAccount],
      [privateKeyRef, besuKeyPair.privateKey],
    ]),
    keychainId,
    logLevel,
    instanceId: uuidv4(),
  });

  test.onFinish(async () => {
    await besuTestLedger.stop();
    await besuTestLedger.destroy();
  });
  const rpcApiHttpHost = await besuTestLedger.getRpcApiHttpHost();
  const web3 = new Web3(rpcApiHttpHost);

  const factory = new PluginFactoryLedgerConnector({
    pluginImportType: PluginImportType.LOCAL,
  });
  const connector: PluginLedgerConnectorBesu = await factory.create({
    rpcApiHttpHost,
    instanceId: connectorId,
    pluginRegistry: new PluginRegistry(),
  });
  const httpServer = createServer();
  await new Promise((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.once("listening", resolve);
    httpServer.listen(0, "127.0.0.1");
  });

  const addressInfo = httpServer.address() as AddressInfo;
  t.comment(`HttpServer AddressInfo: ${JSON.stringify(addressInfo)}`);
  const node1Host = `http://${addressInfo.address}:${addressInfo.port}`;
  t.comment(`Cactus Node Host: ${node1Host}`);
  const pluginRegistry = new PluginRegistry({});
  pluginRegistry.add(keychain);
  pluginRegistry.add(connector);
  const configService = new ConfigService();
  const apiServerOptions = configService.newExampleConfig();
  const pluginOptions: IPluginHtlcEthBesuOptions = {
    logLevel,
    instanceId: uuidv4(),
    pluginRegistry,
  };

  const factoryHTLC = new PluginFactoryHtlcEthBesu({
    pluginImportType: PluginImportType.LOCAL,
  });

  const pluginHtlc = await factoryHTLC.create(pluginOptions);
  pluginRegistry.add(pluginHtlc);
  apiServerOptions.configFile = "";
  apiServerOptions.apiCorsDomainCsv = "*";
  apiServerOptions.apiPort = addressInfo.port;
  apiServerOptions.cockpitPort = 0;
  apiServerOptions.apiTlsEnabled = false;
  const config = configService.newExampleConfigConvict(apiServerOptions);
  const apiServer = new ApiServer({
    httpServerApi: httpServer,
    config: config.getProperties(),
    pluginRegistry,
  });
  await apiServer.start();
  t.comment("Start server");
  test.onFinish(() => apiServer.shutdown());
  const configuration = new Configuration({
    basePath: node1Host,
  });
  t.comment("Setting configuration");

  const api = new DefaultApi(configuration);
  t.comment("Api generated");

  //Deploy contract
  const deployOut = await pluginHtlc.initialize(
    keychainId,
    accountRef,
    privateKeyRef,
    dataTest.estimated_gas,
    Web3SigningCredentialType.PRIVATEKEYHEX,
    connectorId,
  );
  t.comment(deployOut.transactionReceipt.contractAddress!);
  t.ok(deployOut, "deployContract is truthy OK");

  const hashTimeLockAddress = deployOut.transactionReceipt
    .contractAddress as string;

  //deploy DemoHelpers
  const deployDemoHelper = await connector.deployContract({
    web3SigningCredential: {
      ethAccount: firstHighNetWorthAccount,
      secret: besuKeyPair.privateKey,
      type: Web3SigningCredentialType.PRIVATEKEYHEX,
    },
    bytecode: DemoHelpers.bytecode,
    gas: dataTest.estimated_gas,
  });
  t.comment(deployDemoHelper.transactionReceipt.contractAddress!);
  t.ok(deployDemoHelper, "deployContract DemoHelpers is OK");

  let timestamp: number;
  const { callOutput } = await connector.invokeContract({
    contractAbi: DemoHelpers.abi,
    contractAddress: deployDemoHelper.transactionReceipt
      .contractAddress as string,
    invocationType: EthContractInvocationType.CALL,
    methodName: "getTimestamp",
    params: [],
    web3SigningCredential: {
      ethAccount: firstHighNetWorthAccount,
      type: Web3SigningCredentialType.PRIVATEKEYHEX,
      secret: besuKeyPair.privateKey,
    },
    gas: dataTest.estimated_gas,
  });
  t.ok(callOutput, "getTimestamp is truthy OK");
  timestamp = callOutput as number;
  timestamp = +timestamp + +10;

  const balance1 = await web3.eth.getBalance(firstHighNetWorthAccount);
  t.comment(balance1);

  //newContract
  const bodyObj: NewContractObj = {
    contractAddress: hashTimeLockAddress,
    inputAmount: 10,
    outputAmount: 1,
    expiration: timestamp,
    hashLock: dataTest.hashLock,
    receiver: dataTest.receiver,
    outputNetwork: "BTC",
    outputAddress: "1AcVYm7M3kkJQH28FXAvyBFQzFRL6xPKu8",
    keychainId: keychainId,
    connectorId: connectorId,
    accountRef: accountRef,
    privateKeyRef: privateKeyRef,
    credentialType: Web3SigningCredentialType.PRIVATEKEYHEX,
    gas: dataTest.estimated_gas,
  };
  const resp = await api.newContract(bodyObj);
  t.ok(resp, "new contract");

  const resp2 = await connector.invokeContract({
    contractAbi: DemoHelpers.abi,
    contractAddress: deployDemoHelper.transactionReceipt
      .contractAddress as string,
    invocationType: EthContractInvocationType.CALL,
    methodName: "getTxId",
    params: [
      firstHighNetWorthAccount,
      dataTest.receiver,
      10,
      dataTest.hashLock,
      timestamp,
    ],
    web3SigningCredential: {
      ethAccount: firstHighNetWorthAccount,
      type: Web3SigningCredentialType.PRIVATEKEYHEX,
      secret: besuKeyPair.privateKey,
    },
  });
  t.ok(resp2.callOutput, "result invoke is truthy OK");
  const id = resp2.callOutput as string;
  t.comment(id);
  const balance = await web3.eth.getBalance(firstHighNetWorthAccount);
  t.comment(balance);
  t.equal(
    parseInt(balance),
    parseInt(balance1) - 10,
    "The balance of accout is OK",
  );

  // Test for invalid response test case
  try {
    const refundRequest: RefundReq = {
      contractAddress: hashTimeLockAddress,
      credentialType: Web3SigningCredentialType.PRIVATEKEYHEX,
      keychainId,
      connectorId,
      accountRef,
      privateKeyRef,
    };
    const res = await api.refund(id, refundRequest);
    t.equal(res.status, 500, "response status is 500");
  } catch (error) {
    t.equal(error.response.status, 500, "response status is 500");
  }
  t.equal(
    parseInt(balance),
    parseInt(balance1) - 10,
    "The balance of accout is OK",
  );
});
