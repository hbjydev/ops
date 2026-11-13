# Rhea

My testing cluster (for now), used as a testbed.

## Local storage

Miroir stores local volumes as files under `/var/lib/miroir` on the existing system disk.
Its `loopfile` backend presents each file as a block device.
The Talos image supports this backend without additional extensions or disk partitions.

The default storage class is `miroir-local`, with one copy of each volume and an ext4 filesystem.
A persistent volume claim (PVC) requests storage for an application.
Miroir creates the volume when Kubernetes schedules a pod that uses the claim.
Deleting the claim deletes its volume.
The `miroir-snap` class supports snapshots, which capture a volume at a point in time.

The controller limits total requested volume sizes to 39% of the filesystem capacity, approximately 24 GiB on this VM.
The chart accepts only integer ratios, so `extraArgs` supplies `--overcommit-ratio=0.39` after the generated flag.
The `freeSpaceRatio: 1` value also prevents a new volume request from exceeding the current free space.
These limits control storage requests, not total disk usage.
Snapshots, container images, logs, and Talos share the remaining space.
Snapshots remain on the same disk and do not protect against disk loss.

The controller configuration is in `kube/deploy/apps/rhea/miroir-system/miroir/controller.yaml`.
Application Kustomizations can depend on `miroir-config` in the `miroir-system` namespace.
Flux deploys the controller before the node, storage class, and snapshot class resources.

The upstream [single-node example](https://miroir.home-operations.com/quickstart/#1-describe-your-storage)
and [Talos requirements](https://miroir.home-operations.com/requirements/#node-setup-by-os) describe the backend requirements.

## Towonel relay

The Iroh relay runs on Rhea with host networking, which shares the node network with the pod.
Its public URL is `https://relay.towonel.thighhighs.moe:8444`.
The hub already uses port `8443`, so the relay uses `8444`.
The hub and edge both use this relay URL.

Allow inbound TCP `8444` and UDP `7842` through any firewall in front of Rhea.
ExternalDNS creates an unproxied A record for `relay.towonel.thighhighs.moe` pointing to `193.160.32.161`.
Flux waits for `cloudflare-dns` and `core-cert-manager-letsencrypt` before it deploys the relay.
The `network` namespace permits host networking for the hub and relay through its privileged Pod Security label.

Cert-manager supplies the TLS certificate through the `iroh-relay-tls` Secret.
The relay reloads renewed certificates from the mounted Secret directory.
It needs no persistent storage volume.
The configuration follows the [Towonel relay guide](https://towonel.dev/docs/self-hosted/relay/).
