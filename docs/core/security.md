# Security

## Network Security

Core supplies additive Cilium network policies for DNS, labelled traffic and
controller-specific connections. These allowances explicitly avoid enabling
default-deny; the blanket default-deny policy is excluded from the deployment.
Existing workload policies can still isolate their selected endpoints. See
[Network Policies](../standards/netpols.md) for how to select allowances.
