import test, { Test } from "tape";
import { v4 as uuidv4 } from "uuid";
import { createServer } from "http";
import { ApiServer, ConfigService } from "@hyperledger/cactus-cmd-api-server";
import { LogLevelDesc } from "@hyperledger/cactus-common";
import { AddressInfo } from "net";
import { BesuTestLedger } from "@hyperledger/cactus-test-tooling";
import Web3 from "web3";
import {
  Web3SigningCredentialType,
  PluginLedgerConnectorBesu,
  PluginFactoryLedgerConnector,
} from "@hyperledger/cactus-plugin-ledger-connector-besu";
import {
  Configuration,
  DefaultApi,
  IPluginHtlcEthBesuOptions,
  PluginFactoryHtlcEthBesu,
  NewContractObj,
} from "@hyperledger/cactus-plugin-htlc-eth-besu";

import { PluginRegistry } from "@hyperledger/cactus-core";
import { PluginImportType } from "@hyperledger/cactus-core-api";
import { PluginKeychainMemory } from "@hyperledger/cactus-plugin-keychain-memory";
import { dataTest } from "../dataTest";

const connectorId = uuidv4();

test("Test new Contract endpoint", async (t: Test) => {
  const logLevel: LogLevelDesc = "TRACE";
  const besuTestLedger = new BesuTestLedger();
  await besuTestLedger.start();

  const keychainId = uuidv4();
  const firstHighNetWorthAccount = "627306090abaB3A6e1400e9345bC60c78a8BEf57";
  const besuKeyPair = {
    privateKey:
      "c87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3",
  };
  const accountRef = "account";
  const privateKeyRef = "privateKey";
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
  t.comment(`HttpServer1 AddressInfo: ${JSON.stringify(addressInfo)}`);
  const node1Host = `http://${addressInfo.address}:${addressInfo.port}`;
  t.comment(`Cactus Node 1 Host: ${node1Host}`);

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
  const balance = await web3.eth.getBalance(firstHighNetWorthAccount);
  t.comment(balance);

  // Test for 200 valid response test case
  const bodyObj: NewContractObj = {
    contractAddress: hashTimeLockAddress,
    inputAmount: 10,
    outputAmount: 0x04,
    expiration: dataTest.expiration,
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
  const res = await api.newContract(bodyObj);
  t.comment("Getting result");
  t.equal(res.status, 200);

  const balance2 = await web3.eth.getBalance(firstHighNetWorthAccount);
  t.comment(balance2);
  t.equal(
    parseInt(balance),
    parseInt(balance2) - 10,
    "Balance of account is OK",
  );

  t.ok("End test 1");

  // Test for 500 not found test case
  try {
    const bodyObjF: NewContractObj = {
      contractAddress: hashTimeLockAddress,
      inputAmount: 10,
      outputAmount: 0x04,
      expiration: 2147483648,
      hashLock: dataTest.hashLock,
      receiver: "0xFAKE8FDEE72ac11b5c542428B35EEF5769C409f0",
      outputNetwork: "BTC",
      outputAddress: "1AcVYm7M3kkJQH28FXAvyBFQzFRL6xPKu8",
      keychainId: keychainId,
      connectorId: connectorId,
      accountRef: accountRef,
      privateKeyRef: privateKeyRef,
      credentialType: Web3SigningCredentialType.PRIVATEKEYHEX,
    };
    await api.newContract(bodyObjF);
  } catch (error) {
    t.equal(error.response.status, 500, "HTTP response status are equal");
    t.comment("End test 2");
  }
});