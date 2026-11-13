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

The Iroh relay runs on Rhea with pod networking.
Its public URL is `https://relay.towonel.thighhighs.moe:8443`.
Fixed NodePorts expose TCP `8443` and UDP `7842` on the node.
The Service uses `externalTrafficPolicy: Local` to preserve client addresses for discovery.
The hub and edge both use this relay URL.

Allow inbound TCP `8443` and UDP `7842` through any firewall in front of Rhea.
ExternalDNS creates an unproxied A record for `relay.towonel.thighhighs.moe` pointing to `193.160.32.161`.
Flux waits for `core-cilium`, `cloudflare-dns`, and `core-cert-manager-letsencrypt` before it deploys the relay.

Talos and Cilium use the NodePort range `7842-51820` on Rhea.
Apply `kube/clusters/rhea/talos/control-plane/01-api-server.yaml` before deploying these Services.
Cilium reserves this range against temporary outbound ports because it overlaps the default ephemeral range.
The range permits port allocation; only configured Services expose ports.

Cert-manager supplies the TLS certificate through the `iroh-relay-tls` Secret.
The relay reloads renewed certificates from the mounted Secret directory.
It needs no persistent storage volume.
The configuration follows the [Towonel relay guide](https://towonel.dev/docs/self-hosted/relay/).

## Towonel ingress

Envoy listens on public TCP port `443` and selects a listener from the TLS hostname.
The `towonel-hayden` and `towonel-thighhighs` listeners forward encrypted traffic for `*.hayden.moe` and `*.thighhighs.moe` to the Towonel edge.
The `towonel-edge` TLSRoute uses Service `towonel-hub` on port `4443`.
Its BackendTrafficPolicy adds a PROXY v2 header, which carries the original client address.

The exact hostname `towonel.thighhighs.moe` uses a separate HTTPS listener and takes precedence over the wildcard listener.
Envoy terminates TLS with a cert-manager certificate and forwards HTTP to the hub API on port `8443`.
The existing `https` listener handles only `rhea.hayden.moe`.
The PROXY v2 policy applies only to the edge TLSRoute.
Both traffic policies on the Envoy Service use `Local`.
Matching policies allow pods on Rhea to reach the gateway through its public IP with Cilium.

Towonel runs with pod networking, and its internal listeners bind to the pod interfaces.
The Helm post-renderer overrides the chart's forced host networking.
The edge listens on TCP `4443` and `8081`, and the API and hub link use TCP `8443` and `51444`.
The hub and edge trust proxy headers from the cluster pod range.
A fixed NodePort exposes edge UDP `51820` directly with `externalTrafficPolicy: Local`.
The hub API uses a separate pod address, so its internal TCP `8443` does not conflict with the relay.

Point application DNS records at Rhea to use these passthrough routes.
ExternalDNS manages the hub API hostname through its HTTPRoute, but this change does not create wildcard DNS records.
Flux waits for the hub and gateway deployments before it applies `towonel-hub-routes`.

## Network policies

Cilium policies restrict ingress and egress for the hub, relay, and external Envoy proxy pods.
Envoy accepts public HTTP and HTTPS traffic and reaches the Towonel backends and its controller.
Only Envoy reaches the hub API and edge TCP listener through the pod network.
The edge accepts UDP `51820`, and the relay accepts TCP `8443` and UDP `7842`.

Towonel reaches the local relay and external HTTPS services.
Its UDP egress permits arbitrary external peer ports because NAT can change the ports that agents advertise.
The relay needs no new outbound connections; Cilium permits replies to accepted connections.
The existing cluster policy permits DNS queries to CoreDNS for all three workloads.
Health probes and labeled monitoring pods can reach the relevant health and metrics ports.
