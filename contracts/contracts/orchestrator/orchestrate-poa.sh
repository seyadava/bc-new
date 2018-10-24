#!/bin/bash

######################################################################################################
# Orchestrates POA. It generates node identity for validator nodes . It stores passphrarases of
# validator nodes in key vault and create a lease record in azure blob.
#######################################################################################################

# Include utility script
. orchestrate-util.sh

start_parity_devmode_rpc() {
	parity --chain dev --base-path "$DEV_PARITY_DIRECTORY" --jsonrpc-apis "eth,net,web3,personal,parity,parity_accounts" >> "$CONFIG_LOG_FILE_PATH" 2>&1 &
	if [ $? -ne 0 ]; then unsuccessful_exit "Failed to start parity node in dev mode." 25; fi
	echo "===== Started parity in dev mode =====";
	sleep 10;
}


# Shutdown parity process
shutdown_parity()
{
    kill -9 $(ps aux | grep '[p]arity -' | awk '{print $2}');
    # Give time for the process to stop
    sleep 5;
}

####################################################################################
# Parameters : Validate that all arguments are supplied
####################################################################################
if [ $# -lt 14 ]; then unsuccessful_exit "Insufficient parameters supplied." 21; fi

NodeCount=$1
Mode=$2
KEY_VAULT_BASE_URL=$3
STORAGE_ACCOUNT=$4
CONTAINER_NAME=$5
STORAGE_ACCOUNT_KEY=$6
ETH_NETWORK_ID=$7
INITIAL_VALIDATOR_ADMIN_ACCOUNT=$8
CONSORTIUM_DATA_URL=$9
ACCESS_TOKEN=${10}
CONFIG_LOG_FILE_PATH=${11}
DEBUG_MODE=${12}
TRANSACTION_PERMISSION_CONTRACT=${13}
BLOCK_GAS_LIMIT=${14}

# Constants
ADDRESS_LIST="";
ADDRESS_LIST_FOR_CONTRACT="";
NOTRIES=3;
PREFUND_ACCOUNT_ADDRESS=""

DEV_PARITY_DIRECTORY="/tmp/parity";

############################################################################
# Start party in dev mode
############################################################################
start_parity_devmode_rpc

if [ "$DEBUG_MODE" == 'true' ]; then set -x; fi;

#############################################################################################################
# Generate passphrases and addreses. Store passphrases in key vault and upload key vault uri in azure blob
#############################################################################################################
for i in `seq 0 $(($NodeCount - 1))`; do

	passphrase=$(cat /dev/urandom | tr -cd 'a-f0-9' | head -c 32);
	account=$(curl --data '{"jsonrpc":"2.0","method":"parity_newAccountFromPhrase","params":["'$passphrase'", "'$passphrase'"],"id":0}' -H "Content-Type: application/json" -X POST localhost:8545);
	if [ $? -ne 0  ] || [ -z $account ]; then
		unsuccessful_exit "Unable to generate account address from recovery phrase." 22
	fi
	address=$(echo $account | jq -r ".result");

	# Store passphrase in key vault and upload key vault uri to azure blob
	# TODO: Add retry logic on failure to set keyvault secret or upload blob
	passphraseUri=$(set_secret_in_keyvault $KEY_VAULT_BASE_URL "passphrase-$i" $passphrase $ACCESS_TOKEN);
	if [ -z $passphraseUri ]; then
		unsuccessful_exit "Unable to set a secret for passphrase in azure KeyVault." 23;
	fi
	upload_uri_to_blob $STORAGE_ACCOUNT $CONTAINER_NAME $STORAGE_ACCOUNT_KEY "passphrase-$i.json" $passphraseUri

	# Keep track of generated address for injecting to smart contract and for admin approval
	if [ -z $ADDRESS_LIST ]; then
		ADDRESS_LIST="\"$address\"";
		ADDRESS_LIST_FOR_CONTRACT="address($address)";
	else
		ADDRESS_LIST+=",\"$address\"";
		ADDRESS_LIST_FOR_CONTRACT+=", address($address)"
	fi

done

echo "address list: $ADDRESS_LIST";
echo "smart contract address list: $ADDRESS_LIST_FOR_CONTRACT";

# Sanity check on generated address list
if [ -z "$ADDRESS_LIST" ] || [ -z "$ADDRESS_LIST_FOR_CONTRACT" ];  then
	unsuccessful_exit "Generated address list should not be empty or null." 24;
fi

##################################################################################################
# Generate spec.json and admin list ( member deployment) 
# and upload to storage container
##################################################################################################
if [ "$Mode" == "Leader" ] || [ "$Mode" == "Single" ]; then
	generate_poa_spec "$ADDRESS_LIST_FOR_CONTRACT" "$STORAGE_ACCOUNT" "$CONTAINER_NAME" "$STORAGE_ACCOUNT_KEY" "$ETH_NETWORK_ID" "$NodeCount" "$INITIAL_VALIDATOR_ADMIN_ACCOUNT" "$TRANSACTION_PERMISSION_CONTRACT" "$BLOCK_GAS_LIMIT"
else
	make_address_list_available_for_download "$ADDRESS_LIST" "$STORAGE_ACCOUNT" "$CONTAINER_NAME" "$STORAGE_ACCOUNT_KEY"
	host_network_info_from_leader "$CONSORTIUM_DATA_URL"
fi


#################################################################
# Shutdown parity
################################################################
shutdown_parity

############### Orchestration Completed #########################
echo "Orchestration succeeded. Exiting";
exit 0;
