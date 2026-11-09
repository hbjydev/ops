# Network Policies

## Naming Convention

All network policies are named via a convention for ease of reading:

```
np-<type>-<action>-<description>
```

| Field | Description | Allowed Values |
| ----- | ----------- | -------------- |
| `type` | The type of policy this is, in reference to what direction of traffic this policy governs. | `e` for egress, `i` for ingress, and `x` for bidirectional |
| `action` | What action this policy configures. | `a` for allow, `d` for deny. |
| `description` | A short slug to describe this policy. | Any short, URL-safe value. |

Some examples of policy names:

- `np-e-a-hubble-ui-to-relay`: Egress (`e`) policy allowing (`a`) Hubble UI to talk to Hubble Relay (`hubble-ui-to-relay`).
- `np-i-a-silo-internet`: Ingress (`i`) policy allowing (`a`) Silo to talk to the internet (`silo-internet`).
- `np-x-a-cnpg-cluster-nodes`: Bidirectional (`x`) policy allowing (`a`) Cloudnative-PG nodes within the same cluster to talk to each other (`cnpg-cluster-nodes`).

## Application

Policies can be applied in one of three ways:

- Explicit purpose (specifying the affected resources in their manifests)
- Apply-by-default (such as those in `core`)
- Apply-by-label (apply the netpol to a pod by adding a `<ingress|egress|...>.netpol.home.arpa/<to>=<allow|deny>` label to it)

### Apply-by-label notes

The current label policies support `allow`. A `deny` value does not select a deny rule and does not override other allowances.

Apply these labels to pod templates, including installation, upgrade, and deletion jobs. See [the label reference](labels.md) for supported keys.

Standard allowances set `enableDefaultDeny` to `false` for their traffic direction. This lets operators stage labels without enabling isolation. A separate default-deny policy determines when unmatched traffic is blocked.

The deployment resource list includes DNS and label-based allowances. It excludes `default-deny.yaml` and `kube-system-allow-all.yaml`.

Allow rules combine their permissions. A broad `cluster`, `host`, or `world` label grants more access than an individual service usually needs. Use specific peer and port rules for internal service connections.

### Host scope

This baseline governs Cilium-managed pods. It does not change the host firewall or govern pods that use host networking. On rhea, the Kubernetes control-plane processes and Cilium agent/operator use host networking. CoreDNS and Hubble remain within the pod policy scope.
