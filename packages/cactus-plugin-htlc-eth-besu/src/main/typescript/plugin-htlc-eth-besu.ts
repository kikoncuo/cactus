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

import { GetSingleStatusEndpoint } from "./web-services/get-single-status-endpoint";
import { GetStatusEndpoint } from "./web-services/get-status-endpoint";
import { NewContractEndpoint } from "./web-services/new-contract-endpoint";
import { RefundEndpoint } from "./web-services/refund-endpoint";
import { WithdrawEndpoint } from "./web-services/withdraw-endpoint";
import { InitializeEndpoint } from "./web-services/initialize-endpoint";
import {
  EthContractInvocationType,
  InvokeContractV1Response,
  PluginLedgerConnectorBesu,
  RunTransactionResponse,
  Web3SigningCredentialType,
} from "@hyperledger/cactus-plugin-ledger-connector-besu";

import HashTimeLockJson from "../contracts/build/contracts/HashTimeLock.json";
import { PluginRegistry } from "@hyperledger/cactus-core";
import {
  RefundReq,
  WithdrawReq,
  NewContractObj,
} from "./generated/openapi/typescript-axios";
export interface IPluginHtlcEthBesuOptions extends ICactusPluginOptions {
  logLevel?: LogLevelDesc;
  instanceId: string;
  pluginRegistry: PluginRegistry;
}
export class PluginHtlcEthBesu implements ICactusPlugin, IPluginWebService {
  public static readonly CLASS_NAME = "PluginHtlcEthBesu";
  private readonly instanceId: string;
  private readonly pluginRegistry: PluginRegistry;
  private readonly estimatedGas = 6721975; //4100500
  private readonly connectorPackageName =
    "@hyperledger/cactus-plugin-ledger-connector-besu";

  public get className(): string {
    return PluginHtlcEthBesu.CLASS_NAME;
  }

  constructor(public readonly opts: IPluginHtlcEthBesuOptions) {
    const fnTag = `${this.className}#constructor()`;
    Checks.truthy(opts, `${fnTag} opts`);
    Checks.truthy(opts.instanceId, `${fnTag} opts.instanceId`);
    Checks.truthy(opts.pluginRegistry, `${fnTag} opts.pluginRegistry`);
    Checks.nonBlankString(opts.instanceId, `${fnTag} opts.instanceId`);

    this.instanceId = opts.instanceId;
    this.pluginRegistry = opts.pluginRegistry;
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
    return "@hyperledger/cactus-plugin-htlc-eth-besu";
  }

  public getAspect(): PluginAspect {
    return PluginAspect.HTLC;
  }

  public async installWebServices(
    expressApp: Express,
  ): Promise<IWebServiceEndpoint[]> {
    const endpoints: IWebServiceEndpoint[] = [];
    {
      const endpoint = new GetSingleStatusEndpoint({
        logLevel: this.opts.logLevel,
        pluginRegistry: this,
      });
      endpoint.registerExpress(expressApp);
      endpoints.push(endpoint);
    }
    {
      const endpoint = new GetStatusEndpoint({
        logLevel: this.opts.logLevel,
        pluginRegistry: this,
      });
      endpoint.registerExpress(expressApp);
      endpoints.push(endpoint);
    }
    {
      const endpoint = new NewContractEndpoint({
        logLevel: this.opts.logLevel,
        pluginRegistry: this,
      });
      endpoint.registerExpress(expressApp);
      endpoints.push(endpoint);
    }
    {
      const endpoint = new RefundEndpoint({
        logLevel: this.opts.logLevel,
        pluginRegistry: this,
      });
      endpoint.registerExpress(expressApp);
      endpoints.push(endpoint);
    }
    {
      const endpoint = new WithdrawEndpoint({
        logLevel: this.opts.logLevel,
        pluginRegistry: this,
      });
      endpoint.registerExpress(expressApp);
      endpoints.push(endpoint);
    }
    {
      const endpoint = new InitializeEndpoint({
        logLevel: this.opts.logLevel,
        pluginRegistry: this,
      });
      endpoint.registerExpress(expressApp);
      endpoints.push(endpoint);
    }
    return endpoints;
  }

  public async initialize(
    keychainId: string,
    accountRef: string,
    privateKeyRef: string,
    gas: number,
    type: Web3SigningCredentialType,
    connectorId: string,
  ): Promise<RunTransactionResponse> {
    const keychain = this.pluginRegistry.findOneByKeychainId(keychainId);
    const connector = this.pluginRegistry.plugins.find(
      (plugin) => plugin.getInstanceId() == connectorId,
    ) as PluginLedgerConnectorBesu;

    const hashedTimeLockResponse = await connector.deployContract({
      web3SigningCredential: {
        ethAccount: await keychain.get(accountRef),
        secret: await keychain.get(privateKeyRef),
        type: type,
      },
      bytecode: HashTimeLockJson.bytecode,
      gas: gas | this.estimatedGas,
    });
    return hashedTimeLockResponse;
  }

  public async newContract(
    newContractRequest: NewContractObj,
  ): Promise<InvokeContractV1Response> {
    const params = [
      newContractRequest.outputAmount,
      newContractRequest.expiration,
      newContractRequest.hashLock,
      newContractRequest.receiver,
      newContractRequest.outputNetwork,
      newContractRequest.outputAddress,
    ];

    const keychain = this.pluginRegistry.findOneByKeychainId(
      newContractRequest.keychainId,
    );
    const connector = this.pluginRegistry.plugins.find(
      (plugin) => plugin.getInstanceId() == newContractRequest.connectorId,
    ) as PluginLedgerConnectorBesu;

    const result = await connector.invokeContract({
      contractAbi: HashTimeLockJson.abi,
      contractAddress: newContractRequest.contractAddress,
      invocationType: EthContractInvocationType.SEND,
      methodName: "newContract",
      params,
      web3SigningCredential: {
        ethAccount: await keychain.get(newContractRequest.accountRef),
        type: newContractRequest.credentialType as Web3SigningCredentialType,
        secret: await keychain.get(newContractRequest.privateKeyRef),
      },
      gas: newContractRequest.gas || this.estimatedGas,
      value: newContractRequest.inputAmount,
    });
    return result;
  }

  public async getSingleStatus(
    id: string,
    contractAddress: string,
    keychainId: string,
    connectorId: string,
    accountRef: string,
    privateKeyRef: string,
    type: Web3SigningCredentialType,
  ): Promise<InvokeContractV1Response> {
    const keychain = this.pluginRegistry.findOneByKeychainId(keychainId);
    const connector = this.pluginRegistry.plugins.find(
      (plugin) => plugin.getInstanceId() == connectorId,
    ) as PluginLedgerConnectorBesu;

    const result = await connector.invokeContract({
      contractAbi: HashTimeLockJson.abi,
      contractAddress: contractAddress,
      invocationType: EthContractInvocationType.CALL,
      methodName: "getSingleStatus",
      params: [id],
      web3SigningCredential: {
        ethAccount: await keychain.get(accountRef),
        type: type as Web3SigningCredentialType,
        secret: await keychain.get(privateKeyRef),
      },
    });
    return result;
  }

  public async getStatus(
    ids: string[],
    contractAddress: string,
    keychainId: string,
    connectorId: string,
    accountRef: string,
    privateKeyRef: string,
    type: Web3SigningCredentialType,
  ): Promise<InvokeContractV1Response> {
    const keychain = this.pluginRegistry.findOneByKeychainId(keychainId);
    const connector = this.pluginRegistry.plugins.find(
      (plugin) => plugin.getInstanceId() == connectorId,
    ) as PluginLedgerConnectorBesu;

    const result = await connector.invokeContract({
      contractAbi: HashTimeLockJson.abi,
      contractAddress: contractAddress,
      invocationType: EthContractInvocationType.CALL,
      methodName: "getStatus",
      params: [ids],
      web3SigningCredential: {
        ethAccount: await keychain.get(accountRef),
        type: type as Web3SigningCredentialType,
        secret: await keychain.get(privateKeyRef),
      },
    });
    return result;
  }

  public async refund(
    id: string,
    refundRequest: RefundReq,
  ): Promise<InvokeContractV1Response> {
    const keychain = this.pluginRegistry.findOneByKeychainId(
      refundRequest.keychainId,
    );
    const connector = this.pluginRegistry.plugins.find(
      (plugin) => plugin.getInstanceId() == refundRequest.connectorId,
    ) as PluginLedgerConnectorBesu;

    const result = await connector.invokeContract({
      contractAbi: HashTimeLockJson.abi,
      contractAddress: refundRequest.contractAddress,
      invocationType: EthContractInvocationType.SEND,
      methodName: "refund",
      params: [id],
      web3SigningCredential: {
        ethAccount: await keychain.get(refundRequest.accountRef),
        type: refundRequest.credentialType as Web3SigningCredentialType,
        secret: await keychain.get(refundRequest.privateKeyRef),
      },
      gas: refundRequest.gas || this.estimatedGas,
    });
    return result;
  }

  public async withdraw(
    withdrawRequest: WithdrawReq,
  ): Promise<InvokeContractV1Response> {
    const keychain = this.pluginRegistry.findOneByKeychainId(
      withdrawRequest.keychainId,
    );
    const connector = this.pluginRegistry.plugins.find(
      (plugin) => plugin.getInstanceId() == withdrawRequest.connectorId,
    ) as PluginLedgerConnectorBesu;

    const params = [withdrawRequest.id, withdrawRequest.secret];
    const result = await connector.invokeContract({
      contractAbi: HashTimeLockJson.abi,
      contractAddress: withdrawRequest.contractAddress,
      invocationType: EthContractInvocationType.SEND,
      methodName: "withdraw",
      params,
      web3SigningCredential: {
        ethAccount: await keychain.get(withdrawRequest.accountRef),
        type: withdrawRequest.credentialType as Web3SigningCredentialType,
        secret: await keychain.get(withdrawRequest.privateKeyRef),
      },
      gas: withdrawRequest.gas || this.estimatedGas,
    });
    return result;
  }
}
