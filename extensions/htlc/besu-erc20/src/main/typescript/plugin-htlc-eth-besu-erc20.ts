import { Server } from "http";
import { Server as SecureServer } from "https";

import { Express } from "express";
import { Optional } from "typescript-optional";

import {
  IPluginWebService,
  ICactusPlugin,
  ICactusPluginOptions,
  IWebServiceEndpoint,
  PluginAspect,
} from "@hyperledger/cactus-core-api";
import { Checks, LogLevelDesc } from "@hyperledger/cactus-common";
import {
  EthContractInvocationType,
  InvokeContractV1Response,
  PluginLedgerConnectorBesu,
  RunTransactionResponse,
  Web3SigningCredential,
} from "@hyperledger/cactus-plugin-ledger-connector-besu";
import { GetSingleStatusEndpoint } from "./web-services/get-single-status-endpoint";
import { GetStatusEndpoint } from "./web-services/get-status-endpoint";
import { NewContractEndpoint } from "./web-services/new-contract-endpoint";
import { RefundEndpoint } from "./web-services/refund-endpoint";
import { WithdrawEndpoint } from "./web-services/withdraw-endpoint";
import { InitializeEndpoint } from "./web-services/initialize-endpoint";
import HashedTimeLockContractJSON from "../solidity/contracts/HashedTimeLockContract.json";
import { PluginRegistry } from "@hyperledger/cactus-core";
import { NewContractRequest } from ".";
import HashTimeLockJSON from "../solidity/contracts/HashedTimeLockContract.json";
import {
  InitializeRequest,
  RefundRequest,
  WithdrawRequest,
} from "./generated/openapi/typescript-axios";

export interface IPluginHtlcEthBesuErc20Options extends ICactusPluginOptions {
  instanceId: string;
  logLevel?: LogLevelDesc;
  pluginRegistry: PluginRegistry;
}
export class PluginHtlcEthBesuErc20
  implements ICactusPlugin, IPluginWebService {
  public static readonly CLASS_NAME = "PluginHtlcEthBesuErc20";
  private readonly instanceId: string;
  private readonly pluginRegistry: PluginRegistry;
  private readonly estimatedGas = 6721975;
  private readonly connectorPackageName =
    "@hyperledger/cactus-plugin-ledger-connector-besu";

  constructor(public readonly opts: IPluginHtlcEthBesuErc20Options) {
    const fnTag = `${this.className}#constructor()`;
    Checks.truthy(opts, `${fnTag} opts`);
    Checks.truthy(opts.instanceId, `${fnTag} opts.instanceId`);
    Checks.truthy(opts.pluginRegistry, `${fnTag} opts.pluginRegistry`);
    Checks.nonBlankString(opts.instanceId, `${fnTag} opts.instanceId`);
    this.instanceId = opts.instanceId;
    this.pluginRegistry = opts.pluginRegistry;
  }

  public get className(): string {
    return PluginHtlcEthBesuErc20.CLASS_NAME;
  }

  /**
   * Feature is deprecated, we won't need this method in the future.
   */
  public getHttpServer(): Optional<Server | SecureServer> {
    return Optional.empty();
  }

  /**
   * Feature is deprecated, we won't need this method in the future.
   */
  public async shutdown(): Promise<void> {
    return;
  }

  public getInstanceId(): string {
    return this.instanceId;
  }

  public getPackageName(): string {
    return "@hyperledger/cactus-plugin-htlc-eth-besu-erc20";
  }

  //FIXME
  public getAspect(): PluginAspect {
    return "HTLC" as PluginAspect;
  }

  public async installWebServices(
    expressApp: Express,
  ): Promise<IWebServiceEndpoint[]> {
    const endpoints: IWebServiceEndpoint[] = [];
    {
      const endpoint = new GetSingleStatusEndpoint({
        logLevel: this.opts.logLevel,
        plugin: this,
      });
      endpoint.registerExpress(expressApp);
      endpoints.push(endpoint);
    }
    {
      const endpoint = new GetStatusEndpoint({
        logLevel: this.opts.logLevel,
        plugin: this,
      });
      endpoint.registerExpress(expressApp);
      endpoints.push(endpoint);
    }
    {
      const endpoint = new NewContractEndpoint({
        logLevel: this.opts.logLevel,
        plugin: this,
      });
      endpoint.registerExpress(expressApp);
      endpoints.push(endpoint);
    }
    {
      const endpoint = new RefundEndpoint({
        logLevel: this.opts.logLevel,
        plugin: this,
      });
      endpoint.registerExpress(expressApp);
      endpoints.push(endpoint);
    }
    {
      const endpoint = new WithdrawEndpoint({
        logLevel: this.opts.logLevel,
        plugin: this,
      });
      endpoint.registerExpress(expressApp);
      endpoints.push(endpoint);
    }
    {
      const endpoint = new InitializeEndpoint({
        logLevel: this.opts.logLevel,
        plugin: this,
      });
      endpoint.registerExpress(expressApp);
      endpoints.push(endpoint);
    }
    return endpoints;
  }

  public async initialize(
    initializeRequest: InitializeRequest,
  ): Promise<RunTransactionResponse> {
    const connector = this.pluginRegistry.plugins.find(
      (plugin) => plugin.getInstanceId() == initializeRequest.connectorId,
    ) as PluginLedgerConnectorBesu;

    const hashedTimeLockResponse = await connector.deployContract({
      web3SigningCredential: initializeRequest.web3SigningCredential,
      bytecode: HashedTimeLockContractJSON.bytecode,
      gas: initializeRequest.gas || this.estimatedGas,
    });
    return hashedTimeLockResponse;
  }

  public async newContract(
    newContractRequest: NewContractRequest,
  ): Promise<InvokeContractV1Response> {
    const params = [
      newContractRequest.inputAmount,
      newContractRequest.outputAmount,
      newContractRequest.expiration,
      newContractRequest.hashLock,
      newContractRequest.tokenAddress,
      newContractRequest.receiver,
      newContractRequest.outputNetwork,
      newContractRequest.outputAddress,
    ];

    const connector = this.pluginRegistry.plugins.find(
      (plugin) => plugin.getInstanceId() == newContractRequest.connectorId,
    ) as PluginLedgerConnectorBesu;

    const result = await connector.invokeContract({
      contractAbi: HashTimeLockJSON.abi,
      contractAddress: newContractRequest.contractAddress,
      invocationType: EthContractInvocationType.SEND,
      methodName: "newContract",
      params,
      web3SigningCredential: newContractRequest.web3SigningCredential,
      gas: newContractRequest.gas || this.estimatedGas,
    });

    return result;
  }

  public async refund(
    refundRequest: RefundRequest,
  ): Promise<InvokeContractV1Response> {
    const connector = this.pluginRegistry.plugins.find(
      (plugin) => plugin.getInstanceId() == refundRequest.connectorId,
    ) as PluginLedgerConnectorBesu;

    const result = await connector.invokeContract({
      contractAbi: HashTimeLockJSON.abi,
      contractAddress: refundRequest.contractAddress,
      invocationType: EthContractInvocationType.SEND,
      methodName: "refund",
      params: [refundRequest.id],
      web3SigningCredential: refundRequest.web3SigningCredential,
      gas: refundRequest.gas || this.estimatedGas,
    });

    return result;
  }

  public async withdraw(
    withdrawRequest: WithdrawRequest,
  ): Promise<InvokeContractV1Response> {
    const connector = this.pluginRegistry.plugins.find(
      (plugin) => plugin.getInstanceId() == withdrawRequest.connectorId,
    ) as PluginLedgerConnectorBesu;
    const params = [withdrawRequest.id, withdrawRequest.secret];
    const result = await connector.invokeContract({
      contractAbi: HashTimeLockJSON.abi,
      contractAddress: withdrawRequest.contractAddress,
      invocationType: EthContractInvocationType.SEND,
      methodName: "withdraw",
      params,
      web3SigningCredential: withdrawRequest.web3SigningCredential,
      gas: withdrawRequest.gas || this.estimatedGas,
    });

    return result;
  }

  public async getSingleStatus(
    id: string,
    contractAddress: string,
    connectorId: string,
    web3SigningCredential: Web3SigningCredential,
  ): Promise<InvokeContractV1Response> {
    const connector = this.pluginRegistry.plugins.find(
      (plugin) => plugin.getInstanceId() == connectorId,
    ) as PluginLedgerConnectorBesu;

    const result = await connector.invokeContract({
      contractAbi: HashTimeLockJSON.abi,
      contractAddress: contractAddress,
      invocationType: EthContractInvocationType.CALL,
      methodName: "getSingleStatus",
      params: [id],
      web3SigningCredential: web3SigningCredential,
    });
    return result;
  }

  public async getStatus(
    ids: string[],
    contractAddress: string,
    connectorId: string,
    web3SigningCredential: Web3SigningCredential,
  ): Promise<InvokeContractV1Response> {
    const connector = this.pluginRegistry.plugins.find(
      (plugin) => plugin.getInstanceId() == connectorId,
    ) as PluginLedgerConnectorBesu;

    const result = await connector.invokeContract({
      contractAbi: HashTimeLockJSON.abi,
      contractAddress: contractAddress,
      invocationType: EthContractInvocationType.CALL,
      methodName: "getStatus",
      params: [ids],
      web3SigningCredential: web3SigningCredential,
    });
    return result;
  }
}
