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
import { PluginHtlcEthBesu } from "../plugin-htlc-eth-besu";
import { Web3SigningCredentialType } from "../generated/openapi/typescript-axios";
import OAS from "../../json/openapi.json";

export interface IGetSingleStatusEndpointOptions {
  logLevel?: LogLevelDesc;
  pluginRegistry: PluginHtlcEthBesu;
}
export class GetSingleStatusEndpoint implements IWebServiceEndpoint {
  public static readonly CLASS_NAME = "GetSingleStatusEndpoint";
  private readonly log: Logger;

  public get className(): string {
    return GetSingleStatusEndpoint.CLASS_NAME;
  }

  constructor(public readonly options: IGetSingleStatusEndpointOptions) {
    const fnTag = `${this.className}#constructor()`;
    Checks.truthy(options, `${fnTag} arg options`);
    const level = this.options.logLevel || "INFO";
    const label = this.className;
    this.log = LoggerProvider.getOrCreate({ level, label });
  }

  public getOASPath() {
    return OAS.paths[
      "/api/v1/plugins/@hyperledger/cactus-plugin-htlc-eth-besu/get-single-status/{id}"
    ];
  }

  public getVerbLowerCase(): string {
    const apiPath = this.getOASPath();
    return apiPath.get["x-hyperledger-cactus"].http.verbLowerCase;
  }

  public getPath(): string {
    const apiPath = this.getOASPath();
    return apiPath.get["x-hyperledger-cactus"].http.path;
  }

  public getOperationId(): string {
    return this.getOASPath().get.operationId;
  }

  public registerExpress(expressApp: Express): IWebServiceEndpoint {
    registerWebServiceEndpoint(expressApp, this);
    return this;
  }

  public getExpressRequestHandler(): IExpressRequestHandler {
    return this.handleRequest.bind(this);
  }

  public async handleRequest(req: Request, res: Response): Promise<void> {
    const fnTag = "GetSingleStatusEndpoint#handleRequest()";
    this.log.debug(`GET ${this.getPath()}`);
    try {
      const id = req.params.id;
      const contractAddress = req.query["contractAddress"];
      const keychainId = req.query["keychainId"];
      const type = req.query["credentialType"];
      const connectorId = req.query["connectorId"];
      const accountRef = req.query["accountRef"];
      const privateKeyRef = req.query["privateKeyRef"];

      const { callOutput } = await this.options.pluginRegistry.getSingleStatus(
        id as string,
        contractAddress as string,
        keychainId as string,
        connectorId as string,
        accountRef as string,
        privateKeyRef as string,
        type as Web3SigningCredentialType,
      );
      res.send(callOutput);
    } catch (ex) {
      this.log.error(`${fnTag} failed to serve request`, ex);
      res.status(500).json({
        message: "Internal Server Error",
        error: ex?.stack || ex?.message,
      });
    }
  }
}
