import { Optional } from "typescript-optional";
import {
  Logger,
  Checks,
  LogLevelDesc,
  LoggerProvider,
} from "@hyperledger/cactus-common";
import {
  ICactusPlugin,
  IPluginWebService,
  IWebServiceEndpoint,
  PluginAspect,
} from "@hyperledger/cactus-core-api";
import { PluginRegistry } from "@hyperledger/cactus-core";
import {
  DefaultApi as QuorumApi,
  Web3SigningCredential,
} from "@hyperledger/cactus-plugin-ledger-connector-quorum";
import { DefaultApi as BesuApi } from "@hyperledger/cactus-plugin-ledger-connector-besu";
import { InsertBambooHarvestEndpoint } from "./web-services/insert-bamboo-harvest-endpoint";
import { DefaultApi as FabricApi } from "@hyperledger/cactus-plugin-ledger-connector-fabric";
import { ListBambooHarvestEndpoint } from "./web-services/list-bamboo-harvest-endpoint";
import { ISupplyChainContractDeploymentInfo } from "../i-supply-chain-contract-deployment-info";
import { InsertBookshelfEndpoint } from "./web-services/insert-bookshelf-endpoint";
import { ListBookshelfEndpoint } from "./web-services/list-bookshelf-endpoint";
import { InsertShipmentEndpoint } from "./web-services/insert-shipment-endpoint";
import { ListShipmentEndpoint } from "./web-services/list-shipment-endpoint";

export interface OrgEnv {
  CORE_PEER_LOCALMSPID: string;
  CORE_PEER_ADDRESS: string;
  CORE_PEER_MSPCONFIGPATH: string;
  CORE_PEER_TLS_ROOTCERT_FILE: string;
  ORDERER_TLS_ROOTCERT_FILE: string;
}

export interface ISupplyChainCactusPluginOptions {
  logLevel?: LogLevelDesc;
  instanceId: string;
  quorumApiClient: QuorumApi;
  besuApiClient: BesuApi;
  fabricApiClient: FabricApi;
  web3SigningCredential?: Web3SigningCredential;
  fabricEnviroment?: NodeJS.ProcessEnv;
  contracts: ISupplyChainContractDeploymentInfo;
  pluginRegistry: PluginRegistry;
}

export class SupplyChainCactusPlugin
  implements ICactusPlugin, IPluginWebService {
  public static readonly CLASS_NAME = "SupplyChainCactusPlugin";

  private readonly log: Logger;
  private readonly instanceId: string;
  private readonly pluginRegistry: PluginRegistry;
  public get className() {
    return SupplyChainCactusPlugin.CLASS_NAME;
  }

  constructor(public readonly options: ISupplyChainCactusPluginOptions) {
    const fnTag = `${this.className}#constructor()`;

    Checks.truthy(options, `${fnTag} arg options`);
    Checks.truthy(options.instanceId, `${fnTag} arg options.instanceId`);
    Checks.nonBlankString(options.instanceId, `${fnTag} options.instanceId`);
    Checks.truthy(
      options.pluginRegistry,
      `${fnTag} arg options.pluginRegistry`,
    );
    Checks.truthy(options.contracts, `${fnTag} arg options.contracts`);
    /*   Checks.truthy(
      options.web3SigningCredential,
      `${fnTag} arg options.web3SigningCredential`,
    );*/
    Checks.truthy(
      options.quorumApiClient,
      `${fnTag} arg options.quorumApiClient`,
    );

    const level = this.options.logLevel || "INFO";
    const label = this.className;
    this.log = LoggerProvider.getOrCreate({ level, label });
    this.instanceId = options.instanceId;
    this.pluginRegistry = this.options.pluginRegistry;
  }

  public async installWebServices(
    expressApp: any,
  ): Promise<IWebServiceEndpoint[]> {
    const insertBambooHarvest = new InsertBambooHarvestEndpoint({
      contractAddress: this.options.contracts.bambooHarvestRepository.address,
      contractAbi: this.options.contracts.bambooHarvestRepository.abi,
      apiClient: this.options.quorumApiClient,
      web3SigningCredential: this.options
        .web3SigningCredential as Web3SigningCredential,
      logLevel: this.options.logLevel,
    });
    insertBambooHarvest.registerExpress(expressApp);

    const listBambooHarvest = new ListBambooHarvestEndpoint({
      contractAddress: this.options.contracts.bambooHarvestRepository.address,
      contractAbi: this.options.contracts.bambooHarvestRepository.abi,
      apiClient: this.options.quorumApiClient,
      logLevel: this.options.logLevel,
    });
    listBambooHarvest.registerExpress(expressApp);

    const insertBookshelf = new InsertBookshelfEndpoint({
      contractAddress: this.options.contracts.bookshelfRepository.address,
      contractAbi: this.options.contracts.bookshelfRepository.abi,
      besuApi: this.options.besuApiClient,
      web3SigningCredential: this.options
        .web3SigningCredential as Web3SigningCredential,
      logLevel: this.options.logLevel,
    });
    insertBookshelf.registerExpress(expressApp);

    const listBookshelf = new ListBookshelfEndpoint({
      contractAddress: this.options.contracts.bookshelfRepository.address,
      contractAbi: this.options.contracts.bookshelfRepository.abi,
      besuApi: this.options.besuApiClient,
      logLevel: this.options.logLevel,
    });
    listBookshelf.registerExpress(expressApp);

    const insertShipment = new InsertShipmentEndpoint({
      logLevel: this.options.logLevel,
      pluginRegistry: this.options.pluginRegistry,
      fabricApi: this.options.fabricApiClient,
    });
    insertShipment.registerExpress(expressApp);

    const listShipment = new ListShipmentEndpoint({
      logLevel: this.options.logLevel,
      pluginRegistry: this.options.pluginRegistry,
      fabricApi: this.options.fabricApiClient,
    });

    listShipment.registerExpress(expressApp);
    return [
      insertBambooHarvest,
      listBambooHarvest,
      insertBookshelf,
      listBookshelf,
      insertShipment,
      listShipment,
    ];
  }

  public getHttpServer(): Optional<any> {
    return Optional.empty();
  }

  public async shutdown(): Promise<void> {
    this.log.info(`Shutting down ${this.className}...`);
  }

  public getInstanceId(): string {
    return this.instanceId;
  }

  public getPackageName(): string {
    return "@hyperledger/cactus-example-supply-chain-backend";
  }

  public getAspect(): PluginAspect {
    return PluginAspect.WEB_SERVICE;
  }
}
