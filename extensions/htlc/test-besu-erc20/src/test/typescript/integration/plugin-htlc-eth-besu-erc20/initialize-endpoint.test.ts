import test, { Test } from "tape";
import { v4 as uuidv4 } from "uuid";
import { createServer } from "http";
import { AddressInfo } from "net";
import {
  Configuration,
  DefaultApi,
  IPluginHtlcEthBesuErc20Options,
  PluginFactoryHtlcEthBesuErc20,
  InitializeRequest,
} from "@hyperledger/cactus-plugin-htlc-eth-besu-erc20";
import {
  PluginFactoryLedgerConnector,
  PluginLedgerConnectorBesu,
  Web3SigningCredentialType,
} from "@hyperledger/cactus-plugin-ledger-connector-besu";
import { ApiServer, ConfigService } from "@hyperledger/cactus-cmd-api-server";
import { PluginRegistry } from "@hyperledger/cactus-core";
import { PluginImportType } from "@hyperledger/cactus-core-api";
import { BesuTestLedger } from "@hyperledger/cactus-test-tooling";
import { LogLevelDesc } from "@hyperledger/cactus-common";

const logLevel: LogLevelDesc = "INFO";
const estimatedGas = 6721975;
const firstHighNetWorthAccount = "0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1";
const privateKey =
  "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d";
const connectorId = uuidv4();

test("Test initialize function with valid params", async (t: Test) => {
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
  const pluginRegistry = new PluginRegistry({});
  const connector: PluginLedgerConnectorBesu = await factory.create({
    rpcApiHttpHost,
    pluginRegistry,
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

  pluginRegistry.add(connector);
  const pluginOptions: IPluginHtlcEthBesuErc20Options = {
    instanceId: uuidv4(),
    logLevel,
    pluginRegistry,
  };

  const factoryHTLC = new PluginFactoryHtlcEthBesuErc20({
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

  t.comment("Deploys HashTimeLock via .json file on initialize function");
  const request: InitializeRequest = {
    connectorId,
    web3SigningCredential: {
      ethAccount: firstHighNetWorthAccount,
      secret: privateKey,
      type: Web3SigningCredentialType.PRIVATEKEYHEX,
    },
    gas: estimatedGas,
  };

  const res = await api.initialize(request);
  t.equal(res.status, 200, "response status is 200 OK");

  t.ok(res.data, "pluginHtlc.initialize() output is truthy OK");
  t.ok(
    res.data.transactionReceipt,
    "pluginHtlc.initialize() output.transactionReceipt is truthy OK",
  );
  t.ok(
    res.data.transactionReceipt?.contractAddress,
    "pluginHtlc.initialize() output.transactionReceipt.contractAddress is truthy OK",
  );
});

test("Test initialize function with invalid params", async (t: Test) => {
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
  const pluginRegistry = new PluginRegistry({});
  const connector: PluginLedgerConnectorBesu = await factory.create({
    rpcApiHttpHost,
    pluginRegistry,
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

  pluginRegistry.add(connector);
  const pluginOptions: IPluginHtlcEthBesuErc20Options = {
    instanceId: uuidv4(),
    logLevel,
    pluginRegistry,
  };

  const factoryHTLC = new PluginFactoryHtlcEthBesuErc20({
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

  t.comment("Deploys HashTimeLock via .json file on initialize function");
  const request: InitializeRequest = {
    connectorId: "fakeId",
    web3SigningCredential: {
      ethAccount: firstHighNetWorthAccount,
      secret: privateKey,
      type: Web3SigningCredentialType.PRIVATEKEYHEX,
    },
    gas: estimatedGas,
  };
  try {
    const res = await api.initialize(request);
    t.equal(res.status, 400, "response status is 400");
  } catch (error) {
    t.equal(error.response.status, 400, "response status is 400");
  }
});
