# Security

## Network Security

The clusters provisioned here are protected by a series of Cilium network
policies, enforced by rejecting egress and ingress traffic by default, requiring
that applications provide network policies by any of the allowed methods in
[Network Policies](../standards/netpols.md).
