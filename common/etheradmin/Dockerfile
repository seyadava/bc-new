FROM node:8.11.1

# Create app directory
WORKDIR /usr/src/app

ENV listenPort ""
ENV consortiumId ""
ENV azureStorageAccount ""
ENV azureStorageAccessKey ""
ENV containerName ""
ENV identityBlobPrefix ""
ENV ethRpcPort ""
ENV validatorListBlobName ""
ENV paritySpecBlobName ""
ENV valSetContractBlobName ""
ENV adminContractBlobName ""
ENV adminContractABIBlobName ""
ENV adminSiteLogFile ""
ENV rpcEndpoint ""

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY client/package*.json ./

RUN npm update
RUN npm install -g
RUN nodejs node_modules/node-sass/scripts/install.js
RUN npm rebuild node-sass

# Bundle app source
COPY . .

COPY client/ /client/

CMD ["sh", "-c", "cd client && node run.js \"${listenPort}\" \"${consortiumId}\" \"${azureStorageAccount}\" \"${azureStorageAccessKey}\" \"${containerName}\" \"${identityBlobPrefix}\" \"${ethRpcPort}\" \"${validatorListBlobName}\" \"${paritySpecBlobName}\" \"${valSetContractBlobName}\" \"${adminContractBlobName}\" \"${adminContractABIBlobName}\" \"${adminSiteLogFile}\" \"${rpcEndpoint}\""]