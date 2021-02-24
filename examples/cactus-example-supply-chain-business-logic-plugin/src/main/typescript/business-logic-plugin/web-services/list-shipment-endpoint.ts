import { Express, Request, Response } from "express";

import {
  Logger,
  Checks,
  LogLevelDesc,
  LoggerProvider,
} from "@hyperledger/cactus-common";
import {
  IExpressRequestHandler,
  IWebServiceEndpoint,
} from "@hyperledger/cactus-core-api";
import {
  PluginRegistry,
  registerWebServiceEndpoint,
} from "@hyperledger/cactus-core";

import { ListShipmentEndpoint as Constants } from "./list-shipment-endpoint-constants";

import {
  DefaultApi as FabricApi,
  FabricContractInvocationType,
} from "@hyperledger/cactus-plugin-ledger-connector-fabric";

export interface IListShipmentEndpointOptions {
  logLevel?: LogLevelDesc;
  pluginRegistry: PluginRegistry;
  fabricApi: FabricApi;
}

export class ListShipmentEndpoint implements IWebServiceEndpoint {
  public static readonly HTTP_PATH = Constants.HTTP_PATH;

  public static readonly HTTP_VERB_LOWER_CASE = Constants.HTTP_VERB_LOWER_CASE;

  public static readonly OPENAPI_OPERATION_ID = Constants.OPENAPI_OPERATION_ID;

  public static readonly CLASS_NAME = "ListShipmentEndpoint";

  private readonly log: Logger;
  private readonly pluginRegistry: PluginRegistry;

  public get className(): string {
    return ListShipmentEndpoint.CLASS_NAME;
  }

  constructor(public readonly opts: IListShipmentEndpointOptions) {
    const fnTag = `${this.className}#constructor()`;
    Checks.truthy(opts, `${fnTag} arg options`);
    Checks.truthy(opts.pluginRegistry, `${fnTag} options.pluginRegistry`);
    Checks.truthy(opts.fabricApi, `${fnTag} options.fabricApi`);
    const level = this.opts.logLevel || "INFO";
    const label = this.className;
    this.log = LoggerProvider.getOrCreate({ level, label });
    this.pluginRegistry = this.opts.pluginRegistry;
  }

  public registerExpress(expressApp: Express): IWebServiceEndpoint {
    registerWebServiceEndpoint(expressApp, this);
    return this;
  }

  public getVerbLowerCase(): string {
    return ListShipmentEndpoint.HTTP_VERB_LOWER_CASE;
  }

  public getPath(): string {
    return ListShipmentEndpoint.HTTP_PATH;
  }

  public getExpressRequestHandler(): IExpressRequestHandler {
    return this.handleRequest.bind(this);
  }

  async handleRequest(req: Request, res: Response): Promise<void> {
    const tag = `${this.getVerbLowerCase().toUpperCase()} ${this.getPath()}`;
    try {
      this.log.debug(`${tag}`);
      const {
        data: { functionOutput },
      } = await this.opts.fabricApi.runTransactionV1({
        keychainId: "PluginKeychainMemory_C",
        keychainRef: "user2",
        channelName: "mychannel",
        chainCodeId: "shipment",
        invocationType: FabricContractInvocationType.CALL,
        functionName: "getListShipment",
        functionArgs: [],
      });
      const output = JSON.parse(functionOutput);
      const body = { data: output };
      res.status(200);
      res.json(body);
    } catch (ex) {
      this.log.debug(`${tag} Failed to serve request:`, ex);
      res.status(500);
      res.json({ error: ex.stack });
    }
  }
}
