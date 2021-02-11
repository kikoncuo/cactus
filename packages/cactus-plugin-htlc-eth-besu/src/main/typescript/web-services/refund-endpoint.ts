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
import { RefundReq } from "../generated/openapi/typescript-axios";
import OAS from "../../json/openapi.json";

export interface IRefundEndpointOptions {
  logLevel?: LogLevelDesc;
  pluginRegistry: PluginHtlcEthBesu;
}
export class RefundEndpoint implements IWebServiceEndpoint {
  public static readonly CLASS_NAME = "RefundEndpoint";
  private readonly log: Logger;
  private readonly estimatedGas = 6721975;

  public get className(): string {
    return RefundEndpoint.CLASS_NAME;
  }

  constructor(public readonly options: IRefundEndpointOptions) {
    const fnTag = `${this.className}#constructor()`;
    Checks.truthy(options, `${fnTag} arg options`);
    const level = this.options.logLevel || "INFO";
    const label = this.className;
    this.log = LoggerProvider.getOrCreate({ level, label });
  }
  public getOASPath() {
    return OAS.paths[
      "/api/v1/plugins/@hyperledger/cactus-plugin-htlc-eth-besu/refund/{id}"
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
    const fnTag = "RefundEndpoint#handleRequest()";
    this.log.debug(`POST ${this.getPath()}`);
    try {
      const id = req.params["id"];
      const request: RefundReq = req.body as RefundReq;

      const result = await this.options.pluginRegistry.refund(id, request);
      this.log.debug(`${fnTag} Result: ${result}`);
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
