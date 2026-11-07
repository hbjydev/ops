# Cluster certificates

CFSSL creates a root certificate authority and one intermediate authority per cluster.
A certificate authority signs certificates that other systems can trust.
An intermediate authority receives its signing authority from the root.
cert-manager uses each intermediate to issue and renew service certificates.
No CFSSL server runs in Kubernetes.

The root lasts 3,650 days and allows one intermediate level.
Each intermediate lasts 1,825 days and cannot issue further authorities.
Both use ECDSA P-256 keys.
The cluster name identifies the intended owner but does not restrict certificate names cryptographically.
Keep certificate issuance permissions restricted to trusted operators.

1Password stores the private keys.
The root lives in the `ops-pki` vault, and each intermediate lives in its `cluster-<name>` vault.
Only public certificates remain under `pki/certs/`.
Commit those public certificates so that clients can obtain a reviewed trust anchor, the certificate they trust directly.
Keep cluster automation out of the root vault.

## Prepare your workstation

Run these commands on your workstation from the repository root.
You need mise, Bash, OpenSSL, and the 1Password CLI.
mise supplies CFSSL, jq, and usage.
OpenSSL only inspects certificates and keys here. CFSSL generates and signs them.
Sign in through the 1Password desktop integration or your existing CLI session.

```sh
cd pki
mise install cfssl@1.7.1 jq@1.8.2 usage@7.2.0
op whoami
op vault list
```

If a required vault is missing, create it with the corresponding command:

```sh
op vault create ops-pki
op vault create cluster-phoebe
op vault create cluster-rhea
```

The following commands assume that your current directory is `pki/`.
The tasks never create vaults, delete existing items, or replace an existing authority.
Run one authority creation command at a time because 1Password permits duplicate item titles.
The tasks reject existing titles but cannot prevent concurrent writers from creating duplicates.

The executable `pki` uses `usage` comments to define its arguments and help.
The mise tasks call this Bash script.
With the mise tools on your path, you can also run it directly:

```sh
./pki --help
./pki root --help
./pki intermediate --help
```

## Create the root

Read `root.json` before creating the root.
The task sets the certificate name from the generation argument.
It creates a new key rather than importing an SSH key.

```sh
mise run root:create
```

This command creates `ops-pki/root-v1` with three fields: `certificate`, `private-key`, and `chain`.
The private key uses a concealed field.
The task reads each saved field back before it writes public certificates to `certs/root-v1.pem` and `certs/root-v1-chain.pem`.
It never prints the key or passes the key through command arguments.

The task uses private temporary files while OpenSSL inspects the generated key.
Intermediate creation also uses a temporary copy of the root key while CFSSL signs.
Temporary directories use mode `0700`, and files use mode `0600`.
Bash traps remove these files on normal exit, command failure, interrupt, or termination signals.
A forced kill or power loss can leave temporary files behind.

For temporary files backed by memory on Linux, set `TMPDIR` before running the tasks:

```sh
export TMPDIR=/dev/shm
```

Use this only when `/dev/shm` is writable on your workstation.
This avoids ordinary filesystem storage but does not guarantee exclusion from swap or process memory dumps.

## Create cluster intermediates

Read `signing.json` before issuing an intermediate.
The `cluster-ca` profile controls its lifetime and prohibits subordinate authorities.
The task refuses issuance when the intermediate lifetime exceeds the remaining root lifetime.

```sh
mise run intermediate:create phoebe
mise run intermediate:create rhea
```

These commands create `cluster-phoebe/ca-phoebe-v1` and `cluster-rhea/ca-rhea-v1` in 1Password.
Their fields are `certificate`, `private-key`, and `chain`.
Each chain contains the intermediate first, followed by the root.
Public copies appear as `certs/ca-<cluster>-v1.pem` and `certs/ca-<cluster>-v1-chain.pem`.

On your workstation, make sure that each intermediate chains to the root:

```sh
openssl verify -CAfile certs/root-v1.pem certs/ca-phoebe-v1.pem
openssl verify -CAfile certs/root-v1.pem certs/ca-rhea-v1.pem
openssl x509 -in certs/ca-phoebe-v1.pem -noout -subject -issuer -dates -ext basicConstraints
```

The constraint output must contain `CA:TRUE, pathlen:0`.
The generation tasks also test certificate chains and key matches before saving an authority.
If saving succeeds but local export fails, restore the public files without creating another authority:

```sh
mise run public:restore ops-pki root-v1
mise run public:restore cluster-phoebe ca-phoebe-v1
```

If a command fails during a 1Password operation, inspect the target item before retrying.
Do not delete an existing item to bypass the duplicate guard.
The item can contain the authority that the previous command already saved.

## Connect cert-manager later

The tasks above do not write to Kubernetes.
For each cluster, synchronize its 1Password item into a `kubernetes.io/tls` Secret named `service-ca` in the `cert-manager` namespace.
Map `private-key` to `tls.key` and `chain` to `tls.crt`.
Use your chosen secret synchronization controller for this mapping.

A `ClusterIssuer` is a cert-manager issuer available across namespaces.
Its CA Secret lives in the cluster resource namespace, normally `cert-manager`.
An `Issuer` instead reads a Secret in its own namespace.
After the Secret exists, use this resource for cluster-wide issuance:

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: internal-services
spec:
  ca:
    secretName: service-ca
```

Distribute `root-v1.pem` independently as the trusted public root.
Use service certificates with `duration: 2160h` and `renewBefore: 720h` as an initial policy.
These values mean a 90-day lifetime and renewal 30 days before expiry.
cert-manager does not prevent a service certificate from outliving its issuer.
Replace an expiring intermediate before issuing certificates that cross its expiry date.

Keep the Talos infrastructure authorities in the existing TOPF secrets workflow.
The intermediates in this directory serve applications only.
For database client authentication, define the intended trust boundary before sharing the service authority.

## Replace an intermediate

Start this process when the 180-day warning fires.
Keep the old intermediate and key until the migration succeeds.
Run the creation command on your workstation from `pki/`:

```sh
mise run intermediate:create phoebe --generation v2
```

If the root has insufficient lifetime, shorten the intermediate lifetime or migrate to a new root first.
The new item is `cluster-phoebe/ca-phoebe-v2`.
The root stays the same unless you explicitly choose another root with `--root`.

Perform these steps for the target cluster:

1. Make sure that clients trust the root and accept the new intermediate chain.
2. Update any clients that pin the old intermediate to trust both generations during the transition.
3. Change the Secret synchronization source to the new 1Password item.
4. Make sure that `service-ca` contains the new certificate and matching key.
5. Make sure that `internal-services` reports `Ready=True`.
6. Renew each affected cert-manager Certificate with `cmctl renew --namespace <namespace> <certificate-name>`.
7. Make sure that each renewed certificate contains the expected chain.
8. Reload or restart applications that do not reload their certificate files automatically.
9. Test connections from the clients that use each service.
10. Retire the old intermediate after all certificates and clients finish the migration.

Install `cmctl` on your workstation before step 6.
Use the target cluster context for every Kubernetes command.
Replacing the CA Secret alone does not trigger certificate reissuance.
See [the cert-manager CA issuer documentation](https://cert-manager.io/docs/configuration/ca/) for these limitations.

## Replace the root

Root replacement changes what clients trust.
Start this process well before the root expires.
Create a separate root generation on your workstation:

```sh
mise run root:create --generation v2
mise run intermediate:create phoebe --generation v3 --root root-v2
```

Distribute a trust bundle containing both roots before switching any issuer.
Use a new intermediate generation for each cluster.
Follow the intermediate replacement process for every cluster.
Remove the old root from trust bundles only after all dependent certificates finish migration.

## Set up expiry alerts

The repository does not yet deploy Prometheus or Alertmanager.
The examples in `monitoring/` require Prometheus Operator, Prometheus, and an Alertmanager receiver that delivers notifications to you.
Prometheus evaluates alert conditions, and Alertmanager routes notifications.
These files are examples, not resources included in Flux.

The examples assume the monitoring stack has the Helm release label `release: monitoring`.
They also assume the CA Secret is `cert-manager/service-ca`.
Adapt the labels to your Prometheus selectors before installation.
A selector determines which labeled resources a controller reads.

On your workstation, select the target cluster context.
From `pki/`, publish the root certificate and install the exporter:

```sh
kubectl -n cert-manager create configmap pki-root \
  --from-file=root.pem=certs/root-v1.pem --dry-run=client -o yaml | kubectl apply -f -
helm upgrade --install pki-certificates \
  oci://quay.io/enix/charts/x509-certificate-exporter \
  --version 4.2.4 --namespace monitoring --create-namespace \
  --values monitoring/exporter-values.yaml
kubectl apply -f monitoring/alerts.yaml
```

The exporter reads public certificates in `service-ca` and `pki-root`.
Kubernetes Secret permissions also grant access to private fields in the same Secret.
The exporter therefore needs protection even though the metrics contain no private keys.
See the [exporter chart documentation](https://github.com/enix/x509-certificate-exporter/tree/main/chart) for access controls.

The rules warn at 180 days for intermediates and 365 days for the root.
They raise critical alerts at 90 days for intermediates and 180 days for the root.
Missing certificate metrics also trigger an alert, including when the exporter stops producing them.
The exporter chart supplies additional alerts for source errors.

Complete these steps before relying on the alerts:

1. Make sure that Prometheus discovers the exporter ServiceMonitor and reports its target as healthy.
2. Make sure that Prometheus loads the `pki-authorities` rule group.
3. Query `x509_cert_not_after` and identify both certificates by their source labels.
4. Route alerts labeled `component=pki` to an existing Alertmanager receiver.
5. Add a temporary alert rule with `expr: vector(1)`, `for: 1m`, and the same routing labels.
6. Make sure that the test notification reaches your chosen destination.
7. Remove the temporary rule after the notification arrives.
8. Test the missing-metric rule with a temporary copy that selects a nonexistent Secret.
9. Make sure that the missing-metric notification arrives before removing that temporary rule.

Keep the root ConfigMap current during root migration, with both roots present during the overlap.
For each alert, use the replacement procedures above and inspect the named certificate before acting.
These alerts do not monitor Talos infrastructure certificates or service certificate renewal failures.
Configure those alerts separately through the relevant monitoring components.

## Test the workflow

Run the tests on your workstation from `pki/`.
The tests create disposable certificates with the pinned CFSSL binary.
A Bash test double stores disposable 1Password items in a temporary directory.
The tests never contact your vaults.

```sh
mise exec -- ./tests/workflow
mise exec -- shellcheck pki tests/workflow tests/bin/op
```

The tests exercise the certificate chain, duplicate protection, expiry limits, and public certificate restoration.
They also exercise argument parsing, mise forwarding, 1Password failures, and temporary file removal.
Live 1Password authentication and Kubernetes deployment need separate testing during setup.
The implementation follows [CFSSL](https://github.com/cloudflare/cfssl) and the [1Password JSON item workflow](https://www.1password.dev/cli/item-create).
