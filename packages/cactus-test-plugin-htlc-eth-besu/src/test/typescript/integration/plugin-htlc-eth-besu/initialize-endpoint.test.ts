import test, { Test } from "tape";
import { v4 as uuidv4 } from "uuid";
import { createServer } from "http";
import { AddressInfo } from "net";
import {
  Configuration,
  DefaultApi,
  IPluginHtlcEthBesuOptions,
  PluginFactoryHtlcEthBesu,
  InitializeReq,
} from "@hyperledger/cactus-plugin-htlc-eth-besu";
import {
  PluginFactoryLedgerConnector,
  PluginLedgerConnectorBesu,
  Web3SigningCredentialType,
} from "@hyperledger/cactus-plugin-ledger-connector-besu";
import { ApiServer, ConfigService } from "@hyperledger/cactus-cmd-api-server";
import { PluginRegistry } from "@hyperledger/cactus-core";
import { PluginImportType } from "@hyperledger/cactus-core-api";
import { BesuTestLedger } from "@hyperledger/cactus-test-tooling";
import { PluginKeychainMemory } from "@hyperledger/cactus-plugin-keychain-memory";
import { LogLevelDesc } from "@hyperledger/cactus-common";

const logLevel: LogLevelDesc = "INFO";
const estimatedGas = 6721975;
const keychainId = uuidv4();
const firstHighNetWorthAccount = "0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1";
const besuKeyPair = {
  privateKey:
    "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d",
};
const accountRef = "account";
const privateKeyRef = "privateKey";
const connectorId = uuidv4();

test("Test initialize endpoint", async (t: Test) => {
  const keychain = new PluginKeychainMemory({
    backend: new Map([
      [accountRef, firstHighNetWorthAccount],
      [privateKeyRef, besuKeyPair.privateKey],
    ]),
    keychainId,
    logLevel,
    instanceId: uuidv4(),
  });

  t.comment("Starting Besu Test Ledger");
  const besuTestLedger = new BesuTestLedger();
  await besuTestLedger.start();

  test.onFinish(async () => {
    await besuTestLedger.stop();
    await besuTestLedger.destroy();
  });

  const rpcApiHttpHost = await besuTestLedger.getRpcApiHttpHost();
  const factory = new PluginFactoryLedgerConnector({
    pluginImportType: PluginImportType.LOCAL,
  });
  const connector: PluginLedgerConnectorBesu = await factory.create({
    rpcApiHttpHost,
    pluginRegistry: new PluginRegistry(),
    instanceId: connectorId,
  });

  const httpServer = createServer();
  await new Promise((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.once("listening", resolve);
    httpServer.listen(0, "127.0.0.1");
  });

  const addressInfo = httpServer.address() as AddressInfo;
  t.comment(`HttpServer AddressInfo: ${JSON.stringify(addressInfo)}`);
  const nodeHost = `http://${addressInfo.address}:${addressInfo.port}`;
  t.comment(`Cactus Node Host: ${nodeHost}`);

  const configService = new ConfigService();
  const apiServerOptions = configService.newExampleConfig();

  const pluginRegistry = new PluginRegistry({});
  pluginRegistry.add(keychain);
  pluginRegistry.add(connector);
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
    basePath: nodeHost,
  });
  t.comment("Setting configuration");

  const api = new DefaultApi(configuration);
  t.comment("Api generated");

  const request: InitializeReq = {
    keychainId,
    connectorId,
    accountRef,
    privateKeyRef,
    gas: estimatedGas,
    credentialType: Web3SigningCredentialType.PRIVATEKEYHEX,
  };

  const res = await api.initialize(request);
  t.equal(res.status, 200, "response status is 200 OK");
  t.ok(res.data, "pluginHtlc.initialize() output is truthy OK");
});

test("Test error initialize endpoint", async (t: Test) => {
  const keychain = new PluginKeychainMemory({
    backend: new Map([
      [accountRef, firstHighNetWorthAccount],
      [privateKeyRef, besuKeyPair.privateKey],
    ]),
    keychainId,
    logLevel,
    instanceId: uuidv4(),
  });

  t.comment("Starting Besu Test Ledger");
  const besuTestLedger = new BesuTestLedger();
  await besuTestLedger.start();

  test.onFinish(async () => {
    await besuTestLedger.stop();
    await besuTestLedger.destroy();
  });

  const rpcApiHttpHost = await besuTestLedger.getRpcApiHttpHost();
  const factory = new PluginFactoryLedgerConnector({
    pluginImportType: PluginImportType.LOCAL,
  });
  const connector: PluginLedgerConnectorBesu = await factory.create({
    rpcApiHttpHost,
    pluginRegistry: new PluginRegistry(),
    instanceId: connectorId,
  });

  const httpServer = createServer();
  await new Promise((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.once("listening", resolve);
    httpServer.listen(0, "127.0.0.1");
  });

  const addressInfo = httpServer.address() as AddressInfo;
  t.comment(`HttpServer AddressInfo: ${JSON.stringify(addressInfo)}`);
  const nodeHost = `http://${addressInfo.address}:${addressInfo.port}`;
  t.comment(`Cactus Node Host: ${nodeHost}`);

  const configService = new ConfigService();
  const apiServerOptions = configService.newExampleConfig();

  const pluginRegistry = new PluginRegistry({});
  pluginRegistry.add(keychain);
  pluginRegistry.add(connector);
  const pluginOptions: IPluginHtlcEthBesuOptions = {
    instanceId: uuidv4(),
    logLevel,
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
    basePath: nodeHost,
  });
  t.comment("Setting configuration");

  const api = new DefaultApi(configuration);
  t.comment("Api generated");

  const request: InitializeReq = {
    keychainId: "fakeId",
    connectorId,
    accountRef,
    privateKeyRef,
    gas: estimatedGas,
    credentialType: Web3SigningCredentialType.PRIVATEKEYHEX,
  };
  try {
    const res = await api.initialize(request);
    t.equal(res.status, 500, "response status is 500");
  } catch (error) {
    t.equal(error.response.status, 500, "response status is 500");
  }
});
