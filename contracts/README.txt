How to run validator contract tests on Windows:

In a PowerShell window, navigate to the "/contracts" folder.  The folder that is file resides in.
  1. npm install
  2. npm install -g truffle@4.1.14
  3. npm install -g ganache-cli
  4. ganache-cli -l 0xBEBC200 -g 0 -m "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat"

In another PowerShell window and in the same folder
  1. truffle.cmd test

You may also use the Ganache UI  - https://github.com/trufflesuite/ganache/releases
But you will need to edit the settings.
  Set "Gas Limit" = 50000000, "Gas Price" = 0
  Set "Mnemonic" to "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat"



--------------------

How to build docker image of smart contract compiler and publish to DOCKER_REPOSITORY

$> cd contracts
$> ./build.sh "poadev.azurecr.io" "<docker_login>" "<docker_password>" "poadev.azurecr.io/poa-compile-contract:<version>"

