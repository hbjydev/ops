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
| `trust.home.arpa/inject` | Whether or not to inject the trusted root bundle into this pod. | Pods | `true` (default), `false` |
| `trust.home.arpa/profile` | Defines that the pod should use a well-known 'profile' for injecting trust roots | Pods | `default` (default), `node`, `python`, `curl` |
| `egress.netpol.home.arpa/apiserver` | Allow outgoing Kubernetes API traffic, including local-host TCP 6443. | Pods | `allow` |
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

Apply network labels to pod templates. Labels on a HelmRelease or Deployment alone do not select its pods.

The `internet` policies exclude `10.0.0.0/8`, `172.16.0.0/12`, and `192.168.0.0/16`. They do not define all public addresses or include IPv6. See [the network policy standard](netpols.md) for enforcement behavior.
