const log4js = require(`log4js`);
const ConnectorCorda = require(`../corda/connector.js`);
const ConnectorFabric = require(`../fabric/connector.js`);
const Client = require(`@hyperledger-labs/blockchain-integration-framework`).Client;
const conf = require(`./config`);

const logger = log4js.getLogger(`fabric-to-corda`);
logger.level = `info`;
const connectorFabric = new ConnectorFabric(conf.blockchains.fabric);
const connectorCorda = new ConnectorCorda(conf.blockchains.corda);
const fabricFederationClient = new Client({ validators: conf.federations.fabric });
const fabricAsset = conf.assets.fabric;

(async () => {
  try {
    // Step.1 Create asset on Fabric
    const createdAsset = await connectorFabric.createAsset(fabricAsset);
    logger.info(`Asset has been created: ${JSON.stringify(createdAsset)}`);

    // Step.2: Lock asset on Fabric
    const targetDLTId = `CORDA_DLT1`;
    const receiverPubKey = `031b3e4b65070268bd2ce3652966f75ebdf7184f637fd24a4fe0417c2dcb92fd9b`;
    const lockedAsset = await connectorFabric.lockAsset(createdAsset.assetId, targetDLTId, receiverPubKey);
    logger.info(`Asset has been locked: ${JSON.stringify(lockedAsset)}`);

    const targetDLTType = 'CORDA';

    // Step 2.5 (optional): Query the asset on Fabric
    const assetInfo = await connectorFabric.getAsset(lockedAsset.assetId, targetDLTType);
    logger.info(`${targetDLTType} formatted asset has been queried: ${JSON.stringify(assetInfo)}`);

    // Step.3 Ask For Signatures to the Fabric federation
    const multiSignature = await fabricFederationClient.askForSignatures(lockedAsset.assetId, targetDLTType);
    logger.info(`Signatures are:`, JSON.stringify(multiSignature.signatures));

    // Step.4: Verify Signatures on Corda
    const verifications = await connectorCorda.verifyMultisig(multiSignature);
    logger.info(`Signatures have been verified: ${JSON.stringify(verifications)}`);

    // Step.5 (if applicable) Creating a copy of the exported asset on Corda
    const result = await connectorCorda.copyAsset(multiSignature);
    logger.info(`Asset has been copied: ${JSON.stringify(result)}`);

    return;

  } catch (error) {
    logger.info(error);
    process.exit(1);
  }
})();
