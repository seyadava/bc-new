Set-Location ${PSScriptRoot}

# Start ganache-cli w/ mnemonic as Job
Start-Job -Name "ganache-cli" {ganache-cli -l 0xBEBC200 -g 0 -m "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat"}

Try {
    # Runs Solidity Smart Contract tests
    truffle.cmd test --network development
}
Catch {
    throw $_.Exception
    Break
}
Finally {
    # Stop & Remove ganache-cli Job
    Stop-Job -Name "ganache-cli"
    Remove-Job -Name "ganache-cli"
}