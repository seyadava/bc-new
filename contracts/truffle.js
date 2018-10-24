require('babel-register')({
  ignore: /node_modules\/(?!zeppelin-solidity)/
});
require('babel-polyfill')

module.exports = {
  solc: { optimizer: { enabled: true, runs: 200 } },
  networks: {
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*", // Match any network id
      gas: 10000000, // The amount of gas to use to for each transaction
      from: "0x627306090abaB3A6e1400e9345bC60c78a8BEf57",
    }
  }
};
