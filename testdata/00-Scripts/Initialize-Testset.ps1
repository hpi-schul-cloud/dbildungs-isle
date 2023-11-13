# .SYNOPSIS
#   Runs a script on a cluster DB. Clears the DB and uses DB-Migration-Tooling beforehand. No Previous data are kept.
param(
    [Parameter(Mandatory)]$DBScriptPath
)
Set-Variable -Option Constant -Name DBParamSecret -Value 'db-params'
Set-Variable -Option Constant -Name SPSHSecret -Value 'spsh-config'
Set-Variable -Option Constant -Name ScriptConfigMap -Value 'test-data-config-map'

function Test-Secret
{
    param(
        $secretName
    )
    if (kubectl get secret $secretName)
    {
        return $true;
    }
    return $false;
}

Push-Location
try
{
    if (-Not(Test-Path -IsValid -PathType Leaf $DBScriptPath))
    {
        throw "Could not find DB-Script $DBScriptPath"
    }
    if ($null -eq (Get-Command "kubectl" -ErrorAction SilentlyContinue))
    {
        throw new "Could not find kubectl"
    }

    if (-Not(Test-Secret $DBParamSecret))
    {
        throw "Secret: $DBParamSecret not in cluster"
    }

    if (-Not(Test-Secret $SPSHSecret))
    {
        throw "Secret: $SPSHSecret not in cluster"
    }

    kubectl delete --ignore-not-found configmap $ScriptConfigMap | Out-Null


    kubectl create configmap test-data-config-map --from-file $DBScriptPath | Out-Null
    $jobName = (kubectl apply -f apply_to_cluster.yaml -o 'template={{.metadata.name}}')
    try
    {
        if (kubectl wait job $jobName --for 'condition=complete' --timeout=60s)
        {
            kubectl logs --all-containers --prefix --selector "job-name=$jobName" --tail=-1 | Write-Error
            throw "Job did not complete in 30 seconds"
        }
        kubectl logs --all-containers --prefix --selector job-name=$jobName | Out-Host
    }
    finally
    {
        #kubectl delete job $jobName
    }

}
finally
{
    Pop-Location
}