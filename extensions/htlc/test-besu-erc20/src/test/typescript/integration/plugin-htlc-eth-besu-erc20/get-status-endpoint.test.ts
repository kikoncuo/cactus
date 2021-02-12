import test, { Test } from "tape";
import { v4 as uuidv4 } from "uuid";
import { createServer } from "http";
import { AddressInfo } from "net";
import Web3 from "web3";
import {
  Configuration,
  DefaultApi,
  InitializeRequest,
  IPluginHtlcEthBesuErc20Options,
  NewContractRequest,
  PluginFactoryHtlcEthBesuErc20,
  Web3SigningCredential,
} from "@hyperledger/cactus-plugin-htlc-eth-besu-erc20";
import {
  EthContractInvocationType,
  PluginFactoryLedgerConnector,
  PluginLedgerConnectorBesu,
  Web3SigningCredentialType,
} from "@hyperledger/cactus-plugin-ledger-connector-besu";
import { ApiServer, ConfigService } from "@hyperledger/cactus-cmd-api-server";
import { LogLevelDesc } from "@hyperledger/cactus-common";
import { PluginRegistry } from "@hyperledger/cactus-core";
import { PluginImportType } from "@hyperledger/cactus-core-api";
import { BesuTestLedger } from "@hyperledger/cactus-test-tooling";
import TestTokenJSON from "../../../solidity/token-erc20-contract/Test_Token.json";
import DemoHelperJSON from "../../../solidity/token-erc20-contract/DemoHelpers.json";

const logLevel: LogLevelDesc = "INFO";
const estimatedGas = 6721975;
const expiration = 2147483648;
const receiver = "0x627306090abaB3A6e1400e9345bC60c78a8BEf57";
const hashLock =
  "0x3c335ba7f06a8b01d0596589f73c19069e21c81e5013b91f408165d1bf623d32";
const firstHighNetWorthAccount = "0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1";
const privateKey =
  "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d";
const connectorId = uuidv4();
const web3SigningCredential: Web3SigningCredential = {
  ethAccount: firstHighNetWorthAccount,
  secret: privateKey,
  type: Web3SigningCredentialType.PRIVATEKEYHEX,
} as Web3SigningCredential;

test("Test get status", async (t: Test) => {
  t.comment("Starting Besu Test Ledger");
  const besuTestLedger = new BesuTestLedger();
  await besuTestLedger.start();

  test.onFinish(async () => {
    await besuTestLedger.stop();
    await besuTestLedger.destroy();
  });

  const rpcApiHttpHost = await besuTestLedger.getRpcApiHttpHost();

  const web3 = new Web3(rpcApiHttpHost);
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
  const initRequest: InitializeRequest = {
    connectorId,
    web3SigningCredential,
    gas: estimatedGas,
  };
  const deployOut = await pluginHtlc.initialize(initRequest);

  t.ok(deployOut, "pluginHtlc.initialize() output is truthy OK");
  t.ok(
    deployOut.transactionReceipt,
    "pluginHtlc.initialize() output.transactionReceipt is truthy OK",
  );
  t.ok(
    deployOut.transactionReceipt.contractAddress,
    "pluginHtlc.initialize() output.transactionReceipt.contractAddress is truthy OK",
  );
  const hashTimeLockAddress = deployOut.transactionReceipt
    .contractAddress as string;

  t.comment("Deploys TestToken via .json file on deployContract function");
  const encodedParameters = web3.eth.abi.encodeParameters(
    ["uint256", "string", "uint8", "string"],
    [100, "token", 2, "TKN"],
  );
  const deployOutToken = await connector.deployContract({
    web3SigningCredential,
    bytecode: TestTokenJSON.bytecode + encodedParameters.slice(2),
    gas: estimatedGas,
  });
  t.ok(deployOutToken, "deployContract() output is truthy OK");
  t.ok(
    deployOutToken.transactionReceipt,
    "deployContract() output.transactionReceipt is truthy OK",
  );
  t.ok(
    deployOutToken.transactionReceipt.contractAddress,
    "deployContract() output.transactionReceipt.contractAddress is truthy OK",
  );
  const tokenAddress = deployOutToken.transactionReceipt
    .contractAddress as string;

  t.comment("Deploys DemoHelpers via .json file on deployContract function");
  const deployOutDemo = await connector.deployContract({
    web3SigningCredential,
    bytecode: DemoHelperJSON.bytecode,
    gas: estimatedGas,
  });
  t.ok(deployOutDemo, "deployContract() output is truthy OK");
  t.ok(
    deployOutDemo.transactionReceipt,
    "deployContract() output.transactionReceipt is truthy OK",
  );
  t.ok(
    deployOutDemo.transactionReceipt.contractAddress,
    "deployContract() output.transactionReceipt.contractAddress is truthy OK",
  );
  const demoHelpersAddress = deployOutDemo.transactionReceipt
    .contractAddress as string;

  t.comment("Approve 10 Tokens to HashTimeLockAddress");
  const { transactionReceipt } = await connector.invokeContract({
    contractAbi: TestTokenJSON.abi,
    contractAddress: tokenAddress as string,
    invocationType: EthContractInvocationType.SEND,
    methodName: "approve",
    params: [hashTimeLockAddress, "10"],
    web3SigningCredential,
    gas: estimatedGas,
  });
  t.equal(
    transactionReceipt?.status,
    true,
    "approve() transactionReceipt.status is true OK",
  );

  t.comment("Get balance of account");
  const { callOutput } = await connector.invokeContract({
    contractAbi: TestTokenJSON.abi,
    contractAddress: tokenAddress as string,
    invocationType: EthContractInvocationType.CALL,
    methodName: "balanceOf",
    params: [firstHighNetWorthAccount],
    web3SigningCredential,
    gas: estimatedGas,
  });
  t.equal(callOutput, "100", "balance of account is 100 OK");

  t.comment("Get HashTimeLock contract and account allowance");
  const responseAllowance = await connector.invokeContract({
    contractAbi: TestTokenJSON.abi,
    contractAddress: tokenAddress as string,
    invocationType: EthContractInvocationType.CALL,
    methodName: "allowance",
    params: [firstHighNetWorthAccount, hashTimeLockAddress],
    web3SigningCredential,
    gas: estimatedGas,
  });
  t.equal(responseAllowance.callOutput, "10", "callOutput() is 10 OK");

  t.comment("Create new contract for HTLC");
  const request: NewContractRequest = {
    contractAddress: hashTimeLockAddress,
    inputAmount: 10,
    outputAmount: 1,
    expiration,
    hashLock,
    tokenAddress,
    receiver,
    outputNetwork: "BTC",
    outputAddress: "1AcVYm7M3kkJQH28FXAvyBFQzFRL6xPKu8",
    connectorId,
    web3SigningCredential,
    gas: estimatedGas,
  };
  const responseNewContract = await api.newContract(request);
  t.equal(responseNewContract.status, 200, "response status is 200 OK");

  t.comment("Get status of HTLC");
  const responseTxId = await connector.invokeContract({
    contractAbi: DemoHelperJSON.abi,
    contractAddress: demoHelpersAddress as string,
    invocationType: EthContractInvocationType.CALL,
    methodName: "getTxId",
    params: [
      firstHighNetWorthAccount,
      receiver,
      10,
      hashLock,
      expiration,
      tokenAddress,
    ],
    web3SigningCredential,
    gas: estimatedGas,
  });
  const ids = [responseTxId.callOutput as string];
  const res = await api.getStatus(
    ids,
    hashTimeLockAddress,
    web3SigningCredential,
    connectorId,
  );
  t.equal(res.status, 200, "response status is 200 OK");
  t.equal(res.data[0], "1", "the contract status is 1 - Active");
});

test("Test get invalid id status", async (t: Test) => {
  t.comment("Starting Besu Test Ledger");
  const besuTestLedger = new BesuTestLedger();
  await besuTestLedger.start();

  test.onFinish(async () => {
    await besuTestLedger.stop();
    await besuTestLedger.destroy();
  });

  const rpcApiHttpHost = await besuTestLedger.getRpcApiHttpHost();

  const web3 = new Web3(rpcApiHttpHost);
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
  const initRequest: InitializeRequest = {
    connectorId,
    web3SigningCredential,
    gas: estimatedGas,
  };
  const deployOut = await pluginHtlc.initialize(initRequest);
  t.ok(deployOut, "pluginHtlc.initialize() output is truthy OK");
  t.ok(
    deployOut.transactionReceipt,
    "pluginHtlc.initialize() output.transactionReceipt is truthy OK",
  );
  t.ok(
    deployOut.transactionReceipt.contractAddress,
    "pluginHtlc.initialize() output.transactionReceipt.contractAddress is truthy OK",
  );
  const hashTimeLockAddress = deployOut.transactionReceipt
    .contractAddress as string;

  t.comment("Deploys TestToken via .json file on deployContract function");
  const encodedParameters = web3.eth.abi.encodeParameters(
    ["uint256", "string", "uint8", "string"],
    [100, "token", 2, "TKN"],
  );
  const deployOutToken = await connector.deployContract({
    web3SigningCredential,
    bytecode: TestTokenJSON.bytecode + encodedParameters.slice(2),
    gas: estimatedGas,
  });
  t.ok(deployOutToken, "deployContract() output is truthy OK");
  t.ok(
    deployOutToken.transactionReceipt,
    "deployContract() output.transactionReceipt is truthy OK",
  );
  t.ok(
    deployOutToken.transactionReceipt.contractAddress,
    "deployContract() output.transactionReceipt.contractAddress is truthy OK",
  );
  const tokenAddress = deployOutToken.transactionReceipt
    .contractAddress as string;

  t.comment("Approve 10 Tokens to HashTimeLockAddress");
  const { transactionReceipt } = await connector.invokeContract({
    contractAbi: TestTokenJSON.abi,
    contractAddress: tokenAddress as string,
    invocationType: EthContractInvocationType.SEND,
    methodName: "approve",
    params: [hashTimeLockAddress, "10"],
    web3SigningCredential,
    gas: estimatedGas,
  });
  t.equal(
    transactionReceipt?.status,
    true,
    "approve() transactionReceipt.status is true OK",
  );

  t.comment("Get balance of account");
  const { callOutput } = await connector.invokeContract({
    contractAbi: TestTokenJSON.abi,
    contractAddress: tokenAddress as string,
    invocationType: EthContractInvocationType.CALL,
    methodName: "balanceOf",
    params: [firstHighNetWorthAccount],
    web3SigningCredential,
    gas: estimatedGas,
  });
  t.equal(callOutput, "100", "balance of account is 100 OK");

  t.comment("Get HashTimeLock contract and account allowance");
  const responseAllowance = await connector.invokeContract({
    contractAbi: TestTokenJSON.abi,
    contractAddress: tokenAddress as string,
    invocationType: EthContractInvocationType.CALL,
    methodName: "allowance",
    params: [firstHighNetWorthAccount, hashTimeLockAddress],
    web3SigningCredential,
    gas: estimatedGas,
  });
  t.equal(responseAllowance.callOutput, "10", "callOutput() is 10 OK");

  t.comment("Create new contract for HTLC");
  const request: NewContractRequest = {
    contractAddress: hashTimeLockAddress,
    inputAmount: 10,
    outputAmount: 1,
    expiration,
    hashLock,
    tokenAddress,
    receiver,
    outputNetwork: "BTC",
    outputAddress: "1AcVYm7M3kkJQH28FXAvyBFQzFRL6xPKu8",
    connectorId,
    web3SigningCredential,
    gas: estimatedGas,
  };
  const responseNewContract = await api.newContract(request);
  t.equal(responseNewContract.status, 200, "response status is 200 OK");

  t.comment("Get invalid status of HTLC");
  try {
    const res = await api.getStatus(
      ["fakeId"],
      hashTimeLockAddress,
      web3SigningCredential,
      connectorId,
    );
    t.equal(res.status, 400, "response status is 400");
  } catch (error) {
    t.equal(error.response.status, 400, "response status is 400");
  }
});
