import { Express, Request, Response } from "express";
import {
  Checks,
  Logger,
  LoggerProvider,
  LogLevelDesc,
} from "@hyperledger/cactus-common";
import {
  IExpressRequestHandler,
  IWebServiceEndpoint,
} from "@hyperledger/cactus-core-api";
import { registerWebServiceEndpoint } from "@hyperledger/cactus-core";
import OAS from "../../json/openapi.json";

import {
  InitializeReq,
  Web3SigningCredentialType,
} from "../generated/openapi/typescript-axios";
import { PluginHtlcEthBesu } from "../plugin-htlc-eth-besu";

export interface IInitializeEndpointOptions {
  logLevel?: LogLevelDesc;
  pluginRegistry: PluginHtlcEthBesu;
}

export class InitializeEndpoint implements IWebServiceEndpoint {
  public static readonly CLASS_NAME = "InitializeEndpoint";
  private readonly log: Logger;
  private readonly estimatedGas = 6721975;

  constructor(public readonly options: IInitializeEndpointOptions) {
    const fnTag = `${this.className}#constructor()`;
    Checks.truthy(options, `${fnTag} arg options`);
    const level = this.options.logLevel || "INFO";
    const label = this.className;
    this.log = LoggerProvider.getOrCreate({ level, label });
  }

  public get className(): string {
    return InitializeEndpoint.CLASS_NAME;
  }

  public getOASPath() {
    return OAS.paths[
      "/api/v1/plugins/@hyperledger/cactus-plugin-htlc-eth-besu/initialize"
    ];
  }

  public getVerbLowerCase(): string {
    const apiPath = this.getOASPath();
    return apiPath.post["x-hyperledger-cactus"].http.verbLowerCase;
  }

  public getPath(): string {
    const apiPath = this.getOASPath();
    return apiPath.post["x-hyperledger-cactus"].http.path;
  }

  public getOperationId(): string {
    return this.getOASPath().post.operationId;
  }

  public registerExpress(expressApp: Express): IWebServiceEndpoint {
    registerWebServiceEndpoint(expressApp, this);
    return this;
  }

  public getExpressRequestHandler(): IExpressRequestHandler {
    return this.handleRequest.bind(this);
  }

  public async handleRequest(req: Request, res: Response): Promise<void> {
    const fnTag = "InitializeEndpoint#handleRequest()";
    this.log.debug(`POST ${this.getPath()}`);
    try {
      const request: InitializeReq = req.body as InitializeReq;
      const result = await this.options.pluginRegistry.initialize(
        request.keychainId,
        request.accountRef,
        request.privateKeyRef,
        request.gas || this.estimatedGas,
        request.credentialType as Web3SigningCredentialType,
        request.connectorId,
      );

      res.send(result);
    } catch (ex) {
      this.log.error(`${fnTag} failed to serve request`, ex);
      res.status(500).json({
        message: "Internal Server Error",
        error: ex?.stack || ex?.message,
      });
    }
  }
}
