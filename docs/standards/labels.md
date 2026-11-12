# Labels

Labels are used for conditional policy attachment and mutation/patching within
all clusters managed by this repository. This document lays out the
specification for how those labels are written and where they should be
applied.

Labels defined and governed by this repository use a domain name-style format,
where the label will look like:

```
*.<category>.home.arpa/*
```

This explicitly allows for 'subdomains' of categories, while still allowing the
use of the subdomain directly for use cases where a subdomain would be
unnecessary (such as the `trust.home.arpa` namespace that governs PKI).

Some examples of valid labels per this specification would be:

- `egress.netpol.home.arpa/internet`
- `ingress.netpol.home.arpa/apiserver`
- `trust.home.arpa/inject`
- `trust.home.arpa/profile`
- `network.home.arpa/iot`
- `network.home.arpa/management`

When new labels (or label structures for more dynamic labels) are created, they
should be documented below.

## Label Reference

| Label | Description | Relevant To | Allowed values |
| ----- | ----------- | ----------- | -------------- |
| `kustomization.flux.home.arpa/defaults` | Skip parent defaults for a Kustomization that defines its own behavior. | Flux Kustomizations | `disabled` |
| `trust.home.arpa/inject` | Whether or not to inject the trusted root bundle into this pod. | Pods | `true` (default), `false` |
| `trust.home.arpa/profile` | Defines that the pod should use a well-known 'profile' for injecting trust roots | Pods | `default` (default), `node`, `python`, `curl` |
| `egress.netpol.home.arpa/apiserver` | Allow outgoing Kubernetes API traffic, including local-host TCP 6443. | Pods | `allow` |
| `egress.netpol.home.arpa/cloudflare-dns` | Allow DNS over HTTPS to Cloudflare resolvers on TCP 443. | Pods | `allow` |
| `egress.netpol.home.arpa/cluster` | Allow outgoing traffic to all cluster endpoints and nodes. | Pods | `allow` |
| `egress.netpol.home.arpa/host` | Allow outgoing traffic to the local node. | Pods | `allow` |
| `egress.netpol.home.arpa/talos-api` | Allow outgoing TCP 50000 and 50001 to local and remote nodes. | Pods | `allow` |
| `egress.netpol.home.arpa/world` | Allow outgoing traffic outside the cluster, including private networks. | Pods | `allow` |
| `egress.netpol.home.arpa/world-https` | Allow outgoing TCP and UDP 443 outside the cluster. | Pods | `allow` |
| `egress.netpol.home.arpa/internet` | Allow outgoing IPv4 traffic except the three private ranges defined in the policy. | Pods | `allow` |
| `egress.netpol.home.arpa/internet-https` | Allow outgoing TCP and UDP 443 with the same IPv4 exclusions. | Pods | `allow` |
| `ingress.netpol.home.arpa/apiserver` | Allow incoming traffic from the Kubernetes API server. | Pods | `allow` |
| `ingress.netpol.home.arpa/cluster` | Allow incoming traffic from all cluster endpoints and nodes. | Pods | `allow` |
| `ingress.netpol.home.arpa/host` | Allow incoming traffic from the local node. | Pods | `allow` |
| `ingress.netpol.home.arpa/world` | Allow incoming traffic from outside the cluster, including private networks. | Pods | `allow` |
| `ingress.netpol.home.arpa/internet` | Allow incoming IPv4 traffic except the three private ranges defined in the policy. | Pods | `allow` |
| `egress.netpol.home.arpa/lan` | Allow outgoing traffic to Phoebe’s `lan` CIDR group. | Pods on Phoebe | `allow` |
| `egress.netpol.home.arpa/iot` | Allow outgoing traffic to Phoebe’s `iot` CIDR group. | Pods on Phoebe | `allow` |
| `egress.netpol.home.arpa/management` | Allow outgoing traffic to Phoebe’s `management` CIDR group. | Pods on Phoebe | `allow` |
| `egress.netpol.home.arpa/infra` | Allow outgoing traffic to Phoebe’s `infra` CIDR group. | Pods on Phoebe | `allow` |
| `egress.netpol.home.arpa/nas` | Allow outgoing traffic to Phoebe’s `nas` CIDR group. | Pods on Phoebe | `allow` |
| `ingress.netpol.home.arpa/lan` | Allow incoming traffic from Phoebe’s `lan` CIDR group. | Pods on Phoebe | `allow` |
| `ingress.netpol.home.arpa/iot` | Allow incoming traffic from Phoebe’s `iot` CIDR group. | Pods on Phoebe | `allow` |
| `ingress.netpol.home.arpa/management` | Allow incoming traffic from Phoebe’s `management` CIDR group. | Pods on Phoebe | `allow` |
| `ingress.netpol.home.arpa/infra` | Allow incoming traffic from Phoebe’s `infra` CIDR group. | Pods on Phoebe | `allow` |
| `ingress.netpol.home.arpa/nas` | Allow incoming traffic from Phoebe’s `nas` CIDR group. | Pods on Phoebe | `allow` |
| `ingress.netpol.home.arpa/internal` | Allow incoming traffic from the `internal` Envoy gateway. | Pods on Phoebe | `allow` |
| `ingress.netpol.home.arpa/external` | Allow incoming traffic from the `external` Envoy gateway. | Pods on Phoebe | `allow` |
| `egress.netpol.home.arpa/sonarr` | Allow outgoing traffic to `sonarr` on its configured service ports. | Pods on Phoebe | `allow` |
| `egress.netpol.home.arpa/radarr` | Allow outgoing traffic to `radarr` on its configured service ports. | Pods on Phoebe | `allow` |
| `egress.netpol.home.arpa/lidarr` | Allow outgoing traffic to `lidarr` on its configured service ports. | Pods on Phoebe | `allow` |
| `egress.netpol.home.arpa/prowlarr` | Allow outgoing traffic to `prowlarr` on its configured service ports. | Pods on Phoebe | `allow` |
| `egress.netpol.home.arpa/sabnzbd` | Allow outgoing traffic to `sabnzbd` on its configured service ports. | Pods on Phoebe | `allow` |
| `egress.netpol.home.arpa/qbittorrent` | Allow outgoing traffic to `qbittorrent` on its configured service ports. | Pods on Phoebe | `allow` |
| `egress.netpol.home.arpa/slskd` | Allow outgoing traffic to `slskd` on its configured service ports. | Pods on Phoebe | `allow` |
| `egress.netpol.home.arpa/seerr` | Allow outgoing traffic to `seerr` on its configured service ports. | Pods on Phoebe | `allow` |
| `egress.netpol.home.arpa/searxng` | Allow outgoing traffic to `searxng` on its configured service ports. | Pods on Phoebe | `allow` |
| `egress.netpol.home.arpa/smtp-relay` | Allow outgoing traffic to `smtp-relay` on its configured service ports. | Pods on Phoebe | `allow` |
| `egress.netpol.home.arpa/litellm` | Allow outgoing traffic to `litellm` on its configured service ports. | Pods on Phoebe | `allow` |
| `egress.netpol.home.arpa/honcho` | Allow outgoing traffic to `honcho` on its configured service ports. | Pods on Phoebe | `allow` |
| `egress.netpol.home.arpa/memini` | Allow outgoing traffic to `memini` on its configured service ports. | Pods on Phoebe | `allow` |

Apply network labels to pod templates. Labels on a HelmRelease or Deployment alone do not select its pods.

The `internet` policies exclude `10.0.0.0/8`, `172.16.0.0/12`, and `192.168.0.0/16`. They do not define all public addresses or include IPv6. See [the network policy standard](netpols.md) for enforcement behavior.

The `cloudflare-dns` label allows TCP 443 to `1.1.1.1`, `1.0.0.1`, `1.1.1.2`, `1.0.0.2`, `1.1.1.3`, and `1.0.0.3`. These are Cloudflare's standard and Families IPv4 resolvers. It grants destination and port access, without restricting HTTP paths. It does not grant IPv6, plain DNS, or DNS over TLS access. [Cloudflare endpoints](https://developers.cloudflare.com/1.1.1.1/infrastructure/network-operators/)

CoreDNS uses this label with the standard resolver pair. ACME automates certificate issuance. When an ACME issuer is configured, add the label to cert-manager's controller `podLabels`. DNS01 uses a DNS record to prove domain control. The configured DNS01 resolvers already use HTTPS, but certificate-authority and DNS-provider API access need separate allowances.
