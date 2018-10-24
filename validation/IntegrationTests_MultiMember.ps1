param (
    [String]$leaderResourceGroupName,
    [String]$member1ResourceGroupName,
    [String]$member2ResourceGroupName,
    [String]$leaderSshPassword, # The account name can be looked up from the deployment parameters
    [String]$member1SshPassword,
    [String]$member2SshPassword,
    [String]$leaderAdminPublicKey,
    [String]$member1AdminPublicKey,
    [String]$member2AdminPublicKey,
    [String]$leaderAdminPrivateKey,
    [String]$member1AdminPrivateKey,
    [String]$member2AdminPrivateKey,
    [int]$remoteRpcPort = 8540
)

# Output the current PowerShell Version for informational purposes
Write-Output "PowerShell Version Installed"
$PSVersionTable.PSVersion
Write-Output "Node Version Installed"
node --version

Set-Location ${PSScriptRoot}

################################################
# Initialize SSH modules
################################################
if (Get-Module -ListAvailable -Name PoSH-SSH) {
    Write-Host "PoSH-SSH module exists"
}
else {
    Write-Host "PoSH-SSH module does not exist... Installing now"
    Install-Module -name PoSH-SSH -Force -Scope CurrentUser
}
Import-Module PoSH-SSH 

################################################
# Load misc modules
################################################

# Add path to the "./modules" folder to the search path in order to load custom modules
Write-Output "Current PS Module Paths: $env:PsModulePath"
$modulePath = "${PSScriptRoot}\modules"
if (-Not($env:PsModulePath.Contains($modulePath))) {
    $env:PsModulePath = "${env:PsModulePath};$modulePath"
    Write-Output "New PS Module Paths: $env:PsModulePath"
}

Import-Module ValidatorNode -Verbose -Force
Import-Module AzureStorage -Verbose -Force
Import-Module Pester -Verbose -Force

################################################
# Misc Functions
################################################


################################################
# Test Functions
################################################


#################################################################################################################
################################################ Start of Script ################################################
#################################################################################################################


################################################
# Get Deployment information
################################################
$leaderDeploymentGroup = (Get-AzureRmResourceGroupDeployment -ResourceGroupName $leaderResourceGroupName)[-1]
if ($null -eq $leaderDeploymentGroup) {
    throw [System.Exception] "Could not load information about the Leader Resource Group deployments"
}
$leaderSshUsername = $leaderDeploymentGroup.Parameters['adminUsername'].Value

$member1DeploymentGroup = (Get-AzureRmResourceGroupDeployment -ResourceGroupName $member1ResourceGroupName)[-1]
if ($null -eq $member1DeploymentGroup) {
    throw [System.Exception] "Could not load information about the Member1 Resource Group deployments"
}
$member1SshUsername = $member1DeploymentGroup.Parameters['adminUsername'].Value

$member2DeploymentGroup = (Get-AzureRmResourceGroupDeployment -ResourceGroupName $member2ResourceGroupName)[-1]
if ($null -eq $member2DeploymentGroup) {
    throw [System.Exception] "Could not load information about the Member2 Resource Group deployments"
}
$member2SshUsername = $member2DeploymentGroup.Parameters['adminUsername'].Value

$numOfNodes = $leaderDeploymentGroup.Parameters['numVLNodesRegion'].Value


################################################
# Loop over each deployed region and node and add to the $nodeList
################################################

# Get public IPs in order to loop over each deployed region
$allPublicIps = Get-AzureRmPublicIpAddress -ResourceGroupName $leaderResourceGroupName
$loadBalancerIPs = $allPublicIps | Where-Object {$_.DnsSettings -ne $null -and $_.IpConfiguration.Id -like "*/loadBalancers*"}
if ($null -eq $loadBalancerIPs -or $loadBalancerIPs.Length -eq 0) {
    throw [System.Exception] "Cannot find any deployed public IP addresses"
}

$leaderNodeList = New-Object System.Collections.ArrayList

$PortToForwardToRpc = 4100

Try {
    # Loop over each deployed region
    $regionLoop = 0
    foreach ($deployedIP in $loadBalancerIPs) {
        # Loop over each node in a region
        For ($nodeNumber = 0; $nodeNumber -lt $numOfNodes; $nodeNumber++) {
            $validatorNode = New-ValidatorNode `
                -port (4000 + $nodeNumber) `
                -remoteRpcPortNumber $remoteRpcPort `
                -portToForwardToRpc ($PortToForwardToRpc + $regionLoop + $nodeNumber) `
                -hostName $deployedIP.DnsSettings.Fqdn `
                -userName $leaderSshUsername `
                -password $leaderSshPassword
            $leaderNodeList.Add($validatorNode) > $null # Send to null to prevent output of index location printing to 
        }
        $regionLoop += 100
    }

    # Begin Tests
    test-Validators_MultiMember -validatorNodeList $leaderNodeList `
        -leaderAdminPublicKey $leaderAdminPublicKey `
        -member1AdminPublicKey $member1AdminPublicKey `
        -member2AdminPublicKey $member2AdminPublicKey `
        -leaderAdminPrivateKey $leaderAdminPrivateKey `
        -member1AdminPrivateKey $member1AdminPrivateKey `
        -member2AdminPrivateKey $member2AdminPrivateKey `
        -leaderResourceGroupName $leaderResourceGroupName `
        -member1ResourceGroupName $member1ResourceGroupName `
        -member2ResourceGroupName $member2ResourceGroupName
}
Catch {
    throw $_.Exception
    Break
}
Finally {
    foreach ($eachValidatorNode in $leaderNodeList) {
        $eachValidatorNode.CloseSshSession()
    }
}