# Be sure to add a reference to this file in the head of ..\ValidatorNode.psm1

function test-Validators_MultiMember {
    Param(
        [Parameter(Mandatory = $true)][System.Collections.ArrayList] $validatorNodeList,
        [Parameter(Mandatory = $true)][String] $leaderAdminPublicKey,
        [Parameter(Mandatory = $true)][String] $member1AdminPublicKey,
        [Parameter(Mandatory = $true)][String] $member2AdminPublicKey,
        [Parameter(Mandatory = $true)][String] $leaderAdminPrivateKey,
        [Parameter(Mandatory = $true)][String] $member1AdminPrivateKey,
        [Parameter(Mandatory = $true)][String] $member2AdminPrivateKey,
        [Parameter(Mandatory = $true)][String] $leaderResourceGroupName,
        [Parameter(Mandatory = $true)][String] $member1ResourceGroupName,
        [Parameter(Mandatory = $true)][String] $member2ResourceGroupName
    )
    Write-Host "Starting Test - Multi Member Validator Contract"
    $testNode = $validatorNodeList[0];
    Write-Host "  Initial Testing Node: ${testNode}"
    
    # Propose the new admin for Member 1
    Write-Host "  Proposing to add $member1AdminPublicKey as a new admin"
    $proposeTransactionHash = $testNode.ProposeAdmin($leaderAdminPublicKey, $member1AdminPublicKey, "Member 1", $leaderAdminPrivateKey)
    $proposeTransactionReceipt = $testNode.GetMinedTransactionReceipt($proposeTransactionHash)
    Write-Host "  Proposed in Block#: $($proposeTransactionReceipt.blockNumberInt), Transaction #: $proposeTransactionHash"
    Start-Sleep 10

    # Propose the new admin for Member 2
    Write-Host "  Proposing to add $member2AdminPublicKey as a new admin"
    $proposeTransactionHash = $testNode.ProposeAdmin($leaderAdminPublicKey, $member2AdminPublicKey, "Member 2", $leaderAdminPrivateKey)
    $proposeTransactionReceipt = $testNode.GetMinedTransactionReceipt($proposeTransactionHash)
    Write-Host "  Proposed in Block#: $($proposeTransactionReceipt.blockNumberInt), Transaction #: $proposeTransactionHash"
    Start-Sleep 10

    # Vote the new admin for Member 2
    Write-Host "  Vote to add $member2AdminPublicKey as a new admin"
    $proposeTransactionHash = $testNode.VoteForAdmin($member1AdminPublicKey, $member2AdminPublicKey, $member1AdminPrivateKey)
    $proposeTransactionReceipt = $testNode.GetMinedTransactionReceipt($proposeTransactionHash)
    Write-Host "  Voted in Block#: $($proposeTransactionReceipt.blockNumberInt), Transaction #: $proposeTransactionHash"

    # Create a list of validators and add the current leader's validators
    $memberValidatorAccounts = New-Object System.Collections.ArrayList
    $memberValidatorAccounts.AddRange($testNode.getValidators())

    # Add Member 1 Validators to the contract ----------
    $member1Validators = (Add-ResourceGroup-Validators `
            -validatorNode $testNode `
            -resourceGroupName $member1ResourceGroupName `
            -adminPublicKey $member1AdminPublicKey `
            -adminPrivateKey $member1AdminPrivateKey)
    $memberValidatorAccounts.AddRange($member1Validators)

    # Add Member 2 Validators to the contract ----------
    $member2Validators = (Add-ResourceGroup-Validators `
            -validatorNode $testNode `
            -resourceGroupName $member2ResourceGroupName `
            -adminPublicKey $member2AdminPublicKey `
            -adminPrivateKey $member2AdminPrivateKey)
    $memberValidatorAccounts.AddRange($member2Validators)

    # Give time for all validators to mine a block
    Start-Sleep 60
    # Get the current list of validators from the contract
    $validators = $testNode.GetValidators()
    
    # Get the last (#NumValidators * 2) blocks so each validator should have a chance to mine in the round robin election process
    $currentBlockNumber = $testNode.CurrentBlockNumber()
    $miners = New-Object System.Collections.Generic.HashSet[string]

    For ($i = $currentBlockNumber; $i -gt ($currentBlockNumber - ($memberValidatorAccounts.Count * 2)); $i--) {
        $miners.Add($testNode.GetBlock($i).miner)
    }
       
    # Loop over each validator account
    foreach ($eachValidator in $memberValidatorAccounts) {
        # Make sure each validator got added to the contract
        if (-not $validators.Contains($eachValidator)) {
            throw [System.Exception] "Validator $eachValidator not found in getValidators() function call to the contract"
        }
        # Make sure each validator is in the miner list
        if (-not $miners.Contains($eachValidator)) {
            throw [System.Exception] "Validator $eachValidator did not mine a block"
        }    
    }

    Write-Host "End Test - Multi Member Validator Contract"
}

function Add-ResourceGroup-Validators {
    param (
        [Parameter(Mandatory = $true)][ValidatorNode] $validatorNode,
        [Parameter(Mandatory = $true)][String] $resourceGroupName,
        [Parameter(Mandatory = $true)][String] $adminPublicKey,
        [Parameter(Mandatory = $true)][String] $adminPrivateKey
    )
    # Get information about all the blobs in the storage account
    $storageBlobs = (Get-AllAzureStorageBlobs -resourceGroupName $resourceGroupName)
    # Does AddressList.json file exist
    $addressListBlob = ($storageBlobs | Where-Object {$_.Name -like "AddressList.json"})
    if ($null -eq $addressListBlob) {throw [System.Exception] "AddressList.json file not found"}
    if ($addressListBlob.ICloudBlob.Properties.Length -eq 0) {throw [System.Exception] "AddressList.json file is blank"}
    $validatorPublicKeys = ($addressListBlob.ICloudBlob.DownloadText() | ConvertFrom-Json)
   
    $validatorAccounts = New-Object System.Collections.ArrayList
    $validatorAccounts.AddRange($validatorPublicKeys.addresses);
    
    # Add validators to the contract
    foreach ($eachValidator in $validatorAccounts) {
        Start-Sleep 20
        $addTransaction = $validatorNode.AddValidator($adminPublicKey, $eachValidator, $adminPrivateKey)
        $addTransactionReceipt = $validatorNode.GetMinedTransactionReceipt($addTransaction)
        Write-Host "  Added validator $eachValidator in Block#: $($addTransactionReceipt.blockNumberInt), Transaction #: $proposeTransactionHash"
    }
    
    return $validatorAccounts
}

Export-ModuleMember -Function test-Validators_MultiMember